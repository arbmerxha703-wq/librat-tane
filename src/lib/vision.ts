import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/**
 * Reads a photo and returns JSON matching `schema`.
 * Uses Groq (free tier) when GROQ_API_KEY is set, otherwise Claude when ANTHROPIC_API_KEY is set.
 */

export class VisionError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Request<T extends z.ZodType> = {
  image: string; // base64, no data: prefix
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  prompt: string;
  /** Plain-language description of the JSON shape, for providers without schema enforcement. */
  jsonShape: string;
  schema: T;
  /** Bigger for whole shelves, smaller for a single cover. */
  maxTokens: number;
};

export async function readImage<T extends z.ZodType>(req: Request<T>): Promise<z.infer<T> | null> {
  if (process.env.GROQ_API_KEY) return readWithGroq(req);
  if (process.env.ANTHROPIC_API_KEY) return readWithClaude(req);
  throw new VisionError("Leximi i fotove nuk është aktivizuar (mungon GROQ_API_KEY).", 503);
}

const GROQ_DEFAULT_MODEL = "qwen/qwen3.8-27b";

async function readWithGroq<T extends z.ZodType>(req: Request<T>): Promise<z.infer<T> | null> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
      max_completion_tokens: req.maxTokens,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${req.prompt}\n\nReply with ONLY a JSON object, no other text, in exactly this shape:\n${req.jsonShape}`,
            },
            { type: "image_url", image_url: { url: `data:${req.mediaType};base64,${req.image}` } },
          ],
        },
      ],
    }),
  });

  if (res.status === 429) {
    throw new VisionError("U arrit kufiri falas i leximit të fotove. Provoni përsëri pas pak minutash.", 429);
  }
  if (!res.ok) {
    console.error("[groq]", res.status, await res.text().catch(() => ""));
    throw new VisionError("Leximi i fotos dështoi. Provoni përsëri.", 502);
  }

  const body = await res.json();
  const text: string = body?.choices?.[0]?.message?.content ?? "";
  // Some models wrap reasoning or code fences around the JSON; keep only the outermost object.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = req.schema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function readWithClaude<T extends z.ZodType>(req: Request<T>): Promise<z.infer<T> | null> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: req.maxTokens,
    output_config: { effort: req.maxTokens > 8000 ? "medium" : "low", format: zodOutputFormat(req.schema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: req.mediaType, data: req.image } },
          { type: "text", text: req.prompt },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  return (response.parsed_output as z.infer<T> | null) ?? null;
}
