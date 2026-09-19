import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, SCORE_BASIC, SCORE_FAST, SCORE_POWER, SCORE_ARMOR } from '../constants';
import { Difficulty, LevelScore } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';
import { Save } from '../systems/Save';

export class ScoreScene implements Scene {
  private game: Game;
  private levelIndex = 0;
  private levelScore: LevelScore = { basic: 0, fast: 0, power: 0, armor: 0 };
  private totalScore = 0;
  private isCustomLevel = false;
  private difficulty: Difficulty = 'medium';
  private timer = 0;

  constructor(game: Game) {
    this.game = game;
  }

  enter(params?: Record<string, unknown>): void {
    this.levelIndex = (params?.levelIndex as number) ?? 0;
    this.levelScore = (params?.levelScore as LevelScore) ?? { basic: 0, fast: 0, power: 0, armor: 0 };
    this.totalScore = (params?.totalScore as number) ?? 0;
    this.isCustomLevel = (params?.isCustomLevel as boolean) ?? false;
    this.difficulty = (params?.difficulty as Difficulty) ?? 'medium';
    this.timer = 0;

    // 通关内置关卡时存进度（保留难度偏好）
    if (!this.isCustomLevel) {
      Save.recordLevelClear(this.levelIndex, this.totalScore, this.difficulty);
    }
  }

  exit(): void {}

  handleInput(input: Input): void {
    if (input.isConfirm() && this.timer > 1) {
      if (this.isCustomLevel) {
        this.game.switchScene('menu');
      } else {
        this.game.switchScene('stageIntro', {
          levelIndex: this.levelIndex + 1,
          difficulty: this.difficulty,
        });
      }
    }
  }

  update(dt: number): void {
    this.timer += dt;
    if (this.timer >= 5 && !this.isCustomLevel) {
      this.game.switchScene('stageIntro', {
        levelIndex: this.levelIndex + 1,
        difficulty: this.difficulty,
      });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const cx = CANVAS_WIDTH / 2;
    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';

    ctx.font = 'bold 20px monospace';
    ctx.fillText(`STAGE ${this.levelIndex + 1} CLEAR!`, cx, 60);

    const entries: [string, number, number][] = [
      ['普通', this.levelScore.basic, SCORE_BASIC],
      ['快速', this.levelScore.fast, SCORE_FAST],
      ['强力', this.levelScore.power, SCORE_POWER],
      ['重甲', this.levelScore.armor, SCORE_ARMOR],
    ];

    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    let y = 120;

    for (const [name, count, perScore] of entries) {
      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(`${name}`, cx - 120, y);
      ctx.fillText(`× ${count}`, cx - 20, y);
      ctx.fillText(`= ${count * perScore}`, cx + 60, y);
      y += 35;
    }

    ctx.fillStyle = '#808080';
    ctx.fillText('────────────────────', cx - 120, y);
    y += 30;

    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = COLORS.player1Body;
    ctx.fillText(`TOTAL    ${this.totalScore}`, cx - 80, y);

    ctx.font = '12px monospace';
    ctx.fillStyle = '#808080';
    ctx.textAlign = 'center';
    if (this.timer > 1) {
      ctx.fillText('按 Enter 继续', cx, 380);
    }
  }
}
