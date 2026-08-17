// src/features/game/ui/DeathScreen.tsx
"use client";

import { Building2, Home, Mountain, Package, ShieldCheck } from "lucide-react";
import type { DeathLootInfo, RespawnOptions, RespawnTarget } from "../network/NetworkManager";

interface DeathScreenProps {
  isVisible: boolean;
  killerName: string | null;
  options?: RespawnOptions;
  loot?: DeathLootInfo;
  onRespawn: (target: RespawnTarget) => void;
}

function LootNotice({ loot }: { loot: DeathLootInfo }) {
  if (loot.outcome === "empty" || loot.outcome === "kept") return null;

  if (loot.outcome === "insured") {
    return (
      <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md border border-emerald-500/40 rounded-lg px-5 py-3 max-w-md">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <div className="text-left">
          <div className="text-emerald-300 text-sm font-bold">Insurance paid out</div>
          <div className="text-zinc-400 text-[11px]">Your tokens came back with you. The charge is spent.</div>
        </div>
      </div>
    );
  }

  const stacks = loot.stacks ?? 0;
  const inSegment = typeof loot.segment === "number";

  return (
    <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md border border-amber-500/40 rounded-lg px-5 py-3 max-w-md">
      <Package className="w-5 h-5 text-amber-400 shrink-0" />
      <div className="text-left">
        <div className="text-amber-300 text-sm font-bold">
          You dropped {stacks} stack{stacks === 1 ? "" : "s"}
          {inSegment ? ` in Segment ${loot.segment}` : ""}
        </div>
        <div className="text-zinc-400 text-[11px]">
          {inSegment
            ? "The crate lasts five minutes and only you can see it. Leave the game and it is gone for good."
            : "The crate lasts five minutes where you fell, and anyone can take it."}
        </div>
      </div>
    </div>
  );
}

const CHOICES: Array<{
  target: RespawnTarget;
  label: string;
  hint: string;
  icon: typeof Home;
  lockedHint: string;
}> = [
    {
      target: "canyon_hub",
      label: "Canyon Outpost",
      hint: "Straight back for your run",
      icon: Mountain,
      lockedHint: "You did not fall in the canyon",
    },
    {
      target: "home",
      label: "Your Room",
      hint: "At your spawn beacon",
      icon: Home,
      lockedHint: "Build a spawn beacon in your room",
    },
    {
      target: "hall",
      label: "Main Hall",
      hint: "The safe way back",
      icon: Building2,
      lockedHint: "",
    },
  ];

export function DeathScreen({ isVisible, killerName, options, loot, onRespawn }: DeathScreenProps) {
  if (!isVisible) return null;

  const available: RespawnOptions = options ?? { hall: true, home: false, canyon_hub: false };

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-gradient-to-b from-red-950/40 via-black/60 to-black/80 backdrop-blur-sm">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />

      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-70 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-70 pointer-events-none" />

      <div className="relative flex flex-col items-center gap-6 animate-fade-in">
        <div className="text-center">
          <h1 className="text-7xl md:text-8xl font-black text-red-500 tracking-wider drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse">
            YOU DIED
          </h1>
          <div className="mt-2 h-1 w-64 mx-auto bg-gradient-to-r from-transparent via-red-500 to-transparent" />
        </div>

        {killerName && (
          <div className="bg-black/60 backdrop-blur-md border border-red-500/30 rounded-lg px-6 py-3">
            <div className="text-zinc-400 text-sm text-center mb-1">Killed by</div>
            <div className="text-white text-2xl font-bold text-center">
              {killerName}
            </div>
          </div>
        )}

        {loot && <LootNotice loot={loot} />}

        <div className="text-zinc-400 text-sm tracking-widest uppercase">Choose where to come back</div>

        <div className="flex flex-wrap items-stretch justify-center gap-3 px-4">
          {CHOICES.map((choice) => {
            const enabled = available[choice.target];
            const Icon = choice.icon;

            return (
              <button
                key={choice.target}
                disabled={!enabled}
                onClick={() => onRespawn(choice.target)}
                className="w-44 bg-black/60 backdrop-blur-md border border-red-500/30 hover:border-red-400 hover:bg-red-950/40 disabled:border-white/10 disabled:bg-black/40 disabled:cursor-not-allowed rounded-lg px-4 py-4 transition-colors text-center group"
              >
                <Icon className={`w-6 h-6 mx-auto mb-2 ${enabled ? "text-red-400 group-hover:scale-110 transition-transform" : "text-zinc-600"}`} />
                <div className={`font-bold text-sm ${enabled ? "text-white" : "text-zinc-500"}`}>{choice.label}</div>
                <div className="text-[11px] text-zinc-500 mt-1">{enabled ? choice.hint : choice.lockedHint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
