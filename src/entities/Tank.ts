import {
  TANK_SIZE, CELL_SIZE, GAME_AREA_WIDTH, GAME_AREA_HEIGHT,
} from '../constants';
import { Direction, Rect, Point } from '../types';
import { GameMap } from '../systems/Map';
import { PixelArt } from '../rendering/PixelArt';
import { Animation } from '../rendering/Animation';
import { snapToCell } from '../systems/Collision';

export abstract class Tank {
  x: number;
  y: number;
  direction: Direction = 'up';
  speed: number;
  active = true;
  hp: number;
  maxHp: number;
  bodyColor: string;
  trackColor: string;
  readonly anim: Animation;
  protected shootCooldown = 0;

  constructor(x: number, y: number, speed: number, hp: number, bodyColor: string, trackColor: string) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.hp = hp;
    this.maxHp = hp;
    this.bodyColor = bodyColor;
    this.trackColor = trackColor;
    this.anim = new Animation(2, 0.1);
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, width: TANK_SIZE, height: TANK_SIZE };
  }

  get center(): Point {
    return { x: this.x + TANK_SIZE / 2, y: this.y + TANK_SIZE / 2 };
  }

  getBulletSpawnPoint(): Point {
    const cx = this.x + TANK_SIZE / 2 - 2;
    const cy = this.y + TANK_SIZE / 2 - 2;
    switch (this.direction) {
      case 'up':    return { x: cx, y: this.y - 4 };
      case 'down':  return { x: cx, y: this.y + TANK_SIZE };
      case 'left':  return { x: this.x - 4, y: cy };
      case 'right': return { x: this.x + TANK_SIZE, y: cy };
    }
  }

  tryMove(dir: Direction, map: GameMap, allTanks: Tank[]): boolean {
    // Snap to grid when changing direction
    if (dir !== this.direction) {
      if (dir === 'up' || dir === 'down') {
        this.x = snapToCell(this.x, CELL_SIZE);
      } else {
        this.y = snapToCell(this.y, CELL_SIZE);
      }
      this.direction = dir;
    }

    let nx = this.x;
    let ny = this.y;
    switch (dir) {
      case 'up':    ny -= this.speed; break;
      case 'down':  ny += this.speed; break;
      case 'left':  nx -= this.speed; break;
      case 'right': nx += this.speed; break;
    }

    // Boundary check
    if (nx < 0 || nx + TANK_SIZE > GAME_AREA_WIDTH ||
        ny < 0 || ny + TANK_SIZE > GAME_AREA_HEIGHT) {
      return false;
    }

    // Terrain collision
    const startCol = Math.floor(nx / CELL_SIZE);
    const endCol = Math.floor((nx + TANK_SIZE - 1) / CELL_SIZE);
    const startRow = Math.floor(ny / CELL_SIZE);
    const endRow = Math.floor((ny + TANK_SIZE - 1) / CELL_SIZE);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (!map.isPassable(col, row)) {
          return false;
        }
      }
    }

    // Tank-vs-tank collision
    for (const other of allTanks) {
      if (other === this || !other.active) continue;
      if (nx < other.x + TANK_SIZE && nx + TANK_SIZE > other.x &&
          ny < other.y + TANK_SIZE && ny + TANK_SIZE > other.y) {
        return false;
      }
    }

    this.x = nx;
    this.y = ny;
    this.anim.update(1 / 60);
    return true;
  }

  isOnIce(map: GameMap): boolean {
    const col = Math.floor((this.x + TANK_SIZE / 2) / CELL_SIZE);
    const row = Math.floor((this.y + TANK_SIZE / 2) / CELL_SIZE);
    return map.isIce(col, row);
  }

  takeDamage(amount: number = 1): boolean {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.active = false;
      return true;
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    PixelArt.drawTank(
      ctx, this.x, this.y,
      this.direction, this.bodyColor, this.trackColor,
      this.anim.currentFrame,
    );
  }
}
