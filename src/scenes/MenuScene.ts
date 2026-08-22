import { CANVAS_WIDTH, COLORS } from '../constants';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

export class MenuScene implements Scene {
  private game: Game;
  private selectedIndex = 0;
  private readonly options = ['开始游戏', '关卡选择', '地图编辑器'];

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    this.selectedIndex = 0;
  }

  exit(): void {}

  handleInput(input: Input): void {
    if (input.isUp()) {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
    }
    if (input.isDown()) {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
    }
    if (input.isConfirm()) {
      switch (this.selectedIndex) {
        case 0:
          this.game.switchScene('stageIntro', { levelIndex: 0 });
          break;
        case 1:
          this.game.switchScene('stageIntro', { levelIndex: 0 });
          break;
        case 2:
          this.game.switchScene('mapEditor');
          break;
      }
    }
  }

  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const cx = CANVAS_WIDTH / 2;

    // Title
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BATTLE CITY', cx, 100);

    ctx.font = '14px monospace';
    ctx.fillStyle = COLORS.enemyBasic;
    ctx.fillText('坦 克 大 战', cx, 130);

    // Tank decoration
    this.drawMenuTank(ctx, cx - 80, 160, COLORS.playerBody);
    this.drawMenuTank(ctx, cx + 48, 160, COLORS.enemyBasic);

    // Menu options
    ctx.font = '18px monospace';
    for (let i = 0; i < this.options.length; i++) {
      const y = 240 + i * 40;
      ctx.fillStyle = i === this.selectedIndex ? COLORS.playerBody : COLORS.hudText;
      const prefix = i === this.selectedIndex ? '▶ ' : '  ';
      ctx.textAlign = 'center';
      ctx.fillText(prefix + this.options[i], cx, y);
    }

    // Instructions
    ctx.font = '12px monospace';
    ctx.fillStyle = '#808080';
    ctx.fillText('WASD/方向键 选择  |  Enter 确认', cx, 380);
  }

  private drawMenuTank(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x + 8, y, 16, 24);
    ctx.fillRect(x + 12, y - 8, 8, 12);
    ctx.fillStyle = '#404040';
    ctx.fillRect(x + 2, y + 4, 6, 20);
    ctx.fillRect(x + 24, y + 4, 6, 20);
  }
}
