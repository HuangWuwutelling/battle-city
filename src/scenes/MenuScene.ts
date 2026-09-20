import { CANVAS_WIDTH, COLORS } from '../constants';
import { Difficulty, GameMode } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';
import { Save } from '../systems/Save';
import { Audio } from '../systems/Audio';

type MenuOption = 'continue' | 'single' | 'coop' | 'versus' | 'editor';
type MenuState = 'main' | 'difficulty';

const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export class MenuScene implements Scene {
  private game: Game;
  private state: MenuState = 'main';
  private selectedIndex = 0;
  private difficultyIndex = 1; // default medium
  private pendingMode: GameMode | null = null;
  private options: MenuOption[] = [];
  // Cached so render() doesn't re-parse localStorage every frame for the
  // "continue" row. Recomputed in enter() — which fires whenever the menu
  // scene is re-entered, i.e. after every Save.save/clear that the game
  // performs before bouncing back to the menu.
  private continueLabel = '';
  private gamepadCount = 0;
  private toastText: string | null = null;
  private toastTimer = 0;
  private static readonly TOAST_DURATION = 1.5;

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    this.state = 'main';
    this.selectedIndex = 0;
    this.pendingMode = null;
    // 默认选项
    this.options = ['single', 'coop', 'versus', 'editor'];
    if (Save.hasSnapshot() || Save.hasSave()) this.options.unshift('continue');

    // Refresh the cached "continue" label — Save data may have changed
    // since last time the menu was visible.
    this.refreshContinueLabel();

    // 从存档恢复上次难度
    const saved = Save.load();
    if (saved) {
      const idx = DIFFICULTY_ORDER.indexOf(saved.lastDifficulty);
      if (idx >= 0) this.difficultyIndex = idx;
    }
  }

  private refreshContinueLabel(): void {
    const snapshot = Save.loadSnapshot();
    if (snapshot) {
      this.continueLabel = `继续关卡 ${snapshot.levelIndex + 1}`;
      return;
    }
    const data = Save.load();
    this.continueLabel = `继续游戏 (关卡 ${(data?.nextLevel ?? 0) + 1})`;
  }

  exit(): void {}

  handleInput(input: Input): void {
    // 首次进入菜单时初始化 AudioContext（必须在用户手势回调内）
    Audio.init();

    // Cache the live gamepad count once per tick — render() runs after
    // handleInput and would otherwise call navigator.getGamepads() per frame.
    this.gamepadCount = input.getConnectedGamepadCount();

    // 全局 M 键切换静音
    if (input.isKeyPressed('KeyM')) {
      Audio.toggle();
      this.toastText = Audio.isEnabled() ? '🔊 音效开' : '🔇 音效关';
      this.toastTimer = MenuScene.TOAST_DURATION;
      return;
    }

    if (this.state === 'main') {
      this.handleMainInput(input);
    } else {
      this.handleDifficultyInput(input);
    }
  }

  private handleMainInput(input: Input): void {
    if (input.isUp()) {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
      Audio.playMenuMove();
    }
    if (input.isDown()) {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
      Audio.playMenuMove();
    }
    if (input.isConfirm()) {
      const opt = this.options[this.selectedIndex];
      Audio.playMenuSelect();
      if (opt === 'editor') {
        this.game.switchScene('mapEditor');
        return;
      }
      if (opt === 'continue') {
        // 优先用暂停快照恢复（精确还原当时状态）；无快照时回退到普通通关存档
        const snapshot = Save.loadSnapshot();
        if (snapshot) {
          this.game.switchScene('stageIntro', {
            snapshot,
            levelIndex: snapshot.levelIndex,
            mode: snapshot.mode,
            difficulty: snapshot.difficulty,
            keepScore: true,
          });
          return;
        }
        const data = Save.load();
        const levelIndex = data?.nextLevel ?? 0;
        const difficulty = data?.lastDifficulty ?? 'medium';
        // 继续游戏默认单人模式（保持原行为）
        this.game.switchScene('stageIntro', { levelIndex, mode: 'single', difficulty, keepScore: true });
        return;
      }
      // single / coop / versus → 进入难度选择
      this.pendingMode = opt === 'single' ? 'single' : opt === 'coop' ? 'coop' : 'versus';
      this.state = 'difficulty';
      this.difficultyIndex = 1;
      return;
    }
  }

  private handleDifficultyInput(input: Input): void {
    // 横向选择难度
    if (input.isKeyPressed('ArrowLeft') || input.isKeyPressed('KeyA')) {
      this.difficultyIndex = (this.difficultyIndex - 1 + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length;
      Audio.playMenuMove();
    }
    if (input.isKeyPressed('ArrowRight') || input.isKeyPressed('KeyD')) {
      this.difficultyIndex = (this.difficultyIndex + 1) % DIFFICULTY_ORDER.length;
      Audio.playMenuMove();
    }
    if (input.isConfirm()) {
      const difficulty = DIFFICULTY_ORDER[this.difficultyIndex];
      const mode = this.pendingMode!;
      Audio.playMenuSelect();
      this.game.switchScene('stageIntro', { levelIndex: 0, mode, difficulty });
      return;
    }
    if (input.isKeyPressed('Escape') || input.isKeyPressed('Backspace')) {
      // 返回主菜单
      this.state = 'main';
      this.pendingMode = null;
    }
  }

  update(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastTimer = 0;
        this.toastText = null;
      }
    }
  }

  private getOptionLabel(opt: MenuOption): string {
    if (opt === 'continue') return this.continueLabel;
    if (opt === 'single') return '单人模式';
    if (opt === 'coop')   return '合作模式 (1P + AI)';
    if (opt === 'versus') return '双人模式';
    return '地图编辑器';
  }

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
    this.drawMenuTank(ctx, cx - 80, 160, COLORS.player1Body);
    this.drawMenuTank(ctx, cx + 48, 160, COLORS.enemyBasic);

    if (this.state === 'main') {
      this.renderMainOptions(ctx, cx);
    } else {
      this.renderDifficultySelect(ctx, cx);
    }

    // 静音切换提示（右上角，~1.5s 淡出）
    if (this.toastText) {
      const alpha = Math.min(1, this.toastTimer / 0.4);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = COLORS.hudText;
      ctx.textAlign = 'right';
      ctx.fillText(this.toastText, CANVAS_WIDTH - 12, 24);
      ctx.textAlign = 'center';
      ctx.globalAlpha = 1;
    }

    // 手柄状态提示（底部）
    ctx.font = '11px monospace';
    ctx.fillStyle = '#808080';
    ctx.textAlign = 'center';
    // 使用 handleInput 中缓存的计数，避免每帧再扫一次 navigator.getGamepads()
    ctx.fillText(`🎮 检测到 ${this.gamepadCount} 个手柄`, cx, 395);
  }

  private renderMainOptions(ctx: CanvasRenderingContext2D, cx: number): void {
    ctx.font = '16px monospace';
    const startY = 240;
    for (let i = 0; i < this.options.length; i++) {
      const y = startY + i * 40;
      const isSelected = i === this.selectedIndex;
      ctx.fillStyle = isSelected ? COLORS.player1Body : COLORS.hudText;
      const prefix = isSelected ? '▶ ' : '  ';
      const label = this.getOptionLabel(this.options[i]);
      ctx.textAlign = 'center';
      ctx.fillText(prefix + label, cx, y);
    }

    ctx.font = '12px monospace';
    ctx.fillStyle = '#808080';
    ctx.fillText('WASD/方向键 选择  |  Enter 确认', cx, 380);
  }

  private renderDifficultySelect(ctx: CanvasRenderingContext2D, cx: number): void {
    const modeLabel = this.pendingMode === 'single' ? '单人模式'
                    : this.pendingMode === 'coop'   ? '合作模式 (1P + AI)'
                    :                                 '双人模式';

    ctx.font = '14px monospace';
    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(`已选择: ${modeLabel}`, cx, 230);

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = COLORS.player1Body;
    ctx.fillText('选择难度', cx, 265);

    // 难度选项横向排列
    ctx.font = 'bold 18px monospace';
    const boxWidth = 90;
    const totalWidth = boxWidth * DIFFICULTY_ORDER.length;
    const startX = cx - totalWidth / 2;
    for (let i = 0; i < DIFFICULTY_ORDER.length; i++) {
      const x = startX + i * boxWidth + boxWidth / 2;
      const isSelected = i === this.difficultyIndex;
      // 选中标记
      if (isSelected) {
        ctx.fillStyle = COLORS.player1Body;
        ctx.font = '14px monospace';
        ctx.fillText('▼', x, 285);
      }
      // 难度文字
      ctx.fillStyle = isSelected ? COLORS.player1Body : '#606060';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(DIFFICULTY_LABEL[DIFFICULTY_ORDER[i]], x, 310);
    }

    ctx.font = '12px monospace';
    ctx.fillStyle = '#808080';
    ctx.fillText('← → 切换  |  Enter 确认  |  Esc 返回', cx, 360);
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
