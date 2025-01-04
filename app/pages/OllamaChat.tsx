"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { ollama } from "ollama-ai-provider";
import ReactMarkdown from "react-markdown";

interface Model {
  name: string;
}

export default function OllamaChat() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, input, handleInputChange, handleSubmit, setInput } =
    useChat({
      api: "/api/chat",
      body: { model: selectedModel },
    });

  useEffect(() => {
    async function fetchModels() {
      const response = await fetch("http://localhost:11434/api/tags");
      const data = await response.json();
      setModels(data.models);
      if (data.models.length > 0) {
        setSelectedModel(data.models[0].name);
      }
    }
    fetchModels();
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(event.target.files || []);
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
  };

  const removeFile = (fileToRemove: File) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file !== fileToRemove));
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("message", input);

    // Here you would typically send the formData to your API
    // For now, we'll just add the file names to the message
    const fileNames = files.map((file) => file.name).join(", ");
    const messageWithFiles = fileNames
      ? `${input}\n\nAttached files: ${fileNames}`
      : input;
    setInput(messageWithFiles);

    handleSubmit(event);
    setFiles([]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-black">
      <header className="bg-white shadow-sm p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Ollama Chat</h1>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a model</option>
            {models.map((model) => (
              <option key={model.name} value={model.name}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`p-4 rounded-lg ${
                m.role === "user" ? "bg-blue-100 ml-auto" : "bg-green-100"
              } max-w-[80%]`}
            >
              <ReactMarkdown className="prose">{m.content}</ReactMarkdown>
            </div>
          ))}
        </div>
      </main>
      <footer className="bg-white shadow-sm p-4">
        <form
          onSubmit={handleFormSubmit}
          className="max-w-3xl mx-auto space-y-4"
        >
          <div className="flex space-x-4">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Say something..."
              className="flex-grow border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Upload
            </button>
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              ref={fileInputRef}
            />
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center bg-gray-200 rounded-full px-3 py-1"
                >
                  <span className="text-sm truncate max-w-[150px]">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(file)}
                    className="ml-2 text-gray-500 hover:text-gray-700"
                  >
                    <span aria-hidden="true">&times;</span>
                    <span className="sr-only">Remove file</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </form>
      </footer>
    </div>
  );
}
