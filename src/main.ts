import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

// Placeholder: will be replaced by Game class in Task 7
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
ctx.fillStyle = '#FFF';
ctx.font = '20px monospace';
ctx.textAlign = 'center';
ctx.fillText('BATTLE CITY', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
ctx.font = '12px monospace';
ctx.fillText('Loading...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
