import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

import { AppError } from "@/server/errors";

import type { ResponsesPort } from "./service";

type MessageResponse = Pick<
  Anthropic.Message,
  "id" | "model" | "content" | "stop_reason"
>;
type CreateMessage = (
  params: Anthropic.MessageCreateParamsNonStreaming,
) => Promise<MessageResponse>;

function mapAnthropicError(error: unknown): never {
  if (error instanceof Anthropic.AuthenticationError) {
    throw new AppError(
      "ANTHROPIC_AUTHENTICATION",
      "Claude rejected the configured API key.",
      401,
    );
  }
  if (error instanceof Anthropic.RateLimitError) {
    throw new AppError(
      "ANTHROPIC_RATE_LIMIT",
      "Claude is temporarily rate limiting requests.",
      429,
      true,
    );
  }
  if (error instanceof Anthropic.APIConnectionError) {
    throw new AppError(
      "ANTHROPIC_CONNECTION",
      "IdeaProof could not connect to Claude.",
      502,
      true,
    );
  }
  throw new AppError(
    "ANTHROPIC_REQUEST_FAILED",
    "Claude could not generate the document.",
    502,
    true,
  );
}

export function createAnthropicResponsesPort({
  apiKey,
  model,
  create,
}: {
  apiKey?: string;
  model: string;
  create?: CreateMessage;
}): ResponsesPort {
  const client = create ? null : new Anthropic({ apiKey, maxRetries: 2 });
  const send: CreateMessage =
    create ?? ((params) => client!.messages.create(params));

  return {
    provider: "anthropic",
    async parse(request) {
      try {
        const response = await send({
          model,
          max_tokens: 4_096,
          messages: [{ role: "user", content: request.prompt }],
          output_config: {
            format: zodOutputFormat(request.schema as ZodType),
          },
        });

        if (response.stop_reason === "refusal") {
          throw new AppError(
            "ANTHROPIC_REFUSAL",
            "Claude declined to generate this document.",
            422,
          );
        }
        if (response.stop_reason === "max_tokens") {
          throw new AppError(
            "ANTHROPIC_OUTPUT_TRUNCATED",
            "Claude returned an incomplete document.",
            502,
            true,
          );
        }
        if (response.stop_reason !== "end_turn") {
          throw new AppError(
            "ANTHROPIC_OUTPUT_INCOMPLETE",
            "Claude returned an incomplete document.",
            502,
            true,
          );
        }

        const text = response.content
          .filter(
            (block): block is Anthropic.TextBlock => block.type === "text",
          )
          .map((block) => block.text)
          .join("");
        if (!text) {
          throw new AppError(
            "ANTHROPIC_OUTPUT_EMPTY",
            "Claude returned an empty document.",
            502,
            true,
          );
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new AppError(
            "ANTHROPIC_OUTPUT_INVALID",
            "Claude returned an invalid document.",
            502,
            true,
          );
        }
        const validated = request.schema.safeParse(parsed);
        if (!validated.success) {
          throw new AppError(
            "ANTHROPIC_OUTPUT_INVALID",
            "Claude returned an invalid document.",
            502,
            true,
          );
        }
        return {
          id: response.id,
          model: response.model,
          parsed: validated.data,
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        return mapAnthropicError(error);
      }
    },
  };
}
