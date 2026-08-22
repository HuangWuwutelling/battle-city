import { Input } from '../systems/Input';

export interface Scene {
  enter(params?: Record<string, unknown>): void;
  exit(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  handleInput(input: Input): void;
}
