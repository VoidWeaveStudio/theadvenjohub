//src\features\game\ui\Notifications.tsx
"use client";

import { useEffect, useState } from "react";

interface Notification {
    id: number;
    message: string;
    duration: number;
}

interface NotificationsProps {
    notifications: Notification[];
    onRemove: (id: number) => void;
}

export function Notifications({ notifications, onRemove }: NotificationsProps) {
    return (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 space-y-2 pointer-events-none z-40">
            {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onRemove={onRemove} />
            ))}
        </div>
    );
}

function NotificationItem({
    notification,
    onRemove,
}: {
    notification: Notification;
    onRemove: (id: number) => void;
}) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const t1 = setTimeout(() => setVisible(true), 10);
        const t2 = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onRemove(notification.id), 300);
        }, notification.duration);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [notification.id, notification.duration, onRemove]);

    return (
        <div
            className={`px-6 py-3 bg-black/80 backdrop-blur border border-cyan-400/50 rounded-lg text-cyan-300 font-medium shadow-lg shadow-cyan-500/20 transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
                }`}
        >
            {notification.message}
        </div>
    );
}