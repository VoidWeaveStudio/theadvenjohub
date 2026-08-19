// src/core/lib/roomAccess.ts

export const ROOM_ACCESS_VALUES = ["public", "members", "invite", "closed"] as const;

export type RoomAccess = (typeof ROOM_ACCESS_VALUES)[number];

export const ROOM_ACCESS_LABELS: Record<RoomAccess, string> = {
    public: "g.room.access.public",
    members: "g.room.access.members",
    invite: "g.room.access.invite",
    closed: "g.room.access.closed",
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
            return "g.room.deny.members";
        case "invite":
            return "g.room.deny.invite";
        case "closed":
            return "g.room.deny.closed";
        default:
            return "g.room.deny.default";
    }
}
