"use client";

import { useEffect } from "react";

// Last resort: this replaces the root layout, so the language provider and the
// stylesheet are both gone by the time it renders. English and inline styles
// only — anything else would risk failing for the same reason the layout did.
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[global error boundary]", error);
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1rem",
                    background: "#0b0c0e",
                    color: "#e5e7eb",
                    fontFamily: "system-ui, sans-serif",
                    textAlign: "center",
                    padding: "2rem",
                }}
            >
                <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Something went wrong</h1>
                <p style={{ margin: 0, color: "#8b8f98", maxWidth: "28rem" }}>
                    The page could not be loaded. Try again, or reload if it keeps happening.
                </p>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button
                        onClick={reset}
                        style={{
                            padding: "0.5rem 1.25rem",
                            borderRadius: "8px",
                            border: "1px solid #4ade80",
                            background: "#4ade80",
                            color: "#0b0c0e",
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        Try again
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: "0.5rem 1.25rem",
                            borderRadius: "8px",
                            border: "1px solid rgba(255,255,255,0.2)",
                            background: "transparent",
                            color: "#e5e7eb",
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        Reload the page
                    </button>
                </div>
                {error.digest && (
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280" }}>Reference: {error.digest}</p>
                )}
            </body>
        </html>
    );
}
