import { GameClient } from "@/features/game/GameClient";

interface GamePageProps {
  params: {
    slug: string;
  };
}

export default async function GamePage({ params }: GamePageProps) {
  const resolvedParams = await params;
  return <GameClient slug={resolvedParams.slug} />;
}