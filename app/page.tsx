'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/models');
        const data = await response.json();
        setModels(data.models);
        if (data.models.length > 0) {
          setSelectedModel(data.models[0]);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };
    fetchModels();
  }, []);

  const handleSendMessage = async () => {
    if (!prompt.trim() || !selectedModel) return;

    const newChatHistory = [...chatHistory, { role: 'user', content: prompt }];
    setChatHistory(newChatHistory);
    setPrompt('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: selectedModel, chatHistory, prompt }),
      });

      const data = await response.json();
      setChatHistory([...newChatHistory, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Failed to get response:', error);
      setChatHistory([...newChatHistory, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-800 text-white">
      <header className="bg-gray-900 p-4 shadow-md">
        <nav className="flex justify-between items-center">
          <div className="text-xl font-bold">Ollama Web UI</div>
          <div className="">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-md p-2"
            >
              <option value="" disabled>
                Select a model
              </option>
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </nav>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {chatHistory.map((chat, index) => (
            <div key={index} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`p-3 rounded-lg max-w-lg ${
                  chat.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                {chat.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="p-3 rounded-lg max-w-lg bg-gray-700">
                Thinking...
              </div>
            </div>
          )}
        </div>
      </main>
      <footer className="p-4 bg-gray-900">
        <div className="flex items-center">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type your message..."
            className="flex-1 p-2 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={loading || !prompt.trim()}
            className="ml-2 px-4 py-2 bg-blue-600 rounded-md disabled:bg-gray-500"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
