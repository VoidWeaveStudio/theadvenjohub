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

  private frameCount: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    console.log("⌨️ [InputManager] === INIT START ===");
    console.log(`   - Canvas: ${canvas.width}x${canvas.height}`);

    this.onKeyDown = (e) => {
      if (!this.isEnabled) return;

      if (!this.keys.has(e.code)) {
        console.log(`⌨️ [InputManager] Key DOWN: ${e.code}`);
      }
      this.keys.add(e.code);
    };

    this.onKeyUp = (e) => {
      if (!this.isEnabled) return;

      if (this.keys.has(e.code)) {
        console.log(`⌨️ [InputManager] Key UP: ${e.code}`);
      }
      this.keys.delete(e.code);
    };

    this.onMouseDown = (e) => {
      if (!this.isEnabled) return;
      console.log(`🖱️ [InputManager] Mouse DOWN: button ${e.button}, locked: ${this.isPointerLocked}`);
      if (this.isPointerLocked) {
        this.mouseButtons.add(e.button);
      }
    };

    this.onMouseUp = (e) => {
      console.log(`🖱️ [InputManager] Mouse UP: button ${e.button}`);
      this.mouseButtons.delete(e.button);
    };

    this.onMouseMove = (e) => {
      if (!this.isEnabled || !this.isPointerLocked) return;
      this.mouseMovement.x += e.movementX;
      this.mouseMovement.y += e.movementY;

      if (this.frameCount % 60 === 0 && (Math.abs(e.movementX) > 0.1 || Math.abs(e.movementY) > 0.1)) {
        console.log(`🖱️ [InputManager] Mouse move: (${e.movementX.toFixed(2)}, ${e.movementY.toFixed(2)})`);
      }
    };

    this.onPointerLockChange = () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
      console.log(`🔒 [InputManager] Pointer lock CHANGED: ${this.isPointerLocked}`);
      this.onPointerLockStateChange?.(this.isPointerLocked);
    };

    this.onCanvasClick = () => {
      console.log(`🖱️ [InputManager] Canvas clicked, locked: ${this.isPointerLocked}, enabled: ${this.isEnabled}`);
      if (!this.isPointerLocked && this.isEnabled) {
        console.log("🖱️ [InputManager] Requesting pointer lock...");
        canvas.requestPointerLock().catch(err => {
          console.error("❌ [InputManager] Pointer lock failed:", err);
        });
      }
    };

    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    canvas.addEventListener("click", this.onCanvasClick);

    console.log("   ✅ All event listeners attached");
    console.log("⌨️ [InputManager] === INIT END ===");
  }

  update() {
    this.frameCount++;
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
    console.log(`⚙️ [InputManager] Enabled: ${enabled}`);
    this.isEnabled = enabled;
    if (!enabled) {
      console.log("   🧹 Clearing all inputs");
      this.keys.clear();
      this.mouseButtons.clear();
      if (this.isPointerLocked) {
        document.exitPointerLock();
      }
    }
  }

  dispose() {
    console.log("🧹 [InputManager] Disposing...");
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.canvas.removeEventListener("click", this.onCanvasClick);
    console.log("   ✅ All listeners removed");
  }
} 