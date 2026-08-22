import {
  GAME_AREA_WIDTH, CANVAS_HEIGHT, HUD_WIDTH,
  PLAYER_SPAWN, CELL_SIZE, COLORS,
} from '../constants';
import { LevelData, EnemyType, LevelScore } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';
import { GameMap } from '../systems/Map';
import { BulletManager } from '../systems/BulletManager';
import { EnemyManager } from '../systems/EnemyManager';
import { PlayerTank } from '../entities/PlayerTank';
import { Tank } from '../entities/Tank';

import level01 from '../data/levels/level-01.json';
import level02 from '../data/levels/level-02.json';
import level03 from '../data/levels/level-03.json';
import level04 from '../data/levels/level-04.json';
import level05 from '../data/levels/level-05.json';

const LEVELS: LevelData[] = [level01, level02, level03, level04, level05] as unknown as LevelData[];

export class GameScene implements Scene {
  private game: Game;
  private map!: GameMap;
  private bulletManager!: BulletManager;
  private enemyManager!: EnemyManager;
  private player!: PlayerTank;
  private levelIndex = 0;
  private score = 0;
  private levelScore: LevelScore = { basic: 0, fast: 0, power: 0, armor: 0 };
  private input: Input | null = null;
  private isCustomLevel = false;
  private customLevelData: LevelData | null = null;

  constructor(game: Game) {
    this.game = game;
  }

  enter(params?: Record<string, unknown>): void {
    this.levelIndex = (params?.levelIndex as number) ?? 0;
    this.isCustomLevel = !!(params?.customLevel);
    this.customLevelData = (params?.customLevel as LevelData) ?? null;

    if (!params?.keepScore) {
      this.score = 0;
      this.player = new PlayerTank(PLAYER_SPAWN.x * CELL_SIZE, PLAYER_SPAWN.y * CELL_SIZE);
    }

    this.levelScore = { basic: 0, fast: 0, power: 0, armor: 0 };
    this.map = new GameMap();
    this.bulletManager = new BulletManager();
    this.enemyManager = new EnemyManager();

    const levelData = this.isCustomLevel ? this.customLevelData! : LEVELS[this.levelIndex % LEVELS.length];
    this.map.loadLevel(levelData);
    this.enemyManager.initLevel(levelData.enemies);

    if (!this.player) {
      this.player = new PlayerTank(PLAYER_SPAWN.x * CELL_SIZE, PLAYER_SPAWN.y * CELL_SIZE);
    } else {
      this.player.x = PLAYER_SPAWN.x * CELL_SIZE;
      this.player.y = PLAYER_SPAWN.y * CELL_SIZE;
      this.player.active = true;
      this.player.hp = 1;
    }
  }

  exit(): void {}

  handleInput(input: Input): void {
    this.input = input;
  }

  update(dt: number): void {
    if (!this.input) return;

    this.map.update(dt);

    // Update player
    const allTanks: Tank[] = [this.player, ...this.enemyManager.activeEnemies];
    const newPlayerBullet = this.player.update(dt, this.input, this.map, allTanks);
    if (newPlayerBullet) {
      this.bulletManager.addBullet(newPlayerBullet);
    }

    // Update enemies
    this.enemyManager.update(dt, this.map, allTanks, this.player.active ? this.player.center : null);

    // Add enemy bullets to bullet manager
    for (const enemy of this.enemyManager.activeEnemies) {
      if (enemy.bullet && enemy.bullet.active && !this.bulletManager.hasBullet(enemy.bullet)) {
        this.bulletManager.addBullet(enemy.bullet);
      }
    }

    // Update bullets
    this.bulletManager.update(dt);

    // Process collisions
    const result = this.bulletManager.processCollisions(
      this.map, this.player, this.enemyManager.activeEnemies
    );

    // Add score
    this.score += result.score;
    for (const [type, count] of Object.entries(result.enemyKills)) {
      this.levelScore[type as EnemyType] += count as number;
    }

    // Handle player death
    if (result.playerHit) {
      if (this.player.lives > 0) {
        this.player.respawn(PLAYER_SPAWN.x * CELL_SIZE, PLAYER_SPAWN.y * CELL_SIZE);
      } else {
        this.game.switchScene('gameOver', { score: this.score });
        return;
      }
    }

    // Handle eagle destruction
    if (result.eagleHit) {
      this.game.switchScene('gameOver', { score: this.score });
      return;
    }

    // Check level completion
    if (this.enemyManager.isLevelComplete()) {
      this.game.switchScene('score', {
        levelIndex: this.levelIndex,
        levelScore: this.levelScore,
        totalScore: this.score,
        isCustomLevel: this.isCustomLevel,
      });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // 1. Base terrain
    this.map.renderBaseLayer(ctx);

    // 2. Bullets
    this.bulletManager.render(ctx);

    // 3. Tanks
    this.player.render(ctx);
    for (const enemy of this.enemyManager.activeEnemies) {
      enemy.render(ctx);
    }

    // 4. Spawn animation
    this.enemyManager.renderSpawnAnimation(ctx);

    // 5. Grass overlay
    this.map.renderGrassLayer(ctx);

    // 6. HUD
    this.renderHUD(ctx);
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    const hx = GAME_AREA_WIDTH;
    const cx = hx + HUD_WIDTH / 2;

    ctx.fillStyle = '#404040';
    ctx.fillRect(hx, 0, HUD_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';

    ctx.font = '12px monospace';
    ctx.fillText('ENEMY', cx, 30);
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${this.enemyManager.remainingEnemies}`, cx, 55);

    ctx.font = '12px monospace';
    ctx.fillText('STAGE', cx, 150);
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${this.levelIndex + 1}`, cx, 175);

    ctx.font = '12px monospace';
    ctx.fillText('LIVES', cx, 250);
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${this.player.lives}`, cx, 275);

    ctx.font = '12px monospace';
    ctx.fillText('SCORE', cx, 350);
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${this.score}`, cx, 375);
  }
}
