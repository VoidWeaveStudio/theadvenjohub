//src\features\game\ui\HUD.tsx
import { HUDState } from "../core/Game";
import { Crosshair } from "./Crosshair";
import { OnlineCounter } from "./OnlineCounter";

interface HUDProps {
    state: HUDState;
    isPointerLocked: boolean;
    isHitMark?: boolean;
}

export function HUD({ state, isPointerLocked, isHitMark = false }: HUDProps) {
    return (
        <div className="absolute inset-0 pointer-events-none select-none">
            <div className="absolute top-4 left-4">
                <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-lg border border-white/10">
                    <div className="flex items-center gap-2">
                        <span className="text-red-500 text-xl">❤</span>
                        <div className="w-40 h-3 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                                style={{ width: `${(state.health / state.maxHealth) * 100}%` }}
                            />
                        </div>
                        <span className="text-white font-bold w-10 text-right">{state.health}</span>
                    </div>
                </div>
            </div>

            <div className="absolute top-4 right-4">
                <OnlineCounter count={state.online} maxCount={100} />
            </div>

            {state.isWeaponEquipped && (
                <div className="absolute bottom-6 right-6">
                    <div className="bg-black/60 backdrop-blur px-5 py-3 rounded-lg border border-white/10">
                        <div className="flex items-baseline gap-2">
                            <span className="text-white text-3xl font-bold">{state.ammo}</span>
                            <span className="text-zinc-400">/</span>
                            <span className="text-zinc-400 text-xl">{state.maxAmmo}</span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                            {state.isReloading ? (
                                <span className="text-yellow-400 animate-pulse">⟳ Reloading...</span>
                            ) : (
                                "[R] Reload"
                            )}
                        </div>
                    </div>
                </div>
            )}

            {state.inSafeZone && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2">
                    <div className="bg-green-500/20 backdrop-blur border border-green-400/50 px-4 py-1 rounded-full text-green-300 text-sm font-medium">
                        🛡️ Safe Zone
                    </div>
                </div>
            )}

            {state.prompt && (
                <div className="absolute bottom-32 left-1/2 -translate-x-1/2">
                    <div className="bg-black/70 backdrop-blur border border-cyan-400/50 px-5 py-2 rounded-lg text-cyan-300 font-medium">
                        {state.prompt}
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