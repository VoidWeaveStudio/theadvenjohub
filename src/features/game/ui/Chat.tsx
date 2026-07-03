//src\features\game\ui\Chat.tsx
"use client";

import { useState, useEffect, useRef } from "react";

interface ChatMessage {
    id: string;
    sender: string;
    message: string;
    timestamp: number;
    type: "player" | "system";
}

interface ChatProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    isVisible: boolean;
    onToggle: () => void;
}

export function Chat({ messages, onSendMessage, isVisible, onToggle }: ChatProps) {
    const [input, setInput] = useState("");
    const [isInputFocused, setIsInputFocused] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (isInputFocused) {
            inputRef.current?.focus();
        }
    }, [isInputFocused]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input.trim());
            setInput("");
            setIsInputFocused(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsInputFocused(false);
            inputRef.current?.blur();
        }
    };

    if (!isVisible) return null;

    return (
        <div className="absolute bottom-24 left-4 w-96 max-w-[calc(100vw-2rem)] pointer-events-auto">
            <div className="bg-black/70 backdrop-blur border border-white/10 rounded-lg overflow-hidden">
                <div className="bg-zinc-900/80 px-4 py-2 border-b border-white/10 flex items-center justify-between">
                    <span className="text-white font-bold text-sm">💬 Chat</span>
                    <button
                        onClick={onToggle}
                        className="text-zinc-400 hover:text-white text-sm"
                    >
                        ✕
                    </button>
                </div>

                <div className="h-64 overflow-y-auto p-3 space-y-2">
                    {messages.length === 0 ? (
                        <div className="text-zinc-500 text-sm text-center py-8">
                            No messages yet. Press Enter to start chatting.
                        </div>
                    ) : (
                        <>
                            {messages.map((msg) => (
                                <div key={msg.id} className="text-sm">
                                    {msg.type === "system" ? (
                                        <div className="text-cyan-400 italic">
                                            {msg.message}
                                        </div>
                                    ) : (
                                        <div>
                                            <span className="text-cyan-300 font-semibold">{msg.sender}:</span>
                                            <span className="text-white ml-2">{msg.message}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                <div className="border-t border-white/10 p-2">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            onKeyDown={handleKeyDown}
                            placeholder={isInputFocused ? "Type message..." : "Press Enter to chat"}
                            className="flex-1 bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                            maxLength={200}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export type { ChatMessage };