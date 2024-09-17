import { TypeAnimation } from "react-type-animation";

const ChatMessage = ({ message, isUser, isTyping }) => {
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`p-3 rounded-lg ${
          isUser ? "bg-blue-500 text-white" : "bg-gray-200 text-black"
        }`}
      >
        {isTyping ? (
          <TypeAnimation sequence={[message, 1000]} speed={40} repeat={0} />
        ) : (
          message
        )}
      </div>
    </div>
  );
};

export default ChatMessage;