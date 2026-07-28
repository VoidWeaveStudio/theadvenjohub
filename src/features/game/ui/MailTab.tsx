// src/features/game/ui/MailTab.tsx
"use client";

import { useEffect, useState } from "react";
import { Send, Inbox } from "lucide-react";
import { PlayerTag } from "./shell/PlayerTag";
import { MailEntry } from "../network/NetworkManager";

interface MailTabProps {
    mail: MailEntry[];
    unreadMailCount: number;
    onRequestMailInbox: () => void;
    onSendMail: (recipient: { wallet?: string; nickname?: string }, subject: string, body: string) => void;
    onMarkMailRead: (mailId: string) => void;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function formatMailDate(iso: string): string {
    const date = new Date(iso);
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
}

function resolveTarget(query: string): { wallet?: string; nickname?: string } {
    const trimmed = query.trim();
    return trimmed.length >= 32 ? { wallet: trimmed } : { nickname: trimmed };
}

export function MailTab({ mail, unreadMailCount, onRequestMailInbox, onSendMail, onMarkMailRead }: MailTabProps) {
    const [isComposing, setIsComposing] = useState(false);
    const [composeTarget, setComposeTarget] = useState("");
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody, setComposeBody] = useState("");
    const [expandedMailId, setExpandedMailId] = useState<string | null>(null);

    useEffect(() => {
        onRequestMailInbox();
    }, []);

    const handleSendCompose = () => {
        if (!composeTarget.trim() || !composeSubject.trim() || !composeBody.trim()) return;
        onSendMail(resolveTarget(composeTarget), composeSubject.trim(), composeBody.trim());
        setIsComposing(false);
        setComposeTarget("");
        setComposeSubject("");
        setComposeBody("");
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[#8B8F98] text-xs font-bold tracking-wider">
                    INBOX {unreadMailCount > 0 && <span className="text-[#4FD1FF]">({unreadMailCount} unread)</span>}
                </span>
                <button
                    onClick={() => setIsComposing((v) => !v)}
                    className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
                >
                    <Send className="w-3.5 h-3.5" />
                    Compose
                </button>
            </div>

            {isComposing && (
                <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-4 space-y-2.5">
                    <input
                        type="text"
                        value={composeTarget}
                        onChange={(e) => setComposeTarget(e.target.value)}
                        placeholder="Recipient wallet or nickname..."
                        className="w-full bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                    />
                    <input
                        type="text"
                        value={composeSubject}
                        onChange={(e) => setComposeSubject(e.target.value.slice(0, 100))}
                        placeholder="Subject..."
                        className="w-full bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                    />
                    <textarea
                        value={composeBody}
                        onChange={(e) => setComposeBody(e.target.value.slice(0, 2000))}
                        placeholder="Message..."
                        rows={4}
                        className="w-full bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none resize-none"
                    />
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSendCompose}
                            disabled={!composeTarget.trim() || !composeSubject.trim() || !composeBody.trim()}
                            className="btn-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Send
                        </button>
                        <button onClick={() => setIsComposing(false)} className="btn-secondary px-4 py-2 text-sm">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {mail.length === 0 ? (
                    <div className="text-center py-10">
                        <Inbox className="w-8 h-8 text-[#6B7280] mx-auto mb-2" />
                        <p className="text-[#8B8F98] text-sm">Your inbox is empty.</p>
                    </div>
                ) : (
                    mail.map((m) => {
                        const isExpanded = expandedMailId === m.id;
                        return (
                            <div
                                key={m.id}
                                className={`rounded-lg p-3 cursor-pointer transition-colors ${m.isRead ? "bg-[rgba(255,255,255,0.03)]" : "bg-[rgba(79,209,255,0.06)] border border-[rgba(79,209,255,0.2)]"
                                    }`}
                                onClick={() => {
                                    setExpandedMailId(isExpanded ? null : m.id);
                                    if (!m.isRead) onMarkMailRead(m.id);
                                }}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {!m.isRead && <span className="w-2 h-2 rounded-full bg-[#4FD1FF] flex-shrink-0" />}
                                        <span className="text-[#E5E7EB] text-sm font-bold truncate">{m.subject}</span>
                                    </div>
                                    <span className="text-[#6B7280] text-xs flex-shrink-0">{formatMailDate(m.createdAt)}</span>
                                </div>
                                <p className="text-[#8B8F98] text-xs mt-1 flex items-center gap-1">
                                    From
                                    <PlayerTag
                                        nickname={m.senderNickname || truncateWallet(m.senderWallet)}
                                        faction={m.senderFactionSymbol ? { image: m.senderFactionImage ?? null, symbol: m.senderFactionSymbol, number: m.senderFactionNumber ?? 0 } : null}
                                        size="sm"
                                        layout="inline"
                                    />
                                </p>
                                {isExpanded && <p className="text-[#E5E7EB] text-sm mt-2 whitespace-pre-wrap">{m.body}</p>}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
