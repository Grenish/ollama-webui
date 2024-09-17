import React, { useState, useEffect, useRef } from "react";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import { Textarea } from "@nextui-org/input";
import ChatMessage from "./ChatMessage";

function Chat({ selectedModel }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    if (!selectedModel) {
      alert("Please select a model first.");
      return;
    }

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Show typing animation
    setMessages((prev) => [...prev, { sender: "bot", typing: true }]);

    try {
      const response = await fetchOllamaResponse(input);

      // Remove typing animation
      setMessages((prev) => prev.filter((msg) => !msg.typing));

      const botMessage = { sender: "bot", text: response };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error:", error);

      // Remove typing animation
      setMessages((prev) => prev.filter((msg) => !msg.typing));

      const errorMessage = {
        sender: "bot",
        text: "An error occurred. Please try again later.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const fetchOllamaResponse = async (prompt) => {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        model: selectedModel,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    return data.response; // Adjust according to your API response
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderMessage = (msg, idx) => {
    if (msg.typing) {
      return (
        <div key={idx} className="message bot flex items-center my-2">
          <ChatMessage />
        </div>
      );
    }

    const isUser = msg.sender === "user";
    const messageClass = isUser
      ? "message user bg-blue-600 text-white self-end"
      : "message bot bg-gray-800 text-white self-start";

    // Syntax highlighting
    const htmlContent = Prism.highlight(
      msg.text,
      Prism.languages.javascript, // Change language as needed
      "javascript"
    );

    return (
      <div
        key={idx}
        className={`${messageClass} p-3 my-2 rounded-lg max-w-2xl`}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      ></div>
    );
  };

  return (
    <div className="chat-container flex-1 flex flex-col mt-16 mb-20 p-4">
      {/* mt-16 accounts for the navbar height, mb-20 for the input area */}
      <div className="messages flex-1 overflow-auto mb-4">
        {messages.map((msg, idx) => renderMessage(msg, idx))}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-area fixed bottom-0 left-0 right-0 p-4">
        <div className="container mx-auto">
          <Textarea
            ref={inputRef}
            className=" p-3 text-white bg-gray-700 rounded resize-none focus:outline-none shadow-lg w-full max-w-2xl mx-auto"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}

export default Chat;
