// src/features/game/ui/hooks/useNotifications.ts
import { useCallback, useRef, useState } from "react";

interface Notification {
  id: number;
  message: string;
  duration: number;
}

export function useNotifications() {
  const notifIdRef = useRef(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((msg: string, duration = 3000) => {
    const id = ++notifIdRef.current;
    setNotifications((prev) => {
      const newNotifications = [...prev, { id, message: msg, duration }];
      if (newNotifications.length > 5) return newNotifications.slice(-5);
      return newNotifications;
    });
  }, []);

  const removeNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, addNotification, removeNotification };
}
