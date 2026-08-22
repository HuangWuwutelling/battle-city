import { CELL_SIZE, COLORS } from '../constants';
import { TileType, TILE_BRICK, TILE_STEEL, TILE_GRASS, TILE_RIVER, TILE_ICE } from '../types';

export class PixelArt {
  static drawTerrainCell(ctx: CanvasRenderingContext2D, x: number, y: number, type: TileType, frame: number = 0): void {
    const px = x * CELL_SIZE;
    const py = y * CELL_SIZE;
    const s = CELL_SIZE;

    switch (type) {
      case TILE_BRICK:
        PixelArt.drawBrick(ctx, px, py, s);
        break;
      case TILE_STEEL:
        PixelArt.drawSteel(ctx, px, py, s);
        break;
      case TILE_GRASS:
        PixelArt.drawGrass(ctx, px, py, s);
        break;
      case TILE_RIVER:
        PixelArt.drawRiver(ctx, px, py, s, frame);
        break;
      case TILE_ICE:
        PixelArt.drawIce(ctx, px, py, s);
        break;
    }
  }

  private static drawBrick(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.fillStyle = COLORS.brick;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = COLORS.brickDark;
    for (let row = 0; row < s; row += 4) {
      ctx.fillRect(x, y + row, s, 1);
    }
    for (let row = 0; row < s; row += 8) {
      for (let col = 0; col < s; col += 8) {
        ctx.fillRect(x + col, y + row, 1, 4);
      }
      for (let col = 4; col < s; col += 8) {
        ctx.fillRect(x + col, y + row + 4, 1, 4);
      }
    }
  }

  private static drawSteel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.fillStyle = COLORS.steel;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, s, 1);
    ctx.fillRect(x, y, 1, s);
    ctx.fillStyle = COLORS.steelDark;
    ctx.fillRect(x + s - 1, y, 1, s);
    ctx.fillRect(x, y + s - 1, s, 1);
    ctx.fillRect(x + 4, y + 4, s - 8, 1);
    ctx.fillRect(x + 4, y + 4, 1, s - 8);
  }

  private static drawGrass(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = COLORS.grassDark;
    for (let row = 0; row < s; row += 4) {
      for (let col = 0; col < s; col += 4) {
        ctx.fillRect(x + col + 1, y + row, 2, 2);
        ctx.fillRect(x + col + 3, y + row + 2, 1, 2);
      }
    }
  }

  private static drawRiver(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, frame: number): void {
    ctx.fillStyle = COLORS.river;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = COLORS.riverLight;
    const offset = frame % 2 === 0 ? 0 : 4;
    for (let row = 0; row < s; row += 8) {
      for (let col = offset; col < s; col += 8) {
        ctx.fillRect(x + col, y + row, 4, 2);
      }
    }
  }

  private static drawIce(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.fillStyle = COLORS.ice;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = COLORS.iceLight;
    ctx.fillRect(x + 2, y + 2, 4, 2);
    ctx.fillRect(x + 10, y + 8, 3, 2);
    ctx.fillRect(x + 4, y + 12, 5, 1);
  }

  static drawTank(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    direction: 'up' | 'down' | 'left' | 'right',
    bodyColor: string,
    trackColor: string,
    animFrame: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);

    switch (direction) {
      case 'up': break;
      case 'down': ctx.translate(32, 32); ctx.rotate(Math.PI); break;
      case 'left': ctx.translate(0, 32); ctx.rotate(-Math.PI / 2); break;
      case 'right': ctx.translate(32, 0); ctx.rotate(Math.PI / 2); break;
    }

    // Tracks
    ctx.fillStyle = trackColor;
    const trackOffset = animFrame % 2 === 0 ? 0 : 2;
    ctx.fillRect(2, 4, 6, 24);
    for (let i = trackOffset; i < 24; i += 4) {
      ctx.fillRect(2, 4 + i, 6, 2);
    }
    ctx.fillRect(24, 4, 6, 24);
    for (let i = trackOffset; i < 24; i += 4) {
      ctx.fillRect(24, 4 + i, 6, 2);
    }

    // Body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(8, 6, 16, 20);

    // Turret
    ctx.fillRect(12, 2, 8, 12);
    // Barrel
    ctx.fillRect(14, 0, 4, 8);

    ctx.restore();
  }

  static drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = COLORS.bullet;
    ctx.fillRect(x, y, 4, 4);
  }

  static drawEagle(ctx: CanvasRenderingContext2D, x: number, y: number, alive: boolean): void {
    if (alive) {
      ctx.fillStyle = COLORS.eagle;
      ctx.fillRect(x, y, 32, 32);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 4, y + 8, 8, 4);
      ctx.fillRect(x + 20, y + 8, 8, 4);
      ctx.fillRect(x + 12, y + 6, 8, 16);
      ctx.fillRect(x + 14, y + 4, 4, 4);
      ctx.fillRect(x + 10, y + 22, 12, 4);
    } else {
      ctx.fillStyle = '#404040';
      ctx.fillRect(x, y, 32, 32);
      ctx.fillStyle = '#808080';
      ctx.fillRect(x + 4, y + 8, 6, 6);
      ctx.fillRect(x + 18, y + 14, 8, 6);
      ctx.fillRect(x + 8, y + 20, 10, 4);
    }
  }

  static drawExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    const sizes = [12, 24, 32];
    const size = sizes[Math.min(frame, sizes.length - 1)];
    const offset = (32 - size) / 2;

    ctx.fillStyle = COLORS.explosion;
    ctx.fillRect(x + offset, y + offset, size, size);

    const innerSize = Math.max(4, size - 8);
    const innerOffset = (32 - innerSize) / 2;
    ctx.fillStyle = COLORS.explosionInner;
    ctx.fillRect(x + innerOffset, y + innerOffset, innerSize, innerSize);
  }

  static drawSpawnFlash(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
    const cx = x + 16;
    const cy = y + 16;
    const sizes = [4, 12, 20, 28];
    const size = sizes[frame % sizes.length];

    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < size / 2; i++) {
      ctx.fillRect(cx - i, cy - size / 2 + i, i * 2, 1);
      ctx.fillRect(cx - i, cy + size / 2 - i, i * 2, 1);
    }
  }
}
