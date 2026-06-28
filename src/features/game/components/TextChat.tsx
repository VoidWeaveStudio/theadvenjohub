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
  isTeamChat?: boolean;
}

interface TextChatProps {
  socket: Socket | null;
  channelId: string | null;
  myUsername: string;
  myTeam?: number;
  mode: '5v5' | 'ffa' | 'lobby';
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

export function TextChat({ socket, channelId, myUsername, myTeam, mode, isOpen, onToggle }: TextChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTeamChat, setIsTeamChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!socket || !channelId) return;

    const handleChatMessage = (data: ChatMessage) => {
      setMessages(prev => [...prev.slice(-50), data]);
    };

    socket.on('chatMessage', handleChatMessage);

    return () => {
      socket.off('chatMessage', handleChatMessage);
    };
  }, [socket, channelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setInputMessage('');
    }
  }, [isOpen]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !socket || !channelId) return;

    socket.emit('chatMessage', {
      channelId,
      message: inputMessage.trim(),
      username: myUsername,
      team: myTeam,
      isTeamChat: isTeamChat && mode === '5v5'
    });

    setInputMessage('');
    onToggle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onToggle(false);
    }
  };

  return (
    <>
      {/* Превью сообщений */}
      <div className="absolute bottom-32 left-8 w-96 max-w-[400px] pointer-events-none z-30">
        <div className="space-y-1 max-h-64 overflow-hidden">
          {messages.slice(-8).map((msg) => (
            <div 
              key={msg.id} 
              className={`px-3 py-1.5 rounded-lg backdrop-blur-sm text-sm ${
                msg.isTeamChat 
                  ? 'bg-blue-900/60 border border-blue-500/30' 
                  : 'bg-black/60 border border-white/10'
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className={`font-bold text-xs ${
                  msg.isTeamChat ? 'text-blue-300' : 
                  msg.username === myUsername ? 'text-yellow-400' : 'text-white'
                }`}>
                  {msg.isTeamChat && <span className="text-blue-400">[TEAM] </span>}
                  {msg.username}:
                </span>
                <span className="text-white/90 text-xs break-words">{msg.message}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Окно ввода */}
      {isOpen && (
        <div className="absolute bottom-8 left-8 w-[500px] max-w-[90vw] pointer-events-auto z-50">
          <div className="bg-black/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/10 overflow-hidden">
            <div className="bg-zinc-900/80 px-4 py-2 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-sm flex items-center gap-2">
                  <span>💬</span>
                  <span>{mode === 'lobby' ? 'Lobby Chat' : 'Chat'}</span>
                </span>
                {/* ✅ Показываем кнопку Team/All только в игре 5v5 */}
                {mode === '5v5' && (
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
                )}
              </div>
              <div className="text-zinc-500 text-xs">
                <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-white font-mono">Enter</kbd> send • <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-white font-mono">Esc</kbd> close
              </div>
            </div>

            <div className="px-4 py-3">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === 'lobby' 
                    ? 'Message to lobby...' 
                    : isTeamChat && mode === '5v5' 
                      ? 'Message to team...' 
                      : 'Message to all...'
                }
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                maxLength={200}
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}