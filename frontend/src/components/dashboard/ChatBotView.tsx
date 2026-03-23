import { useState } from "react";
import { Bot, Send, Brain, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ChatBotVariant = "wms" | "dr";

const COPY = {
  wms: {
    title: "WMS AI Assistant",
    tagline: "Your intelligent warehouse analytics companion",
    body: "The WMS AI chatbot is currently under active development. Soon you'll be able to ask questions like:",
    questions: [
      "What are today's pending orders?",
      "Show me warehouse efficiency trends",
      "Which items need reordering?",
      "Summarize this week's performance",
    ],
    placeholder: "Ask anything about your warehouse… (coming soon)",
  },
  dr: {
    title: "DR AI Assistant",
    tagline: "Your intelligent delivery & routing companion",
    body: "The DR AI chatbot is currently under active development. Soon you'll be able to ask questions like:",
    questions: [
      "What are today's driver assignments?",
      "Show me POD updates for this week",
      "Which deliveries are pending?",
      "Summarize driver performance",
    ],
    placeholder: "Ask anything about delivery routing… (coming soon)",
  },
};

interface ChatBotViewProps {
  variant?: ChatBotVariant;
}

const ChatBotView = ({ variant = "wms" }: ChatBotViewProps) => {
  const [inputValue, setInputValue] = useState("");
  const copy = COPY[variant];

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 p-6 mb-6 text-white shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="bg-white/20 rounded-full p-3">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{copy.title}</h2>
            <p className="text-indigo-200 text-sm mt-1">
              {copy.tagline}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-100 flex flex-col overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="relative mb-6">
            <div className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full p-6 inline-block">
              <Brain className="h-16 w-16 text-indigo-500" />
            </div>
            <div className="absolute -top-1 -right-1 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full p-1.5">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>

          <h3 className="text-2xl font-bold text-slate-700 mb-3">
            Development in Progress
          </h3>
          <p className="text-slate-500 max-w-md leading-relaxed mb-6">
            {copy.body}
          </p>

          {/* Sample Questions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mb-8">
            {copy.questions.map((q) => (
              <div
                key={q}
                className="flex items-start space-x-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-left opacity-60 cursor-not-allowed"
              >
                <MessageSquare className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-slate-600">{q}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center space-x-2 text-sm text-indigo-500 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
            <span>Coming soon — stay tuned!</span>
          </div>
        </div>

        {/* Input Bar */}
        <div className="border-t border-slate-100 p-4 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full p-2 flex-shrink-0">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 relative">
              <Input
                placeholder={copy.placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled
                className="pr-12 bg-white border-slate-200 text-slate-400 cursor-not-allowed rounded-xl"
              />
            </div>
            <Button
              disabled
              size="icon"
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl opacity-50 cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-slate-400 text-center mt-2">
            AI features are under development and will be available soon
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatBotView;
