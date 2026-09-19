import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from '../constants';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';
import { Audio } from '../systems/Audio';

export class GameOverScene implements Scene {
  private game: Game;
  private score = 0;
  private timer = 0;

  constructor(game: Game) {
    this.game = game;
  }

  enter(params?: Record<string, unknown>): void {
    this.score = (params?.score as number) ?? 0;
    this.timer = 0;
    // 游戏结束音效
    Audio.playGameOver();
  }

  exit(): void {}

  handleInput(input: Input): void {
    if (input.isConfirm() && this.timer > 1) {
      this.game.switchScene('menu');
    }
  }

  update(dt: number): void {
    this.timer += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const cx = CANVAS_WIDTH / 2;
    const targetY = CANVAS_HEIGHT / 2 - 20;
    const startY = CANVAS_HEIGHT;
    const progress = Math.min(this.timer / 1.5, 1);
    const y = startY + (targetY - startY) * progress;

    ctx.fillStyle = '#E04040';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', cx, y);

    if (this.timer > 1.5) {
      ctx.fillStyle = COLORS.hudText;
      ctx.font = '16px monospace';
      ctx.fillText(`SCORE: ${this.score}`, cx, y + 50);

      ctx.font = '12px monospace';
      ctx.fillStyle = '#808080';
      ctx.fillText('按 Enter 返回菜单', cx, y + 100);
    }
  }
}
