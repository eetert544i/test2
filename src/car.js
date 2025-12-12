import { add, clamp, crossZ, dot, normalize, perp, scale, sub } from './math.js';

export class Car {
  constructor(start) {
    this.mass = 120;
    this.inertia = 180;
    this.wheelBase = 72;
    this.wheelRadius = 18;
    this.pos = { ...start };
    this.vel = { x: 0, y: 0 };
    this.angle = 0;
    this.angVel = 0;
    this.springK = 1100;
    this.springDamp = 75;
    this.friction = 14;
    this.enginePower = 260;
    this.fuel = 1;
  }

  reset(start) {
    this.pos = { ...start };
    this.vel = { x: 0, y: 0 };
    this.angle = 0;
    this.angVel = 0;
    this.fuel = 1;
  }

  wheelOffset(sign) {
    const dir = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    const offset = scale(dir, this.wheelBase * 0.5 * sign);
    return add({ x: 0, y: this.wheelRadius }, offset);
  }

  getWheelPosition(sign) {
    const offset = this.wheelOffset(sign);
    const rot = this.angle;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    return {
      x: this.pos.x + offset.x * cos - offset.y * sin,
      y: this.pos.y + offset.x * sin + offset.y * cos,
    };
  }

  update(dt, input, track) {
    const g = { x: 0, y: 900 };
    const forces = [g];
    let torque = 0;

    const wheels = [
      { sign: -1, throttle: -input.brake },
      { sign: 1, throttle: input.throttle },
    ];

    for (const wheel of wheels) {
      const pos = this.getWheelPosition(wheel.sign);
      const height = track.sampleHeight(pos.x);
      const slope = track.slopeAt(pos.x);
      const tangent = normalize({ x: 1, y: slope });
      const normal = perp(tangent);
      const depth = this.wheelRadius - (pos.y - height);

      if (depth > 0) {
        const relVel = add(this.vel, { x: -this.angVel * (pos.y - this.pos.y), y: this.angVel * (pos.x - this.pos.x) });
        const normalSpeed = dot(relVel, normal);
        const springForce = clamp(depth * this.springK - normalSpeed * this.springDamp, -4000, 4000);
        const frictionSpeed = dot(relVel, tangent);
        const frictionForce = -frictionSpeed * this.friction;
        const driveForce = wheel.throttle * this.enginePower;
        const totalAlong = frictionForce + driveForce;

        const force = add(scale(normal, springForce), scale(tangent, totalAlong));
        forces.push(force);

        const r = sub(pos, this.pos);
        torque += crossZ(r, force);
      }
    }

    if (Math.abs(this.angVel) < 6) {
      if (input.leanLeft) torque -= 220;
      if (input.leanRight) torque += 220;
    }

    const accel = forces.reduce((acc, f) => add(acc, scale(f, 1 / this.mass)), { x: 0, y: 0 });
    this.vel = add(this.vel, scale(accel, dt));
    this.pos = add(this.pos, scale(this.vel, dt));

    this.angVel += (torque / this.inertia) * dt;
    this.angle += this.angVel * dt;

    this.fuel = clamp(this.fuel - dt * (0.03 + 0.06 * input.throttle), 0, 1);
  }

  draw(ctx, camera) {
    const pos = { x: this.pos.x - camera.x, y: this.pos.y - camera.y };
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(this.angle);

    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-40, -10, 80, 24, 6);
    ctx.fill();
    ctx.stroke();

    this.drawWheel(ctx, -this.wheelBase * 0.5, 8);
    this.drawWheel(ctx, this.wheelBase * 0.5, 8);

    ctx.fillStyle = '#0b132b';
    ctx.beginPath();
    ctx.roundRect(-6, -22, 12, 12, 3);
    ctx.fill();

    ctx.restore();
  }

  drawWheel(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y + this.wheelRadius);
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(0, 0, this.wheelRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, this.wheelRadius * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
