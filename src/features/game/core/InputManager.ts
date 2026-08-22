// src/features/game/core/InputManager.ts
import * as THREE from "three";
import { SoundManager } from "./SoundManager";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

const VIRTUAL_TAP_HOLD_MS = 120;

export class InputManager {
  private keys: Set<string> = new Set();
  private mouseButtons: Set<number> = new Set();
  private mouseJustPressed: Set<number> = new Set();
  private mouseJustReleased: Set<number> = new Set();
  private mouseMovement: THREE.Vector2 = new THREE.Vector2();
  private isPointerLocked: boolean = false;
  private isEnabled: boolean = true;
  private canvas: HTMLCanvasElement;
  private touchControlActive: boolean = false;
  private virtualKeyTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseUp: (e: MouseEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onPointerLockChange: () => void;
  private onCanvasClick: () => void;
  private onContextMenu: (e: MouseEvent) => void;
  private onTouchStart: () => void;

  public onPointerLockStateChange?: (locked: boolean) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.onKeyDown = (e) => {
      if (!this.isEnabled) return;
      if (isTypingTarget(e.target)) return;
      this.keys.add(e.code);
    };

    this.onKeyUp = (e) => {
      if (!this.isEnabled) return;
      this.keys.delete(e.code);
    };

    this.onMouseDown = (e) => {
      if (!this.isEnabled) return;
      if (this.isPointerLocked) {
        this.mouseButtons.add(e.button);
        this.mouseJustPressed.add(e.button);
      }
    };

    this.onMouseUp = (e) => {
      if (this.mouseButtons.delete(e.button)) {
        this.mouseJustReleased.add(e.button);
      }
    };

    this.onMouseMove = (e) => {
      if (!this.isEnabled || !this.isPointerLocked) return;
      this.mouseMovement.x += e.movementX;
      this.mouseMovement.y += e.movementY;
    };

    this.onPointerLockChange = () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
      this.onPointerLockStateChange?.(this.isPointerLocked);
    };

    this.onCanvasClick = () => {
      SoundManager.getInstance().resume();
      if (this.touchControlActive) return;
      if (!this.isPointerLocked && this.isEnabled) {
        canvas.requestPointerLock().catch(() => { });
      }
    };

    this.onContextMenu = (e) => {
      if (this.isPointerLocked) e.preventDefault();
    };

    this.onTouchStart = () => {
      SoundManager.getInstance().resume();
    };

    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    canvas.addEventListener("click", this.onCanvasClick);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    document.addEventListener("touchend", this.onTouchStart, { passive: true });
    document.addEventListener("pointerdown", this.onTouchStart, { passive: true });
  }

  setTouchControlActive(active: boolean) {
    if (this.touchControlActive === active) return;

    this.touchControlActive = active;

    if (active && document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }

    this.onPointerLockStateChange?.(this.isPointerLockedState());
  }

  isTouchControlActive(): boolean {
    return this.touchControlActive;
  }

  private dispatchKey(type: "keydown" | "keyup", code: string) {
    document.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
  }

  setVirtualKey(code: string, pressed: boolean) {
    if (pressed) {
      if (this.keys.has(code)) return;
      this.keys.add(code);
      this.dispatchKey("keydown", code);
      return;
    }

    if (!this.keys.delete(code)) return;
    this.dispatchKey("keyup", code);
  }

  pressVirtualKey(code: string, holdMs: number = VIRTUAL_TAP_HOLD_MS) {
    this.keys.add(code);
    this.dispatchKey("keydown", code);

    const existing = this.virtualKeyTimers.get(code);
    if (existing) clearTimeout(existing);

    this.virtualKeyTimers.set(
      code,
      setTimeout(() => {
        this.keys.delete(code);
        this.dispatchKey("keyup", code);
        this.virtualKeyTimers.delete(code);
      }, holdMs)
    );
  }

  setVirtualMouseButton(button: number, pressed: boolean) {
    if (pressed) {
      if (this.mouseButtons.has(button)) return;
      this.mouseButtons.add(button);
      this.mouseJustPressed.add(button);
      return;
    }

    if (this.mouseButtons.delete(button)) {
      this.mouseJustReleased.add(button);
    }
  }

  addVirtualLook(dx: number, dy: number) {
    if (!this.isEnabled) return;
    this.mouseMovement.x += dx;
    this.mouseMovement.y += dy;
  }

  clearVirtualState() {
    for (const timer of this.virtualKeyTimers.values()) clearTimeout(timer);
    this.virtualKeyTimers.clear();
    this.keys.clear();
    this.mouseButtons.clear();
    this.mouseMovement.set(0, 0);
  }

  consumeMouseMovement(): THREE.Vector2 {
    const m = this.mouseMovement.clone();
    this.mouseMovement.set(0, 0);
    return m;
  }

  isKeyPressed(code: string): boolean {
    return this.keys.has(code);
  }

  isKeyJustPressed(code: string): boolean {
    if (this.keys.has(code)) {
      this.keys.delete(code);
      return true;
    }
    return false;
  }

  isMousePressed(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  isMouseJustPressed(button: number): boolean {
    if (!this.mouseJustPressed.has(button)) return false;
    this.mouseJustPressed.delete(button);
    return true;
  }

  isMouseJustReleased(button: number): boolean {
    if (!this.mouseJustReleased.has(button)) return false;
    this.mouseJustReleased.delete(button);
    return true;
  }

  isPointerLockedState(): boolean {
    return this.touchControlActive || this.isPointerLocked;
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clearVirtualState();
      this.mouseJustPressed.clear();
      this.mouseJustReleased.clear();
      if (this.isPointerLocked) {
        document.exitPointerLock();
      }
    }
  }

  dispose() {
    for (const timer of this.virtualKeyTimers.values()) clearTimeout(timer);
    this.virtualKeyTimers.clear();

    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.canvas.removeEventListener("click", this.onCanvasClick);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    document.removeEventListener("touchend", this.onTouchStart);
    document.removeEventListener("pointerdown", this.onTouchStart);
  }
}
