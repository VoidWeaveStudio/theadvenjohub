// src/features/admin/ui/AdminEventsTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight, Eraser, Save } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";
import { EVENT_DOORS_BY_ID, eventWindow, type ResolvedEvent } from "@/features/game/data/eventDoors";

interface AdminEvent extends ResolvedEvent {
    runs: number;
    bestWave: number;
}

interface Draft {
    enabled: boolean;
    title: string;
    tagline: string;
    description: string;
    rewardText: string;
    scheduleNote: string;
    startsAt: string;
    endsAt: string;
    repeatDays: number;
    minParty: number;
    maxParty: number;
    cooldownMinutes: number;
    ashPerWave: number;
    xpPerWave: number;
    ashCap: number;
    xpCap: number;
}

const DRAFT_KEYS: (keyof Draft)[] = [
    "enabled",
    "title",
    "tagline",
    "description",
    "rewardText",
    "scheduleNote",
    "startsAt",
    "endsAt",
    "repeatDays",
    "minParty",
    "maxParty",
    "cooldownMinutes",
    "ashPerWave",
    "xpPerWave",
    "ashCap",
    "xpCap",
];

function toLocalInput(epoch: number | null): string {
    if (epoch === null) return "";
    const date = new Date(epoch - new Date(epoch).getTimezoneOffset() * 60000);
    return date.toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDraft(event: AdminEvent): Draft {
    return {
        enabled: event.enabled,
        title: event.title,
        tagline: event.tagline,
        description: event.description,
        rewardText: event.rewardText,
        scheduleNote: event.scheduleNote,
        startsAt: toLocalInput(event.startsAt),
        endsAt: toLocalInput(event.endsAt),
        repeatDays: event.repeatDays,
        minParty: event.minParty,
        maxParty: event.maxParty,
        cooldownMinutes: event.cooldownMinutes,
        ashPerWave: event.ashPerWave,
        xpPerWave: event.xpPerWave,
        ashCap: event.ashCap,
        xpCap: event.xpCap,
    };
}

function isDirty(draft: Draft, event: AdminEvent): boolean {
    const current = toDraft(event);
    return DRAFT_KEYS.some((key) => draft[key] !== current[key]);
}

function describeWindow(draft: Draft): { label: string; tone: string } {
    if (!draft.startsAt && !draft.endsAt) {
        return { label: "No schedule — the toggle alone decides", tone: "#6B7280" };
    }

    const preview = eventWindow({
        startsAt: draft.startsAt ? new Date(draft.startsAt).getTime() : null,
        endsAt: draft.endsAt ? new Date(draft.endsAt).getTime() : null,
        repeatDays: draft.repeatDays,
    } as ResolvedEvent);

    const stamp = (value: number | null) => (value === null ? "—" : new Date(value).toLocaleString());

    if (preview.state === "open") {
        return { label: `Running now, closes ${stamp(preview.closesAt)}`, tone: "#4ADE80" };
    }
    if (preview.state === "upcoming") {
        return { label: `Next window ${stamp(preview.opensAt)} → ${stamp(preview.closesAt)}`, tone: "#FFD166" };
    }
    return { label: `Window finished ${stamp(preview.closesAt)}`, tone: "#FF5757" };
}

const inputClass =
    "w-full bg-black/40 text-white px-3 py-1.5 rounded text-xs border border-white/10 focus:border-cyan-500/50 outline-none";
const labelClass = "block text-[#6B7280] text-[10px] font-bold tracking-wider uppercase mb-1";

export const AdminEventsTable = forwardRef<AdminTableRef>(function AdminEventsTable(_props, ref) {
    const [events, setEvents] = useState<AdminEvent[]>([]);
    const [gameSlug, setGameSlug] = useState<string | null>(null);
    const [gameName, setGameName] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [expanded, setExpanded] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/events", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                const list: AdminEvent[] = data.events || [];
                setEvents(list);
                setGameSlug(data.gameSlug || null);
                setGameName(data.gameName || null);
                setDrafts(Object.fromEntries(list.map((event) => [event.id, toDraft(event)])));
            }
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        load();
    }, []);

    const patch = (eventId: string, changes: Partial<Draft>) => {
        setDrafts((prev) => ({ ...prev, [eventId]: { ...prev[eventId], ...changes } }));
    };

    const save = async (event: AdminEvent) => {
        const draft = drafts[event.id];
        if (!draft) return;

        setError(null);
        setBusyId(event.id);
        try {
            const res = await signedFetch("/api/admin/events", "event_config_set", `event:${event.id}`, {
                eventId: event.id,
                gameSlug,
                ...draft,
                startsAt: fromLocalInput(draft.startsAt),
                endsAt: fromLocalInput(draft.endsAt),
            });
            if (res.ok) {
                const data = await res.json();
                const saved = {
                    ...data,
                    startsAt: data.startsAt ? new Date(data.startsAt).getTime() : null,
                    endsAt: data.endsAt ? new Date(data.endsAt).getTime() : null,
                };
                setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, ...saved } : e)));
                setDrafts((prev) => ({ ...prev, [event.id]: toDraft({ ...event, ...saved }) }));
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Save failed");
            }
        } catch (err: any) {
            setError(err.message || "Save failed");
        } finally {
            setBusyId(null);
        }
    };

    const clearBoard = async (event: AdminEvent) => {
        if (!window.confirm(`Wipe the leaderboard for ${event.title}? Every recorded run is deleted.`)) return;

        setError(null);
        setBusyId(event.id);
        try {
            const res = await signedFetch(
                "/api/admin/events",
                "event_board_clear",
                `event:${event.id}`,
                { eventId: event.id, gameSlug },
                "DELETE"
            );
            if (res.ok) {
                setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, runs: 0, bestWave: 0 } : e)));
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Clear failed");
            }
        } catch (err: any) {
            setError(err.message || "Clear failed");
        } finally {
            setBusyId(null);
        }
    };

    if (loading) return <div className="text-[#8B8F98] text-sm">Loading events...</div>;

    return (
        <div className="space-y-3">
            <div className="text-[#8B8F98] text-sm">
                Doors in the Events Hall of{" "}
                <span className="text-[#E5E7EB] font-bold">{gameName ?? "—"}</span>
                {gameSlug ? <span className="text-[#6B7280] font-mono"> ({gameSlug})</span> : null}. A disabled event keeps its
                door sealed — players see the panel and the leaderboard, but cannot walk in. The running game server picks
                changes up within 30 seconds.
            </div>

            {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
            )}

            <div className="space-y-2">
                {events.map((event) => {
                    const draft = drafts[event.id];
                    if (!draft) return null;

                    const dirty = isDirty(draft, event);
                    const open = expanded === event.id;
                    const glyph = EVENT_DOORS_BY_ID.get(event.id)?.glyph ?? "•";
                    const accent = `#${event.accent.toString(16).padStart(6, "0")}`;
                    const windowInfo = describeWindow(draft);

                    return (
                        <div key={event.id} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                            <div className="flex items-center gap-3 p-2.5">
                                <button
                                    onClick={() => setExpanded(open ? null : event.id)}
                                    className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-white"
                                >
                                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>

                                <span className="text-lg leading-none">{glyph}</span>

                                <div className="flex-1 min-w-0">
                                    <div className="text-[#E5E7EB] text-sm font-bold truncate">{event.title}</div>
                                    <div className="text-[#6B7280] text-[11px] font-mono truncate">
                                        {event.id} · {event.locationId}
                                    </div>
                                </div>

                                <div className="text-[#8B8F98] text-[11px] text-right flex-shrink-0">
                                    {event.scored ? (
                                        <>
                                            <div>{event.runs} runs</div>
                                            <div className="text-[#6B7280]">best wave {event.bestWave}</div>
                                        </>
                                    ) : (
                                        <div className="text-[#6B7280]">no scoring yet</div>
                                    )}
                                </div>

                                <label className="flex items-center gap-2 flex-shrink-0 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={draft.enabled}
                                        onChange={(e) => patch(event.id, { enabled: e.target.checked })}
                                        className="w-4 h-4 accent-cyan-500"
                                    />
                                    <span
                                        className="text-xs font-bold"
                                        style={{ color: draft.enabled ? accent : "#6B7280" }}
                                    >
                                        {draft.enabled ? "Open" : "Sealed"}
                                    </span>
                                </label>

                                <button
                                    onClick={() => save(event)}
                                    disabled={!dirty || busyId === event.id}
                                    className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-xs font-bold px-2 py-1 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    Save
                                </button>
                            </div>

                            {open && (
                                <div className="border-t border-white/10 p-3 space-y-3 bg-black/20">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelClass}>Title</label>
                                            <input
                                                className={inputClass}
                                                value={draft.title}
                                                onChange={(e) => patch(event.id, { title: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Tagline</label>
                                            <input
                                                className={inputClass}
                                                value={draft.tagline}
                                                onChange={(e) => patch(event.id, { tagline: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>Description shown at the door</label>
                                        <textarea
                                            rows={3}
                                            className={`${inputClass} resize-y`}
                                            value={draft.description}
                                            onChange={(e) => patch(event.id, { description: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>Reward text</label>
                                        <textarea
                                            rows={2}
                                            className={`${inputClass} resize-y`}
                                            value={draft.rewardText}
                                            onChange={(e) => patch(event.id, { rewardText: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2 border border-white/10 rounded-lg p-3 bg-black/20">
                                        <div className="flex items-center gap-2">
                                            <CalendarClock className="w-3.5 h-3.5 text-[#8B8F98]" />
                                            <span className="text-[#C9CDD3] text-xs font-bold">Schedule</span>
                                            <span className="text-[10px] ml-auto" style={{ color: windowInfo.tone }}>
                                                {windowInfo.label}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className={labelClass}>Opens</label>
                                                <input
                                                    type="datetime-local"
                                                    className={inputClass}
                                                    value={draft.startsAt}
                                                    onChange={(e) => patch(event.id, { startsAt: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Closes</label>
                                                <input
                                                    type="datetime-local"
                                                    className={inputClass}
                                                    value={draft.endsAt}
                                                    onChange={(e) => patch(event.id, { endsAt: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Repeat every (days)</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={365}
                                                    className={inputClass}
                                                    disabled={!draft.startsAt || !draft.endsAt}
                                                    value={draft.repeatDays}
                                                    onChange={(e) => patch(event.id, { repeatDays: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-[#6B7280] text-[10px]">
                                                Leave both empty for an always-on door. 0 repeat = one-off window.
                                            </span>
                                            <button
                                                onClick={() => patch(event.id, { startsAt: "", endsAt: "", repeatDays: 0 })}
                                                disabled={!draft.startsAt && !draft.endsAt}
                                                className="text-[#8B8F98] hover:text-white text-[10px] font-bold px-2 py-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                Clear schedule
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>Schedule note (empty = hidden)</label>
                                        <input
                                            className={inputClass}
                                            placeholder="e.g. Runs every Friday 20:00 UTC"
                                            value={draft.scheduleNote}
                                            onChange={(e) => patch(event.id, { scheduleNote: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className={labelClass}>Min party</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={4}
                                                className={inputClass}
                                                value={draft.minParty}
                                                onChange={(e) => patch(event.id, { minParty: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Max party</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={4}
                                                className={inputClass}
                                                value={draft.maxParty}
                                                onChange={(e) => patch(event.id, { maxParty: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Cooldown (minutes)</label>
                                            <input
                                                type="number"
                                                min={0}
                                                className={inputClass}
                                                value={draft.cooldownMinutes}
                                                onChange={(e) => patch(event.id, { cooldownMinutes: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-3">
                                        <div>
                                            <label className={labelClass}>Ash / wave</label>
                                            <input
                                                type="number"
                                                min={0}
                                                className={inputClass}
                                                value={draft.ashPerWave}
                                                onChange={(e) => patch(event.id, { ashPerWave: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Ash cap</label>
                                            <input
                                                type="number"
                                                min={0}
                                                className={inputClass}
                                                value={draft.ashCap}
                                                onChange={(e) => patch(event.id, { ashCap: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>XP / wave</label>
                                            <input
                                                type="number"
                                                min={0}
                                                className={inputClass}
                                                value={draft.xpPerWave}
                                                onChange={(e) => patch(event.id, { xpPerWave: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>XP cap</label>
                                            <input
                                                type="number"
                                                min={0}
                                                className={inputClass}
                                                value={draft.xpCap}
                                                onChange={(e) => patch(event.id, { xpCap: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    {event.scored && (
                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-[#6B7280] text-xs">
                                                {event.runs} recorded runs on the door leaderboard
                                            </span>
                                            <button
                                                onClick={() => clearBoard(event)}
                                                disabled={event.runs === 0 || busyId === event.id}
                                                className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <Eraser className="w-3.5 h-3.5" />
                                                Wipe leaderboard
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
