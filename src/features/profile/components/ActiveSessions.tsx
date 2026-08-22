// src/features/profile/components/ActiveSessions.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Monitor } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { sessionFetch } from "@/core/api/session";
import { formatDateTime } from "@/core/lib/clientUtils";

interface SessionEntry {
  sid: string;
  device: string;
  createdAt: number;
  lastSeenAt: number;
  current: boolean;
}

export function ActiveSessions() {
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await sessionFetch("/api/auth/sessions");
      if (!res.ok) throw new Error("load_failed");

      const data = await res.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      setError(t("profile.sessions.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = useCallback(async (sid: string) => {
    setRevoking(sid);

    try {
      const res = await sessionFetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid }),
      });

      if (!res.ok) throw new Error("revoke_failed");

      setSessions((prev) => prev.filter((entry) => entry.sid !== sid));
    } catch {
      setError(t("profile.sessions.revokeFailed"));
    } finally {
      setRevoking(null);
    }
  }, [t]);

  return (
    <div className="border-t border-border pt-6">
      <h3 className="text-sm font-medium text-foreground mb-4">
        {t("profile.sessions.title")}
      </h3>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("common.loading")}
        </div>
      )}

      {!isLoading && sessions.length === 0 && (
        <p className="text-sm text-text-secondary">{t("profile.sessions.empty")}</p>
      )}

      {!isLoading && sessions.length > 0 && (
        <ul className="space-y-2">
          {sessions.map((entry) => (
            <li
              key={entry.sid}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <Monitor className="w-4 h-4 mt-0.5 text-text-muted flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm text-foreground truncate">
                    {entry.device}
                    {entry.current && (
                      <span className="ml-2 text-xs text-primary">{t("profile.sessions.current")}</span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted">
                    {t("profile.sessions.lastSeen")}: {formatDateTime(new Date(entry.lastSeenAt).toISOString())}
                  </div>
                </div>
              </div>

              {!entry.current && (
                <button
                  onClick={() => revoke(entry.sid)}
                  disabled={revoking === entry.sid}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors min-h-[44px] px-3 disabled:opacity-50"
                >
                  {revoking === entry.sid ? "…" : t("profile.sessions.revoke")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-400 mt-3" role="alert">{error}</p>}
    </div>
  );
}
