import {
  GAME_AREA_WIDTH, CANVAS_HEIGHT, HUD_WIDTH,
  PLAYER_SPAWN, PLAYER1_SPAWN, PLAYER2_SPAWN, PLAYER_SPAWN_COOP, ALLY_SPAWN,
  CELL_SIZE, COLORS, DIFFICULTY,
  PLAYER_LIVES, ALLY_LIVES,
} from '../constants';
import { Difficulty, Direction, EnemyType, GameMode, LevelData, LevelScore, Point, TileType } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';
import { GameMap } from '../systems/Map';
import { BulletManager } from '../systems/BulletManager';
import { EnemyManager } from '../systems/EnemyManager';
import { PlayerTank } from '../entities/PlayerTank';
import { AlliedTank } from '../entities/AlliedTank';
import { EnemyTank } from '../entities/EnemyTank';
import { Bullet } from '../entities/Bullet';
import { Tank } from '../entities/Tank';
import { Save, GameSnapshot } from '../systems/Save';
import { Audio } from '../systems/Audio';

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
  private paused = false;

  constructor(game: Game) {
    this.game = game;
  }

  enter(params?: Record<string, unknown>): void {
    // 暂停快照恢复：从快照重建完整状态，跳过后续默认初始化
    if (params?.snapshot) {
      this.enterFromSnapshot(params.snapshot as GameSnapshot);
      return;
    }
    if (params?.keepScore) {
      this.enterNextLevel(params);
    } else {
      this.enterFresh(params);
    }
  }

  /**
   * New game from menu (or map editor). Resets score, players, ally, lives,
   * loads the level from scratch, places tanks at spawn points.
   */
  private enterFresh(params?: Record<string, unknown>): void {
    Audio.playLevelStart();

    this.levelIndex = (params?.levelIndex as number) ?? 0;
    this.isCustomLevel = !!(params?.customLevel);
    this.customLevelData = (params?.customLevel as LevelData) ?? null;
    this.mode = (params?.mode as GameMode) ?? 'single';
    this.difficulty = (params?.difficulty as Difficulty) ?? 'medium';
    this.paused = false;

    this.score = 0;
    this.levelScore = { basic: 0, fast: 0, power: 0, armor: 0 };
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

    this.map = new GameMap();
    this.bulletManager = new BulletManager();
    this.enemyManager = new EnemyManager();

    const levelData = this.isCustomLevel ? this.customLevelData! : LEVELS[this.levelIndex % LEVELS.length];
    this.map.loadLevel(levelData);
    this.enemyManager.initLevel(levelData.enemies, this.difficulty);

    this.resetPositionsForMode();
    this.resetLivesForLevel();
  }

  /**
   * Score scene → next stage. Currently delegates to enterFresh because no
   * caller in the codebase passes keepScore without a snapshot (snapshot
   * takes the early-return path through enterFromSnapshot). Kept as a
   * distinct method so the intent ("keep score and players across the
   * level boundary") is named; if a future caller needs to preserve state
   * across a level switch, only this method needs to change.
   */
  private enterNextLevel(params?: Record<string, unknown>): void {
    this.enterFresh(params);
  }

  /**
   * Restore full game state from a pause snapshot, then auto-resume so
   * the player doesn't have to press P/Esc after selecting "Continue" from
   * the menu. (Major #13 — the prior paused-on-restore UX was confusing.)
   */
  private enterFromSnapshot(snapshot: GameSnapshot): void {
    this.restoreFromSnapshot(snapshot);
    this.paused = false;
  }

  /**
   * Single source for per-player spawn point. Mirrors the spawn points
   * used by enterFresh when creating tanks. Also used by handleFriendlyHit
   * to place respawned players back at the correct location.
   */
  private spawnPointFor(playerIndex: 0 | 1): Point {
    if (playerIndex === 1) return PLAYER2_SPAWN;
    if (this.mode === 'versus') return PLAYER1_SPAWN;
    if (this.mode === 'coop') return PLAYER_SPAWN_COOP;
    return PLAYER_SPAWN;
  }

  /**
   * Snap every player and ally back to its spawn point and re-activate it.
   * Idempotent on already-spawned tanks (the PlayerTank constructor already
   * spawns at the right cell, so this is a no-op for the enterFresh path
   * but matters for any future keepScore path that reuses existing tanks).
   */
  private resetPositionsForMode(): void {
    if (this.mode === 'versus') {
      const p1 = this.players[0];
      const p2 = this.players[1];
      if (p1) {
        p1.x = PLAYER1_SPAWN.x * CELL_SIZE;
        p1.y = PLAYER1_SPAWN.y * CELL_SIZE;
        p1.active = true;
        p1.hp = 1;
      }
      if (p2) {
        p2.x = PLAYER2_SPAWN.x * CELL_SIZE;
        p2.y = PLAYER2_SPAWN.y * CELL_SIZE;
        p2.active = true;
        p2.hp = 1;
      }
    } else {
      const spawn = this.spawnPointFor(0);
      const p1 = this.players[0];
      if (p1) {
        p1.x = spawn.x * CELL_SIZE;
        p1.y = spawn.y * CELL_SIZE;
        p1.active = true;
        p1.hp = 1;
      }
    }

    if (this.ally) {
      this.ally.x = ALLY_SPAWN.x * CELL_SIZE;
      this.ally.y = ALLY_SPAWN.y * CELL_SIZE;
      this.ally.active = true;
      this.ally.respawn(ALLY_SPAWN.x * CELL_SIZE, ALLY_SPAWN.y * CELL_SIZE);
    }
  }

  /**
   * Reset every player and the ally back to their full lives pool at the
   * start of a level. Snapshot restore skips this (the snapshot already
   * carries the correct remaining-lives state via the early-return path).
   */
  private resetLivesForLevel(): void {
    for (const player of this.players) {
      player.lives = PLAYER_LIVES;
    }
    if (this.ally) {
      this.ally.lives = ALLY_LIVES;
    }
  }

  exit(): void {}

  handleInput(input: Input): void {
    this.input = input;
    // 暂停/恢复：按 P 或 Esc 时切换暂停状态；进入暂停时立即保存快照
    if (input.isPause()) {
      if (!this.paused) {
        this.paused = true;
        this.saveSnapshot();
      } else {
        this.paused = false;
      }
    }
  }

  update(dt: number): void {
    if (!this.input) return;
    if (this.paused) return;

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
        this.bulletManager.addBullet(newBullet, 'player');
      }
    }

    // Update AI ally in coop mode
    if (this.ally && this.ally.active) {
      const newAllyBullet = this.ally.update(
        dt, this.map, allTanks, this.enemyManager.activeEnemies,
      );
      if (newAllyBullet) {
        this.bulletManager.addBullet(newAllyBullet, 'ally');
      }
    }

    // Enemy AI targets the first active player position
    const target = this.players.find(p => p.active) ?? null;
    this.enemyManager.update(dt, this.map, allTanks, target ? target.center : null);

    // Pull any newly spawned enemy bullets into the bullet manager
    for (const enemy of this.enemyManager.activeEnemies) {
      for (const bullet of enemy.activeBullets) {
        if (!this.bulletManager.hasBullet(bullet)) {
          this.bulletManager.addBullet(bullet, 'enemy');
        }
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

    if (result.friendlyHit) {
      this.handleFriendlyHit();
    }

    if (result.eagleHit) {
      Save.clearSnapshot();
      this.game.switchScene('gameOver', { score: this.score });
      return;
    }

    if (this.enemyManager.isLevelComplete()) {
      Save.clearSnapshot();
      this.game.switchScene('score', {
        levelIndex: this.levelIndex,
        levelScore: this.levelScore,
        totalScore: this.score,
        isCustomLevel: this.isCustomLevel,
        difficulty: this.difficulty,
        mode: this.mode,
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
        const spawn = this.spawnPointFor(player.playerIndex);
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
      Save.clearSnapshot();
      this.game.switchScene('gameOver', { score: this.score });
    }
  }

  /**
   * 将当前完整游戏状态写入 localStorage。
   * 仅持久化存活的敌人；剩余数量由 EnemyManager.remainingEnemies 计算。
   */
  private saveSnapshot(): void {
    const snapshot: GameSnapshot = {
      version: 1,
      savedAt: Date.now(),
      levelIndex: this.levelIndex,
      mode: this.mode,
      difficulty: this.difficulty,
      score: this.score,
      levelScore: { ...this.levelScore },
      isCustomLevel: this.isCustomLevel,
      customLevelData: this.customLevelData,

      map: {
        cells: this.map.getCellGrid().map(row => row.map(cell => cell as number)),
        eagleAlive: this.map.isEagleAlive(),
      },

      players: this.players.map(p => ({
        playerIndex: p.playerIndex,
        x: p.x,
        y: p.y,
        direction: p.direction,
        lives: p.lives,
        hp: p.hp,
        active: p.active,
        invincibleTimer: (p as unknown as { invincibleTimer: number }).invincibleTimer,
      })),

      ally: this.ally ? {
        x: this.ally.x,
        y: this.ally.y,
        direction: this.ally.direction,
        lives: this.ally.lives,
        hp: this.ally.hp,
        active: this.ally.active,
        directionTimer: (this.ally as unknown as { directionTimer: number }).directionTimer,
        nextDirectionChange: (this.ally as unknown as { nextDirectionChange: number }).nextDirectionChange,
      } : null,

      enemies: this.enemyManager.activeEnemies
        .filter(e => e.active)
        .map(e => ({
          type: e.type,
          x: e.x,
          y: e.y,
          direction: e.direction,
          hp: e.hp,
          active: e.active,
          directionTimer: (e as unknown as { directionTimer: number }).directionTimer,
          nextDirectionChange: (e as unknown as { nextDirectionChange: number }).nextDirectionChange,
          shootTimer: (e as unknown as { shootTimer: number }).shootTimer,
          flashTimer: (e as unknown as { flashTimer: number }).flashTimer,
          hasBullet: e.activeBullets.length > 0,
        })),
      remainingEnemies: this.enemyManager.remainingEnemies,

      bullets: ((this.bulletManager as unknown as { bullets: Bullet[] }).bullets).map(b => ({
        x: b.x,
        y: b.y,
        direction: b.direction,
        speed: b.speed,
        ownerIsPlayer: b.ownerIsPlayer,
        active: b.active,
      })),
    };

    Save.saveSnapshot(snapshot);
  }

  /**
   * 从快照恢复完整游戏状态。默认把 `paused` 设为 true 以避免在恢复过程中
   * 触发半成品的更新；`enterFromSnapshot`（Major #13 UX 修复）会在恢复
   * 完成后把 `paused` 设回 false，所以 pause overlay 在玩家选择
   * "Continue 关卡" 时不会再出现。
   * 不会触发默认的关卡加载 / 敌人初始化 / 生命重置流程。
   */
  private restoreFromSnapshot(snapshot: GameSnapshot): void {
    this.levelIndex = snapshot.levelIndex;
    this.mode = snapshot.mode;
    this.difficulty = snapshot.difficulty;
    this.score = snapshot.score;
    this.levelScore = { ...snapshot.levelScore };
    this.isCustomLevel = snapshot.isCustomLevel;
    this.customLevelData = snapshot.customLevelData;
    this.paused = true;

    // 地图：从快照直接覆盖单元（不走 13×13→26×26 展开），并恢复基地存活标志
    this.map = new GameMap();
    this.map.setCellGrid(snapshot.map.cells as unknown as TileType[][]);
    (this.map as unknown as { eagleAlive: boolean }).eagleAlive = snapshot.map.eagleAlive;

    // 管理器
    this.bulletManager = new BulletManager();
    this.enemyManager = new EnemyManager();

    // 先创建所有子弹并加入 BulletManager
    const restoredBullets: Bullet[] = [];
    for (const b of snapshot.bullets) {
      const bullet = new Bullet(b.x, b.y, b.direction, b.speed, b.ownerIsPlayer);
      bullet.active = b.active;
      restoredBullets.push(bullet);
      this.bulletManager.addBullet(bullet);
    }

    // 玩家
    this.players = [];
    for (const p of snapshot.players) {
      const colors = p.playerIndex === 0
        ? { body: COLORS.player1Body, track: COLORS.player1Track }
        : { body: COLORS.player2Body, track: COLORS.player2Track };
      const player = new PlayerTank(p.x, p.y, p.playerIndex, colors.body, colors.track);
      player.direction = p.direction;
      player.lives = p.lives;
      player.hp = p.hp;
      player.active = p.active;
      (player as unknown as { invincibleTimer: number }).invincibleTimer = p.invincibleTimer;
      this.players.push(player);
    }

    // 友军
    this.ally = null;
    if (snapshot.ally) {
      const a = snapshot.ally;
      const ally = new AlliedTank(a.x, a.y);
      ally.direction = a.direction;
      ally.lives = a.lives;
      ally.hp = a.hp;
      ally.active = a.active;
      (ally as unknown as { directionTimer: number }).directionTimer = a.directionTimer;
      (ally as unknown as { nextDirectionChange: number }).nextDirectionChange = a.nextDirectionChange;
      this.ally = ally;
    }

    // 敌人：重建 activeEnemies + 各自的子弹归属 + 速度倍率
    const em = this.enemyManager as unknown as {
      activeEnemies: EnemyTank[];
      spawnQueue: Array<{ type: EnemyType }>;
      spawnTimer: number;
      currentSpawnIndex: number;
      spawning: unknown;
      currentSpeedMult: number;
    };
    const speedMult = DIFFICULTY[snapshot.difficulty].speedMult;
    em.currentSpeedMult = speedMult;
    em.spawning = null;
    em.spawnTimer = 0;

    const enemyBulletsInOrder = restoredBullets.filter(b => !b.ownerIsPlayer);
    let enemyBulletCursor = 0;
    for (const e of snapshot.enemies) {
      const enemy = new EnemyTank(e.x, e.y, e.type, speedMult);
      enemy.direction = e.direction;
      enemy.hp = e.hp;
      enemy.active = e.active;
      (enemy as unknown as { directionTimer: number }).directionTimer = e.directionTimer;
      (enemy as unknown as { nextDirectionChange: number }).nextDirectionChange = e.nextDirectionChange;
      (enemy as unknown as { shootTimer: number }).shootTimer = e.shootTimer;
      (enemy as unknown as { flashTimer: number }).flashTimer = e.flashTimer;
      if (e.hasBullet && enemyBulletCursor < enemyBulletsInOrder.length) {
        // bullets is protected on Tank; cast through unknown like the prior
        // single-slot pattern did, since snapshot restore needs to inject.
        (enemy as unknown as { bullets: Bullet[] }).bullets.push(enemyBulletsInOrder[enemyBulletCursor++]);
      }
      em.activeEnemies.push(enemy);
    }

    // 用占位类型重建 spawnQueue，使 remainingEnemies 计数与快照一致
    const activeCount = em.activeEnemies.filter(e => e.active).length;
    const spawnQueueLen = Math.max(0, snapshot.remainingEnemies - activeCount);
    em.spawnQueue = new Array(spawnQueueLen).fill({ type: 'basic' });
    em.currentSpawnIndex = em.activeEnemies.length;
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

    // 7. Pause overlay
    if (this.paused) {
      this.renderPauseOverlay(ctx);
    }
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

  private renderPauseOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, GAME_AREA_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px monospace';
    ctx.fillText('PAUSED', GAME_AREA_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#A0A0A0';
    ctx.fillText('按 P / Esc 继续', GAME_AREA_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
  }
}