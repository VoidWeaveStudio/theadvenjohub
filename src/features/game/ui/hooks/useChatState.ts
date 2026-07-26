// src/features/game/ui/hooks/useChatState.ts
import { useCallback, useState } from "react";
import { ChatMessage } from "../Chat";

export function useChatState() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [nickname, setNickname] = useState("Player");
  const [isChatVisible, setIsChatVisible] = useState(true);

  const handleChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages((prev) => [...prev.slice(-99), message]);
  }, []);

  const handleNicknameLoaded = useCallback((nick: string) => {
    if (nick) setNickname(nick);
  }, []);

  return {
    chatMessages,
    nickname,
    setNickname,
    isChatVisible,
    setIsChatVisible,
    handleChatMessage,
    handleNicknameLoaded,
  };
}
