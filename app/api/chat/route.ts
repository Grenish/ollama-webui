import { NextResponse } from "next/server";
import { Ollama } from "ollama";

type Role = "user" | "assistant" | "system";

interface ChatMessage {
  role: Role;
  content: string;
}

interface ChatRequestBody {
  model: string;
  messages?: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
}

const DEFAULT_OLLAMA_HOST = "http://localhost:11434";

function getOllamaHost(): string {
  const host = process.env.OLLAMA_URL || DEFAULT_OLLAMA_HOST;
  return host.replace(/\/+$/, "");
}

// Initialize Ollama client
const ollama = new Ollama({
  host: getOllamaHost(),
});

// Validate messages array
function isValidMessages(m: any): m is ChatMessage[] {
  return (
    Array.isArray(m) &&
    m.every(
      (it) =>
        it &&
        typeof it.role === "string" &&
        typeof it.content === "string" &&
        ["user", "assistant", "system"].includes(it.role),
    )
  );
}

export async function POST(req: Request) {
  let body: ChatRequestBody;

  // Parse request body
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 },
    );
  }

  // Validate model
  if (!body?.model || typeof body.model !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'model' field" },
      { status: 400 },
    );
  }

  // Validate messages
  if (body.messages && !isValidMessages(body.messages)) {
    return NextResponse.json(
      {
        error:
          "Invalid 'messages' array. Each message must have 'role' (user/assistant/system) and 'content' (string)",
      },
      { status: 400 },
    );
  }

  const messages = body.messages ?? [];
  const shouldStream = body.stream ?? true;
  const temperature = body.temperature ?? body.options?.temperature ?? 0.7;

  // Check if model supports thinking (reasoning models)
  const isThinkingModel =
    body.model.toLowerCase().includes("deepseek-r1") ||
    body.model.toLowerCase().includes("qwq") ||
    body.model.toLowerCase().includes("think");

  // Non-streaming response
  if (!shouldStream) {
    try {
      const response = await ollama.chat({
        model: body.model,
        messages,
        stream: false,
        options: {
          temperature,
          top_p: body.options?.top_p ?? 0.9,
          top_k: body.options?.top_k ?? 40,
          num_predict: body.options?.num_predict,
          stop: body.options?.stop,
        },
      });

      return NextResponse.json(
        {
          message: response.message,
          done: true,
          total_duration: response.total_duration,
          load_duration: response.load_duration,
          prompt_eval_count: response.prompt_eval_count,
          prompt_eval_duration: response.prompt_eval_duration,
          eval_count: response.eval_count,
          eval_duration: response.eval_duration,
        },
        { status: 200 },
      );
    } catch (error: any) {
      console.error("Ollama chat error:", error);
      return NextResponse.json(
        {
          error: `Ollama error: ${error.message || "Unknown error"}`,
          details: error.stack,
        },
        { status: 500 },
      );
    }
  }

  // Streaming response
  try {
    const stream = await ollama.chat({
      model: body.model,
      messages,
      stream: true,
      options: {
        temperature,
        top_p: body.options?.top_p ?? 0.9,
        top_k: body.options?.top_k ?? 40,
        num_predict: body.options?.num_predict,
        stop: body.options?.stop,
      },
    });

    const encoder = new TextEncoder();

    // Create a ReadableStream that transforms Ollama's stream to SSE format
    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Handle thinking/reasoning content (for models like DeepSeek-R1)
            if (isThinkingModel && chunk.message?.content) {
              const content = chunk.message.content;

              // Check if this is reasoning content (heuristic: contains <think> tags or similar patterns)
              const isReasoning =
                content.includes("<think>") ||
                content.includes("</think>") ||
                (chunk.message as any).thinking;

              if (isReasoning || (chunk.message as any).thinking) {
                const thinkingContent =
                  (chunk.message as any).thinking || content;
                const reasoningData = JSON.stringify({
                  content: thinkingContent,
                });
                controller.enqueue(
                  encoder.encode(
                    `event: reasoning\ndata: ${reasoningData}\n\n`,
                  ),
                );
                continue;
              }
            }

            // Handle regular message content
            if (chunk.message?.content) {
              const messageData = JSON.stringify({
                content: chunk.message.content,
                role: chunk.message.role || "assistant",
              });
              controller.enqueue(
                encoder.encode(`event: message\ndata: ${messageData}\n\n`),
              );
            }

            // Handle completion metadata
            if (chunk.done) {
              const metaData = JSON.stringify({
                done: true,
                total_duration: chunk.total_duration,
                load_duration: chunk.load_duration,
                prompt_eval_count: chunk.prompt_eval_count,
                prompt_eval_duration: chunk.prompt_eval_duration,
                eval_count: chunk.eval_count,
                eval_duration: chunk.eval_duration,
              });
              controller.enqueue(
                encoder.encode(`event: meta\ndata: ${metaData}\n\n`),
              );
            }
          }

          // Send final done event
          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
          controller.close();
        } catch (error: any) {
          console.error("Stream processing error:", error);
          const errorData = JSON.stringify({
            error: error.message || "Stream processing failed",
          });
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${errorData}\n\n`),
          );
          controller.close();
        }
      },
      cancel() {
        // Cleanup if client disconnects
        console.log("Client disconnected from stream");
      },
    });

    return new Response(responseStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error: any) {
    console.error("Ollama streaming error:", error);
    return NextResponse.json(
      {
        error: `Ollama streaming error: ${error.message || "Unknown error"}`,
        details: error.stack,
      },
      { status: 500 },
    );
  }
}
