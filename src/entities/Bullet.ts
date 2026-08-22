import { BULLET_SIZE, GAME_AREA_WIDTH, GAME_AREA_HEIGHT } from '../constants';
import { Direction, Rect } from '../types';
import { PixelArt } from '../rendering/PixelArt';

export class Bullet {
  x: number;
  y: number;
  direction: Direction;
  speed: number;
  active = true;
  readonly ownerIsPlayer: boolean;

  constructor(x: number, y: number, direction: Direction, speed: number, ownerIsPlayer: boolean) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.speed = speed;
    this.ownerIsPlayer = ownerIsPlayer;
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, width: BULLET_SIZE, height: BULLET_SIZE };
  }

  update(): void {
    switch (this.direction) {
      case 'up':    this.y -= this.speed; break;
      case 'down':  this.y += this.speed; break;
      case 'left':  this.x -= this.speed; break;
      case 'right': this.x += this.speed; break;
    }

    if (this.x < 0 || this.x + BULLET_SIZE > GAME_AREA_WIDTH ||
        this.y < 0 || this.y + BULLET_SIZE > GAME_AREA_HEIGHT) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    PixelArt.drawBullet(ctx, this.x, this.y);
  }

  destroy(): void {
    this.active = false;
  }
}
