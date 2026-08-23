// src/features/game/ui/TouchControls.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InputManager } from "../core/InputManager";
import { getTouchSensitivity } from "../utils/touchSettings";

const STICK_RADIUS = 56;
const STICK_DEAD_ZONE = 0.18;
const STICK_RUN_ZONE = 0.82;
const TAP_MAX_MS = 220;
const TAP_MAX_DISTANCE = 12;

export type TouchMode = "world" | "combat";

interface TouchControlsProps {
  input: InputManager | null;
  mode: TouchMode;
  onOpenWheel: () => void;
  visible: boolean;
  rotated?: boolean;
  canBuy?: boolean;
}

interface StickState {
  pointerId: number;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
}

interface LookState {
  pointerId: number;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  startedAt: number;
  moved: number;
}

const MOVE_KEYS = ["KeyW", "KeyS", "KeyA", "KeyD", "ShiftLeft"] as const;

const WORLD_ARC_RADIUS = 88;

function arcOffset(angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: Math.round(Math.cos(radians) * WORLD_ARC_RADIUS),
    y: Math.round(Math.sin(radians) * WORLD_ARC_RADIUS),
  };
}

const COMBAT_SLOTS: { code: string; label: string }[] = [
  { code: "Digit1", label: "1" },
  { code: "Digit2", label: "2" },
  { code: "Digit3", label: "3" },
  { code: "Digit4", label: "4" },
  { code: "Digit5", label: "5" },
];

function buzz(duration = 12) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(duration);
}

export function TouchControls({
  input,
  mode,
  onOpenWheel,
  visible,
  rotated = false,
  canBuy = false,
}: TouchControlsProps) {
  const stickRef = useRef<StickState | null>(null);
  const lookRef = useRef<LookState | null>(null);
  const sensitivityRef = useRef(getTouchSensitivity());
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [crouching, setCrouching] = useState(false);
  const [aiming, setAiming] = useState(false);
  const [firing, setFiring] = useState(false);

  const combat = mode === "combat";

  const toLocal = useCallback(
    (dx: number, dy: number) => (rotated ? { dx: dy, dy: -dx } : { dx, dy }),
    [rotated]
  );

  useEffect(() => {
    sensitivityRef.current = getTouchSensitivity();
  }, [visible]);

  const releaseMovement = useCallback(() => {
    setRunning(false);
    if (!input) return;
    for (const code of MOVE_KEYS) input.setVirtualKey(code, false);
  }, [input]);

  const releaseCombat = useCallback(() => {
    if (!input) return;
    input.setVirtualMouseButton(0, false);
    input.setVirtualMouseButton(2, false);
    setFiring(false);
    setAiming(false);
  }, [input]);

  useEffect(() => {
    if (visible) return;

    releaseMovement();
    releaseCombat();
    setKnob(null);
    stickRef.current = null;
    lookRef.current = null;
  }, [visible, releaseMovement, releaseCombat]);

  useEffect(() => {
    if (combat) return;
    releaseCombat();
  }, [combat, releaseCombat]);

  useEffect(() => () => {
    releaseMovement();
    releaseCombat();
  }, [releaseMovement, releaseCombat]);

  const applyStick = useCallback((dx: number, dy: number) => {
    if (!input) return;

    const length = Math.hypot(dx, dy);
    const normalized = length > 0 ? Math.min(1, length / STICK_RADIUS) : 0;

    if (normalized < STICK_DEAD_ZONE) {
      releaseMovement();
      return;
    }

    const nx = dx / (length || 1);
    const ny = dy / (length || 1);

    input.setVirtualKey("KeyW", ny < -0.4);
    input.setVirtualKey("KeyS", ny > 0.4);
    input.setVirtualKey("KeyA", nx < -0.4);
    input.setVirtualKey("KeyD", nx > 0.4);

    const run = normalized >= STICK_RUN_ZONE;
    input.setVirtualKey("ShiftLeft", run);
    setRunning(run);
  }, [input, releaseMovement]);

  const onStickDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!input) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    stickRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      dx: 0,
      dy: 0,
    };
    setKnob({ x: 0, y: 0 });
  }, [input]);

  const onStickMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const stick = stickRef.current;
    if (!stick || stick.pointerId !== event.pointerId) return;

    const { dx, dy } = toLocal(event.clientX - stick.originX, event.clientY - stick.originY);
    const length = Math.hypot(dx, dy);
    const clamped = length > STICK_RADIUS ? STICK_RADIUS / length : 1;

    stick.dx = dx * clamped;
    stick.dy = dy * clamped;

    setKnob({ x: stick.dx, y: stick.dy });
    applyStick(stick.dx, stick.dy);
  }, [applyStick, toLocal]);

  const onStickUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const stick = stickRef.current;
    if (!stick || stick.pointerId !== event.pointerId) return;

    stickRef.current = null;
    setKnob(null);
    releaseMovement();
  }, [releaseMovement]);

  const onLookDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!input) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    lookRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      moved: 0,
    };
  }, [input]);

  const onLookMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const look = lookRef.current;
    if (!look || look.pointerId !== event.pointerId || !input) return;

    const { dx, dy } = toLocal(event.clientX - look.lastX, event.clientY - look.lastY);

    look.lastX = event.clientX;
    look.lastY = event.clientY;
    look.moved += Math.hypot(dx, dy);

    const sensitivity = sensitivityRef.current * (aiming ? 0.6 : 1);
    input.addVirtualLook(dx * sensitivity, dy * sensitivity);
  }, [input, aiming, toLocal]);

  const onLookUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const look = lookRef.current;
    if (!look || look.pointerId !== event.pointerId || !input) return;

    lookRef.current = null;

    if (combat) return;

    const heldFor = performance.now() - look.startedAt;
    const travelled = Math.hypot(event.clientX - look.startX, event.clientY - look.startY);

    if (heldFor <= TAP_MAX_MS && travelled <= TAP_MAX_DISTANCE && look.moved <= TAP_MAX_DISTANCE) {
      input.setVirtualMouseButton(0, true);
      setTimeout(() => input.setVirtualMouseButton(0, false), 60);
    }
  }, [input, combat]);

  const tapKey = useCallback((code: string) => {
    input?.pressVirtualKey(code);
    buzz();
  }, [input]);

  const toggleCrouch = useCallback(() => {
    if (!input) return;
    buzz();
    setCrouching((prev) => {
      input.setVirtualKey("ControlLeft", !prev);
      return !prev;
    });
  }, [input]);

  const toggleAim = useCallback(() => {
    if (!input) return;
    buzz();
    setAiming((prev) => {
      input.setVirtualMouseButton(2, !prev);
      return !prev;
    });
  }, [input]);

  const worldArc = [
    { label: "E", angle: 180, press: () => tapKey("KeyE") },
    { label: "⤒", angle: 225, press: () => tapKey("Space") },
    { label: "✦", angle: 270, press: onOpenWheel },
  ];

  const startFire = useCallback(() => {
    if (!input) return;
    input.setVirtualMouseButton(0, true);
    setFiring(true);
    buzz(18);
  }, [input]);

  const stopFire = useCallback(() => {
    if (!input) return;
    input.setVirtualMouseButton(0, false);
    setFiring(false);
  }, [input]);

  if (!visible || !input) return null;

  return (
    <div className="absolute inset-0 z-30 select-none pointer-events-none" style={{ touchAction: "none" }}>
      <div
        className="absolute inset-y-0 right-0 left-1/3 pointer-events-auto"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />

      <div
        className={`game-touch-stick absolute bottom-6 left-6 w-[132px] h-[132px] rounded-full border backdrop-blur-sm pointer-events-auto transition-colors ${running ? "border-[#4FD1FF]/70 bg-[#4FD1FF]/10" : "border-white/20 bg-black/25"
          }`}
        style={{ marginBottom: "var(--safe-bottom)", marginLeft: "var(--safe-left)" }}
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
      >
        <div
          className={`absolute left-1/2 top-1/2 w-14 h-14 -ml-7 -mt-7 rounded-full border transition-transform duration-75 ${running ? "bg-[#4FD1FF]/40 border-[#4FD1FF]" : "bg-white/25 border-white/40"
            }`}
          style={{ transform: `translate(${knob?.x ?? 0}px, ${knob?.y ?? 0}px)` }}
        />
      </div>

      <div
        className="game-touch-actions absolute bottom-6 right-6 pointer-events-auto"
        style={{ marginBottom: "var(--safe-bottom)", marginRight: "var(--safe-right)" }}
      >
        {combat ? (
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-end gap-3">
              <TouchButton label="R" onPress={() => tapKey("KeyR")} />
              <TouchButton label="◎" active={aiming} onPress={toggleAim} />
            </div>

            <div className="flex items-end gap-3">
              <TouchButton label="E" onPress={() => tapKey("KeyE")} />
              <TouchButton label="⌄" active={crouching} onPress={toggleCrouch} />
              <TouchButton label="⤒" onPress={() => tapKey("Space")} />
              <HoldButton label="🔥" active={firing} onStart={startFire} onStop={stopFire} />
            </div>
          </div>
        ) : (
          <div className="relative w-20 h-20">
            {worldArc.map(({ label, angle, press }) => {
              const { x, y } = arcOffset(angle);

              return (
                <div
                  key={label}
                  className="absolute left-1/2 top-1/2"
                  style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                >
                  <TouchButton label={label} onPress={press} />
                </div>
              );
            })}

            <HoldButton label="🔥" active={firing} onStart={startFire} onStop={stopFire} />
          </div>
        )}
      </div>

      {combat && (
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto"
          style={{ marginRight: "var(--safe-right)" }}
        >
          <TouchButton label={canBuy ? "🛒" : "⇄"} size="sm" onPress={() => tapKey("KeyB")} />
          {COMBAT_SLOTS.map((slot) => (
            <TouchButton key={slot.code} label={slot.label} size="sm" onPress={() => tapKey(slot.code)} />
          ))}
        </div>
      )}

    </div>
  );
}

const SIZE_CLASSES = {
  sm: "w-11 h-11 text-base",
  md: "w-14 h-14 text-xl",
  lg: "w-16 h-16 text-2xl",
};

function TouchButton({
  label,
  onPress,
  active = false,
  size = "md",
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPress();
      }}
      className={`${SIZE_CLASSES[size]} rounded-full border flex items-center justify-center font-oxanium transition-colors ${active
        ? "bg-[#4FD1FF]/30 border-[#4FD1FF] text-white"
        : "bg-black/35 border-white/25 text-white/85"
        }`}
      style={{ backdropFilter: "blur(4px)" }}
    >
      {label}
    </button>
  );
}

function HoldButton({
  label,
  active,
  onStart,
  onStop,
}: {
  label: string;
  active: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        onStart();
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        onStop();
      }}
      onPointerCancel={() => onStop()}
      onPointerLeave={() => onStop()}
      className={`w-20 h-20 rounded-full border-2 flex items-center justify-center text-3xl transition-colors ${active
        ? "bg-[#FF5757]/40 border-[#FF5757]"
        : "bg-black/35 border-white/30"
        }`}
      style={{ backdropFilter: "blur(4px)" }}
    >
      {label}
    </button>
  );
}
