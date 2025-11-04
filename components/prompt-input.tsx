"use client";

import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "./ui/prompt-input";
import { Button } from "./ui/button";
import { ArrowUp, Globe, Paperclip, Square, X } from "lucide-react";
import React, { useRef, useState } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Toggle } from "./ui/toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface PromptInputWithActionsProps {
  models?: string[];
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  onSendMessage?: (prompt: string, model: string) => void;
  isLoading?: boolean;
  onStopGeneration?: () => void;
}

export function PromptInputWithActions({
  models = [],
  selectedModel = "",
  onModelChange,
  onSendMessage,
  isLoading: externalIsLoading,
  onStopGeneration,
}: PromptInputWithActionsProps) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [currentModel, setCurrentModel] = useState(selectedModel);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Use external loading state if provided, otherwise manage internally
  const isLoading = externalIsLoading ?? false;

  // Update local model when prop changes
  React.useEffect(() => {
    setCurrentModel(selectedModel);
  }, [selectedModel]);

  const handleSubmit = () => {
    if ((input.trim() || files.length > 0) && currentModel) {
      const messageToSend = input;

      // Clear input immediately for better UX
      setInput("");
      setFiles([]);

      // Call the onSendMessage callback if provided
      if (onSendMessage) {
        onSendMessage(messageToSend, currentModel);
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (uploadInputRef?.current) {
      uploadInputRef.current.value = "";
    }
  };

  const handleModelChange = (value: string) => {
    setCurrentModel(value);
    if (onModelChange) {
      onModelChange(value);
    }
  };

  return (
    <PromptInput
      value={input}
      onValueChange={setInput}
      isLoading={isLoading}
      onSubmit={handleSubmit}
      className="w-full max-w-(--breakpoint-md)"
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="bg-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <Paperclip className="size-4" />
              <span className="max-w-[120px] truncate">{file.name}</span>
              <button
                onClick={() => handleRemoveFile(index)}
                className="hover:bg-secondary/50 rounded-full p-1"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <PromptInputTextarea placeholder="Ask me anything..." />

      <PromptInputActions className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2">
          <PromptInputAction tooltip="Attach files">
            <Label
              htmlFor="file-upload"
              className="hover:bg-secondary-foreground/10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl"
            >
              <Input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <Paperclip className="text-primary size-5" />
            </Label>
          </PromptInputAction>
          <PromptInputAction tooltip="Web Search">
            <Label htmlFor="">
              <Toggle className="rounded-full cursor-pointer">
                <Globe /> Web Search
              </Toggle>
            </Label>
          </PromptInputAction>
        </div>

        <div className="flex items-center gap-2">
          <PromptInputAction tooltip="Select model">
            <Select value={currentModel} onValueChange={handleModelChange}>
              <SelectTrigger className="outline-none cursor-pointer rounded-full min-w-[180px]">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent className="outline-none">
                {models.length > 0 ? (
                  models.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="loading" disabled>
                    Loading models...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </PromptInputAction>
          <PromptInputAction
            tooltip={isLoading ? "Stop generation" : "Send message"}
          >
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={isLoading ? onStopGeneration : handleSubmit}
              disabled={
                !isLoading &&
                (!currentModel || (!input.trim() && files.length === 0))
              }
            >
              {isLoading ? (
                <Square className="size-5 fill-current" />
              ) : (
                <ArrowUp className="size-5" />
              )}
            </Button>
          </PromptInputAction>
        </div>
      </PromptInputActions>
    </PromptInput>
  );
}
