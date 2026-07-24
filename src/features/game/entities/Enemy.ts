//src\features\game\entities\Enemy.ts
import * as THREE from "three";

export class Enemy {
    public mesh: THREE.Group;
    public id: string;
    public health: number = 100;
    public maxHealth: number = 100;
    public aggroRadius: number = 20;
    public damage: number = 10;
    public attackCooldown: number = 1.0;
    private currentCooldown: number = 0;
    
    public velocity: THREE.Vector3 = new THREE.Vector3();
    private isJumping: boolean = false;
    private jumpCooldown: number = 0;
    private moveSpeed: number = 5;

    constructor(id: string) {
        this.id = id;
        this.mesh = new THREE.Group();
        
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xff3333,
            roughness: 0.7,
            metalness: 0.1
        });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.y = 0.5;
        cube.castShadow = true;
        cube.receiveShadow = true;
        
        this.mesh.add(cube);
    }

    public getHitbox(): THREE.Mesh {
        return this.mesh.children[0] as THREE.Mesh;
    }

    public takeDamage(amount: number) {
        this.health = Math.max(0, this.health - amount);
        
        const cube = this.mesh.children[0] as THREE.Mesh;
        if (cube && cube.material instanceof THREE.MeshStandardMaterial) {
            const originalColor = cube.material.color.getHex();
            cube.material.color.setHex(0xffffff);
            setTimeout(() => {
                if (cube.material instanceof THREE.MeshStandardMaterial) {
                    cube.material.color.setHex(originalColor);
                }
            }, 100);
        }
    }

    public isDead(): boolean {
        return this.health <= 0;
    }

    public update(
        delta: number, 
        playerPosition: THREE.Vector3, 
        getGroundHeight: (x: number, z: number) => number,
        onDamagePlayer?: (damage: number) => void
    ) {
        if (this.isDead()) return;

        if (this.currentCooldown > 0) this.currentCooldown -= delta;
        if (this.jumpCooldown > 0) this.jumpCooldown -= delta;

        const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);

        if (distanceToPlayer <= this.aggroRadius) {
            const direction = new THREE.Vector3().subVectors(playerPosition, this.mesh.position).normalize();
            direction.y = 0;

            if (!this.isJumping && this.jumpCooldown <= 0) {
                this.velocity.y = 7;
                this.isJumping = true;
                this.jumpCooldown = 1.0 + Math.random() * 1.0;
            }

            this.velocity.y -= 25 * delta;
            
            this.mesh.position.x += direction.x * this.moveSpeed * delta;
            this.mesh.position.z += direction.z * this.moveSpeed * delta;
            this.mesh.position.y += this.velocity.y * delta;

            const groundHeight = getGroundHeight(this.mesh.position.x, this.mesh.position.z);
            if (this.mesh.position.y <= groundHeight) {
                this.mesh.position.y = groundHeight;
                this.velocity.y = 0;
                this.isJumping = false;
            }

            this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z);

            if (distanceToPlayer <= 1.5 && this.currentCooldown <= 0) {
                if (onDamagePlayer) {
                    onDamagePlayer(this.damage);
                }
                this.currentCooldown = this.attackCooldown;
            }
        } else {
            if (this.mesh.position.y > 0) {
                this.velocity.y -= 25 * delta;
                this.mesh.position.y += this.velocity.y * delta;
                const groundHeight = getGroundHeight(this.mesh.position.x, this.mesh.position.z);
                if (this.mesh.position.y <= groundHeight) {
                    this.mesh.position.y = groundHeight;
                    this.velocity.y = 0;
                }
            }
        }
    }

    dispose(scene: THREE.Scene) {
        scene.remove(this.mesh);
    }
}