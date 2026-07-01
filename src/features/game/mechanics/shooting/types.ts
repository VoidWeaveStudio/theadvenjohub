export interface ShootingConfig {
  damage: number;
  fireRate: number;
  maxAmmo: number;
  reloadTime: number;
  muzzleOffsetY: number;
  shootingAnimationDuration: number;
}

export interface ShootingState {
  ammo: number;
  isReloading: boolean;
  isShooting: boolean;
}