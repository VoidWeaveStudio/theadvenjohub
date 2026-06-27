// src/features/game/components/VoiceChat.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

interface VoiceChatProps {
  socket: Socket | null;
  roomId: string | null;
  myUsername: string;
}

export function VoiceChat({ socket, roomId, myUsername }: VoiceChatProps) {
  const [isTalking, setIsTalking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [talkingPlayers, setTalkingPlayers] = useState<Set<string>>(new Set());
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleVoiceSignal = async (data: any) => {
      const { type, senderId, description, candidate } = data;

      try {
        if (type === 'offer') {
          const pc = createPeerConnection(senderId);
          await pc.setRemoteDescription(new RTCSessionDescription(description));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('voiceSignal', {
            type: 'answer',
            targetId: senderId,
            description: pc.localDescription
          });
        } else if (type === 'answer') {
          const pc = peerConnectionsRef.current.get(senderId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(description));
          }
        } else if (type === 'candidate') {
          const pc = peerConnectionsRef.current.get(senderId);
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      } catch (err) {
        console.error('Voice signal error:', err);
      }
    };

    const handlePlayerTalking = (data: { playerId: string; isTalking: boolean }) => {
      setTalkingPlayers(prev => {
        const next = new Set(prev);
        if (data.isTalking) {
          next.add(data.playerId);
        } else {
          next.delete(data.playerId);
        }
        return next;
      });
    };

    socket.on('voiceSignal', handleVoiceSignal);
    socket.on('playerTalking', handlePlayerTalking);

    return () => {
      socket.off('voiceSignal', handleVoiceSignal);
      socket.off('playerTalking', handlePlayerTalking);
    };
  }, [socket, roomId]);

  const createPeerConnection = (peerId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('voiceSignal', {
          type: 'candidate',
          targetId: peerId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.play().catch(console.error);
      audioElementsRef.current.set(peerId, audio);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  };

  const startVoiceChat = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      localStreamRef.current = stream;
      setIsTalking(true);
      socket?.emit('startVoiceChat', { roomId });
    } catch (err) {
      console.error('Failed to get microphone:', err);
      alert('Не удалось получить доступ к микрофону. Проверьте разрешения браузера.');
    }
  };

  const stopVoiceChat = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    audioElementsRef.current.forEach(audio => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();
    setIsTalking(false);
    setIsMuted(false);
    socket?.emit('stopVoiceChat', { roomId });
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peerConnectionsRef.current.forEach(pc => pc.close());
      audioElementsRef.current.forEach(audio => {
        audio.pause();
        audio.srcObject = null;
      });
    };
  }, []);

  return (
    <div className="absolute bottom-32 left-8 bg-black/80 backdrop-blur-md px-4 py-3 rounded-xl shadow-2xl border border-white/10">
      <div className="flex items-center gap-3">
        <button
          onClick={isTalking ? stopVoiceChat : startVoiceChat}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            isTalking
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/50'
              : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/50'
          }`}
        >
          {isTalking ? '🔴 Stop' : '🎤 Start'}
        </button>

        {isTalking && (
          <button
            onClick={toggleMute}
            className={`px-3 py-2 rounded-lg font-semibold transition-all ${
              isMuted
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-white'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        )}

        {talkingPlayers.size > 0 && (
          <div className="flex items-center gap-1 ml-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-white text-sm">{talkingPlayers.size} talking</span>
          </div>
        )}
      </div>
    </div>
  );
}