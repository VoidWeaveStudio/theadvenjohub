// src/features/game/ui/hooks/useNotifications.ts
import { useCallback, useRef, useState } from "react";
import { SoundManager } from "../../core/SoundManager";

const ALERT_PREFIXES = ["⚠️", "❌", "🔒", "⛔"];
const SUCCESS_PREFIXES = ["✅", "🎉", "💰", "🏆"];

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
    const alert = ALERT_PREFIXES.some((prefix) => msg.startsWith(prefix));
    const success = SUCCESS_PREFIXES.some((prefix) => msg.startsWith(prefix));
    SoundManager.getInstance().play(
      alert ? "ui-error" : success ? "notify-success" : "notify-info",
      { volume: 0.4 }
    );
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
