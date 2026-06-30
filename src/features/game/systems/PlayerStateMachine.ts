// src/features/game/systems/PlayerStateMachine.ts
import * as THREE from 'three';

export type PlayerState = 
  | 'idle'
  | 'walking'
  | 'running'
  | 'shooting'
  | 'reloading'
  | 'casting'
  | 'fishing'
  | 'driving'
  | 'death';

export interface PlayerContext {
  isMoving: boolean;
  moveSpeed: number;
  isShooting: boolean;
  isReloading: boolean;
  isCasting: boolean;
  isFishing: boolean;
  isDriving: boolean;
  isDead: boolean;
  inputDirection: THREE.Vector3;
}

export class PlayerStateMachine {
  private currentState: PlayerState = 'idle';
  private transitions: Map<PlayerState, Set<PlayerState>> = new Map();
  
  constructor() {
    this.setupTransitions();
  }
  
  private setupTransitions(): void {
    this.addTransition('idle', 'walking');
    this.addTransition('idle', 'running');
    this.addTransition('idle', 'shooting');
    this.addTransition('idle', 'casting');
    this.addTransition('idle', 'fishing');
    this.addTransition('idle', 'driving');
    this.addTransition('idle', 'death');
    
    this.addTransition('walking', 'idle');
    this.addTransition('walking', 'running');
    this.addTransition('walking', 'shooting');
    this.addTransition('walking', 'casting');
    this.addTransition('walking', 'death');
    
    this.addTransition('running', 'idle');
    this.addTransition('running', 'walking');
    this.addTransition('running', 'shooting');
    this.addTransition('running', 'casting');
    this.addTransition('running', 'death');
    
    this.addTransition('shooting', 'idle');
    this.addTransition('shooting', 'walking');
    this.addTransition('shooting', 'running');
    this.addTransition('shooting', 'reloading');
    this.addTransition('shooting', 'death');
    
    this.addTransition('reloading', 'idle');
    this.addTransition('reloading', 'walking');
    this.addTransition('reloading', 'running');
    this.addTransition('reloading', 'death');
    
    this.addTransition('casting', 'idle');
    this.addTransition('casting', 'walking');
    this.addTransition('casting', 'running');
    this.addTransition('casting', 'death');
    
    this.addTransition('fishing', 'idle');
    this.addTransition('fishing', 'death');
    
    this.addTransition('driving', 'idle');
    this.addTransition('driving', 'death');
    
    this.addTransition('death', 'idle');
  }
  
  private addTransition(from: PlayerState, to: PlayerState): void {
    if (!this.transitions.has(from)) {
      this.transitions.set(from, new Set());
    }
    this.transitions.get(from)!.add(to);
  }
  
  canTransitionTo(nextState: PlayerState): boolean {
    if (this.currentState === nextState) return true;
    return this.transitions.get(this.currentState)?.has(nextState) ?? false;
  }
  
  transitionTo(nextState: PlayerState): boolean {
    if (this.canTransitionTo(nextState)) {
      this.currentState = nextState;
      return true;
    }
    return false;
  }
  
  update(context: PlayerContext): PlayerState {
    let nextState: PlayerState = this.currentState;
    
    if (context.isDead) {
      nextState = 'death';
    } else if (context.isShooting) {
      nextState = 'shooting';
    } else if (context.isReloading) {
      nextState = 'reloading';
    } else if (context.isCasting) {
      nextState = 'casting';
    } else if (context.isFishing) {
      nextState = 'fishing';
    } else if (context.isDriving) {
      nextState = 'driving';
    } else if (context.isMoving) {
      nextState = context.moveSpeed > 0.5 ? 'running' : 'walking';
    } else {
      nextState = 'idle';
    }
    
    if (nextState !== this.currentState) {
      this.transitionTo(nextState);
    }
    
    return this.currentState;
  }
  
  getCurrentState(): PlayerState {
    return this.currentState;
  }
}