import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

import { AppError } from "@/server/errors";

import type { ResponsesPort } from "./service";

function mapOpenAiError(error: unknown): never {
  if (error instanceof OpenAI.AuthenticationError) {
    throw new AppError(
      "OPENAI_AUTHENTICATION_FAILED",
      "OpenAI rejected the configured API key.",
      401,
    );
  }
  if (error instanceof OpenAI.RateLimitError) {
    throw new AppError(
      "OPENAI_RATE_LIMITED",
      "OpenAI is temporarily rate limiting requests.",
      429,
      true,
    );
  }
  throw new AppError(
    "OPENAI_REQUEST_FAILED",
    "OpenAI could not generate the document.",
    502,
    true,
  );
}

export function createOpenAiResponsesPort({
  apiKey,
  model,
}: {
  apiKey: string;
  model: string;
}): ResponsesPort {
  const client = new OpenAI({ apiKey });

  return {
    provider: "openai",
    async parse(request) {
      try {
        const response = await client.responses.parse({
          model,
          store: false,
          input: request.prompt,
          text: {
            verbosity: "low",
            format: zodTextFormat(
              request.schema as ZodType,
              `${request.documentType}_document`,
            ),
          },
        });
        const refusal = response.output
          .filter((item) => item.type === "message")
          .flatMap((item) => item.content)
          .find((item) => item.type === "refusal");
        if (refusal) {
          throw new AppError(
            "OPENAI_REFUSAL",
            "OpenAI declined to generate this document.",
            422,
          );
        }
        if (response.status !== "completed") {
          throw new AppError(
            "OPENAI_RESPONSE_INCOMPLETE",
            "OpenAI returned an incomplete response.",
            502,
            true,
          );
        }
        if (!response.output_parsed) {
          throw new AppError(
            "OPENAI_OUTPUT_INVALID",
            "OpenAI returned an invalid document.",
            502,
            true,
          );
        }
        return {
          id: response.id,
          model: response.model,
          parsed: request.schema.parse(response.output_parsed),
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        return mapOpenAiError(error);
      }
    },
  };
}
