import { Direction } from '../types';

export class Input {
  private keys: Set<string> = new Set();
  private justPressed: Set<string> = new Set();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
      // Prevent scrolling with arrow keys / space
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  isKeyPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  getDirection(): Direction | null {
    if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) return 'up';
    if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) return 'down';
    if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) return 'left';
    if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) return 'right';
    return null;
  }

  isShooting(): boolean {
    return this.isKeyDown('Space');
  }

  isConfirm(): boolean {
    return this.isKeyPressed('Enter');
  }

  isUp(): boolean {
    return this.isKeyPressed('ArrowUp') || this.isKeyPressed('KeyW');
  }

  isDown(): boolean {
    return this.isKeyPressed('ArrowDown') || this.isKeyPressed('KeyS');
  }

  endFrame(): void {
    this.justPressed.clear();
  }
}
