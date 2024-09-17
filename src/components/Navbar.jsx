// src/Navbar.jsx
import React, { useState, useEffect } from "react";

function Navbar({ selectedModel, setSelectedModel }) {
  const [models, setModels] = useState([]);

  useEffect(() => {
    // Fetch available models from the Ollama API
    const fetchModels = async () => {
      try {
        const response = await fetch("http://localhost:11434/api/tags");
        const data = await response.json();
        setModels(data.models); // Adjust based on actual API response
      } catch (error) {
        console.error("Error fetching models:", error);
      }
    };

    fetchModels();
  }, []);

  return (
    <nav className="bg-gray-800 p-4 fixed top-0 left-0 right-0 z-10 shadow">
      <div className="container mx-auto flex items-center justify-between">
        <h1 className="text-white text-lg font-bold">Ollama Chat</h1>
        <div className="flex items-center">
          <label htmlFor="model-select" className="mr-2 text-white">
            Model:
          </label>
          <select
            id="model-select"
            className="bg-gray-700 text-white p-2 rounded"
            value={selectedModel || ""}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            <option value="" disabled>
              Select a model
            </option>
            {models.map((model) => (
              <option key={model.name} value={model.name}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
