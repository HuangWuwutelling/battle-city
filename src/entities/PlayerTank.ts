import {
  PLAYER_SPEED, PLAYER_BULLET_SPEED, PLAYER_MAX_BULLETS,
  PLAYER_LIVES, INVINCIBLE_DURATION, COLORS,
} from '../constants';
import { Direction } from '../types';
import { Tank } from './Tank';
import { Bullet } from './Bullet';
import { Input } from '../systems/Input';
import { GameMap } from '../systems/Map';
import type { PlayerTankSnapshot } from '../systems/Snapshot';

export class PlayerTank extends Tank {
  readonly kind = 'player' as const;
  readonly playerIndex: 0 | 1;
  lives: number;
  // `invincibleTimer` was previously `private` and only reachable via an
  // `as unknown as { invincibleTimer: number }` cast in GameScene.saveSnapshot.
  // It stays out of the public surface (still encapsulated), but is now
  // read/written exclusively through `serialize()` / `static deserialize()`,
  // which the compiler can verify stays in sync with the snapshot schema.
  private invincibleTimer = 0;
  private sliding = false;
  private slideDirection: Direction = 'up';

  constructor(
    x: number,
    y: number,
    playerIndex: 0 | 1,
    bodyColor: string = COLORS.player1Body,
    trackColor: string = COLORS.player1Track,
  ) {
    super(x, y, PLAYER_SPEED, 1, bodyColor, trackColor);
    this.playerIndex = playerIndex;
    this.lives = PLAYER_LIVES;
    this.invincibleTimer = INVINCIBLE_DURATION;
  }

  get isInvincible(): boolean {
    return this.invincibleTimer > 0;
  }

  /**
   * Serialize this tank's full state into a typed snapshot. Defined inside
   * the class so it can read private fields (e.g. `invincibleTimer`)
   * without any cast. Adding a new instance field produces a TS error here
   * until it's added to `PlayerTankSnapshot` — that's the contract that
   * makes the snapshot schema self-enforcing.
   */
  serialize(): PlayerTankSnapshot {
    return {
      kind: 'player',
      playerIndex: this.playerIndex,
      x: this.x,
      y: this.y,
      direction: this.direction,
      lives: this.lives,
      hp: this.hp,
      active: this.active,
      invincibleTimer: this.invincibleTimer,
    };
  }

  /**
   * Static factory: build a fresh PlayerTank from a snapshot. The static
   * method body has access to private instance members of PlayerTank (TS
   * private is class-level), so no cast is needed to set `invincibleTimer`.
   */
  static deserialize(snap: PlayerTankSnapshot): PlayerTank {
    const colors = snap.playerIndex === 0
      ? { body: COLORS.player1Body, track: COLORS.player1Track }
      : { body: COLORS.player2Body, track: COLORS.player2Track };
    const tank = new PlayerTank(snap.x, snap.y, snap.playerIndex, colors.body, colors.track);
    tank.direction = snap.direction;
    tank.lives = snap.lives;
    tank.hp = snap.hp;
    tank.active = snap.active;
    tank.invincibleTimer = snap.invincibleTimer;
    return tank;
  }

  update(dt: number, input: Input, map: GameMap, allTanks: Tank[]): Bullet | null {
    if (!this.active) return null;

    this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);

    // Update existing bullets
    this.updateBullets(dt, map);

    // Movement
    const dir = input.getPlayerDirection(this.playerIndex);
    let newBullet: Bullet | null = null;

    if (dir) {
      this.sliding = false;
      this.tryMove(dir, map, allTanks);
      if (this.isOnIce(map)) {
        this.sliding = true;
        this.slideDirection = dir;
      }
    } else if (this.sliding && this.isOnIce(map)) {
      this.tryMove(this.slideDirection, map, allTanks);
    } else {
      this.sliding = false;
    }

    // Shooting
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (input.isPlayerShooting(this.playerIndex) && this.shootCooldown <= 0 && this.activeBullets.length < PLAYER_MAX_BULLETS) {
      const bp = this.getBulletSpawnPoint();
      newBullet = new Bullet(bp.x, bp.y, this.direction, PLAYER_BULLET_SPEED, true);
      this.bullets.push(newBullet);
      this.shootCooldown = 0.2;
    }

    return newBullet;
  }

  respawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.direction = 'up';
    this.hp = 1;
    this.active = true;
    this.invincibleTimer = INVINCIBLE_DURATION;
    this.bullets = [];
    this.lives--;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 10) % 2 === 0) {
      return;
    }
    super.render(ctx);
  }
}
