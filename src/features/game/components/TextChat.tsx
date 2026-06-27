// src/features/game/components/TextChat.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  team?: number;
}

interface TextChatProps {
  socket: Socket | null;
  roomId: string | null;
  myUsername: string;
  myTeam?: number;
}

export function TextChat({ socket, roomId, myUsername, myTeam }: TextChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isTeamChat, setIsTeamChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleChatMessage = (data: ChatMessage) => {
      setMessages(prev => [...prev.slice(-50), data]);
    };

    socket.on('chatMessage', handleChatMessage);

    return () => {
      socket.off('chatMessage', handleChatMessage);
    };
  }, [socket, roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !socket || !roomId) return;

    socket.emit('chatMessage', {
      roomId,
      message: inputMessage.trim(),
      username: myUsername,
      team: myTeam,
      isTeamChat
    });

    setInputMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <div className="absolute bottom-48 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10">
            <div className="text-white/60 text-sm flex items-center gap-2">
              Press <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono">Y</kbd> to chat
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div 
          className="absolute bottom-32 left-1/2 -translate-x-1/2 w-[500px] max-w-[90vw] bg-black/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/10 overflow-hidden pointer-events-auto z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-zinc-900/80 px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold flex items-center gap-2">
                <span>💬</span>
                <span>Chat</span>
              </span>
              <button
                onClick={() => setIsTeamChat(!isTeamChat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isTeamChat
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {isTeamChat ? '👥 Team' : '🌍 All'}
              </button>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-700"
            >
              ✕
            </button>
          </div>

          <div className="h-64 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 ? (
              <div className="text-zinc-500 text-center text-sm py-8">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`font-bold text-sm ${
                        msg.username === myUsername ? 'text-yellow-400' : 'text-blue-400'
                      }`}>
                        {msg.username}
                      </span>
                      <span className="text-zinc-600 text-xs">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-white text-sm mt-0.5 break-words">{msg.message}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="bg-zinc-900/80 px-4 py-3 border-t border-white/10">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isTeamChat ? 'Message to team...' : 'Message to all...'}
                className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                maxLength={200}
                autoComplete="off"
              />
              <button
                onClick={() => {
                  sendMessage();
                  setIsOpen(false);
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
            <div className="text-zinc-500 text-xs mt-2">
              Press <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-white font-mono">Enter</kbd> to send • <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-white font-mono">Esc</kbd> to close
            </div>
          </div>
        </div>
      )}
    </>
  );
}