import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { createAnthropicResponsesPort } from "@/server/generation/anthropic-client";
import { technicalSpecificationSchema } from "@/server/generation/schemas";

import { specWithWords } from "./helpers";

const request = {
  documentType: "specification" as const,
  prompt: "fixture",
  schema: technicalSpecificationSchema,
};

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg_123",
    model: "claude-opus-4-8",
    content: [{ type: "text", text: JSON.stringify(specWithWords(30)) }],
    stop_reason: "end_turn",
    ...overrides,
  };
}

it("parses Claude structured output through the requested schema", async () => {
  const create = vi.fn().mockResolvedValue(message());
  const port = createAnthropicResponsesPort({
    model: "claude-opus-4-8",
    create,
  });

  const result = await port.parse(request);

  expect(result).toMatchObject({
    id: "msg_123",
    model: "claude-opus-4-8",
    parsed: specWithWords(30),
  });
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "claude-opus-4-8",
      max_tokens: 4_096,
      messages: [{ role: "user", content: "fixture" }],
      output_config: { format: expect.any(Object) },
    }),
  );
});

describe("safe Anthropic failures", () => {
  it.each([
    [
      new Anthropic.AuthenticationError(
        401,
        { type: "error", error: { type: "authentication_error" } },
        "secret authentication detail",
        new Headers(),
      ),
      {
        code: "ANTHROPIC_AUTHENTICATION",
        status: 401,
        retryable: false,
      },
    ],
    [
      new Anthropic.RateLimitError(
        429,
        { type: "error", error: { type: "rate_limit_error" } },
        "secret rate-limit detail",
        new Headers(),
      ),
      { code: "ANTHROPIC_RATE_LIMIT", status: 429, retryable: true },
    ],
    [
      new Anthropic.APIConnectionError({
        message: "secret connection detail",
      }),
      { code: "ANTHROPIC_CONNECTION", status: 502, retryable: true },
    ],
    [
      new Anthropic.BadRequestError(
        400,
        {
          type: "error",
          error: {
            type: "invalid_request_error",
            message: "Your credit balance is too low to access the API.",
          },
        },
        "secret billing detail",
        new Headers(),
      ),
      {
        code: "ANTHROPIC_BILLING_REQUIRED",
        status: 402,
        retryable: false,
      },
    ],
    [
      new Anthropic.PermissionDeniedError(
        403,
        {
          type: "error",
          error: {
            type: "permission_error",
            message: "secret permission detail",
          },
        },
        "secret permission detail",
        new Headers(),
      ),
      {
        code: "ANTHROPIC_PERMISSION_DENIED",
        status: 403,
        retryable: false,
      },
    ],
    [
      new Anthropic.NotFoundError(
        404,
        {
          type: "error",
          error: {
            type: "not_found_error",
            message: "secret model detail",
          },
        },
        "secret model detail",
        new Headers(),
      ),
      {
        code: "ANTHROPIC_MODEL_UNAVAILABLE",
        status: 422,
        retryable: false,
      },
    ],
    [
      new Anthropic.BadRequestError(
        400,
        {
          type: "error",
          error: {
            type: "invalid_request_error",
            message: "secret invalid request detail",
          },
        },
        "secret invalid request detail",
        new Headers(),
      ),
      {
        code: "ANTHROPIC_REQUEST_INVALID",
        status: 422,
        retryable: false,
      },
    ],
    [
      new Anthropic.UnprocessableEntityError(
        422,
        {
          type: "error",
          error: {
            type: "invalid_request_error",
            message: "secret invalid request detail",
          },
        },
        "secret invalid request detail",
        new Headers(),
      ),
      {
        code: "ANTHROPIC_REQUEST_INVALID",
        status: 422,
        retryable: false,
      },
    ],
    [
      new Anthropic.InternalServerError(
        500,
        {
          type: "error",
          error: {
            type: "api_error",
            message: "secret provider detail",
          },
        },
        "secret provider detail",
        new Headers(),
      ),
      {
        code: "ANTHROPIC_SERVICE_UNAVAILABLE",
        status: 502,
        retryable: true,
      },
    ],
    [
      new Error("secret provider detail"),
      { code: "ANTHROPIC_REQUEST_FAILED", status: 502, retryable: true },
    ],
  ])("maps provider errors to $expected.code", async (error, expected) => {
    const port = createAnthropicResponsesPort({
      model: "claude-opus-4-8",
      create: vi.fn().mockRejectedValue(error),
    });

    await expect(port.parse(request)).rejects.toMatchObject(expected);
    await expect(port.parse(request)).rejects.not.toMatchObject({
      message: expect.stringContaining("secret"),
    });
  });

  it("maps a refusal without exposing provider content", async () => {
    const port = createAnthropicResponsesPort({
      model: "claude-opus-4-8",
      create: vi.fn().mockResolvedValue(
        message({
          stop_reason: "refusal",
          content: [{ type: "text", text: "private refusal detail" }],
        }),
      ),
    });

    await expect(port.parse(request)).rejects.toMatchObject({
      code: "ANTHROPIC_REFUSAL",
    });
  });

  it.each([
    ["malformed JSON", "{", "ANTHROPIC_OUTPUT_INVALID"],
    ["schema-invalid JSON", "{}", "ANTHROPIC_OUTPUT_INVALID"],
  ])("rejects %s", async (_case, text, code) => {
    const port = createAnthropicResponsesPort({
      model: "claude-opus-4-8",
      create: vi
        .fn()
        .mockResolvedValue(message({ content: [{ type: "text", text }] })),
    });

    await expect(port.parse(request)).rejects.toMatchObject({ code });
  });
});
