// src/features/game/ui/RoomConsolePanel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { SlidersHorizontal, Loader2, Trash2, UserPlus, Hammer } from "lucide-react";
import { SoundManager } from "../core/SoundManager";
import { gameFetch } from "../utils/gameFetch";
import { ROOM_ACCESS_LABELS, type RoomAccess } from "@/core/lib/roomAccess";
import { useLanguage } from "@/core/i18n/LanguageContext";

const PERSONAL_ACCESS: RoomAccess[] = ["public", "invite", "closed"];

interface RoomInvite {
    id: string;
    nickname: string | null;
    wallet: string;
    usesLeft: number | null;
    permanent: boolean;
}

interface RoomAccessResponse {
    personalAccess: RoomAccess;
    factions: Array<{ id: string; name: string; access: RoomAccess; canManage: boolean }>;
}

interface RoomConsolePanelProps {
    isOpen: boolean;
    factionId: string | null;
    canBuild: boolean;
    onClose: () => void;
    onNotification: (message: string, duration?: number) => void;
    onOpenBuildEditor: () => void;
}

export function RoomConsolePanel({ isOpen, factionId, canBuild, onClose, onNotification, onOpenBuildEditor }: RoomConsolePanelProps) {
    const { t } = useLanguage();
    const [state, setState] = useState<RoomAccessResponse | null>(null);
    const [invites, setInvites] = useState<RoomInvite[]>([]);
    const [nickname, setNickname] = useState("");
    const [permanent, setPermanent] = useState(false);
    const [busy, setBusy] = useState(false);

    const isFactionRoom = factionId !== null;

    const loadInvites = useCallback(async () => {
        if (isFactionRoom) return;
        try {
            const res = await gameFetch("/api/game/room-invites");
            const data = await res.json();
            if (Array.isArray(data?.invites)) setInvites(data.invites);
        } catch {
        }
    }, [isFactionRoom]);

    useEffect(() => {
        if (!isOpen) {
            setState(null);
            setInvites([]);
            setNickname("");
            return;
        }

        SoundManager.getInstance().play('modal-open');

        gameFetch("/api/game/room-access")
            .then((res) => res.json())
            .then((data) => {
                if (!data?.error) setState(data);
            })
            .catch(() => { });

        loadInvites();
    }, [isOpen, loadInvites]);

    const currentAccess: RoomAccess | null = !state
        ? null
        : isFactionRoom
            ? state.factions.find((f) => f.id === factionId)?.access ?? "members"
            : state.personalAccess;

    const canManage = !state
        ? false
        : isFactionRoom
            ? state.factions.find((f) => f.id === factionId)?.canManage ?? false
            : true;

    const saveAccess = async (access: RoomAccess) => {
        setBusy(true);
        try {
            const res = await gameFetch("/api/game/room-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    isFactionRoom ? { scope: "faction", factionId, access } : { scope: "personal", access }
                ),
            });
            if (!res.ok) throw new Error("save_failed");

            setState((prev) => {
                if (!prev) return prev;
                if (!isFactionRoom) return { ...prev, personalAccess: access };
                return {
                    ...prev,
                    factions: prev.factions.map((f) => (f.id === factionId ? { ...f, access } : f)),
                };
            });
            onNotification("🔒 Room access updated", 2000);
        } catch {
            onNotification("⚠️ Could not update access", 2500);
        } finally {
            setBusy(false);
        }
    };

    const sendInvite = async () => {
        const trimmed = nickname.trim();
        if (!trimmed || busy) return;

        setBusy(true);
        try {
            const res = await gameFetch("/api/game/room-invites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nickname: trimmed, permanent }),
            });
            const data = await res.json();

            if (!res.ok) {
                onNotification(
                    data?.error === "player_not_found" ? t("g.roomConsole.noSuchPlayer") : t("g.roomConsole.inviteFailed"),
                    2500
                );
                return;
            }

            setNickname("");
            onNotification(permanent ? t("g.roomConsole.permanentIssued") : t("g.roomConsole.oneTimeIssued"), 2000);
            await loadInvites();
        } catch {
            onNotification(t("g.roomConsole.inviteFailed"), 2500);
        } finally {
            setBusy(false);
        }
    };

    const revokeInvite = async (inviteId: string) => {
        setBusy(true);
        try {
            await gameFetch("/api/game/room-invites", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteId }),
            });
            await loadInvites();
        } catch {
        } finally {
            setBusy(false);
        }
    };

    if (!isOpen) return null;

    const options = PERSONAL_ACCESS;

    return (
        <div
            className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-2 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-md bg-[rgba(10,12,20,0.95)] border-2 border-[#66CCFF]/35 rounded-[16px] p-6 shadow-[0_0_35px_rgba(102,204,255,0.15)] max-h-[calc(85*var(--game-vh))] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-5 h-5 text-[#66CCFF]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">
                            {isFactionRoom ? t("g.roomConsole.factionTitle") : t("g.roomConsole.title")}
                        </h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        ✕
                    </button>
                </div>

                {canBuild && (
                    <button
                        onClick={() => { onClose(); onOpenBuildEditor(); }}
                        className="w-full flex items-center justify-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-[#4FD1FF]/15 border border-[#4FD1FF]/40 text-[#4FD1FF] text-sm font-black hover:bg-[#4FD1FF]/25 transition-colors"
                    >
                        <Hammer className="w-4 h-4" /> {t("g.roomConsole.openBuildEditor")}
                    </button>
                )}

                {!state ? (
                    <div className="flex items-center gap-2 text-[#8B8F98] text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> {t("g.roomConsole.reading")}
                    </div>
                ) : !canManage ? (
                    <p className="text-[#FFD166] text-sm bg-[#FFD166]/10 border border-[#FFD166]/20 rounded-lg px-3 py-2">
                        {t("g.roomConsole.onlyFounder")}
                    </p>
                ) : (
                    <>
                        {isFactionRoom ? (
                            <p className="text-[#8B8F98] text-sm">
                                {t("g.roomConsole.factionAlwaysOpen")}
                            </p>
                        ) : (
                            <>
                                <div className="text-[#8B8F98] text-xs uppercase tracking-wide mb-2">{t("g.roomConsole.whoMayEnter")}</div>
                                <div className="grid grid-cols-1 gap-1.5 mb-5">
                                    {options.map((access) => (
                                        <button
                                            key={access}
                                            onClick={() => saveAccess(access)}
                                            disabled={busy}
                                            className={`px-3 py-2 rounded-md text-xs font-bold text-left transition-colors disabled:opacity-50 ${currentAccess === access
                                                ? "bg-[#66CCFF]/20 text-[#66CCFF] border border-[#66CCFF]/40"
                                                : "bg-white/5 text-[#8B8F98] border border-white/10 hover:text-[#E5E7EB]"
                                                }`}
                                        >
                                            {t(ROOM_ACCESS_LABELS[access])}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {isFactionRoom ? null : (
                            <>
                                <div className="text-[#8B8F98] text-xs uppercase tracking-wide mb-2">{t("g.roomConsole.invitations")}</div>

                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value.slice(0, 30))}
                                        onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                                        placeholder={t("g.roomConsole.nicknamePlaceholder")}
                                        className="flex-1 min-w-0 bg-[rgba(255,255,255,0.04)] text-[#E5E7EB] px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-[#66CCFF]/50 outline-none"
                                    />
                                    <button
                                        onClick={sendInvite}
                                        disabled={busy || nickname.trim().length === 0}
                                        className="btn-secondary px-3 py-2 text-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                    </button>
                                </div>

                                <label className="flex items-center gap-2 mb-4 text-xs text-[#8B8F98] cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={permanent}
                                        onChange={(e) => setPermanent(e.target.checked)}
                                        className="accent-[#66CCFF]"
                                    />
                                    {t("g.roomConsole.permanentPassHint")}
                                </label>

                                {invites.length === 0 ? (
                                    <p className="text-[#8B8F98] text-sm">{t("g.roomConsole.noInvites")}</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {invites.map((invite) => (
                                            <div key={invite.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[#E5E7EB] text-sm font-bold truncate">
                                                        {invite.nickname ?? invite.wallet}
                                                    </div>
                                                    <div className="text-[#8B8F98] text-xs">
                                                        {invite.permanent ? t("g.roomConsole.permanentPass") : t("g.roomConsole.oneTimeLeft", { count: invite.usesLeft ?? 0 })}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => revokeInvite(invite.id)}
                                                    disabled={busy}
                                                    className="bg-transparent border-0 p-1 text-[#8B8F98] hover:text-[#FF5757] transition-colors disabled:opacity-50"
                                                    title={t("g.roomConsole.revoke")}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
