import React, { useState } from "react";
import Chat from "./components/Chat";
import Navbar from "./components/Navbar";

const App = () => {
  const [selectedModel, setSelectedModel] = useState(null);
  return (
    <div className="dark bg-gray-900 text-white min-h-screen">
      <Navbar
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
      />
      <Chat selectedModel={selectedModel} />
    </div>
  );
};

export default App;
