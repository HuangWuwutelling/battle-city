import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';
import { Game } from './Game';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const LOGICAL_W = CANVAS_WIDTH;
const LOGICAL_H = CANVAS_HEIGHT;
const MARGIN = 20;

function fitCanvas(): void {
  const maxW = window.innerWidth - MARGIN * 2;
  const maxH = window.innerHeight - MARGIN * 2;
  const scaleX = Math.floor(maxW / LOGICAL_W);
  const scaleY = Math.floor(maxH / LOGICAL_H);
  const scale = Math.max(1, Math.min(scaleX, scaleY));
  canvas.style.width = `${LOGICAL_W * scale}px`;
  canvas.style.height = `${LOGICAL_H * scale}px`;
}

window.addEventListener('resize', fitCanvas);
fitCanvas();

const game = new Game(canvas);
game.start();
