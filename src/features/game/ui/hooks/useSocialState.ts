// src/features/game/ui/hooks/useSocialState.ts
import { useCallback, useState } from "react";
import { FriendEntry, FriendRequestEntry, MailEntry } from "../../network/NetworkManager";

export function useSocialState() {
    const [friends, setFriends] = useState<FriendEntry[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<FriendRequestEntry[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestEntry[]>([]);
    const [friendSearchResults, setFriendSearchResults] = useState<FriendRequestEntry[]>([]);
    const [mail, setMail] = useState<MailEntry[]>([]);
    const [unreadMailCount, setUnreadMailCount] = useState(0);
    const [lastSentMailId, setLastSentMailId] = useState<string | null>(null);

    const handleFriendRequestSent = useCallback((friend: FriendRequestEntry, status: string) => {
        if (status === "accepted") {
            setFriends((prev) => (prev.some((f) => f.userId === friend.userId) ? prev : [...prev, { ...friend, online: false }]));
        } else {
            setOutgoingRequests((prev) => (prev.some((r) => r.userId === friend.userId) ? prev : [...prev, friend]));
        }
    }, []);

    const handleFriendRequestAccepted = useCallback((friend: FriendEntry) => {
        setFriends((prev) => (prev.some((f) => f.userId === friend.userId) ? prev : [...prev, friend]));
        setIncomingRequests((prev) => prev.filter((r) => r.userId !== friend.userId));
    }, []);

    const handleFriendRequestDeclined = useCallback((requestUserId: string) => {
        setIncomingRequests((prev) => prev.filter((r) => r.userId !== requestUserId));
    }, []);

    const handleFriendRemoved = useCallback((friendUserId: string) => {
        setFriends((prev) => prev.filter((f) => f.userId !== friendUserId));
    }, []);

    const handleFriendsListResult = useCallback(
        (data: { friends: FriendEntry[]; incoming: FriendRequestEntry[]; outgoing: FriendRequestEntry[] }) => {
            setFriends(data.friends);
            setIncomingRequests(data.incoming);
            setOutgoingRequests(data.outgoing);
        },
        []
    );

    const handleFriendSearchResult = useCallback((results: FriendRequestEntry[]) => {
        setFriendSearchResults(results);
    }, []);

    const clearFriendSearchResults = useCallback(() => {
        setFriendSearchResults([]);
    }, []);

    const handleMailSent = useCallback((mailId: string) => {
        setLastSentMailId(mailId);
    }, []);

    const handleMailInboxResult = useCallback((data: { mail: MailEntry[]; unreadCount: number }) => {
        setMail(data.mail);
        setUnreadMailCount(data.unreadCount);
    }, []);

    const handleMailMarkedRead = useCallback((mailId: string) => {
        setMail((prev) => prev.map((m) => (m.id === mailId ? { ...m, isRead: true } : m)));
        setUnreadMailCount((prev) => Math.max(0, prev - 1));
    }, []);

    return {
        friends,
        incomingRequests,
        outgoingRequests,
        friendSearchResults,
        mail,
        unreadMailCount,
        lastSentMailId,
        handleFriendRequestSent,
        handleFriendRequestAccepted,
        handleFriendRequestDeclined,
        handleFriendRemoved,
        handleFriendsListResult,
        handleFriendSearchResult,
        clearFriendSearchResults,
        handleMailSent,
        handleMailInboxResult,
        handleMailMarkedRead,
    };
}
