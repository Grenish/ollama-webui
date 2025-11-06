/**
 * Chat utilities for Ollama WebUI
 * Contains helper functions for chat message handling, streaming, and formatting
 */

import { type AgentSource } from "@/lib/hooks/use-agent";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  reasoningDuration?: number;
  tool?: "RAG" | "WebSearch" | "Both";
  sources?: AgentSource[];
  isAgent?: boolean;
  timestamp?: number;
}

export interface StreamEventHandlers {
  onReasoning?: (text: string) => void;
  onMessage?: (content: string) => void;
  onMeta?: (meta: any) => void;
  onTool?: (tool: "RAG" | "WebSearch" | "Both") => void;
  onProgress?: (status: string, details?: string[]) => void;
  onSources?: (sources: AgentSource[]) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Parse Server-Sent Events (SSE) from a stream
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: StreamEventHandlers,
): Promise<void> {
  const decoder = new TextDecoder();
  let currentEventType = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEventType = line.substring(7).trim();
          continue;
        }

        if (line.startsWith("data: ")) {
          const data = line.substring(6).trim();
          if (!data || data === "{}") continue;

          try {
            const parsed = JSON.parse(data);

            switch (currentEventType) {
              case "reasoning":
                handlers.onReasoning?.(parsed.content || "");
                break;

              case "message":
                handlers.onMessage?.(parsed.content || "");
                break;

              case "meta":
                handlers.onMeta?.(parsed);
                break;

              case "tool":
                handlers.onTool?.(parsed.tool);
                break;

              case "progress":
                handlers.onProgress?.(parsed.status, parsed.details);
                break;

              case "sources":
                handlers.onSources?.(parsed.sources || []);
                break;

              case "done":
                handlers.onDone?.();
                break;

              case "error":
                handlers.onError?.(
                  new Error(parsed.error || "Unknown stream error"),
                );
                break;

              default:
                console.warn("Unknown event type:", currentEventType, parsed);
            }
          } catch (err) {
            console.error("Failed to parse SSE data:", err);
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      handlers.onError?.(err);
    }
    throw err;
  }
}

/**
 * Check if a model is a thinking/reasoning model
 */
export function isThinkingModel(modelName: string): boolean {
  const lowerName = modelName.toLowerCase();
  return (
    lowerName.includes("deepseek-r1") ||
    lowerName.includes("qwq") ||
    lowerName.includes("think") ||
    lowerName.includes("reasoning") ||
    lowerName.includes("r1")
  );
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 1) return "< 1s";
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Calculate reasoning duration from start time
 */
export function calculateReasoningDuration(startTime: number): number {
  const elapsedMs = Date.now() - startTime;
  return Math.max(1, Math.ceil(elapsedMs / 1000));
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

/**
 * Sanitize and format markdown content
 */
export function formatMarkdownContent(content: string): string {
  // Remove common artifacts from LLM responses
  return content
    .replace(/^(COMPREHENSIVE ANSWER:|RESPONSE:|ANSWER:|YOUR ANSWER:)/gi, "")
    .replace(/^\*\*COMPREHENSIVE ANSWER:\*\*/gi, "")
    .replace(/^\*\*RESPONSE:\*\*/gi, "")
    .replace(/^\*\*ANSWER:\*\*/gi, "")
    .trim();
}

/**
 * Store chat session in storage
 */
export function saveChatSession(
  chatId: string,
  data: {
    model: string;
    messages: ChatMessage[];
    agentMode?: boolean;
    webSearchOnly?: boolean;
  },
): void {
  try {
    sessionStorage.setItem(`chat-${chatId}`, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save chat session:", error);
  }
}

/**
 * Load chat session from storage
 */
export function loadChatSession(chatId: string): {
  model: string;
  messages: ChatMessage[];
  agentMode?: boolean;
  webSearchOnly?: boolean;
} | null {
  try {
    const data = sessionStorage.getItem(`chat-${chatId}`);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to load chat session:", error);
    return null;
  }
}

/**
 * Clear chat session from storage
 */
export function clearChatSession(chatId: string): void {
  try {
    sessionStorage.removeItem(`chat-${chatId}`);
  } catch (error) {
    console.error("Failed to clear chat session:", error);
  }
}

/**
 * Prepare messages for API request
 */
export function prepareMessagesForAPI(
  messages: ChatMessage[],
): Array<{ role: "user" | "assistant" | "system"; content: string }> {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(
  text: string,
  maxLength: number,
  ellipsis = "...",
): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Get tool display name
 */
export function getToolDisplayName(
  tool: "RAG" | "WebSearch" | "Both",
): string {
  switch (tool) {
    case "RAG":
      return "Local Knowledge Base";
    case "WebSearch":
      return "Web Search";
    case "Both":
      return "RAG + Web Search";
    default:
      return tool;
  }
}

/**
 * Create an error message
 */
export function createErrorMessage(error: Error | string): ChatMessage {
  const errorText =
    typeof error === "string" ? error : error.message || "Unknown error";

  return {
    role: "assistant",
    content: `⚠️ An error occurred: ${errorText}`,
    timestamp: Date.now(),
  };
}

/**
 * Validate chat message
 */
export function isValidChatMessage(msg: any): msg is ChatMessage {
  return (
    msg &&
    typeof msg === "object" &&
    typeof msg.role === "string" &&
    ["user", "assistant", "system"].includes(msg.role) &&
    typeof msg.content === "string"
  );
}

/**
 * Validate messages array
 */
export function isValidMessagesArray(
  messages: any,
): messages is ChatMessage[] {
  return Array.isArray(messages) && messages.every(isValidChatMessage);
}

/**
 * Deduplicate messages by content and timestamp
 */
export function deduplicateMessages(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  return messages.filter((msg) => {
    const key = `${msg.role}:${msg.content}:${msg.timestamp || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extract source URLs from messages
 */
export function extractSourceUrls(messages: ChatMessage[]): string[] {
  const urls: string[] = [];

  messages.forEach((msg) => {
    if (msg.sources) {
      msg.sources.forEach((source) => {
        if (source.url) {
          urls.push(source.url);
        }
      });
    }
  });

  return Array.from(new Set(urls)); // Deduplicate
}

/**
 * Count tokens (rough estimation)
 */
export function estimateTokenCount(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Create a user message
 */
export function createUserMessage(content: string): ChatMessage {
  return {
    role: "user",
    content,
    timestamp: Date.now(),
  };
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(
  content: string,
  options?: {
    reasoning?: string;
    reasoningDuration?: number;
    tool?: "RAG" | "WebSearch" | "Both";
    sources?: AgentSource[];
    isAgent?: boolean;
  },
): ChatMessage {
  return {
    role: "assistant",
    content,
    timestamp: Date.now(),
    ...options,
  };
}
