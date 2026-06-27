// src/features/game/components/VoiceChat.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

interface VoiceChatProps {
  socket: Socket | null;
  roomId: string | null;
  myUsername: string;
  isChatOpenRef?: React.MutableRefObject<boolean>;
}

export function VoiceChat({ socket, roomId, myUsername, isChatOpenRef }: VoiceChatProps) {
  const [isTalking, setIsTalking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [talkingPlayers, setTalkingPlayers] = useState<Set<string>>(new Set());
  const [hasPermission, setHasPermission] = useState(false);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const isTalkingRef = useRef(false);

  useEffect(() => {
    const initMicrophone = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        localStreamRef.current = stream;
        setHasPermission(true);
        stream.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      } catch (err) {
        console.error('Microphone permission denied:', err);
        setHasPermission(false);
      }
    };

    if (socket && roomId) {
      initMicrophone();
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [socket, roomId]);

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

  const startTalking = async () => {
    if (isTalkingRef.current || isMuted || isChatOpenRef?.current) return;

    try {
      if (!localStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        localStreamRef.current = stream;
      }

      localStreamRef.current.getTracks().forEach(track => {
        track.enabled = true;
      });

      isTalkingRef.current = true;
      setIsTalking(true);
      socket?.emit('startVoiceChat', { roomId });
    } catch (err) {
      console.error('Failed to start talking:', err);
    }
  };

  const stopTalking = () => {
    if (!isTalkingRef.current) return;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.enabled = false;
      });
    }

    isTalkingRef.current = false;
    setIsTalking(false);
    socket?.emit('stopVoiceChat', { roomId });
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (isTalkingRef.current && !isMuted) {
      stopTalking();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyV' && !e.repeat && !isChatOpenRef?.current) {
        e.preventDefault();
        startTalking();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyV') {
        e.preventDefault();
        stopTalking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isMuted, isChatOpenRef]);

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
    <div className="absolute bottom-8 left-8 bg-black/80 backdrop-blur-md px-4 py-3 rounded-xl shadow-2xl border border-white/10">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${
          isTalking ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 
          hasPermission ? 'bg-zinc-500' : 'bg-red-500'
        }`} />

        <div className="text-white text-sm">
          {isTalking ? (
            <span className="text-green-400 font-semibold">🎤 Talking...</span>
          ) : isMuted ? (
            <span className="text-yellow-400">🔇 Muted</span>
          ) : hasPermission ? (
            <span className="text-zinc-400">Hold <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-white font-mono text-xs">V</kbd> to talk</span>
          ) : (
            <span className="text-red-400">🎤 No mic access</span>
          )}
        </div>

        {hasPermission && (
          <button
            onClick={toggleMute}
            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
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
          <div className="flex items-center gap-1 ml-2 px-2 py-1 bg-green-900/50 rounded-lg border border-green-500/30">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs font-semibold">{talkingPlayers.size}</span>
          </div>
        )}
      </div>
    </div>
  );
}