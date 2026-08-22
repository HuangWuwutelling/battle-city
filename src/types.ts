// Terrain tile types (used in 13×13 tile grid)
export type TileType = 0 | 1 | 2 | 3 | 4 | 5;
// 0=empty, 1=brick, 2=steel, 3=grass, 4=river, 5=ice

export const TILE_EMPTY: TileType = 0;
export const TILE_BRICK: TileType = 1;
export const TILE_STEEL: TileType = 2;
export const TILE_GRASS: TileType = 3;
export const TILE_RIVER: TileType = 4;
export const TILE_ICE: TileType = 5;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export type EnemyType = 'basic' | 'fast' | 'power' | 'armor';

export interface EnemyConfig {
  type: EnemyType;
}

export interface LevelData {
  name: string;
  tiles: TileType[][];  // 13×13 grid
  enemies: {
    basic: number;
    fast: number;
    power: number;
    armor: number;
  };
}

export interface LevelScore {
  basic: number;
  fast: number;
  power: number;
  armor: number;
}
