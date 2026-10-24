import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Sends one or more photos with a prompt and returns the model's text reply.
 * Uses Groq (free tier) when GROQ_API_KEY is set, otherwise Claude when ANTHROPIC_API_KEY is set.
 */

export class VisionError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Seconds to wait before retrying, when a free-tier rate limit was hit. */
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export type VisionImage = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }; // base64, no prefix

type Request = { images: VisionImage[]; prompt: string; maxTokens: number };

export async function readImages(req: Request): Promise<string> {
  if (process.env.GROQ_API_KEY) return readWithGroq(req);
  if (process.env.ANTHROPIC_API_KEY) return readWithClaude(req);
  throw new VisionError("Leximi i fotove nuk është aktivizuar (mungon GROQ_API_KEY).", 503);
}

/** Pulls the JSON value out of a reply that may be wrapped in code fences or extra text. */
export function parseLenientJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/g, "");
  const start = t.search(/[[{]/);
  if (start === -1) return null;
  const end = t.lastIndexOf(t[start] === "{" ? "}" : "]");
  if (end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

const GROQ_DEFAULT_MODEL = "qwen/qwen3.8-27b";
// Groq's free tier rejects replies expected to exceed 1000 output tokens per minute.
const GROQ_MAX_OUTPUT = 950;

async function readWithGroq(req: Request): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "content-type": "application/json",
    },
    // No JSON mode: the model sometimes wraps the JSON in code fences, which JSON mode rejects.
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
      max_completion_tokens: Math.min(req.maxTokens, GROQ_MAX_OUTPUT),
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: req.prompt },
            ...req.images.map((img) => ({
              type: "image_url",
              image_url: { url: `data:${img.mediaType};base64,${img.data}` },
            })),
          ],
        },
      ],
    }),
  });

  if (res.status === 429) {
    const body = await res.json().catch(() => null);
    const message: string = body?.error?.message ?? "";
    const seconds = Number(/try again in ([\d.]+)s/.exec(message)?.[1] ?? res.headers.get("retry-after") ?? 30);
    throw new VisionError(
      "U arrit kufiri falas i leximit të fotove. Po pres pak dhe provoj përsëri.",
      429,
      Math.ceil(Math.min(Math.max(seconds, 3), 90)),
    );
  }
  if (!res.ok) {
    console.error("[groq]", res.status, await res.text().catch(() => ""));
    throw new VisionError("Leximi i fotos dështoi. Provoni përsëri.", 502);
  }
  const body = await res.json();
  return body?.choices?.[0]?.message?.content ?? "";
}

async function readWithClaude(req: Request): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium" },
    messages: [
      {
        role: "user",
        content: [
          ...req.images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
          })),
          { type: "text", text: req.prompt },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") return "";
  return response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}
