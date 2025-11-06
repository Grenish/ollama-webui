import { NextResponse } from "next/server";
import { Ollama } from "ollama";

const DEFAULT_OLLAMA_HOST = "http://localhost:11434";

function getOllamaHost(): string {
  const host = process.env.OLLAMA_URL || DEFAULT_OLLAMA_HOST;
  return host.replace(/\/+$/, "");
}

// Initialize Ollama client
const ollama = new Ollama({
  host: getOllamaHost(),
});

interface ModelResponse {
  id: string;
  name: string;
  size: number;
  modifiedAt: string;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface ModelsListResponse {
  models: ModelResponse[];
}

export async function GET() {
  try {
    const response = await ollama.list();

    if (!response || !response.models) {
      return NextResponse.json(
        {
          error: "Invalid response from Ollama",
          models: [],
        },
        { status: 502 },
      );
    }

    const models: ModelResponse[] = response.models.map((model) => ({
      id: model.name,
      name: model.name,
      size: model.size,
      modifiedAt: model.modified_at,
      digest: model.digest,
      details: model.details
        ? {
            format: model.details.format,
            family: model.details.family,
            families: model.details.families,
            parameter_size: model.details.parameter_size,
            quantization_level: model.details.quantization_level,
          }
        : undefined,
    }));

    const payload: ModelsListResponse = { models };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch Ollama models:", error);

    return NextResponse.json(
      {
        error: `Failed to fetch models from Ollama: ${error.message || "Unknown error"}`,
        details: error.stack,
        models: [],
      },
      { status: 500 },
    );
  }
}

/**
 * POST endpoint to pull a new model
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.model || typeof body.model !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'model' field" },
        { status: 400 },
      );
    }

    const modelName = body.model;
    const stream = body.stream ?? false;

    if (!stream) {
      // Non-streaming pull
      await ollama.pull({ model: modelName, stream: false });

      return NextResponse.json(
        {
          success: true,
          message: `Model ${modelName} pulled successfully`,
        },
        { status: 200 },
      );
    }

    // Streaming pull with progress updates
    const encoder = new TextEncoder();
    const pullStream = await ollama.pull({ model: modelName, stream: true });

    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of pullStream) {
            const data = JSON.stringify({
              status: chunk.status,
              digest: chunk.digest,
              total: chunk.total,
              completed: chunk.completed,
            });

            controller.enqueue(
              encoder.encode(`event: progress\ndata: ${data}\n\n`),
            );
          }

          controller.enqueue(
            encoder.encode(
              `event: complete\ndata: ${JSON.stringify({ success: true })}\n\n`,
            ),
          );
          controller.close();
        } catch (error: any) {
          const errorData = JSON.stringify({
            error: error.message || "Pull failed",
          });
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${errorData}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Failed to pull model:", error);

    return NextResponse.json(
      {
        error: `Failed to pull model: ${error.message || "Unknown error"}`,
        details: error.stack,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE endpoint to remove a model
 */
export async function DELETE(req: Request) {
  try {
    const body = await req.json();

    if (!body.model || typeof body.model !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'model' field" },
        { status: 400 },
      );
    }

    await ollama.delete({ model: body.model });

    return NextResponse.json(
      {
        success: true,
        message: `Model ${body.model} deleted successfully`,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Failed to delete model:", error);

    return NextResponse.json(
      {
        error: `Failed to delete model: ${error.message || "Unknown error"}`,
        details: error.stack,
      },
      { status: 500 },
    );
  }
}
