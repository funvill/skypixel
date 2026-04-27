"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressBar = void 0;
class ProgressBar {
    constructor(total, label, width = 30) {
        this.current = 0;
        this.startedAt = Date.now();
        this.lastRenderedAt = 0;
        this.total = Math.max(1, total);
        this.width = width;
        this.label = label;
    }
    update(value) {
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
    log(message) {
        process.stdout.write('\n');
        console.log(message);
        this.lastRenderedAt = 0;
        this.update(this.current);
    }
}
exports.ProgressBar = ProgressBar;
