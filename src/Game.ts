import { CANVAS_WIDTH, CANVAS_HEIGHT, TICK_RATE, COLORS } from './constants';
import { Scene } from './scenes/Scene';
import { Input } from './systems/Input';
import { MenuScene } from './scenes/MenuScene';
import { StageIntroScene } from './scenes/StageIntroScene';
import { GameScene } from './scenes/GameScene';
import { ScoreScene } from './scenes/ScoreScene';
import { GameOverScene } from './scenes/GameOverScene';
import { MapEditorScene } from './scenes/MapEditorScene';

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
    this.switchScene('menu');
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(timestamp: number): void {
    if (!this.running) return;

    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    this.accumulator += dt;

    while (this.accumulator >= TICK_RATE) {
      if (this.currentScene) {
        this.currentScene.handleInput(this.input);
        this.currentScene.update(TICK_RATE);
      }
      this.input.endFrame();
      this.accumulator -= TICK_RATE;
    }

    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (this.currentScene) {
      this.currentScene.render(this.ctx);
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}
