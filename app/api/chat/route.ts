import { NextResponse } from "next/server";

type Role = "user" | "assistant" | "system" | string;
type ChatMessage = { role: Role; content: string; [k: string]: unknown };

type ChatRequestBody = {
  model: string;
  messages?: ChatMessage[];
  stream?: boolean;
  think?: boolean;
  // pass-through
  [k: string]: unknown;
};

const DEFAULT_OLLAMA = "http://localhost:11434";

function getBaseUrl(): string {
  const url = process.env.OLLAMA_URL || DEFAULT_OLLAMA;
  return url.replace(/\/+$/, "");
}

function isValidMessages(m: any): m is ChatMessage[] {
  return (
    Array.isArray(m) &&
    m.every(
      (it) =>
        it && typeof it.role === "string" && typeof it.content === "string",
    )
  );
}

export async function POST(req: Request) {
  const baseURL = getBaseUrl();
  const ollamaUrl = `${baseURL}/api/chat`;

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.model || typeof body.model !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'model'." },
      { status: 400 },
    );
  }

  if (body.messages && !isValidMessages(body.messages)) {
    return NextResponse.json(
      { error: "Invalid 'messages' array." },
      { status: 400 },
    );
  }

  // Build payload forwarded to Ollama.
  const payload: any = {
    model: body.model,
    messages: body.messages ?? [],
  };
  if (typeof body.stream === "boolean") payload.stream = body.stream;
  if (typeof body.think === "boolean") payload.think = body.think;
  // copy extras (be cautious in prod)
  for (const k of Object.keys(body)) {
    if (!["model", "messages", "stream", "think"].includes(k))
      payload[k] = (body as any)[k];
  }

  try {
    const resp = await fetch(ollamaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream, */*",
        // Authorization: `Bearer ${process.env.OLLAMA_API_KEY ?? ""}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Ollama error ${resp.status}: ${resp.statusText}`,
          details: text,
        },
        { status: 502 },
      );
    }

    // If caller asked non-stream, just return JSON
    if (!payload.stream) {
      const data = await resp.json().catch(async () => {
        const t = await resp.text().catch(() => "");
        return { raw: t };
      });
      return NextResponse.json({ ollama: data }, { status: 200 });
    }

    // STREAMING: transform upstream stream into normalized SSE events
    const upstream = resp.body;
    if (!upstream)
      return NextResponse.json(
        { error: "Upstream has no body." },
        { status: 502 },
      );

    const reader = upstream.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Create a ReadableStream that emits SSE events
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            // emit done event
            controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
            controller.close();
            return;
          }

          const chunkText = decoder.decode(value, { stream: true });
          const lines = chunkText.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);

              // Handle thinking models - if message has 'thinking' field
              if (parsed.message?.thinking) {
                const thinkingData = JSON.stringify({
                  content: parsed.message.thinking,
                });
                controller.enqueue(
                  encoder.encode(`event: reasoning\ndata: ${thinkingData}\n\n`),
                );
              }

              // Handle regular message content
              if (parsed.message?.content) {
                const messageData = JSON.stringify({
                  content: parsed.message.content,
                  role: parsed.message.role || "assistant",
                });
                controller.enqueue(
                  encoder.encode(`event: message\ndata: ${messageData}\n\n`),
                );
              }

              // Handle done status
              if (parsed.done === true) {
                const metaData = JSON.stringify({
                  done: true,
                  total_duration: parsed.total_duration,
                  load_duration: parsed.load_duration,
                  prompt_eval_count: parsed.prompt_eval_count,
                  prompt_eval_duration: parsed.prompt_eval_duration,
                  eval_count: parsed.eval_count,
                  eval_duration: parsed.eval_duration,
                });
                controller.enqueue(
                  encoder.encode(`event: meta\ndata: ${metaData}\n\n`),
                );
              }
            } catch (err) {
              // If can't parse as JSON, emit as meta
              controller.enqueue(
                encoder.encode(
                  `event: meta\ndata: ${JSON.stringify({ raw: line })}\n\n`,
                ),
              );
            }
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`,
            ),
          );
          controller.close();
        }
      },
      cancel() {
        try {
          reader.cancel();
        } catch {
          // ignore
        }
      },
    });

    const headers = new Headers({
      "Content-Type": "text/event-stream;charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    return new Response(stream, { status: 200, headers });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
