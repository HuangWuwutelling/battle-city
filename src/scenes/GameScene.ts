import {
  GAME_AREA_WIDTH, CANVAS_HEIGHT, HUD_WIDTH,
  PLAYER_SPAWN, PLAYER1_SPAWN, PLAYER2_SPAWN, PLAYER_SPAWN_COOP, ALLY_SPAWN, CELL_SIZE, COLORS,
  PLAYER_LIVES, ALLY_LIVES,
} from '../constants';
import { Difficulty, EnemyType, GameMode, LevelData, LevelScore } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';
import { GameMap } from '../systems/Map';
import { BulletManager } from '../systems/BulletManager';
import { EnemyManager } from '../systems/EnemyManager';
import { PlayerTank } from '../entities/PlayerTank';
import { AlliedTank } from '../entities/AlliedTank';
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
  private players: PlayerTank[] = [];
  private ally: AlliedTank | null = null;
  private levelIndex = 0;
  private score = 0;
  private levelScore: LevelScore = { basic: 0, fast: 0, power: 0, armor: 0 };
  private input: Input | null = null;
  private isCustomLevel = false;
  private customLevelData: LevelData | null = null;
  private mode: GameMode = 'single';
  private difficulty: Difficulty = 'medium';

  constructor(game: Game) {
    this.game = game;
  }

  enter(params?: Record<string, unknown>): void {
    this.levelIndex = (params?.levelIndex as number) ?? 0;
    this.isCustomLevel = !!(params?.customLevel);
    this.customLevelData = (params?.customLevel as LevelData) ?? null;
    this.mode = (params?.mode as GameMode) ?? 'single';
    this.difficulty = (params?.difficulty as Difficulty) ?? 'medium';

    if (!params?.keepScore) {
      this.score = 0;
      this.players = [];
      this.ally = null;

      // versus: P1 at PLAYER1_SPAWN + P2 at PLAYER2_SPAWN
      // coop:   P1 at PLAYER_SPAWN_COOP + ally at ALLY_SPAWN
      // single: P1 at PLAYER_SPAWN
      if (this.mode === 'versus') {
        this.players.push(new PlayerTank(
          PLAYER1_SPAWN.x * CELL_SIZE,
          PLAYER1_SPAWN.y * CELL_SIZE,
          0,
          COLORS.player1Body,
          COLORS.player1Track,
        ));
        this.players.push(new PlayerTank(
          PLAYER2_SPAWN.x * CELL_SIZE,
          PLAYER2_SPAWN.y * CELL_SIZE,
          1,
          COLORS.player2Body,
          COLORS.player2Track,
        ));
      } else {
        const spawn = this.mode === 'coop' ? PLAYER_SPAWN_COOP : PLAYER_SPAWN;
        this.players.push(new PlayerTank(
          spawn.x * CELL_SIZE,
          spawn.y * CELL_SIZE,
          0,
          COLORS.player1Body,
          COLORS.player1Track,
        ));
        if (this.mode === 'coop') {
          this.ally = new AlliedTank(
            ALLY_SPAWN.x * CELL_SIZE,
            ALLY_SPAWN.y * CELL_SIZE,
          );
        }
      }
    }

    this.levelScore = { basic: 0, fast: 0, power: 0, armor: 0 };
    this.map = new GameMap();
    this.bulletManager = new BulletManager();
    this.enemyManager = new EnemyManager();

    const levelData = this.isCustomLevel ? this.customLevelData! : LEVELS[this.levelIndex % LEVELS.length];
    this.map.loadLevel(levelData);
    this.enemyManager.initLevel(levelData.enemies, this.difficulty);

    // Reset positions on every level transition (even keepScore level switches).
    if (this.mode === 'versus') {
      const p1 = this.players[0];
      const p2 = this.players[1];
      if (p1) { p1.x = PLAYER1_SPAWN.x * CELL_SIZE; p1.y = PLAYER1_SPAWN.y * CELL_SIZE; p1.active = true; p1.hp = 1; }
      if (p2) { p2.x = PLAYER2_SPAWN.x * CELL_SIZE; p2.y = PLAYER2_SPAWN.y * CELL_SIZE; p2.active = true; p2.hp = 1; }
    } else {
      const spawn = this.mode === 'coop' ? PLAYER_SPAWN_COOP : PLAYER_SPAWN;
      const p1 = this.players[0];
      if (p1) { p1.x = spawn.x * CELL_SIZE; p1.y = spawn.y * CELL_SIZE; p1.active = true; p1.hp = 1; }
    }

    if (this.ally) {
      this.ally.x = ALLY_SPAWN.x * CELL_SIZE;
      this.ally.y = ALLY_SPAWN.y * CELL_SIZE;
      this.ally.active = true;
      this.ally.respawn(ALLY_SPAWN.x * CELL_SIZE, ALLY_SPAWN.y * CELL_SIZE);
    }

    // Reset lives to the full pool on every new level start, so lives do not
    // carry over from the previous level. Skipped when resuming from save.
    if (params?.resumeFromSave !== true) {
      for (const player of this.players) {
        player.lives = PLAYER_LIVES;
      }
      if (this.ally) {
        this.ally.lives = ALLY_LIVES;
      }
    }
  }

  exit(): void {}

  handleInput(input: Input): void {
    this.input = input;
  }

  update(dt: number): void {
    if (!this.input) return;

    this.map.update(dt);

    // Build the unified tank list used for movement collision checks.
    const allTanks: Tank[] = [
      ...this.players,
      ...(this.ally && this.ally.active ? [this.ally] : []),
      ...this.enemyManager.activeEnemies,
    ];

    // Update each player (P1, and P2 in versus mode)
    for (const player of this.players) {
      const newBullet = player.update(dt, this.input, this.map, allTanks);
      if (newBullet) {
        this.bulletManager.addBullet(newBullet);
      }
    }

    // Update AI ally in coop mode
    if (this.ally && this.ally.active) {
      const newAllyBullet = this.ally.update(
        dt, this.map, allTanks, this.enemyManager.activeEnemies,
      );
      if (newAllyBullet) {
        this.bulletManager.addBullet(newAllyBullet);
      }
    }

    // Enemy AI targets the first active player position
    const target = this.players.find(p => p.active) ?? null;
    this.enemyManager.update(dt, this.map, allTanks, target ? target.center : null);

    // Pull any newly spawned enemy bullets into the bullet manager
    for (const enemy of this.enemyManager.activeEnemies) {
      if (enemy.bullet && enemy.bullet.active && !this.bulletManager.hasBullet(enemy.bullet)) {
        this.bulletManager.addBullet(enemy.bullet);
      }
    }

    this.bulletManager.update(dt);

    // BulletManager now resolves damage for every friendly unit (P1, P2, ally).
    const friendlyTanks: Tank[] = [
      ...this.players,
      ...(this.ally && this.ally.active ? [this.ally] : []),
    ];
    const result = this.bulletManager.processCollisions(
      this.map, friendlyTanks, this.enemyManager.activeEnemies,
    );

    this.score += result.score;
    for (const [type, count] of Object.entries(result.enemyKills)) {
      this.levelScore[type as EnemyType] += count as number;
    }

    if (result.friendlyHitIndex !== null) {
      this.handleFriendlyHit();
    }

    if (result.eagleHit) {
      this.game.switchScene('gameOver', { score: this.score });
      return;
    }

    if (this.enemyManager.isLevelComplete()) {
      this.game.switchScene('score', {
        levelIndex: this.levelIndex,
        levelScore: this.levelScore,
        totalScore: this.score,
        isCustomLevel: this.isCustomLevel,
        difficulty: this.difficulty,
      });
    }
  }

  /**
   * Handle player/ally death: each unit is processed independently.
   * - lives > 0: respawn at that unit's spawn point and decrement lives
   * - lives <= 0: the unit stays inactive for the rest of the level
   * Game Over triggers only when ALL players AND the ally are gone.
   */
  private handleFriendlyHit(): void {
    // Process each player independently
    for (const player of this.players) {
      if (player.active) continue;
      if (player.lives > 0) {
        const spawn = player.playerIndex === 0
          ? (this.mode === 'coop' ? PLAYER_SPAWN_COOP : (this.mode === 'versus' ? PLAYER1_SPAWN : PLAYER_SPAWN))
          : PLAYER2_SPAWN;
        player.respawn(spawn.x * CELL_SIZE, spawn.y * CELL_SIZE);
      }
      // lives <= 0: stay inactive
    }

    // Process AI ally
    if (this.ally && !this.ally.active) {
      if (this.ally.lives > 0) {
        this.ally.respawn(ALLY_SPAWN.x * CELL_SIZE, ALLY_SPAWN.y * CELL_SIZE);
      }
      // lives <= 0: ally is gone for the level; player(s) continue solo
    }

    // Game Over: all players dead AND ally gone (or never existed)
    const allPlayersDead = this.players.every(p => !p.active);
    const allyGone = !this.ally || !this.ally.active;
    if (allPlayersDead && allyGone) {
      this.game.switchScene('gameOver', { score: this.score });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // 1. Base terrain
    this.map.renderBaseLayer(ctx);

    // 2. Bullets
    this.bulletManager.render(ctx);

    // 3. Tanks (players, ally, then enemies)
    for (const player of this.players) {
      player.render(ctx);
    }
    if (this.ally && this.ally.active) {
      this.ally.render(ctx);
    }
    for (const enemy of this.enemyManager.activeEnemies) {
      enemy.render(ctx);
    }

    // 4. Spawn animation
    this.enemyManager.renderSpawnAnimation(ctx);

    // 5. Grass overlay (covers tanks — visual cover)
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

    // ENEMY counter
    ctx.font = '12px monospace';
    ctx.fillText('ENEMY', cx, 25);
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${this.enemyManager.remainingEnemies}`, cx, 50);

    // Per-unit life blocks (P1 always; P2 in versus; ALLY in coop)
    let yCursor = 80;
    const drawUnitLives = (
      label: string,
      color: string,
      lives: number,
      active: boolean,
      inactiveLabel?: string,
    ) => {
      ctx.fillStyle = color;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(label, cx, yCursor);
      yCursor += 18;
      ctx.font = '10px monospace';
      if (active) {
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText('♥'.repeat(Math.max(0, lives)), cx, yCursor);
      } else {
        ctx.fillStyle = '#808080';
        ctx.fillText(inactiveLabel ?? 'OUT', cx, yCursor);
      }
      yCursor += 22;
    };

    drawUnitLives('P1', COLORS.player1Body, this.players[0]?.lives ?? 0, this.players[0]?.active ?? false);
    if (this.mode === 'versus') {
      drawUnitLives('P2', COLORS.player2Body, this.players[1]?.lives ?? 0, this.players[1]?.active ?? false);
    }
    if (this.mode === 'coop' && this.ally) {
      drawUnitLives('ALLY', COLORS.allyBody, this.ally.lives, this.ally.active, 'GONE');
    }

    // STAGE
    yCursor += 10;
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '12px monospace';
    ctx.fillText('STAGE', cx, yCursor);
    yCursor += 25;
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${this.levelIndex + 1}`, cx, yCursor);

    // Difficulty (small, below stage)
    yCursor += 25;
    ctx.font = '10px monospace';
    ctx.fillStyle = '#A0A0A0';
    const diffLabel = this.difficulty === 'easy' ? '简单' : this.difficulty === 'medium' ? '中等' : '困难';
    ctx.fillText(`难度: ${diffLabel}`, cx, yCursor);

    // SCORE — pinned to the bottom of the HUD
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '12px monospace';
    ctx.fillText('SCORE', cx, 360);
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${this.score}`, cx, 385);
  }
}
