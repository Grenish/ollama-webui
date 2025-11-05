import { useState, useCallback } from "react";

export type Tool = "RAG" | "WebSearch" | "Both";

export interface AgentSource {
  type: "rag" | "web";
  title?: string;
  url?: string;
  content: string;
  score?: number;
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  tool?: Tool;
  sources?: AgentSource[];
  isAgent?: boolean;
}

export interface ProgressUpdate {
  status: string;
  details?: string[];
}

export interface UseAgentOptions {
  onError?: (error: Error) => void;
}

export function useAgent(options?: UseAgentOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool | null>(null);
  const [streamingSources, setStreamingSources] = useState<AgentSource[]>([]);
  const [progressStatus, setProgressStatus] = useState<string>("");
  const [progressDetails, setProgressDetails] = useState<string[]>([]);

  const sendAgentQuery = useCallback(
    async (
      query: string,
      onChunk: (chunk: string) => void,
      onComplete: (sources: AgentSource[], tool: Tool) => void,
    ) => {
      setIsLoading(true);
      setCurrentTool(null);
      setStreamingSources([]);
      setProgressStatus("");
      setProgressDetails([]);

      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, stream: true }),
        });

        if (!response.ok) {
          throw new Error(`Agent API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let tool: Tool | null = null;
        let sources: AgentSource[] = [];
        let currentEventType = "";

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

                if (currentEventType === "tool") {
                  tool = parsed.tool;
                  setCurrentTool(tool);
                } else if (currentEventType === "progress") {
                  setProgressStatus(parsed.status || "");
                  setProgressDetails(parsed.details || []);
                } else if (currentEventType === "sources") {
                  sources = parsed.sources || [];
                  setStreamingSources(sources);
                } else if (currentEventType === "message") {
                  const content = parsed.content || "";
                  if (content) {
                    onChunk(content);
                  }
                } else if (currentEventType === "done") {
                  if (tool && onComplete) {
                    onComplete(sources, tool);
                  }
                }
              } catch (err) {
                console.error("Failed to parse SSE data:", err);
              }
            }
          }
        }
      } catch (error: any) {
        console.error("Agent query failed:", error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
        setCurrentTool(null);
        setStreamingSources([]);
        setProgressStatus("");
        setProgressDetails([]);
      }
    },
    [options],
  );

  const checkAgentStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/agent");
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error("Failed to check agent status:", error);
      return null;
    }
  }, []);

  return {
    sendAgentQuery,
    checkAgentStatus,
    isLoading,
    currentTool,
    streamingSources,
    progressStatus,
    progressDetails,
  };
}
