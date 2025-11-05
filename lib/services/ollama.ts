const DEFAULT_OLLAMA = "http://localhost:11434";

function getBaseUrl(): string {
  const url = process.env.OLLAMA_URL || DEFAULT_OLLAMA;
  return url.replace(/\/+$/, "");
}

interface EmbeddingResponse {
  embedding: number[];
}

interface OllamaGenerateResponse {
  response?: string;
  done?: boolean;
}

export class OllamaService {
  private baseUrl: string;
  private generationTimeout: number;
  private embeddingTimeout: number;

  constructor(
    baseUrl?: string,
    generationTimeout = 180000,
    embeddingTimeout = 120000,
  ) {
    this.baseUrl = baseUrl || getBaseUrl();
    this.generationTimeout = generationTimeout;
    this.embeddingTimeout = embeddingTimeout;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  async generate(
    model: string,
    prompt: string,
    temperature = 0.3,
  ): Promise<string> {
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature,
            top_p: 0.9,
            num_predict: 512,
          },
        }),
      },
      this.generationTimeout,
    );

    if (!res.ok) {
      throw new Error(`Generation failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as OllamaGenerateResponse;
    return (data.response || "").trim();
  }

  async embed(text: string, model: string): Promise<number[]> {
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}/api/embeddings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: text.slice(0, 2048), // Limit text length
        }),
      },
      this.embeddingTimeout,
    );

    if (!res.ok) {
      throw new Error(`Embedding failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as EmbeddingResponse;
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error("Invalid embedding response");
    }
    return data.embedding;
  }
}
