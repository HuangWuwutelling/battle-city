import { CANVAS_WIDTH, CANVAS_HEIGHT, TICK_RATE } from './constants';
import { Scene } from './scenes/Scene';
import { Input } from './systems/Input';
import { MenuScene } from './scenes/MenuScene';
import { StageIntroScene } from './scenes/StageIntroScene';
import { GameScene } from './scenes/GameScene';
import { ScoreScene } from './scenes/ScoreScene';
import { GameOverScene } from './scenes/GameOverScene';
import { MapEditorScene } from './scenes/MapEditorScene';
import { Audio } from './systems/Audio';

/**
 * Hard cap on per-frame delta-time (seconds). If the tab is backgrounded
 * the RAF callback can fire hundreds of ms after `lastTime`; without this
 * cap the accumulator would then try to "catch up" with a giant burst of
 * TICK_RATE ticks, freezing the game on resume. 0.25s ≈ 15 missed ticks
 * at 60fps.
 */
const MAX_DT = 0.25;

export class Game {
  private ctx: CanvasRenderingContext2D;
  private input: Input;
  private scenes: Map<string, Scene> = new Map();
  private currentScene: Scene | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.input = new Input();
    this.registerScenes();
  }

  private registerScenes(): void {
    const scenes: [string, Scene][] = [
      ['menu', new MenuScene(this)],
      ['stageIntro', new StageIntroScene(this)],
      ['game', new GameScene(this)],
      ['score', new ScoreScene(this)],
      ['gameOver', new GameOverScene(this)],
      ['mapEditor', new MapEditorScene(this)],
    ];
    for (const [name, scene] of scenes) {
      this.scenes.set(name, scene);
    }
  }

  switchScene(name: string, params?: Record<string, unknown>): void {
    if (this.currentScene) {
      this.currentScene.exit();
    }
    const scene = this.scenes.get(name);
    if (!scene) {
      console.error(`Scene "${name}" not found`);
      return;
    }
    this.currentScene = scene;
    scene.enter(params);
  }

  start(): void {
    this.running = true;
    // Minor #33 — Audio.init() used to live in MenuScene.handleInput (only
    // ran on a user key/confirm). It's now called eagerly at app start.
    // init() is idempotent and also resumes a suspended AudioContext on
    // subsequent calls, so the eager call still leaves the first user
    // keypress as the unlock-gesture for browsers that require it.
    Audio.init();
    this.switchScene('menu');
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(timestamp: number): void {
    if (!this.running) return;

    // Clamp dt so a backgrounded tab returning to foreground doesn't
    // dump hundreds of catch-up TICK_RATE ticks into the accumulator.
    const dt = Math.min((timestamp - this.lastTime) / 1000, MAX_DT);
    this.lastTime = timestamp;
    this.accumulator += dt;

    while (this.accumulator >= TICK_RATE) {
      this.input.refreshGamepads();
      if (this.currentScene) {
        this.currentScene.handleInput(this.input);
        this.currentScene.update(TICK_RATE);
      }
      this.input.endFrame();
      this.accumulator -= TICK_RATE;
    }

    // Background clear removed (Minor #30). Each scene now paints its
    // own backdrop:
    //   - GameScene: Map.renderBaseLayer fills the gameplay area
    //     (CELL_COLS*CELL_SIZE × CELL_ROWS*CELL_SIZE) before iterating
    //     terrain cells.
    //   - MenuScene: render() now starts with a full-canvas fillRect.
    //   - StageIntro / Score / GameOver already covered themselves.
    //   - MapEditorScene already covers via toolbar + editor + sidbar rects.
    //   - HUD sidebar in GameScene still draws its own fillRect.

    if (this.currentScene) {
      this.currentScene.render(this.ctx);
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}
