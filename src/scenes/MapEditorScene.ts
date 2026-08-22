import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

// Placeholder - full implementation in Task 10
export class MapEditorScene implements Scene {
  private game: Game;
  constructor(game: Game) { this.game = game; }
  enter(): void {}
  exit(): void {}
  handleInput(input: Input): void {
    if (input.isKeyPressed('Escape')) {
      this.game.switchScene('menu');
    }
  }
  update(_dt: number): void {}
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFF';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MAP EDITOR (TODO)', 256, 208);
  }
}
