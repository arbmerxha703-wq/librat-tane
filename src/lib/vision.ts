import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Sends one or more photos with a prompt and returns the model's text reply.
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

type Request = {
  images: VisionImage[];
  prompt: string;
  maxTokens: number;
  /** How long to wait for the best (slower) Gemini model before switching to the fast one. */
  patienceMs: number;
};

/**
 * Order of preference, each one taking over when the previous is slow, busy or failing:
 * Gemini Flash (free, reads every title right but can be slow when Google is busy),
 * Gemini Flash-Lite (free and fast, occasionally adds a book that isn't there),
 * Groq (free, misreads more titles), Claude (paid).
 */
export async function readImages(req: Request): Promise<string> {
  if (process.env.GEMINI_API_KEY) {
    const models = [
      { model: process.env.GEMINI_MODEL || "gemini-3.8-flash", timeoutMs: req.patienceMs },
      { model: process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite", timeoutMs: 30_000 },
    ];
    for (const { model, timeoutMs } of models) {
      try {
        return await readWithGemini(req, model, timeoutMs);
      } catch (err) {
        if (!(err instanceof VisionError)) throw err;
        console.warn(`[vision] ${model} unavailable:`, err.message);
      }
    }
    if (!process.env.GROQ_API_KEY) throw new VisionError("Leximi i fotos dështoi. Provoni përsëri.", 502);
  }
  if (process.env.GROQ_API_KEY) return readWithGroq(req);
  if (process.env.ANTHROPIC_API_KEY) return readWithClaude(req);
  throw new VisionError("Leximi i fotove nuk është aktivizuar (mungon GEMINI_API_KEY).", 503);
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rateLimited(seconds: number): VisionError {
  return new VisionError(
    "U arrit kufiri falas i leximit të fotove. Po pres pak dhe provoj përsëri.",
    429,
    Math.ceil(Math.min(Math.max(seconds, 3), 90)),
  );
}

async function readWithGemini(req: Request, model: string, timeoutMs: number): Promise<string> {
  const deadline = AbortSignal.timeout(timeoutMs);
  const payload = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          ...req.images.map((img) => ({ inline_data: { mime_type: img.mediaType, data: img.data } })),
          { text: req.prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      // Leave room for the model's thinking as well as the list itself.
      maxOutputTokens: Math.max(req.maxTokens, 16000),
      responseMimeType: "application/json",
      mediaResolution: "MEDIA_RESOLUTION_HIGH",
      // Reading spines needs sharp eyes more than long thinking; default thinking took ~90 s per shelf.
      thinkingConfig: { thinkingLevel: process.env.GEMINI_THINKING || "low" },
    },
  });
  const call = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "content-type": "application/json" },
      body: payload,
      signal: deadline,
    }).catch((err) => {
      if (deadline.aborted) throw new VisionError(`no reply within ${timeoutMs / 1000}s`, 504);
      throw new VisionError(`network error: ${(err as Error).message}`, 502);
    });

  // "High demand" (503) spells are usually short: try once more before handing over.
  let res = await call();
  if (res.status === 503 && !deadline.aborted) {
    await sleep(1500);
    res = await call();
  }

  if (res.status === 429) {
    const body = await res.json().catch(() => null);
    const delay = (body?.error?.details as { retryDelay?: string }[] | undefined)?.find((d) => d.retryDelay)?.retryDelay;
    throw rateLimited(Number.parseFloat(delay ?? "30"));
  }
  if (!res.ok) {
    console.error("[gemini]", res.status, await res.text().catch(() => ""));
    throw new VisionError("Leximi i fotos dështoi. Provoni përsëri.", 502);
  }
  const body = await res.json().catch(() => {
    throw new VisionError(`no reply within ${timeoutMs / 1000}s`, 504);
  });
  const parts: { text?: string; thought?: boolean }[] = body?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
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
    throw rateLimited(Number(/try again in ([\d.]+)s/.exec(message)?.[1] ?? res.headers.get("retry-after") ?? 30));
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
