export class ProgressBar {
  private readonly total: number;
  private readonly width: number;
  private readonly label: string;
  private current = 0;
  private startedAt = Date.now();
  private lastRenderedAt = 0;

  constructor(total: number, label: string, width = 30) {
    this.total = Math.max(1, total);
    this.width = width;
    this.label = label;
  }

  update(value: number): void {
    this.current = Math.max(0, Math.min(this.total, value));
    const now = Date.now();
    if (this.current < this.total && now - this.lastRenderedAt < 200) {
      return;
    }

    this.lastRenderedAt = now;
    const ratio = this.current / this.total;
    const filled = Math.round(this.width * ratio);
    const bar = `${'='.repeat(filled)}${'-'.repeat(this.width - filled)}`;
    const percent = `${(ratio * 100).toFixed(1).padStart(5, ' ')}`;
    const elapsedSeconds = ((now - this.startedAt) / 1000).toFixed(1).padStart(6, ' ');
    process.stdout.write(`\r${this.label} [${bar}] ${percent}% ${this.current}/${this.total} ${elapsedSeconds}s`);

    if (this.current >= this.total) {
      process.stdout.write('\n');
    }
  }

  log(message: string): void {
    process.stdout.write('\n');
    console.log(message);
    this.lastRenderedAt = 0;
    this.update(this.current);
  }
}