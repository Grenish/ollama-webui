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
import { PromptInputWithActions } from "@/components/prompt-input";
import { MessageSquareIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  reasoningDuration?: number;
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const reasoningStartTimeRef = useRef<number | null>(null);
  const hasInitialized = useRef(false);

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

  const handleSendMessage = async (prompt: string, selectedModel: string) => {
    if (!prompt.trim()) return;

    const newMsg: ChatMessage = { role: "user", content: prompt };
    const updated = [...messages, newMsg];
    setMessages(updated);
    setModel(selectedModel);

    sessionStorage.setItem(
      `chat-${chatId}`,
      JSON.stringify({ model: selectedModel, messages: updated }),
    );

    await sendMessageToAPI(updated, selectedModel);
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
                    <Message from={msg.role}>
                      <MessageContent>
                        <Response>{msg.content}</Response>
                      </MessageContent>
                      <MessageAvatar
                        name={msg.role === "user" ? "You" : "AI Assistant"}
                        src={
                          msg.role === "user"
                            ? ""
                            : "https://github.com/openai.png"
                        }
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
                        <Shimmer>Generating...</Shimmer>
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
