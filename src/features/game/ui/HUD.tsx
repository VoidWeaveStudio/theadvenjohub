// src/features/game/ui/HUD.tsx
import type { ReactNode } from "react";
import { HUDState } from "../core/Game";
import { Crosshair } from "./Crosshair";
import { OnlineCounter } from "./OnlineCounter";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { Heart, Shield, Activity, Mic, ShieldCheck, Swords, Crown } from "lucide-react";
import { ShardSwitcher } from "./ShardSwitcher";
import { XpBar } from "./XpBar";
import type { ShardStateData, ProgressionStateData, PartyMemberData } from "../network/NetworkManager";
import type { XpPopup } from "./hooks/useProgressionState";


interface HUDProps {
    state: HUDState;
    isPointerLocked: boolean;
    isHitMark?: boolean;
    isTalking?: boolean;
    spawnProtectionSeconds?: number;
    combatRemainingMs?: number;
    partyMembers?: PartyMemberData[];
    partyLeaderId?: string | null;
    localPlayerId?: string | null;
    shardState?: ShardStateData | null;
    onSwitchShard?: (instance: number) => void;
    progression?: ProgressionStateData | null;
    xpPopups?: XpPopup[];
    onOpenSkills?: () => void;
    rightRail?: ReactNode;
    topCenter?: ReactNode;
}

export function HUD({ state, isPointerLocked, isHitMark = false, isTalking = false, spawnProtectionSeconds = 0, combatRemainingMs = 0, partyMembers = [], partyLeaderId = null, localPlayerId = null, shardState = null, onSwitchShard, progression = null, xpPopups = [], onOpenSkills, rightRail, topCenter }: HUDProps) {
    const { t } = useLanguage();
    const partyFrames = partyMembers.filter((member) => member.id !== localPlayerId);
    const healthPercentage = (state.health / state.maxHealth) * 100;

    return (
        <div className="game-ui-scale-fill absolute inset-0 pointer-events-none select-none font-oxanium">
            <div className="absolute top-3 left-3 sm:top-6 sm:left-6" style={{ marginTop: "var(--safe-top)", marginLeft: "var(--safe-left)" }}>
                <div className="flex items-end gap-3">
                    <div className="relative w-[236px] max-w-[58vw]">
                        <div className="absolute -inset-3 -z-10 rounded-2xl bg-gradient-to-br from-black/60 via-black/35 to-transparent" />

                        <div className="flex items-baseline gap-2">
                            <Heart className="w-4 h-4 self-center text-[#FF5757] fill-[#FF5757] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
                            <span className={`text-2xl font-black leading-none tabular-nums drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] ${healthPercentage <= 30 ? "text-[#FF7B7B]" : "text-white"}`}>
                                {state.health}
                            </span>
                            <span className="text-white/40 text-[11px] font-bold leading-none">/ {state.maxHealth}</span>
                        </div>

                        <div className="mt-1 h-2 rounded-full bg-black/55 ring-1 ring-white/10 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-[#FF5757] to-[#FF9B7B] transition-all duration-300 ease-out"
                                style={{ width: `${healthPercentage}%` }}
                            />
                        </div>

                        <XpBar progression={progression} popups={xpPopups} onOpenSkills={onOpenSkills} />

                        {partyFrames.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                                {partyFrames.map((member) => {
                                    const memberHealth = member.maxHealth > 0
                                        ? Math.max(0, Math.min(100, (member.health / member.maxHealth) * 100))
                                        : 0;

                                    return (
                                        <div
                                            key={member.id}
                                            className="px-0.5"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                {member.id === partyLeaderId && <Crown className="w-3 h-3 text-[#FFD166] shrink-0" />}
                                                <span className="text-[#C9CDD3] text-[11px] font-bold truncate">{member.nickname}</span>
                                                <span className={`text-[10px] ml-auto ${member.alive ? "text-[#6B7280]" : "text-red-400 font-bold"}`}>
                                                    {member.alive ? member.health : t("g.hud.down")}
                                                </span>
                                            </div>
                                            <div className="mt-1 w-full h-1 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-300 ease-out ${member.alive ? "bg-[#8AD4FF]" : "bg-zinc-700"}`}
                                                    style={{ width: `${member.alive ? memberHealth : 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {isTalking && (
                        <div className="bg-[rgba(74,222,128,0.15)] backdrop-blur-md border border-[#4ADE80]/30 rounded-[10px] px-3 py-2 flex items-center gap-2">
                            <Mic className="w-4 h-4 text-[#4ADE80] animate-pulse" />
                            <span className="text-[#4ADE80] text-xs font-bold tracking-wider">{t("g.hud.talking")}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="game-ui-rightrail absolute top-16 sm:top-6 right-3 sm:right-6 flex flex-col items-end gap-1.5 max-w-[220px] sm:max-w-[300px]" style={{ marginRight: "var(--safe-right)" }}>
                <OnlineCounter count={state.online} here={state.onlineHere} />
                <ShardSwitcher state={shardState ?? null} onSwitch={onSwitchShard ?? (() => { })} />

                {combatRemainingMs > 0 && (
                    <div className="bg-[rgba(248,113,113,0.15)] backdrop-blur-md border border-[#F87171]/40 px-4 py-2 rounded-[10px]">
                        <div className="flex items-center gap-2">
                            <Swords className="w-4 h-4 text-[#F87171]" />
                            <span className="text-[#F87171] text-sm font-bold tracking-wider">
                                {t("g.hud.inCombat")} {Math.ceil(combatRemainingMs / 1000)}s
                            </span>
                        </div>
                    </div>
                )}

                {rightRail}
            </div>

            <div
                className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
                style={{ top: "var(--top-menu-band, 148px)" }}
            >
                {topCenter}

                {spawnProtectionSeconds > 0 && (
                    <div className="bg-[rgba(111,224,255,0.15)] backdrop-blur-md border border-[#6FE0FF]/40 px-5 py-2 rounded-[10px]">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-[#6FE0FF]" />
                            <span className="text-[#6FE0FF] text-sm font-bold tracking-wider">
                                {t("g.hud.invulnerable")} {spawnProtectionSeconds}s
                            </span>
                            <span className="text-[#6FE0FF]/60 text-xs">{t("g.hud.shootToCancel")}</span>
                        </div>
                    </div>
                )}

                {state.inSafeZone && (
                    <div className="bg-[rgba(74,222,128,0.15)] backdrop-blur-md border border-[#4ADE80]/30 px-5 py-2 rounded-[10px]">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-[#4ADE80]" />
                            <span className="text-[#4ADE80] text-sm font-bold tracking-wider">{t("g.hud.safeZone")}</span>
                        </div>
                    </div>
                )}
            </div>

            {state.isWeaponEquipped && (
                <div className="game-ui-weapon absolute bottom-44 right-4 sm:bottom-8 sm:right-8">
                    <div className="flex items-center gap-3 rounded-full bg-[rgba(10,13,18,0.66)] backdrop-blur-md ring-1 ring-white/10 pl-3.5 pr-4 py-1.5">
                        <div className="flex flex-col leading-none gap-0.5">
                            <span className="text-[#C5C9D1] text-[10px] font-bold tracking-wider uppercase">{t(state.weaponName)}</span>
                            <span className="text-[#4FD1FF] text-[9px] font-bold tracking-wider uppercase">{state.fireMode}</span>
                        </div>

                        {state.weaponKind === "staff" ? (
                            <span className="text-[#C79AE0] text-lg font-black leading-none tracking-wide">{t("g.hud.mana")}</span>
                        ) : (
                            <div className="flex items-baseline gap-1 tabular-nums">
                                {state.isReloading ? (
                                    <Activity className="w-5 h-5 self-center text-[#FF5757] animate-pulse" />
                                ) : (
                                    <>
                                        <span className={`text-2xl font-black leading-none ${state.ammo === 0 ? "text-[#FF5757]" : "text-white"}`}>
                                            {state.ammo}
                                        </span>
                                        <span className="text-white/35 text-[11px] font-bold">/ {state.maxAmmo}</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {(state.isReloading || state.chargeProgress > 0) && (
                        <div className="mx-3 mt-1 h-1 rounded-full bg-black/60 overflow-hidden">
                            <div
                                className={`h-full rounded-full ${state.isReloading ? "bg-[#FF5757] transition-none" : "bg-[#C79AE0]"}`}
                                style={{
                                    width: `${Math.round((state.isReloading ? state.reloadProgress : state.chargeProgress) * 100)}%`,
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            {state.inkDarkness > 0 && (
                <div
                    className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                    style={{ background: "#05050a", opacity: state.inkDarkness }}
                />
            )}

            {state.tunerReadout && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-none">
                    <div className="bg-[rgba(12,12,14,0.9)] border border-[#FFD166]/40 rounded-[8px] px-4 py-2">
                        <div className="text-[#FFD166] text-[10px] font-bold tracking-wider mb-1">
                            WEAPON GRIP TUNER — numpad 4/6 x, 8/2 y, 7/9 z, 1/3 yaw, -/+ pitch, ÷/× roll, 5 logs, 0 exits
                        </div>
                        <div className="text-[#E5E7EB] text-xs font-mono">{state.tunerReadout}</div>
                    </div>
                </div>
            )}

            {state.prompt && (
                <div className="absolute bottom-32 left-1/2 -translate-x-1/2">
                    <div className="bg-[rgba(12,12,14,0.72)] backdrop-blur-md border border-[#4FD1FF]/40 px-6 py-3 rounded-[10px] shadow-lg shadow-[#4FD1FF]/10">
                        <div className="flex items-center gap-3">
                            <div className="bg-[rgba(79,209,255,0.2)] border border-[#4FD1FF] rounded-md px-3 py-1">
                                <span className="text-[#4FD1FF] text-sm font-bold">E</span>
                            </div>
                            <span className="text-[#4FD1FF] text-sm font-bold tracking-wide">{state.prompt}</span>
                        </div>
                    </div>
                </div>
            )}

            <Crosshair
                visible={isPointerLocked && !state.inSafeZone && state.isWeaponEquipped}
                isHitMark={isHitMark}
            />
        </div>
    );
}