export class Animation {
  private frameIndex = 0;
  private elapsed = 0;

  constructor(
    public readonly frameCount: number,
    public readonly frameDuration: number,
    public readonly loop: boolean = true,
  ) {}

  update(dt: number): void {
    this.elapsed += dt;
    if (this.elapsed >= this.frameDuration) {
      this.elapsed -= this.frameDuration;
      this.frameIndex++;
      if (this.frameIndex >= this.frameCount) {
        this.frameIndex = this.loop ? 0 : this.frameCount - 1;
      }
    }
  }

  get currentFrame(): number {
    return this.frameIndex;
  }

  get isFinished(): boolean {
    return !this.loop && this.frameIndex >= this.frameCount - 1;
  }

  reset(): void {
    this.frameIndex = 0;
    this.elapsed = 0;
  }
}
