"use client";

import { PromptInputWithActions } from "@/components/prompt-input";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";

export default function Home() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch("/api/models");
        const data = await response.json();
        if (data.models && data.models.length > 0) {
          const modelNames = data.models.map((m: any) => m.name || m.id);
          setModels(modelNames);
          setSelectedModel(modelNames[0]);
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
      }
    };
    fetchModels();
  }, []);

  const handleSendMessage = async (
    prompt: string,
    model: string,
    agentMode = false,
    webSearchOnly = false,
  ) => {
    if (!prompt.trim() || (!model && !agentMode && !webSearchOnly)) return;

    setIsLoading(true);

    // Generate a new chat ID
    const chatId = nanoid();

    // Store the initial message and model in sessionStorage
    sessionStorage.setItem(
      `chat-${chatId}`,
      JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        agentMode,
        webSearchOnly,
      }),
    );

    // Redirect to the chat page
    router.push(`/c/${chatId}`);
  };

  const handleStopGeneration = () => {
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="mb-5">
        <h2 className="text-3xl font-semibold">Ready when you are!</h2>
      </div>
      <PromptInputWithActions
        models={models}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        onStopGeneration={handleStopGeneration}
      />
    </div>
  );
}
