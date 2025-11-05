"use client";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Response } from "@/components/ai-elements/response";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  InlineCitation,
  InlineCitationText,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselPrev,
  InlineCitationCarouselNext,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation";
import {
  Task,
  TaskTrigger,
  TaskContent,
  TaskItem,
} from "@/components/ai-elements/task";
import { PromptInputWithActions } from "@/components/prompt-input";
import { MessageSquareIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAgent, type AgentSource } from "@/lib/hooks/use-agent";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  reasoningDuration?: number;
  tool?: "RAG" | "WebSearch" | "Both";
  sources?: AgentSource[];
  isAgent?: boolean;
};

export default function ChatPage() {
  const params = useParams();
  const chatId = params["chat-id"] as string;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [model, setModel] = useState<string>("");
  const [models, setModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isReasoningStreaming, setIsReasoningStreaming] = useState(false);
  const [reasoningText, setReasoningText] = useState("");
  const [useAgentMode, setUseAgentMode] = useState(false);
  const [agentProgressStatus, setAgentProgressStatus] = useState("");
  const [agentProgressDetails, setAgentProgressDetails] = useState<string[]>(
    [],
  );
  const [agentCurrentTool, setAgentCurrentTool] = useState<
    "RAG" | "WebSearch" | "Both" | null
  >(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reasoningStartTimeRef = useRef<number | null>(null);
  const hasInitialized = useRef(false);
  const {
    sendAgentQuery,
    isLoading: isAgentLoading,
    currentTool,
    progressStatus,
    progressDetails,
  } = useAgent();

  // Fetch models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch("/api/models");
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          const names = data.models.map((m: any) => m.name || m.id);
          setModels(names);
        }
      } catch (err) {
        console.error("Failed to fetch models:", err);
      }
    };
    fetchModels();
  }, []);

  // Load session chat data and trigger first message
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const chatData = sessionStorage.getItem(`chat-${chatId}`);
    if (chatData) {
      try {
        const parsed = JSON.parse(chatData);
        setModel(parsed.model);
        setMessages(parsed.messages);
        if (parsed.messages.length > 0) {
          sendMessageToAPI(parsed.messages, parsed.model);
        }
      } catch (err) {
        console.error("Failed to parse chat data:", err);
      }
    }
  }, [chatId]);

  const sendMessageToAPI = async (
    chatMessages: ChatMessage[],
    currentModel: string,
  ) => {
    setIsLoading(true);
    setIsWaitingForResponse(true);
    setIsReasoningStreaming(false);
    setReasoningText("");
    reasoningStartTimeRef.current = null;

    const isThinkingModel =
      currentModel.toLowerCase().includes("deepseek-r1") ||
      currentModel.toLowerCase().includes("qwq") ||
      currentModel.toLowerCase().includes("think");

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: currentModel,
          messages: chatMessages,
          stream: true,
          think: isThinkingModel,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantMessage = "";
      let accumulatedThinking = "";
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

            // As soon as we receive the first chunk, stop showing shimmer
            if (isWaitingForResponse) setIsWaitingForResponse(false);

            try {
              const parsed = JSON.parse(data);

              // Handle reasoning
              if (currentEventType === "reasoning") {
                if (reasoningStartTimeRef.current === null)
                  reasoningStartTimeRef.current = Date.now();

                setIsReasoningStreaming(true);
                const thinkText = parsed.content || "";
                accumulatedThinking += thinkText;
                setReasoningText(accumulatedThinking);
                continue;
              }

              // Handle normal messages
              if (currentEventType === "message") {
                let duration: number | undefined;

                if (accumulatedThinking) {
                  if (reasoningStartTimeRef.current) {
                    const elapsedMs =
                      Date.now() - reasoningStartTimeRef.current;
                    duration = Math.max(1, Math.ceil(elapsedMs / 1000));
                    reasoningStartTimeRef.current = null;
                  }
                  if (isReasoningStreaming) {
                    setIsReasoningStreaming(false);
                    setReasoningText("");
                  }
                }

                const content = parsed.content || "";
                if (content) {
                  assistantMessage += content;
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const last = newMsgs[newMsgs.length - 1];
                    if (last && last.role === "assistant") {
                      last.content = assistantMessage;
                      if (accumulatedThinking && !last.reasoning) {
                        last.reasoning = accumulatedThinking;
                        last.reasoningDuration = duration;
                      }
                    } else {
                      newMsgs.push({
                        role: "assistant",
                        content: assistantMessage,
                        reasoning: accumulatedThinking || undefined,
                        reasoningDuration: duration,
                      });
                    }
                    return newMsgs;
                  });
                }
                continue;
              }

              // Handle meta events (completion)
              if (currentEventType === "meta" && parsed.done === true) {
                if (accumulatedThinking) {
                  let duration: number | undefined;
                  if (reasoningStartTimeRef.current) {
                    const elapsedMs =
                      Date.now() - reasoningStartTimeRef.current;
                    duration = Math.max(1, Math.ceil(elapsedMs / 1000));
                    reasoningStartTimeRef.current = null;
                  }
                  if (isReasoningStreaming) {
                    setIsReasoningStreaming(false);
                    setReasoningText("");
                  }
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const last = newMsgs[newMsgs.length - 1];
                    if (last && last.role === "assistant" && !last.reasoning) {
                      last.reasoning = accumulatedThinking;
                      last.reasoningDuration = duration;
                    }
                    return newMsgs;
                  });
                }
                continue;
              }
            } catch (err) {
              console.error("Failed to parse SSE data:", err);
            }
          }
        }
      }

      setIsReasoningStreaming(false);
      setReasoningText("");
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Generation stopped.");
        setMessages((prev) => {
          const msgs = [...prev];
          const last = msgs[msgs.length - 1];
          if (last && last.role === "assistant" && !last.content.trim())
            msgs.pop();
          return msgs;
        });
      } else {
        console.error("Chat failed:", err);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ Something went wrong." },
        ]);
      }
    } finally {
      setIsLoading(false);
      setIsReasoningStreaming(false);
      setReasoningText("");
      setIsWaitingForResponse(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setIsReasoningStreaming(false);
      setReasoningText("");
      setIsWaitingForResponse(false);
    }
  };

  const handleSendMessage = async (
    prompt: string,
    selectedModel: string,
    agentMode = false,
    webSearchOnly = false,
  ) => {
    if (!prompt.trim()) return;

    const newMsg: ChatMessage = { role: "user", content: prompt };
    const updated = [...messages, newMsg];
    setMessages(updated);
    setModel(selectedModel);

    sessionStorage.setItem(
      `chat-${chatId}`,
      JSON.stringify({
        model: selectedModel,
        messages: updated,
        agentMode,
        webSearchOnly,
      }),
    );

    if (agentMode || webSearchOnly) {
      await sendAgentMessage(prompt, webSearchOnly);
    } else {
      await sendMessageToAPI(updated, selectedModel);
    }
  };

  const sendAgentMessage = async (query: string, webSearchOnly = false) => {
    setIsLoading(true);
    setIsWaitingForResponse(true);
    setAgentProgressStatus("");
    setAgentProgressDetails([]);
    setAgentCurrentTool(null);

    let assistantMessage = "";

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, stream: true, webSearchOnly }),
      });

      if (!response.ok) {
        throw new Error(`Agent API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let tool: "RAG" | "WebSearch" | "Both" | null = null;
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
                setAgentCurrentTool(tool);
              } else if (currentEventType === "progress") {
                // Update progress state
                setAgentProgressStatus(parsed.status || "");
                setAgentProgressDetails(parsed.details || []);
              } else if (currentEventType === "sources") {
                sources = parsed.sources || [];
              } else if (currentEventType === "message") {
                const content = parsed.content || "";
                if (content) {
                  if (isWaitingForResponse) setIsWaitingForResponse(false);
                  assistantMessage += content;
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const last = newMsgs[newMsgs.length - 1];
                    if (last && last.role === "assistant" && last.isAgent) {
                      last.content = assistantMessage;
                    } else {
                      newMsgs.push({
                        role: "assistant",
                        content: assistantMessage,
                        isAgent: true,
                      });
                    }
                    return newMsgs;
                  });
                }
              } else if (currentEventType === "done") {
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  const last = newMsgs[newMsgs.length - 1];
                  if (last && last.role === "assistant" && last.isAgent) {
                    last.sources = sources;
                    if (tool) {
                      last.tool = tool;
                    }
                  }
                  return newMsgs;
                });
              }
            } catch (err) {
              console.error("Failed to parse SSE data:", err);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Agent message failed:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Agent failed. Please try again.",
          isAgent: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsWaitingForResponse(false);
      setAgentProgressStatus("");
      setAgentProgressDetails([]);
      setAgentCurrentTool(null);
    }
  };

  return (
    <div className="flex flex-col items-center w-full h-screen bg-background">
      <div className="flex-1 w-full max-w-4xl overflow-y-auto px-4 pb-32">
        <Conversation className="w-full h-full">
          <ConversationContent>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <ConversationEmptyState
                  description="Messages will appear here as the conversation progresses."
                  icon={<MessageSquareIcon className="size-6" />}
                  title="Start a conversation"
                />
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={`${chatId}-msg-${i}`}>
                    {msg.role === "assistant" && msg.reasoning && (
                      <Reasoning
                        className="w-full mb-4"
                        isStreaming={false}
                        duration={msg.reasoningDuration}
                        defaultOpen={false}
                      >
                        <ReasoningTrigger />
                        <ReasoningContent>{msg.reasoning}</ReasoningContent>
                      </Reasoning>
                    )}
                    {msg.role === "assistant" && msg.isAgent && msg.tool && (
                      <Tool className="mb-4 w-full" defaultOpen={true}>
                        <ToolHeader
                          title={`${msg.tool === "Both" ? "RAG + Web Search" : msg.tool}`}
                          type="tool-call"
                          state="output-available"
                        />
                        <ToolContent>
                          <ToolInput
                            input={{ query: messages[i - 1]?.content || "" }}
                          />
                          {msg.sources && msg.sources.length > 0 && (
                            <ToolOutput
                              output={{
                                tool: msg.tool,
                                sources: msg.sources.length,
                                results: msg.sources.slice(0, 3).map((s) => ({
                                  type: s.type,
                                  title: s.title || "Document",
                                  url: s.url,
                                  score: s.score,
                                })),
                              }}
                              errorText={undefined}
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    )}
                    <Message from={msg.role}>
                      <MessageContent>
                        {msg.role === "assistant" &&
                        msg.sources &&
                        msg.sources.length > 0 ? (
                          <div>
                            <Response>{msg.content}</Response>
                            <InlineCitation className="mt-4">
                              <InlineCitationText>Sources:</InlineCitationText>
                              <InlineCitationCard>
                                <InlineCitationCardTrigger
                                  sources={msg.sources
                                    .filter((s) => s.url)
                                    .map((s) => s.url!)}
                                >
                                  View {msg.sources.length} source
                                  {msg.sources.length > 1 ? "s" : ""}
                                </InlineCitationCardTrigger>
                                <InlineCitationCardBody>
                                  <InlineCitationCarousel>
                                    <InlineCitationCarouselHeader>
                                      <InlineCitationCarouselPrev />
                                      <InlineCitationCarouselIndex />
                                      <InlineCitationCarouselNext />
                                    </InlineCitationCarouselHeader>
                                    <InlineCitationCarouselContent>
                                      {msg.sources.map((source, idx) => (
                                        <InlineCitationCarouselItem key={idx}>
                                          <InlineCitationSource
                                            title={
                                              source.title ||
                                              `${source.type.toUpperCase()} Source ${idx + 1}`
                                            }
                                            url={source.url}
                                            description={
                                              source.content.slice(0, 200) +
                                              "..."
                                            }
                                          />
                                        </InlineCitationCarouselItem>
                                      ))}
                                    </InlineCitationCarouselContent>
                                  </InlineCitationCarousel>
                                </InlineCitationCardBody>
                              </InlineCitationCard>
                            </InlineCitation>
                          </div>
                        ) : (
                          <Response>{msg.content}</Response>
                        )}
                      </MessageContent>
                      <MessageAvatar
                        name={msg.role === "user" ? "You" : "AI Assistant"}
                        src={msg.role === "user" ? "" : ""}
                      />
                    </Message>
                  </div>
                ))}

                {isReasoningStreaming && reasoningText && (
                  <Reasoning
                    className="w-full max-w-4xl mb-4"
                    isStreaming={isReasoningStreaming}
                  >
                    <ReasoningTrigger />
                    <ReasoningContent>{reasoningText}</ReasoningContent>
                  </Reasoning>
                )}

                {isWaitingForResponse &&
                  !isReasoningStreaming &&
                  (messages.length === 0 ||
                    messages[messages.length - 1].role !== "assistant" ||
                    !messages[messages.length - 1].content) && (
                    <Message from="assistant" key="loading">
                      <MessageContent className="bg-transparent!">
                        {agentProgressStatus ? (
                          <Task className="w-full mb-4" defaultOpen={true}>
                            <TaskTrigger title={agentProgressStatus} />
                            <TaskContent>
                              {agentCurrentTool && (
                                <TaskItem className="font-medium text-foreground">
                                  🔧 Tool selected:{" "}
                                  {agentCurrentTool === "Both"
                                    ? "RAG + Web Search"
                                    : agentCurrentTool === "RAG"
                                      ? "Local Knowledge Base"
                                      : "Web Search"}
                                </TaskItem>
                              )}
                              {agentProgressDetails &&
                                agentProgressDetails.length > 0 && (
                                  <div className="space-y-1 mt-2">
                                    {agentProgressDetails.map((detail, idx) => (
                                      <TaskItem
                                        key={idx}
                                        className="flex items-center gap-2"
                                      >
                                        <span className="text-primary">→</span>
                                        <span>{detail}</span>
                                      </TaskItem>
                                    ))}
                                  </div>
                                )}
                            </TaskContent>
                          </Task>
                        ) : (
                          <Shimmer>Generating...</Shimmer>
                        )}
                      </MessageContent>
                      <MessageAvatar
                        name="AI Assistant"
                        src="https://github.com/openai.png"
                      />
                    </Message>
                  )}
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      <div className="fixed bottom-0 left-0 w-full p-3">
        <div className="max-w-4xl flex items-center justify-center mx-auto">
          <PromptInputWithActions
            models={models}
            selectedModel={model}
            onModelChange={setModel}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onStopGeneration={handleStopGeneration}
          />
        </div>
      </div>
    </div>
  );
}
