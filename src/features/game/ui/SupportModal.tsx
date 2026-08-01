// src/features/game/ui/SupportModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { X, LifeBuoy } from "lucide-react";
import { SoundManager } from "../core/SoundManager";

interface SupportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (subject: string, message: string) => void;
    initialSubject?: string;
    initialMessage?: string;
}

export function SupportModal({ isOpen, onClose, onSend, initialSubject, initialMessage }: SupportModalProps) {
    const [subject, setSubject] = useState(initialSubject || "");
    const [message, setMessage] = useState(initialMessage || "");

    useEffect(() => {
        if (isOpen) {
            setSubject(initialSubject || "");
            setMessage(initialMessage || "");
        }
    }, [isOpen, initialSubject, initialMessage]);

    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play('modal-open');
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSend = () => {
        if (!subject.trim() || !message.trim()) return;
        onSend(subject.trim(), message.trim());
        setSubject("");
        setMessage("");
        onClose();
    };

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto p-4">
            <div className="w-full max-w-md bg-[rgba(12,14,16,0.95)] border-2 border-[#4FD1FF]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(79,209,255,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <LifeBuoy className="w-5 h-5 text-[#4FD1FF]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">Contact Support</h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-[#8B8F98] text-sm mb-3">
                    Describe your issue. The reply will arrive in your in-game mail.
                </p>

                <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value.slice(0, 100))}
                    placeholder="Subject"
                    className="w-full bg-black/40 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-[#4FD1FF] outline-none mb-2"
                />

                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                    placeholder="What's going on?"
                    rows={5}
                    className="w-full bg-black/40 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-[#4FD1FF] outline-none resize-none"
                />

                <button
                    onClick={handleSend}
                    disabled={!subject.trim() || !message.trim()}
                    className="w-full mt-3 bg-gradient-to-r from-[#4FD1FF] to-[#3B9FD9] text-[rgba(12,12,14,0.9)] font-bold px-6 py-2.5 rounded-[8px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Send to Support
                </button>
            </div>
        </div>
    );
}
