// src/features/game/ui/PartyPanel.tsx
"use client";

import { Crown, LogOut, ShieldOff, UserMinus, Users } from "lucide-react";
import type { PartyStateData } from "../network/NetworkManager";
import { EVENT_DOORS } from "../data/eventDoors";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface PartyPanelProps {
    party: PartyStateData;
    localPlayerId: string | null;
    onLeave: () => void;
    onKick: (memberId: string) => void;
}

const LOCATION_LABELS: Record<string, string> = {
    "main-world": "g.place.openWorld",
    "tower-main-hall": "g.place.mainHall",
    "tower-first-floor": "g.place.canyon",
    "tower-events": "g.place.eventsHall",
    "tower-basement": "g.place.tokenGates",
    cave: "g.place.cave",
};

// Event rooms keep their own proper names, so they are looked up separately
// from the translated location labels.
const EVENT_ROOM_NAMES: Record<string, string> = {
    ...Object.fromEntries(EVENT_DOORS.map((event) => [event.locationId, event.name])),
};

function locationLabel(locationId: string | null): string {
    if (!locationId) return "g.place.elsewhere";
    if (LOCATION_LABELS[locationId]) return LOCATION_LABELS[locationId];
    if (locationId.startsWith("player-room-")) return "g.place.personalRoom";
    if (locationId.startsWith("faction-")) return "g.place.factionRoom";
    return "g.place.elsewhere";
}

export function PartyPanel({ party, localPlayerId, onLeave, onKick }: PartyPanelProps) {
    const { t } = useLanguage();
    const isLeader = !!party.leaderId && party.leaderId === localPlayerId;

    if (!party.partyId || party.members.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="w-10 h-10 text-[#3F444C] mb-3" />
                <div className="text-[#C9CDD3] text-sm font-bold">{t("g.party.notInParty")}</div>
                <div className="text-[#6B7280] text-xs mt-2 max-w-xs">
                    {t("g.party.inviteHint").split("{action}")[0]}
                    <span className="text-[#8AD4FF]">{t("g.party.inviteAction")}</span>
                    {t("g.party.inviteHint").split("{action}")[1]}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 bg-[rgba(138,212,255,0.08)] border border-[#8AD4FF]/25 rounded-lg px-3 py-2">
                <ShieldOff className="w-4 h-4 text-[#8AD4FF] shrink-0" />
                <span className="text-[#C9CDD3] text-[11px]">
                    Party members cannot damage each other — bullets, abilities and zones all pass through.
                </span>
            </div>

            <div className="space-y-2">
                {party.members.map((member) => {
                    const isSelf = member.id === localPlayerId;
                    const healthPercent = member.maxHealth > 0
                        ? Math.max(0, Math.min(100, (member.health / member.maxHealth) * 100))
                        : 0;

                    return (
                        <div
                            key={member.id}
                            className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg px-3 py-2.5"
                        >
                            <div className="flex items-center gap-2">
                                {member.id === party.leaderId && <Crown className="w-3.5 h-3.5 text-[#FFD166] shrink-0" />}
                                <span className="text-[#E5E7EB] text-sm font-bold truncate">{member.nickname}</span>
                                {isSelf && <span className="text-[#6B7280] text-[10px]">you</span>}
                                <span className="text-[#6B7280] text-[10px] ml-auto">Lv {member.level}</span>
                                {isLeader && !isSelf && (
                                    <button
                                        onClick={() => onKick(member.id)}
                                        title={t("g.party.remove")}
                                        className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-red-400 transition-colors"
                                    >
                                        <UserMinus className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="mt-2 h-1.5 bg-black/50 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${member.alive ? "bg-gradient-to-r from-red-500 to-red-400" : "bg-zinc-700"}`}
                                    style={{ width: `${member.alive ? healthPercent : 100}%` }}
                                />
                            </div>

                            <div className="mt-1.5 flex items-center justify-between text-[10px]">
                                <span className="text-[#6B7280]">{EVENT_ROOM_NAMES[member.locationId ?? ""] ?? t(locationLabel(member.locationId))}</span>
                                <span className={member.alive ? "text-[#8B8F98]" : "text-red-400 font-bold"}>
                                    {member.alive ? `${member.health} / ${member.maxHealth}` : t("g.party.down")}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={onLeave}
                className="w-full flex items-center justify-center gap-2 bg-[rgba(255,255,255,0.04)] hover:bg-red-500/10 border border-white/10 hover:border-red-400/40 text-[#C9CDD3] hover:text-red-300 font-bold py-2.5 rounded-lg transition-colors"
            >
                <LogOut className="w-4 h-4" />
                <span>{t("g.party.leave")}</span>
            </button>
        </div>
    );
}
