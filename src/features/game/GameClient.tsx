"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/core/auth/AuthProvider";
import { apiGet } from "@/core/api/client";
import { GameLobby } from "@/features/game/GameLobby";
import { GameWorld } from "@/features/game/GameWorld";

interface GameClientProps {
  slug: string;
}

interface GameFullData {
  id: string;
  slug: string;
  title: string;
  isOwned: boolean;
}

export function GameClient({ slug }: GameClientProps) {
  const router = useRouter();
  const { isAuthorized, userWallet } = useAuth();
  const [gameData, setGameData] = useState<GameFullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inGame, setInGame] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  console.log("🎮 GameClient:", { slug, isAuthorized, userWallet });

  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthChecked(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!authChecked) return;

    if (!isAuthorized) {
      setError("Please login to play");
      setLoading(false);
      return;
    }

    checkOwnership();
  }, [isAuthorized, slug, authChecked]);

  const checkOwnership = async () => {
    console.log("🔍 Checking ownership for:", slug);
    try {
      const data = await apiGet<GameFullData>(`/api/games/${slug}/full`);
      console.log("📦 Game data:", data);
      setGameData(data);
      
      if (!data.isOwned) {
        console.error("❌ Game not owned!");
        setError("You don't own this game");
        setTimeout(() => router.push(`/games/${slug}`), 2000);
      }
    } catch (err) {
      console.error("❌ Check error:", err);
      setError("Failed to verify ownership");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 text-center">
          <div className="text-white text-xl">Loading game...</div>
        </div>
      </div>
    );
  }

  if (error || !gameData?.isOwned) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-zinc-900 border border-red-500/30 rounded-xl p-8 text-center">
          <div className="text-red-500 text-xl">{error || "Access denied"}</div>
        </div>
      </div>
    );
  }

  if (!inGame) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <GameLobby
          wallet={userWallet || ""}
          onStart={() => setInGame(true)}
          onExit={() => router.push(`/games/${slug}`)}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black" style={{ top: "64px" }}>
      <GameWorld 
        key={userWallet}
        wallet={userWallet || ""} 
        onExit={() => setInGame(false)} 
      />
    </div>
  );
}