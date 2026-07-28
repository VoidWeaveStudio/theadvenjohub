// src/features/game/ui/FactionTasksPanel.tsx
"use client";

import { useEffect } from "react";
import { Target, Swords, Crosshair, Coins, Trophy } from "lucide-react";
import { FactionDetail, FactionTaskDefinition } from "../network/NetworkManager";
import { FactionHeader } from "./FactionHeader";

interface FactionTasksPanelProps {
    faction: FactionDetail;
    myWallet: string;
    taskDefinitions: FactionTaskDefinition[];
    onRequestTaskList: () => void;
    onAcceptTask: (taskKey: string) => void;
}

function metricIcon(metric: FactionTaskDefinition["metric"]) {
    if (metric === "kills") return <Swords className="w-4 h-4" />;
    if (metric === "shots") return <Crosshair className="w-4 h-4" />;
    return <Coins className="w-4 h-4" />;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
}

export function FactionTasksPanel({ faction, myWallet, taskDefinitions, onRequestTaskList, onAcceptTask }: FactionTasksPanelProps) {
    const canManage = faction.founderWallet === myWallet || faction.verifiedCreatorWallet === myWallet;
    const activeTask = faction.activeTask;

    useEffect(() => {
        if (!activeTask && canManage) onRequestTaskList();
    }, [!!activeTask, canManage]);

    return (
        <div className="space-y-4">
            <FactionHeader faction={faction} />

            <div>
                <span className="text-[#8B8F98] text-xs font-bold tracking-wider">
                    FACTION TASK — {faction.name}{faction.symbol ? ` ($${faction.symbol})` : ""}
                </span>

                {activeTask ? (
                    <div className="mt-2 bg-[rgba(79,209,255,0.06)] border border-[rgba(79,209,255,0.2)] rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[#E5E7EB] font-bold">
                                <Target className="w-4 h-4 text-[#4FD1FF]" />
                                {taskDefinitions.find((t) => t.key === activeTask.key)?.label || activeTask.key}
                            </div>
                            <span className="text-[#FFD166] text-sm font-bold">+{activeTask.rewardAsh} Ash</span>
                        </div>
                        <p className="text-[#8B8F98] text-xs">
                            {taskDefinitions.find((t) => t.key === activeTask.key)?.description}
                        </p>
                        <div className="h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                            <div
                                className="h-full bg-[#4FD1FF] transition-all"
                                style={{ width: `${Math.min(100, (activeTask.progress / activeTask.target) * 100)}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-[#8B8F98]">
                                {activeTask.progress} / {activeTask.target}
                            </span>
                            {activeTask.acceptedByNickname && (
                                <span className="text-[#6B7280]">Accepted by {activeTask.acceptedByNickname}</span>
                            )}
                        </div>
                    </div>
                ) : canManage ? (
                    <div className="mt-2 space-y-2">
                        {taskDefinitions.length === 0 ? (
                            <p className="text-[#8B8F98] text-sm text-center py-6">Loading tasks...</p>
                        ) : (
                            taskDefinitions.map((task) => (
                                <div
                                    key={task.key}
                                    className="flex items-center justify-between gap-3 bg-[rgba(255,255,255,0.04)] rounded-lg p-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-[rgba(79,209,255,0.1)] flex items-center justify-center text-[#4FD1FF] flex-shrink-0">
                                            {metricIcon(task.metric)}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[#E5E7EB] text-sm font-bold truncate">{task.label}</div>
                                            <div className="text-[#8B8F98] text-xs truncate">{task.description}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className="text-[#FFD166] text-xs font-bold">+{task.rewardAsh}</span>
                                        <button onClick={() => onAcceptTask(task.key)} className="btn-primary px-3 py-1.5 text-xs">
                                            Accept
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <p className="mt-2 text-[#8B8F98] text-sm text-center py-6">
                        Waiting for the faction leader or verified token creator to start a task.
                    </p>
                )}
            </div>

            {faction.taskHistory && faction.taskHistory.length > 0 && (
                <div>
                    <span className="text-[#8B8F98] text-xs font-bold tracking-wider">RECENT REWARDS</span>
                    <div className="mt-2 space-y-1.5">
                        {faction.taskHistory.map((entry) => (
                            <div
                                key={entry.id}
                                className="flex items-center justify-between bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Trophy className="w-3.5 h-3.5 text-[#FFD166] flex-shrink-0" />
                                    <span className="text-[#E5E7EB] text-xs truncate">
                                        {taskDefinitions.find((t) => t.key === entry.taskKey)?.label || entry.taskKey}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                                    <span className="text-[#FFD166] font-bold">+{entry.rewardAsh}</span>
                                    <span className="text-[#6B7280]">to {entry.rewardNickname || "leadership"}</span>
                                    <span className="text-[#6B7280]">{formatDate(entry.completedAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
