"use client";

import { useEffect } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";

// Without this, a single render-time exception anywhere under the root layout
// leaves the player on a blank page with nothing to do but guess. `reset()`
// re-renders the segment, which recovers from a transient failure without
// throwing away the session.
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const { t } = useLanguage();

    useEffect(() => {
        console.error("[error boundary]", error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
            <h1 className="text-2xl font-bold text-foreground">{t("errors.boundary.title")}</h1>
            <p className="max-w-md text-text-secondary">{t("errors.boundary.body")}</p>
            <div className="flex gap-3">
                <button onClick={reset} className="btn-primary px-5 py-2">
                    {t("common.retry")}
                </button>
                <button onClick={() => window.location.reload()} className="btn-secondary px-5 py-2">
                    {t("errors.boundary.reload")}
                </button>
            </div>
            {error.digest && (
                <p className="text-xs text-text-muted">{t("errors.boundary.reference", { id: error.digest })}</p>
            )}
        </div>
    );
}
