// src/features/game/core/InputManager.ts
import * as THREE from "three";
import { SoundManager } from "./SoundManager";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export class InputManager {
  private keys: Set<string> = new Set();
  private mouseButtons: Set<number> = new Set();
  private mouseJustPressed: Set<number> = new Set();
  private mouseJustReleased: Set<number> = new Set();
  private mouseMovement: THREE.Vector2 = new THREE.Vector2();
  private isPointerLocked: boolean = false;
  private isEnabled: boolean = true;
  private canvas: HTMLCanvasElement;

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseUp: (e: MouseEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onPointerLockChange: () => void;
  private onCanvasClick: () => void;
  private onContextMenu: (e: MouseEvent) => void;

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
      if (!this.isPointerLocked && this.isEnabled) {
        canvas.requestPointerLock().catch(() => { });
      }
    };

    this.onContextMenu = (e) => {
      if (this.isPointerLocked) e.preventDefault();
    };

    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    canvas.addEventListener("click", this.onCanvasClick);
    canvas.addEventListener("contextmenu", this.onContextMenu);
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
    return this.isPointerLocked;
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.mouseButtons.clear();
      this.mouseJustPressed.clear();
      this.mouseJustReleased.clear();
      if (this.isPointerLocked) {
        document.exitPointerLock();
      }
    }
  }

  dispose() {
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.canvas.removeEventListener("click", this.onCanvasClick);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
  }
}