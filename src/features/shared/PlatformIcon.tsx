import { Apple, Globe, Monitor, Play, Send } from "lucide-react";
import type { ComponentType } from "react";
import type { GamePlatform } from "@/core/lib/gamePlatforms";

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="15.5" cy="9.5" r="2.75" />
      <circle cx="8.5" cy="15.5" r="1.75" />
      <path d="M9.9 14.3 13.6 11.6" />
    </svg>
  );
}

const ICONS: Record<GamePlatform, ComponentType<{ className?: string }>> = {
  web: Globe,
  pc: Monitor,
  steam: SteamIcon,
  telegram: Send,
  google_play: Play,
  app_store: Apple,
};

export const PLATFORM_LABEL_KEYS: Record<GamePlatform, string> = {
  web: "platform.web",
  pc: "platform.pc",
  steam: "platform.steam",
  telegram: "platform.telegram",
  google_play: "platform.google_play",
  app_store: "platform.app_store",
};

export const PLATFORM_TONES: Record<GamePlatform, { text: string; soft: string }> = {
  web: { text: "text-emerald-400", soft: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  pc: { text: "text-violet-400", soft: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
  steam: { text: "text-slate-300", soft: "text-slate-300 bg-slate-500/10 border-slate-500/30" },
  telegram: { text: "text-sky-400", soft: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  google_play: { text: "text-lime-400", soft: "text-lime-400 bg-lime-500/10 border-lime-500/30" },
  app_store: { text: "text-blue-400", soft: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
};

export function PlatformIcon({ platform, className = "w-4 h-4" }: { platform: GamePlatform; className?: string }) {
  const Icon = ICONS[platform];
  return <Icon className={className} />;
}
