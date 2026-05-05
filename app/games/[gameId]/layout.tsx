//app\games\[gameId]\layout.tsx
export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="game-root-wrapper">{children}</div>;
}