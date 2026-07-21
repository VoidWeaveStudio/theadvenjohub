//src\features\game\core\InputManager.ts
import * as THREE from "three";

export class InputManager {
  private keys: Set<string> = new Set();
  private mouseButtons: Set<number> = new Set();
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

  public onPointerLockStateChange?: (locked: boolean) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.onKeyDown = (e) => {
      if (!this.isEnabled) return;
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
      }
    };

    this.onMouseUp = (e) => {
      this.mouseButtons.delete(e.button);
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
      if (!this.isPointerLocked && this.isEnabled) {
        canvas.requestPointerLock().catch(() => { });
      }
    };

    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    canvas.addEventListener("click", this.onCanvasClick);
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

  isPointerLockedState(): boolean {
    return this.isPointerLocked;
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.mouseButtons.clear();
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
  }
}