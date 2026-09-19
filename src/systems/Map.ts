import {
  CELL_SIZE, CELL_COLS, CELL_ROWS,
  GRID_COLS, GRID_ROWS,
  EAGLE_POS, RIVER_ANIMATION_INTERVAL,
} from '../constants';
import {
  TileType, LevelData, TILE_EMPTY, TILE_BRICK, TILE_STEEL, TILE_GRASS,
  TILE_RIVER, TILE_ICE,
} from '../types';
import { PixelArt } from '../rendering/PixelArt';
import type { MapSnapshot } from './Snapshot';

export class GameMap {
  private cells: TileType[][] = [];
  private eagleAlive = true;
  private riverTimer = 0;
  private riverFrame = 0;

  constructor() {
    this.initEmpty();
  }

  private initEmpty(): void {
    this.cells = [];
    for (let row = 0; row < CELL_ROWS; row++) {
      this.cells[row] = [];
      for (let col = 0; col < CELL_COLS; col++) {
        this.cells[row][col] = TILE_EMPTY;
      }
    }
    this.eagleAlive = true;
  }

  loadLevel(level: LevelData): void {
    this.initEmpty();

    // Expand 13×13 tiles to 26×26 cells
    for (let tileRow = 0; tileRow < GRID_ROWS; tileRow++) {
      for (let tileCol = 0; tileCol < GRID_COLS; tileCol++) {
        const type = level.tiles[tileRow][tileCol];
        const cellRow = tileRow * 2;
        const cellCol = tileCol * 2;
        this.cells[cellRow][cellCol] = type;
        this.cells[cellRow][cellCol + 1] = type;
        this.cells[cellRow + 1][cellCol] = type;
        this.cells[cellRow + 1][cellCol + 1] = type;
      }
    }

    this.placeEagle();
  }

  private placeEagle(): void {
    const ex = EAGLE_POS.x;
    const ey = EAGLE_POS.y;

    // Clear eagle area
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        if (ey + dy < CELL_ROWS && ex + dx < CELL_COLS) {
          this.cells[ey + dy][ex + dx] = TILE_EMPTY;
        }
      }
    }

    // Surrounding brick wall protection (U-shape)
    if (ey - 1 >= 0) {
      for (let dx = -1; dx <= 2; dx++) {
        const col = ex + dx;
        if (col >= 0 && col < CELL_COLS) {
          this.cells[ey - 1][col] = TILE_BRICK;
        }
      }
    }
    // Left column
    if (ex - 1 >= 0) {
      if (ey < CELL_ROWS) this.cells[ey][ex - 1] = TILE_BRICK;
      if (ey + 1 < CELL_ROWS) this.cells[ey + 1][ex - 1] = TILE_BRICK;
    }
    // Right column
    if (ex + 2 < CELL_COLS) {
      if (ey < CELL_ROWS) this.cells[ey][ex + 2] = TILE_BRICK;
      if (ey + 1 < CELL_ROWS) this.cells[ey + 1][ex + 2] = TILE_BRICK;
    }

    this.eagleAlive = true;
  }

  getCell(col: number, row: number): TileType {
    if (row < 0 || row >= CELL_ROWS || col < 0 || col >= CELL_COLS) {
      return TILE_STEEL; // Out of bounds = impassable
    }
    return this.cells[row][col];
  }

  setCell(col: number, row: number, type: TileType): void {
    if (row >= 0 && row < CELL_ROWS && col >= 0 && col < CELL_COLS) {
      this.cells[row][col] = type;
    }
  }

  isPassable(col: number, row: number): boolean {
    const type = this.getCell(col, row);
    return type === TILE_EMPTY || type === TILE_GRASS || type === TILE_ICE;
  }

  isBulletPassable(col: number, row: number): boolean {
    const type = this.getCell(col, row);
    return type === TILE_EMPTY || type === TILE_GRASS || type === TILE_RIVER || type === TILE_ICE;
  }

  isIce(col: number, row: number): boolean {
    return this.getCell(col, row) === TILE_ICE;
  }

  destroyCell(col: number, row: number): void {
    if (this.getCell(col, row) === TILE_BRICK) {
      this.setCell(col, row, TILE_EMPTY);
    }
  }

  destroyEagle(): void {
    this.eagleAlive = false;
  }

  isEagleAlive(): boolean {
    return this.eagleAlive;
  }

  update(dt: number): void {
    this.riverTimer += dt;
    if (this.riverTimer >= RIVER_ANIMATION_INTERVAL) {
      this.riverTimer -= RIVER_ANIMATION_INTERVAL;
      this.riverFrame = (this.riverFrame + 1) % 2;
    }
  }

  renderBaseLayer(ctx: CanvasRenderingContext2D): void {
    for (let row = 0; row < CELL_ROWS; row++) {
      for (let col = 0; col < CELL_COLS; col++) {
        const type = this.cells[row][col];
        if (type !== TILE_EMPTY && type !== TILE_GRASS) {
          PixelArt.drawTerrainCell(ctx, col, row, type, this.riverFrame);
        }
      }
    }

    // Draw eagle
    const ex = EAGLE_POS.x * CELL_SIZE;
    const ey = EAGLE_POS.y * CELL_SIZE;
    PixelArt.drawEagle(ctx, ex, ey, this.eagleAlive);
  }

  renderGrassLayer(ctx: CanvasRenderingContext2D): void {
    for (let row = 0; row < CELL_ROWS; row++) {
      for (let col = 0; col < CELL_COLS; col++) {
        if (this.cells[row][col] === TILE_GRASS) {
          PixelArt.drawTerrainCell(ctx, col, row, TILE_GRASS);
        }
      }
    }
  }

  getCellGrid(): TileType[][] {
    return this.cells.map(row => [...row]);
  }

  setCellGrid(grid: TileType[][]): void {
    this.cells = grid.map(row => [...row]);
  }

  /**
   * Typed snapshot accessor. Replaces the previous
   * `(this.map as unknown as { eagleAlive: boolean }).eagleAlive` cast in
   * GameScene.saveSnapshot — `eagleAlive` stays private (gameplay state,
   * not part of the public surface) but is now read through this typed
   * method that the compiler verifies stays in sync with MapSnapshot.
   */
  serialize(): MapSnapshot {
    return {
      cells: this.cells.map(row => [...row]),
      eagleAlive: this.eagleAlive,
    };
  }

  /**
   * Restore from a typed snapshot. Reverse of `serialize()`. Replaces the
   * `(this.map as unknown as { eagleAlive: boolean }).eagleAlive = ...`
   * cast in GameScene.restoreFromSnapshot.
   */
  applySnapshot(snap: MapSnapshot): void {
    this.cells = snap.cells.map(row => [...row]);
    this.eagleAlive = snap.eagleAlive;
  }

  static deserialize(snap: MapSnapshot): GameMap {
    const map = new GameMap();
    map.applySnapshot(snap);
    return map;
  }
}
