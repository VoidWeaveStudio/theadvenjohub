// src/features/game/ui/hooks/useChatState.ts
import { useCallback, useState } from "react";
import { ChatMessage } from "../Chat";

export function useChatState() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [factionMessages, setFactionMessages] = useState<Record<string, ChatMessage[]>>({});
  const [nickname, setNickname] = useState("Player");
  const [isChatVisible, setIsChatVisible] = useState(true);

  const handleChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages((prev) => [...prev.slice(-99), message]);
  }, []);

  const handleFactionChatMessage = useCallback((message: ChatMessage & { factionId: string }) => {
    setFactionMessages((prev) => {
      const existing = prev[message.factionId] || [];
      return { ...prev, [message.factionId]: [...existing.slice(-99), message] };
    });
  }, []);

  const handleNicknameLoaded = useCallback((nick: string) => {
    if (nick) setNickname(nick);
  }, []);

  return {
    chatMessages,
    factionMessages,
    nickname,
    setNickname,
    isChatVisible,
    setIsChatVisible,
    handleChatMessage,
    handleFactionChatMessage,
    handleNicknameLoaded,
  };
}
