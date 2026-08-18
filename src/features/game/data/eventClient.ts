// src/features/game/data/eventClient.ts
import { EVENT_DOORS, EventBoardEntry, ResolvedEvent, resolveAllEvents, resolveEvent } from "./eventDoors";

export interface EventDetail {
    event: ResolvedEvent;
    board: EventBoardEntry[];
}

function fallbackEvents(): ResolvedEvent[] {
    return resolveAllEvents([]);
}

export async function fetchEvents(gameSlug: string): Promise<ResolvedEvent[]> {
    try {
        const res = await fetch(`/api/game/events?gameSlug=${encodeURIComponent(gameSlug)}`, { cache: "no-store" });
        if (!res.ok) return fallbackEvents();
        const data = await res.json();
        return Array.isArray(data?.events) ? (data.events as ResolvedEvent[]) : fallbackEvents();
    } catch {
        return fallbackEvents();
    }
}

export async function fetchEventDetail(gameSlug: string, eventId: string): Promise<EventDetail | null> {
    const door = EVENT_DOORS.find((entry) => entry.id === eventId);
    if (!door) return null;

    try {
        const res = await fetch(
            `/api/game/events?gameSlug=${encodeURIComponent(gameSlug)}&eventId=${encodeURIComponent(eventId)}`,
            { cache: "no-store" }
        );
        if (!res.ok) return { event: resolveEvent(door, null), board: [] };

        const data = await res.json();
        return {
            event: (data?.event as ResolvedEvent) ?? resolveEvent(door, null),
            board: Array.isArray(data?.board) ? (data.board as EventBoardEntry[]) : [],
        };
    } catch {
        return { event: resolveEvent(door, null), board: [] };
    }
}
