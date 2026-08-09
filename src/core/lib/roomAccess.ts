// src/core/lib/roomAccess.ts

export const ROOM_ACCESS_VALUES = ["public", "members", "invite", "closed"] as const;

export type RoomAccess = (typeof ROOM_ACCESS_VALUES)[number];

export const ROOM_ACCESS_LABELS: Record<RoomAccess, string> = {
    public: "Public — anyone may enter",
    members: "Members only",
    invite: "By invitation",
    closed: "Closed — owner only",
};

export function isRoomAccess(value: string): value is RoomAccess {
    return (ROOM_ACCESS_VALUES as readonly string[]).includes(value);
}

export interface RoomAccessContext {
    access: RoomAccess;
    isOwner: boolean;
    isMember: boolean;
    isInvited: boolean;
}

export function canEnterRoom(context: RoomAccessContext): boolean {
    if (context.isOwner) return true;
    switch (context.access) {
        case "public":
            return true;
        case "members":
            return context.isMember;
        case "invite":
            return context.isInvited;
        case "closed":
            return false;
        default:
            return false;
    }
}

export function roomAccessDenialReason(access: RoomAccess): string {
    switch (access) {
        case "members":
            return "Members only.";
        case "invite":
            return "This room is by invitation only.";
        case "closed":
            return "This room is closed.";
        default:
            return "You cannot enter this room.";
    }
}
