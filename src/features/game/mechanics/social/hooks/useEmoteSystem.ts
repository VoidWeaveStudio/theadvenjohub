import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { EmoteId } from '../types';
import { EMOTES } from '../config';

interface UseEmoteSystemProps {
  playerModelRef: React.MutableRefObject<THREE.Group | null>;
  socket?: Socket | null;
  isInGame?: boolean;
}

export function useEmoteSystem({ playerModelRef, socket, isInGame = true }: UseEmoteSystemProps) {
  const [activeEmote, setActiveEmote] = useState<EmoteId | null>(null);
  const emoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playEmote = useCallback((emoteId: EmoteId) => {
    const emote = EMOTES.find((e) => e.id === emoteId);
    if (!emote) return;

    if (emoteTimerRef.current) {
      clearTimeout(emoteTimerRef.current);
    }

    setActiveEmote(emoteId);

    if (socket?.connected && !isInGame) {
      socket.emit('lobbyEmote', { emoteId });
    }

    emoteTimerRef.current = setTimeout(() => {
      setActiveEmote(null);
      emoteTimerRef.current = null;
    }, emote.duration);
  }, [socket, isInGame]);

  const stopEmote = useCallback(() => {
    if (emoteTimerRef.current) {
      clearTimeout(emoteTimerRef.current);
      emoteTimerRef.current = null;
    }
    setActiveEmote(null);
  }, []);

  useEffect(() => () => stopEmote(), [stopEmote]);

  return {
    activeEmote,
    playEmote,
    stopEmote,
    emotes: EMOTES,
  };
}