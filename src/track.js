import { lerp } from './math.js';

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

export class Track {
  constructor() {
    this.points = [{ x: 0, y: 0 }, { x: 80, y: 0 }];
    this.segmentLength = 80;
    this.maxSlope = 0.35;
    this.coins = [];
    this.generatedUntil = 2000;
    this.extendTo(this.generatedUntil);
  }

  reset() {
    this.points = [{ x: 0, y: 0 }, { x: 80, y: 0 }];
    this.coins = [];
    this.generatedUntil = 2000;
    this.extendTo(this.generatedUntil);
  }

  extendTo(x) {
    while (this.points[this.points.length - 1].x < x) {
      const last = this.points[this.points.length - 1];
      const targetX = last.x + this.segmentLength;
      const prevSlope = (last.y - this.points[this.points.length - 2].y) / this.segmentLength;
      const slopeChange = randomInRange(-0.12, 0.12);
      let slope = prevSlope + slopeChange;
      slope = Math.max(-this.maxSlope, Math.min(this.maxSlope, slope));
      const targetY = last.y + slope * this.segmentLength;
      this.points.push({ x: targetX, y: targetY });

      if (Math.random() > 0.45) {
        this.coins.push({ x: targetX - this.segmentLength * 0.4, y: targetY - 60, collected: false });
      }
    }
  }

  sampleHeight(x) {
    this.extendTo(x + 500);
    const idx = this.findSegment(x);
    const a = this.points[idx];
    const b = this.points[idx + 1];
    const t = (x - a.x) / (b.x - a.x);
    return lerp(a.y, b.y, t);
  }

  slopeAt(x) {
    const idx = this.findSegment(x);
    const a = this.points[idx];
    const b = this.points[idx + 1];
    return (b.y - a.y) / (b.x - a.x);
  }

  findSegment(x) {
    for (let i = 0; i < this.points.length - 1; i++) {
      if (x >= this.points[i].x && x <= this.points[i + 1].x) return i;
    }
    return this.points.length - 2;
  }

  draw(ctx, camera) {
    ctx.save();
    ctx.beginPath();
    this.points.forEach((p, i) => {
      const px = p.x - camera.x;
      const py = p.y - camera.y;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    const width = ctx.canvas.width / devicePixelRatio;
    const height = ctx.canvas.height / devicePixelRatio;
    ctx.lineTo(this.points[this.points.length - 1].x - camera.x, height + 200);
    ctx.lineTo(this.points[0].x - camera.x, height + 200);
    ctx.closePath();
    ctx.fillStyle = 'rgba(52, 211, 153, 0.1)';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
