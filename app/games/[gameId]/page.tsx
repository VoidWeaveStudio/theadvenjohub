//app\games\[gameId]\page.tsx
"use client";

import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { gamesRegistry } from "@/games/registry";

export default function GamePage() {
  const { gameId } = useParams();
  const [GameComponent, setGameComponent] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof gameId !== "string" || !gamesRegistry[gameId]) {
      notFound();
      return;
    }

    setLoading(true);
    gamesRegistry[gameId].module()
      .then((mod) => setGameComponent(() => mod.default || mod))
      .catch(() => notFound())
      .finally(() => setLoading(false));
  }, [gameId]);

  if (loading) {
    return (
      <div className="game-root game-modal-overlay">
        <div className="game-loader" />
        <p className="mt-4 text-sm text-zinc-400">Loading game...</p>
      </div>
    );
  }

  if (!GameComponent) return null;

  return <GameComponent />;
}