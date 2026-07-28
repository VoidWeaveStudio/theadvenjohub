// src/features/game/ui/shell/PlayerTag.tsx
"use client";

import { Crown, Gem, Users } from "lucide-react";

export type PlayerTagBadge = "founder" | "creator" | null;

export type PlayerTagFaction = {
    image: string | null;
    symbol: string | null;
    number: number;
} | null;

interface PlayerTagProps {
    nickname: string;
    faction: PlayerTagFaction;
    badge?: PlayerTagBadge;
    size?: "sm" | "md";
    layout?: "stacked" | "inline";
}

const BADGE_COLOR: Record<Exclude<PlayerTagBadge, null>, string> = {
    creator: "#C084FC",
    founder: "#FFD166",
};

const DEFAULT_COLOR = "#4FD1FF";

function BadgeIcon({ badge, className }: { badge: PlayerTagBadge; className?: string }) {
    if (badge === "founder") return <Crown className={className} />;
    if (badge === "creator") return <Gem className={className} />;
    return null;
}

export function PlayerTag({ nickname, faction, badge = null, size = "md", layout = "stacked" }: PlayerTagProps) {
    if (!faction) {
        return <span className={size === "sm" ? "text-sm" : "text-base"}>{nickname}</span>;
    }

    const accentColor = badge ? BADGE_COLOR[badge] : DEFAULT_COLOR;
    const imageSize = layout === "inline" ? "w-4 h-4" : size === "sm" ? "w-7 h-7" : "w-9 h-9";

    const image = faction.image ? (
        <img src={faction.image} alt="" className={`${imageSize} rounded-md object-cover flex-shrink-0`} />
    ) : (
        <div className={`${imageSize} rounded-md bg-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0`}>
            <Users className={layout === "inline" ? "w-2.5 h-2.5 text-[#8B8F98]" : "w-4 h-4 text-[#8B8F98]"} />
        </div>
    );

    if (layout === "inline") {
        return (
            <span className="inline-flex items-center gap-1.5 align-middle">
                {image}
                {faction.symbol && (
                    <span
                        className="font-oxanium font-black uppercase tracking-wider text-[10px] inline-flex items-center gap-0.5"
                        style={{ color: accentColor }}
                    >
                        <BadgeIcon badge={badge} className="w-2.5 h-2.5" />${faction.symbol}
                    </span>
                )}
                <span className={size === "sm" ? "text-sm" : "text-base"}>{nickname}</span>
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-2 align-middle">
            {image}
            <span className="flex flex-col leading-tight min-w-0">
                {faction.symbol && (
                    <span
                        className="font-oxanium font-black uppercase tracking-wider text-[10px] inline-flex items-center gap-1"
                        style={{ color: accentColor }}
                    >
                        <BadgeIcon badge={badge} className="w-2.5 h-2.5 flex-shrink-0" />${faction.symbol}
                    </span>
                )}
                <span className={`${size === "sm" ? "text-sm" : "text-base"} text-[#E5E7EB] font-medium truncate`}>
                    {nickname}
                </span>
            </span>
        </span>
    );
}
