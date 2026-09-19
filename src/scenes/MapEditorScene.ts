import {
  CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE,
  GRID_COLS, GRID_ROWS, COLORS,
  ENEMY_SPAWN_POINTS, CELL_SIZE,
} from '../constants';
import { TileType, LevelData, TILE_EMPTY, TILE_BRICK, TILE_STEEL, TILE_GRASS, TILE_RIVER, TILE_ICE } from '../types';
import { Scene } from './Scene';
import { Input } from '../systems/Input';
import { Game } from '../Game';
import { PixelArt } from '../rendering/PixelArt';
import { saveCustomMaps, loadCustomMaps, exportMap } from '../utils/storage';

const TOOLBAR_HEIGHT = 36;
const EDITOR_AREA_SIZE = GRID_COLS * TILE_SIZE; // 416
const SIDEBAR_WIDTH = CANVAS_WIDTH - EDITOR_AREA_SIZE; // 96

const TERRAIN_OPTIONS: { type: TileType; label: string }[] = [
  { type: TILE_BRICK, label: '砖' },
  { type: TILE_STEEL, label: '铁' },
  { type: TILE_GRASS, label: '草' },
  { type: TILE_RIVER, label: '河' },
  { type: TILE_ICE, label: '冰' },
  { type: TILE_EMPTY, label: '空' },
];

export class MapEditorScene implements Scene {
  private game: Game;
  private grid: TileType[][] = [];
  private selectedTerrain: TileType = TILE_BRICK;
  private selectedTerrainIndex = 0;
  private mouseDown = false;
  private rightMouseDown = false;
  private mouseX = 0;
  private mouseY = 0;
  private mapName = '自定义关卡';
  private enemyConfig = { basic: 10, fast: 4, power: 4, armor: 2 };
  private message = '';
  private messageTimer = 0;

  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundContextMenu: (e: Event) => void;

  constructor(game: Game) {
    this.game = game;
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundContextMenu = (e: Event) => e.preventDefault();
  }

  enter(): void {
    this.initGrid();
    this.selectedTerrain = TILE_BRICK;
    this.selectedTerrainIndex = 0;
    this.message = '';

    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    canvas.addEventListener('mousemove', this.boundMouseMove);
    canvas.addEventListener('mousedown', this.boundMouseDown);
    canvas.addEventListener('mouseup', this.boundMouseUp);
    canvas.addEventListener('contextmenu', this.boundContextMenu);
  }

  exit(): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    canvas.removeEventListener('mousemove', this.boundMouseMove);
    canvas.removeEventListener('mousedown', this.boundMouseDown);
    canvas.removeEventListener('mouseup', this.boundMouseUp);
    canvas.removeEventListener('contextmenu', this.boundContextMenu);
  }

  private initGrid(): void {
    this.grid = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      this.grid[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        this.grid[row][col] = TILE_EMPTY;
      }
    }
    this.placeEagleProtection();
  }

  private placeEagleProtection(): void {
    const eagleTileRow = GRID_ROWS - 1;
    const eagleTileCol = 6;
    if (eagleTileRow - 1 >= 0) {
      for (let dc = -1; dc <= 2; dc++) {
        const col = eagleTileCol + dc;
        if (col >= 0 && col < GRID_COLS) {
          this.grid[eagleTileRow - 1][col] = TILE_BRICK;
        }
      }
    }
    if (eagleTileCol - 1 >= 0) {
      this.grid[eagleTileRow][eagleTileCol - 1] = TILE_BRICK;
    }
    if (eagleTileCol + 1 < GRID_COLS) {
      this.grid[eagleTileRow][eagleTileCol + 1] = TILE_BRICK;
    }
  }

  private getTileAtPixel(px: number, py: number): { col: number; row: number } | null {
    const editorX = px;
    const editorY = py - TOOLBAR_HEIGHT;
    if (editorX < 0 || editorX >= EDITOR_AREA_SIZE || editorY < 0 || editorY >= EDITOR_AREA_SIZE) {
      return null;
    }
    const col = Math.floor(editorX / TILE_SIZE);
    const row = Math.floor(editorY / TILE_SIZE);
    if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
      return { col, row };
    }
    return null;
  }

  private onMouseMove(e: MouseEvent): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;

    if (this.mouseDown) this.paintAtPixel(this.mouseX, this.mouseY);
    if (this.rightMouseDown) this.eraseAtPixel(this.mouseX, this.mouseY);
  }

  private onMouseDown(e: MouseEvent): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    if (e.button === 0) {
      if (px >= EDITOR_AREA_SIZE) {
        this.handleSidebarClick(px - EDITOR_AREA_SIZE, py);
        return;
      }
      if (py < TOOLBAR_HEIGHT) {
        this.handleToolbarClick(px, py);
        return;
      }
      this.mouseDown = true;
      this.paintAtPixel(px, py);
    } else if (e.button === 2) {
      this.rightMouseDown = true;
      this.eraseAtPixel(px, py);
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.rightMouseDown = false;
  }

  private paintAtPixel(px: number, py: number): void {
    const tile = this.getTileAtPixel(px, py);
    if (tile) {
      this.grid[tile.row][tile.col] = this.selectedTerrain;
    }
  }

  private eraseAtPixel(px: number, py: number): void {
    const tile = this.getTileAtPixel(px, py);
    if (tile) {
      this.grid[tile.row][tile.col] = TILE_EMPTY;
    }
  }

  private handleSidebarClick(sx: number, sy: number): void {
    const btnStartY = 50;
    const btnSize = 36;
    const btnGap = 4;
    for (let i = 0; i < TERRAIN_OPTIONS.length; i++) {
      const by = btnStartY + i * (btnSize + btnGap);
      if (sy >= by && sy < by + btnSize) {
        this.selectedTerrainIndex = i;
        this.selectedTerrain = TERRAIN_OPTIONS[i].type;
        return;
      }
    }
  }

  private handleToolbarClick(px: number, py: number): void {
    const btnWidth = 70;
    const btnGap = 8;
    const startX = 10;
    const buttons = ['新建', '保存', '导出', '测试', '返回'];
    for (let i = 0; i < buttons.length; i++) {
      const bx = startX + i * (btnWidth + btnGap);
      if (px >= bx && px < bx + btnWidth) {
        this.handleToolAction(buttons[i]);
        return;
      }
    }
  }

  private handleToolAction(action: string): void {
    switch (action) {
      case '新建':
        this.initGrid();
        this.showMessage('已创建新地图');
        break;
      case '保存':
        this.saveMap();
        break;
      case '导出':
        exportMap(this.buildLevelData());
        this.showMessage('已导出地图文件');
        break;
      case '测试':
        this.testMap();
        break;
      case '返回':
        this.game.switchScene('menu');
        break;
    }
  }

  private buildLevelData(): LevelData {
    return {
      name: this.mapName,
      tiles: this.grid.map(row => [...row]),
      enemies: { ...this.enemyConfig },
    };
  }

  private saveMap(): void {
    const maps = loadCustomMaps();
    const data = this.buildLevelData();
    const idx = maps.findIndex(m => m.name === data.name);
    if (idx >= 0) {
      maps[idx] = data;
    } else {
      maps.push(data);
    }
    saveCustomMaps(maps);
    this.showMessage('地图已保存');
  }

  private testMap(): void {
    this.game.switchScene('game', {
      levelIndex: 0,
      customLevel: this.buildLevelData(),
    });
  }

  private showMessage(msg: string): void {
    this.message = msg;
    this.messageTimer = 2;
  }

  handleInput(input: Input): void {
    if (input.isKeyDown('Digit1')) { this.selectedTerrain = TILE_BRICK; this.selectedTerrainIndex = 0; }
    if (input.isKeyDown('Digit2')) { this.selectedTerrain = TILE_STEEL; this.selectedTerrainIndex = 1; }
    if (input.isKeyDown('Digit3')) { this.selectedTerrain = TILE_GRASS; this.selectedTerrainIndex = 2; }
    if (input.isKeyDown('Digit4')) { this.selectedTerrain = TILE_RIVER; this.selectedTerrainIndex = 3; }
    if (input.isKeyDown('Digit5')) { this.selectedTerrain = TILE_ICE; this.selectedTerrainIndex = 4; }
    if (input.isKeyDown('Digit6')) { this.selectedTerrain = TILE_EMPTY; this.selectedTerrainIndex = 5; }
    if (input.isKeyPressed('Escape')) {
      this.game.switchScene('menu');
    }
  }

  update(dt: number): void {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Toolbar
    ctx.fillStyle = '#303030';
    ctx.fillRect(0, 0, CANVAS_WIDTH, TOOLBAR_HEIGHT);

    const btnWidth = 70;
    const btnGap = 8;
    const startX = 10;
    const buttons = ['新建', '保存', '导出', '测试', '返回'];
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < buttons.length; i++) {
      const bx = startX + i * (btnWidth + btnGap);
      ctx.fillStyle = '#505050';
      ctx.fillRect(bx, 6, btnWidth, 24);
      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(buttons[i], bx + btnWidth / 2, 22);
    }

    // Editor background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, TOOLBAR_HEIGHT, EDITOR_AREA_SIZE, EDITOR_AREA_SIZE);

    // Draw terrain
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const type = this.grid[row][col];
        if (type !== TILE_EMPTY) {
          const cellCol = col * 2;
          const cellRow = row * 2;
          for (let cr = 0; cr < 2; cr++) {
            for (let cc = 0; cc < 2; cc++) {
              PixelArt.drawTerrainCell(ctx, cellCol + cc, cellRow + cr, type);
            }
          }
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_COLS; i++) {
      const x = i * TILE_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, TOOLBAR_HEIGHT);
      ctx.lineTo(x, TOOLBAR_HEIGHT + EDITOR_AREA_SIZE);
      ctx.stroke();
    }
    for (let i = 0; i <= GRID_ROWS; i++) {
      const y = TOOLBAR_HEIGHT + i * TILE_SIZE;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(EDITOR_AREA_SIZE, y);
      ctx.stroke();
    }

    // Fixed markers
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    // Eagle marker
    ctx.fillStyle = '#FFD700';
    const eagleX = 6 * TILE_SIZE + TILE_SIZE / 2;
    const eagleY = TOOLBAR_HEIGHT + 12 * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillText('E', eagleX, eagleY + 4);

    // Player spawn
    ctx.fillStyle = COLORS.player1Body;
    const playerX = 4 * TILE_SIZE + TILE_SIZE / 2;
    const playerY = TOOLBAR_HEIGHT + 12 * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillText('P', playerX, playerY + 4);

    // Enemy spawns
    ctx.fillStyle = COLORS.enemyBasic;
    for (const sp of ENEMY_SPAWN_POINTS) {
      const sx = (sp.x / 2) * TILE_SIZE + TILE_SIZE / 2;
      const sy = TOOLBAR_HEIGHT + (sp.y / 2) * TILE_SIZE + TILE_SIZE / 2;
      ctx.fillText('E', sx, sy + 4);
    }

    // Hover highlight
    const hoverTile = this.getTileAtPixel(this.mouseX, this.mouseY);
    if (hoverTile) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        hoverTile.col * TILE_SIZE,
        TOOLBAR_HEIGHT + hoverTile.row * TILE_SIZE,
        TILE_SIZE, TILE_SIZE,
      );
    }

    // Sidebar
    const sx = EDITOR_AREA_SIZE;
    ctx.fillStyle = '#303030';
    ctx.fillRect(sx, TOOLBAR_HEIGHT, SIDEBAR_WIDTH, CANVAS_HEIGHT - TOOLBAR_HEIGHT);

    // Terrain selection buttons
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const btnStartY = TOOLBAR_HEIGHT + 14;
    const btnSize = 36;
    const btnGap2 = 4;
    const previewColors: string[] = [COLORS.brick, COLORS.steel, COLORS.grass, COLORS.river, COLORS.ice, '#000'];

    for (let i = 0; i < TERRAIN_OPTIONS.length; i++) {
      const by = btnStartY + i * (btnSize + btnGap2);
      const isSelected = i === this.selectedTerrainIndex;

      ctx.fillStyle = isSelected ? '#606060' : '#404040';
      ctx.fillRect(sx + 8, by, SIDEBAR_WIDTH - 16, btnSize);
      if (isSelected) {
        ctx.strokeStyle = COLORS.player1Body;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 8, by, SIDEBAR_WIDTH - 16, btnSize);
      }

      ctx.fillStyle = previewColors[i];
      ctx.fillRect(sx + 14, by + 8, 20, 20);

      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(TERRAIN_OPTIONS[i].label, sx + SIDEBAR_WIDTH / 2 + 10, by + 22);
    }

    // Hints
    ctx.font = '9px monospace';
    ctx.fillStyle = '#808080';
    ctx.textAlign = 'center';
    ctx.fillText('按键1-6选择地形', sx + SIDEBAR_WIDTH / 2, CANVAS_HEIGHT - 40);
    ctx.fillText('左键放置 右键擦除', sx + SIDEBAR_WIDTH / 2, CANVAS_HEIGHT - 25);
    ctx.fillText('ESC 返回菜单', sx + SIDEBAR_WIDTH / 2, CANVAS_HEIGHT - 10);

    // Status message
    if (this.message) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(EDITOR_AREA_SIZE / 2 - 80, TOOLBAR_HEIGHT + EDITOR_AREA_SIZE / 2 - 15, 160, 30);
      ctx.fillStyle = COLORS.player1Body;
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.message, EDITOR_AREA_SIZE / 2, TOOLBAR_HEIGHT + EDITOR_AREA_SIZE / 2 + 5);
    }
  }
}
