import { Ollama } from "ollama";

const DEFAULT_OLLAMA_HOST = "http://localhost:11434";

function getBaseUrl(): string {
  const url = process.env.OLLAMA_URL || DEFAULT_OLLAMA_HOST;
  return url.replace(/\/+$/, "");
}

interface GenerateOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_predict?: number;
  stop?: string[];
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface StreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export class OllamaService {
  private client: Ollama;
  private generationTimeout: number;
  private embeddingTimeout: number;

  constructor(
    baseUrl?: string,
    generationTimeout = 180000,
    embeddingTimeout = 120000,
  ) {
    this.client = new Ollama({
      host: baseUrl || getBaseUrl(),
    });
    this.generationTimeout = generationTimeout;
    this.embeddingTimeout = embeddingTimeout;
  }

  /**
   * Generate text completion using Ollama (non-streaming)
   */
  async generate(
    model: string,
    prompt: string,
    temperature = 0.3,
    options?: GenerateOptions,
  ): Promise<string> {
    try {
      const response = await this.client.generate({
        model,
        prompt,
        stream: false,
        options: {
          temperature,
          top_p: options?.top_p ?? 0.9,
          top_k: options?.top_k ?? 40,
          num_predict: options?.num_predict ?? 512,
          stop: options?.stop,
        },
      });

      return response.response.trim();
    } catch (error: any) {
      throw new Error(
        `Ollama generation failed: ${error.message || String(error)}`,
      );
    }
  }

  /**
   * Generate text completion with streaming support
   */
  async generateStream(
    model: string,
    prompt: string,
    callbacks: StreamCallbacks,
    temperature = 0.3,
    options?: GenerateOptions,
  ): Promise<void> {
    let fullResponse = "";

    try {
      const stream = await this.client.generate({
        model,
        prompt,
        stream: true,
        options: {
          temperature,
          top_p: options?.top_p ?? 0.9,
          top_k: options?.top_k ?? 40,
          num_predict: options?.num_predict ?? 512,
          stop: options?.stop,
        },
      });

      for await (const chunk of stream) {
        if (chunk.response) {
          fullResponse += chunk.response;
          callbacks.onToken?.(chunk.response);
        }

        if (chunk.done) {
          callbacks.onComplete?.(fullResponse.trim());
        }
      }
    } catch (error: any) {
      const err = new Error(
        `Ollama streaming failed: ${error.message || String(error)}`,
      );
      callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * Chat completion using Ollama (non-streaming)
   */
  async chat(
    model: string,
    messages: ChatMessage[],
    temperature = 0.7,
    options?: GenerateOptions,
  ): Promise<string> {
    try {
      const response = await this.client.chat({
        model,
        messages,
        stream: false,
        options: {
          temperature,
          top_p: options?.top_p ?? 0.9,
          top_k: options?.top_k ?? 40,
          num_predict: options?.num_predict ?? 512,
          stop: options?.stop,
        },
      });

      return response.message.content.trim();
    } catch (error: any) {
      throw new Error(`Ollama chat failed: ${error.message || String(error)}`);
    }
  }

  /**
   * Chat completion with streaming support
   */
  async chatStream(
    model: string,
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    temperature = 0.7,
    options?: GenerateOptions,
  ): Promise<void> {
    let fullResponse = "";

    try {
      const stream = await this.client.chat({
        model,
        messages,
        stream: true,
        options: {
          temperature,
          top_p: options?.top_p ?? 0.9,
          top_k: options?.top_k ?? 40,
          num_predict: options?.num_predict ?? 512,
          stop: options?.stop,
        },
      });

      for await (const chunk of stream) {
        if (chunk.message?.content) {
          fullResponse += chunk.message.content;
          callbacks.onToken?.(chunk.message.content);
        }

        if (chunk.done) {
          callbacks.onComplete?.(fullResponse.trim());
        }
      }
    } catch (error: any) {
      const err = new Error(
        `Ollama chat streaming failed: ${error.message || String(error)}`,
      );
      callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * Generate embeddings for text
   */
  async embed(text: string, model: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings({
        model,
        prompt: text.slice(0, 2048), // Limit text length to avoid errors
      });

      if (!response.embedding || !Array.isArray(response.embedding)) {
        throw new Error("Invalid embedding response from Ollama");
      }

      return response.embedding;
    } catch (error: any) {
      throw new Error(
        `Ollama embedding failed: ${error.message || String(error)}`,
      );
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<
    Array<{
      name: string;
      size: number;
      modified_at: string;
      digest: string;
    }>
  > {
    try {
      const response = await this.client.list();
      return response.models.map((model) => ({
        name: model.name,
        size: model.size,
        modified_at: model.modified_at,
        digest: model.digest,
      }));
    } catch (error: any) {
      throw new Error(
        `Failed to list Ollama models: ${error.message || String(error)}`,
      );
    }
  }

  /**
   * Check if a model is available
   */
  async hasModel(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some((m) => m.name === modelName);
    } catch (error) {
      return false;
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(
    modelName: string,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    try {
      const stream = await this.client.pull({
        model: modelName,
        stream: true,
      });

      for await (const chunk of stream) {
        if (chunk.status && onProgress) {
          // Calculate progress if available
          if (chunk.completed && chunk.total) {
            const progress = (chunk.completed / chunk.total) * 100;
            onProgress(progress);
          }
        }
      }
    } catch (error: any) {
      throw new Error(
        `Failed to pull model ${modelName}: ${error.message || String(error)}`,
      );
    }
  }

  /**
   * Delete a model
   */
  async deleteModel(modelName: string): Promise<void> {
    try {
      await this.client.delete({ model: modelName });
    } catch (error: any) {
      throw new Error(
        `Failed to delete model ${modelName}: ${error.message || String(error)}`,
      );
    }
  }

  /**
   * Show model information
   */
  async showModel(modelName: string): Promise<any> {
    try {
      const response = await this.client.show({ model: modelName });
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to show model ${modelName}: ${error.message || String(error)}`,
      );
    }
  }

  /**
   * Get the Ollama client instance (for advanced usage)
   */
  getClient(): Ollama {
    return this.client;
  }
}
