import { CANVAS_WIDTH, CANVAS_HEIGHT, STAGE_INTRO_DURATION, COLORS } from '../constants';
import { Difficulty, GameMode } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';

export class StageIntroScene implements Scene {
  private game: Game;
  private levelIndex = 0;
  private mode: GameMode = 'single';
  private difficulty: Difficulty = 'medium';
  private timer = 0;

  constructor(game: Game) {
    this.game = game;
  }

  enter(params?: Record<string, unknown>): void {
    this.levelIndex = (params?.levelIndex as number) ?? 0;
    this.mode = (params?.mode as GameMode) ?? 'single';
    this.difficulty = (params?.difficulty as Difficulty) ?? 'medium';
    this.timer = 0;
  }

  exit(): void {}
  handleInput(_input: Input): void {}

  update(dt: number): void {
    this.timer += dt;
    if (this.timer >= STAGE_INTRO_DURATION) {
      this.game.switchScene('game', {
        levelIndex: this.levelIndex,
        mode: this.mode,
        difficulty: this.difficulty,
      });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const progress = Math.min(this.timer / STAGE_INTRO_DURATION, 1);
    const curtainWidth = CANVAS_WIDTH * (1 - progress);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, curtainWidth / 2, CANVAS_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - curtainWidth / 2, 0, curtainWidth / 2, CANVAS_HEIGHT);

    const modeLabel = this.mode === 'single' ? '单人'
                     : this.mode === 'coop'   ? '合作 (1P + AI)'
                     :                          '双人';

    const diffLabel = this.difficulty === 'easy'   ? '易'
                    : this.difficulty === 'medium' ? '中'
                    :                                '难';

    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`STAGE ${this.levelIndex + 1}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

    ctx.font = '14px monospace';
    ctx.fillText(`${modeLabel}  |  难度: ${diffLabel}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 15);
  }
}