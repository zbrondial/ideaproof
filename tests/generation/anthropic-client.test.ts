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
      "ANTHROPIC_AUTHENTICATION",
    ],
    [
      new Anthropic.RateLimitError(
        429,
        { type: "error", error: { type: "rate_limit_error" } },
        "secret rate-limit detail",
        new Headers(),
      ),
      "ANTHROPIC_RATE_LIMIT",
    ],
    [
      new Anthropic.APIConnectionError({
        message: "secret connection detail",
      }),
      "ANTHROPIC_CONNECTION",
    ],
    [new Error("secret provider detail"), "ANTHROPIC_REQUEST_FAILED"],
  ])("maps provider errors to %s", async (error, code) => {
    const port = createAnthropicResponsesPort({
      model: "claude-opus-4-8",
      create: vi.fn().mockRejectedValue(error),
    });

    await expect(port.parse(request)).rejects.toMatchObject({ code });
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
