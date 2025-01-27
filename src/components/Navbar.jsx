import React, { useState, useEffect } from "react";

function Navbar({ selectedModel, setSelectedModel }) {
  const [models, setModels] = useState([]);

  // Fetch models with error handling and cleanup
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const fetchModels = async () => {
      try {
        const response = await fetch("http://localhost:11434/api/tags", {
          signal,
        });
        const data = await response.json();
        setModels(data.models || []);
      } catch (error) {
        if (!signal.aborted) {
          console.error("Error fetching models:", error);
        }
      }
    };

    fetchModels();
    return () => controller.abort();
  }, []);

  return (
    <nav className="bg-gray-900 border-b border-gray-700 fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0 flex items-center">
            <span className="text-white text-xl font-semibold tracking-tight">
              Ollama Chat
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative group">
              <select
                value={selectedModel || ""}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="block appearance-none w-48 bg-gray-800 border border-gray-700 hover:border-gray-600 px-4 py-2 pr-8 rounded-lg shadow-sm leading-tight focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-100 transition-all duration-200"
              >
                <option value="" disabled className="text-gray-400">
                  Select Model
                </option>
                {models.map((model) => (
                  <option
                    key={model.name}
                    value={model.name}
                    className="bg-gray-800 hover:bg-indigo-600 truncate"
                  >
                    {model.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 group-hover:text-gray-300 transition-colors">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default React.memo(Navbar);
