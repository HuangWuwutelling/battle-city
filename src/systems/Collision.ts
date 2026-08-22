import { Rect, Point } from '../types';

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
}

export function getOverlapRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.width, b.x + b.width) - x;
  const h = Math.min(a.y + a.height, b.y + b.height) - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, width: w, height: h };
}

// Snap a position to the nearest cell boundary
export function snapToCell(value: number, cellSize: number): number {
  return Math.round(value / cellSize) * cellSize;
}
