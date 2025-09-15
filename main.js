const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const distanceEl = document.getElementById('distance');
const fuelEl = document.getElementById('fuel');
const bestDistanceEl = document.getElementById('best-distance');
const gameOverLayer = document.getElementById('game-over');
const finalDistanceEl = document.getElementById('final-distance');
const restartButton = document.getElementById('restart');

const TERRAIN_STEP = 120;
const INITIAL_SEGMENTS = 420;
const GRAVITY = 900; // px per second squared
const DISTANCE_SCALE = 0.1; // px to meters
const FUEL_SPACING = 1600;

const terrain = {
  points: [],
  slope: 0,
  options: null
};

const fuelPickups = [];
let nextFuelX = 600;

const inputState = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

const car = {
  position: { x: 140, y: 0 },
  velocity: { x: 0, y: 0 },
  angle: 0,
  angularVelocity: 0,
  mass: 16,
  wheelBase: 120,
  wheelRadius: 26,
  wheelYOffset: 28,
  suspensionStiffness: 450,
  suspensionDamping: 30,
  wheelFriction: 26,
  tireGrip: 1.2,
  engineForce: 3400,
  airControlTorque: 220,
  bodySize: { width: 150, height: 52 },
  inertia: 120,
  fuel: 1,
  fuelBurnRate: 0.22,
  distance: 0,
  startX: 140,
  wheels: []
};

car.inertia = (car.mass * (Math.pow(car.bodySize.width, 2) + Math.pow(car.bodySize.height, 2))) / 12;
car.wheels = [
  { localOffset: { x: -car.wheelBase / 2, y: car.wheelYOffset }, spin: 0, world: { x: 0, y: 0 }, contact: false },
  { localOffset: { x: car.wheelBase / 2, y: car.wheelYOffset }, spin: 0, world: { x: 0, y: 0 }, contact: false }
];

let cameraX = 0;
let lastTime = performance.now();
let gameOver = false;
let bestDistance = 0;

try {
  const stored = localStorage.getItem('canvas-hillclimber-best');
  if (stored) {
    bestDistance = parseFloat(stored) || 0;
    bestDistanceEl.textContent = bestDistance.toFixed(1);
  }
} catch (err) {
  // Local storage might be unavailable (privacy mode etc.)
}

function resizeCanvas() {
  if (!canvas.clientWidth) {
    canvas.style.width = '100%';
  }
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    canvas.width = 960;
    canvas.height = 540;
    return;
  }
  canvas.width = rect.width;
  canvas.height = rect.height;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function createTerrainOptions() {
  const height = canvas.height || 540;
  return {
    baseHeight: height * 0.72,
    minHeight: height * 0.38,
    maxHeight: height * 0.92,
    slopeVariance: 12,
    slopeLimit: 30,
    bigHillChance: 0.08
  };
}

function generateInitialTerrain() {
  terrain.points.length = 0;
  terrain.options = createTerrainOptions();
  let x = 0;
  let y = terrain.options.baseHeight;
  let slope = 0;
  terrain.points.push({ x, y });

  for (let i = 0; i < INITIAL_SEGMENTS; i += 1) {
    const next = advanceTerrainPoint(x, y, slope, terrain.options);
    terrain.points.push(next.point);
    x = next.point.x;
    y = next.point.y;
    slope = next.slope;
  }
  terrain.slope = slope;
}

function advanceTerrainPoint(x, y, slope, options) {
  let targetSlope = slope + randomRange(-options.slopeVariance, options.slopeVariance);
  targetSlope = clamp(targetSlope, -options.slopeLimit, options.slopeLimit);

  if (Math.random() < options.bigHillChance) {
    targetSlope += randomRange(-options.slopeVariance * 1.5, options.slopeVariance * 1.5);
    targetSlope = clamp(targetSlope, -options.slopeLimit * 1.2, options.slopeLimit * 1.2);
  }

  let nextY = y + targetSlope;
  nextY = clamp(nextY, options.minHeight, options.maxHeight);

  const point = { x: x + TERRAIN_STEP, y: nextY };
  return { point, slope: targetSlope * 0.72 + slope * 0.28 };
}

function extendTerrainTo(targetX) {
  const options = terrain.options;
  if (!options) return;
  while (terrain.points[terrain.points.length - 1].x < targetX) {
    const lastPoint = terrain.points[terrain.points.length - 1];
    const next = advanceTerrainPoint(lastPoint.x, lastPoint.y, terrain.slope, options);
    terrain.points.push(next.point);
    terrain.slope = next.slope;
  }
}

function getGroundInfo(x) {
  if (!terrain.points.length) return null;
  const points = terrain.points;
  const maxIndex = points.length - 1;
  const maxX = points[maxIndex].x;

  if (x >= maxX) {
    const p0 = points[maxIndex - 1];
    const p1 = points[maxIndex];
    const dx = p1.x - p0.x || 1;
    const dy = p1.y - p0.y;
    const normal = normalize({ x: dy, y: -dx });
    return {
      point: { x, y: p1.y + (dy / dx) * (x - p1.x) },
      normal,
      tangent: { x: -normal.y, y: normal.x },
      segmentIndex: maxIndex - 1
    };
  }

  if (x <= points[0].x) {
    const p0 = points[0];
    const p1 = points[1];
    const dx = p1.x - p0.x || 1;
    const dy = p1.y - p0.y;
    const t = clamp((x - p0.x) / dx, 0, 1);
    const y = p0.y + dy * t;
    const normal = normalize({ x: dy, y: -dx });
    return {
      point: { x, y },
      normal,
      tangent: { x: -normal.y, y: normal.x },
      segmentIndex: 0
    };
  }

  const index = Math.min(Math.floor(x / TERRAIN_STEP), points.length - 2);
  const p0 = points[index];
  const p1 = points[index + 1];
  const span = p1.x - p0.x || TERRAIN_STEP;
  const t = clamp((x - p0.x) / span, 0, 1);
  const y = p0.y + (p1.y - p0.y) * t;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const normal = normalize({ x: dy, y: -dx });
  return {
    point: { x, y },
    normal,
    tangent: { x: -normal.y, y: normal.x },
    segmentIndex: index
  };
}

function normalize(vec) {
  const length = Math.hypot(vec.x, vec.y) || 1;
  return { x: vec.x / length, y: vec.y / length };
}

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(Math.abs(radius), Math.abs(width) / 2, Math.abs(height) / 2);
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function ensureFuelUpTo(targetX) {
  extendTerrainTo(targetX + TERRAIN_STEP * 2);
  while (nextFuelX < targetX) {
    const ground = getGroundInfo(nextFuelX);
    if (!ground) break;
    fuelPickups.push({
      x: nextFuelX,
      y: ground.point.y - 80,
      collected: false
    });
    nextFuelX += FUEL_SPACING + randomRange(-400, 420);
  }
}

function resetGame() {
  generateInitialTerrain();
  nextFuelX = 800;
  fuelPickups.length = 0;
  ensureFuelUpTo(canvas.width * 2);

  car.position.x = car.startX;
  const ground = getGroundInfo(car.position.x);
  car.position.y = ground ? ground.point.y - car.wheelRadius - car.wheelYOffset : canvas.height * 0.6;
  car.velocity.x = 0;
  car.velocity.y = 0;
  car.angle = 0;
  car.angularVelocity = 0;
  car.distance = 0;
  car.fuel = 1;
  car.wheels.forEach(wheel => {
    wheel.spin = 0;
    wheel.contact = false;
  });
  cameraX = 0;
  gameOver = false;
  gameOverLayer.classList.add('hidden');
}

function updateInput(evt, isDown) {
  switch (evt.code) {
    case 'ArrowUp':
    case 'KeyW':
      inputState.forward = isDown;
      evt.preventDefault();
      break;
    case 'ArrowDown':
    case 'KeyS':
      inputState.backward = isDown;
      evt.preventDefault();
      break;
    case 'ArrowLeft':
    case 'KeyA':
      inputState.left = isDown;
      evt.preventDefault();
      break;
    case 'ArrowRight':
    case 'KeyD':
      inputState.right = isDown;
      evt.preventDefault();
      break;
    case 'KeyR':
      if (isDown) {
        restartGame();
      }
      break;
    default:
      break;
  }
}

document.addEventListener('keydown', evt => updateInput(evt, true));
document.addEventListener('keyup', evt => updateInput(evt, false));
restartButton.addEventListener('click', () => restartGame());

function restartGame() {
  resetGame();
}

function update(dt) {
  if (gameOver) return;
  extendTerrainTo(car.position.x + canvas.width * 1.5);
  ensureFuelUpTo(car.position.x + canvas.width * 1.2);

  const throttleInputRaw = (inputState.forward ? 1 : 0) - (inputState.backward ? 1 : 0);
  let throttleInput = throttleInputRaw;
  if (car.fuel <= 0 && throttleInput > 0) {
    throttleInput = 0;
  }
  if (throttleInput !== 0) {
    car.fuel = clamp(car.fuel - Math.abs(throttleInput) * car.fuelBurnRate * dt, 0, 1);
  } else if (car.fuel < 1) {
    car.fuel = clamp(car.fuel + 0.06 * dt, 0, 1);
  }

  let totalForceX = 0;
  let totalForceY = car.mass * GRAVITY;
  let totalTorque = 0;
  let contactCount = 0;

  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);

  car.wheels.forEach(wheel => {
    const offsetX = cos * wheel.localOffset.x - sin * wheel.localOffset.y;
    const offsetY = sin * wheel.localOffset.x + cos * wheel.localOffset.y;
    const worldX = car.position.x + offsetX;
    const worldY = car.position.y + offsetY;
    const wheelVelocityX = car.velocity.x - car.angularVelocity * offsetY;
    const wheelVelocityY = car.velocity.y + car.angularVelocity * offsetX;
    const ground = getGroundInfo(worldX);

    wheel.world.x = worldX;
    wheel.world.y = worldY;

    let contactForceX = 0;
    let contactForceY = 0;
    wheel.contact = false;

    if (ground) {
      const normal = ground.normal;
      const tangent = ground.tangent;
      const vecToGroundX = worldX - ground.point.x;
      const vecToGroundY = worldY - ground.point.y;
      const distanceAlongNormal = vecToGroundX * normal.x + vecToGroundY * normal.y;
      const penetration = car.wheelRadius - distanceAlongNormal;

      if (penetration > 0) {
        wheel.contact = true;
        contactCount += 1;
        const relativeNormalVelocity = wheelVelocityX * normal.x + wheelVelocityY * normal.y;
        const relativeTangentVelocity = wheelVelocityX * tangent.x + wheelVelocityY * tangent.y;

        const springForce = penetration * car.suspensionStiffness;
        const damperForce = relativeNormalVelocity * car.suspensionDamping;
        let normalForceMag = springForce - damperForce;
        if (normalForceMag < 0) normalForceMag = 0;

        contactForceX += normal.x * normalForceMag;
        contactForceY += normal.y * normalForceMag;

        let tangentialForce = -relativeTangentVelocity * car.wheelFriction;
        if (throttleInput !== 0) {
          tangentialForce += throttleInput * car.engineForce;
        }
        const maxTraction = Math.abs(normalForceMag * car.tireGrip);
        if (maxTraction > 0) {
          tangentialForce = clamp(tangentialForce, -maxTraction, maxTraction);
        }

        contactForceX += tangent.x * tangentialForce;
        contactForceY += tangent.y * tangentialForce;

        const spinDelta = (relativeTangentVelocity / car.wheelRadius) * dt;
        wheel.spin += spinDelta;
      } else {
        wheel.spin *= 0.99;
      }
    } else {
      wheel.spin *= 0.99;
    }

    totalForceX += contactForceX;
    totalForceY += contactForceY;

    const torqueContribution = offsetX * contactForceY - offsetY * contactForceX;
    totalTorque += torqueContribution;
  });

  const tiltInput = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
  const tiltFactor = contactCount === 2 ? 0.25 : 1;
  totalTorque += tiltInput * car.airControlTorque * tiltFactor;

  const dragX = -car.velocity.x * 0.75;
  const dragY = -car.velocity.y * 0.35;
  totalForceX += dragX;
  totalForceY += dragY;

  const accelerationX = totalForceX / car.mass;
  const accelerationY = totalForceY / car.mass;
  const angularAcceleration = totalTorque / car.inertia;

  car.velocity.x += accelerationX * dt;
  car.velocity.y += accelerationY * dt;
  car.angularVelocity += angularAcceleration * dt;
  car.angularVelocity = clamp(car.angularVelocity, -3.5, 3.5);

  car.position.x += car.velocity.x * dt;
  car.position.y += car.velocity.y * dt;
  car.angle += car.angularVelocity * dt;

  if (car.position.x < 0) {
    car.position.x = 0;
    car.velocity.x = 0;
  }

  const currentDistance = Math.max(0, (car.position.x - car.startX) * DISTANCE_SCALE);
  car.distance = Math.max(car.distance, currentDistance);
  if (car.distance > bestDistance) {
    bestDistance = car.distance;
    bestDistanceEl.textContent = bestDistance.toFixed(1);
    try {
      localStorage.setItem('canvas-hillclimber-best', bestDistance.toFixed(1));
    } catch (err) {
      // ignore storage errors
    }
  }

  cameraX = car.position.x - canvas.width * 0.35;
  cameraX = Math.max(cameraX, 0);

  fuelPickups.forEach(pickup => {
    if (pickup.collected) return;
    const dx = car.position.x - pickup.x;
    const dy = car.position.y - pickup.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 80) {
      pickup.collected = true;
      car.fuel = clamp(car.fuel + 0.45, 0, 1.1);
    }
  });

  const headOffset = { x: 0, y: -car.bodySize.height * 0.5 };
  const headWorldX = car.position.x + cos * headOffset.x - sin * headOffset.y;
  const headWorldY = car.position.y + sin * headOffset.x + cos * headOffset.y;
  const headGround = getGroundInfo(headWorldX);

  if (car.position.y - car.bodySize.height > canvas.height + 300) {
    triggerGameOver();
  } else if (headGround && headWorldY >= headGround.point.y - 6 && contactCount > 0) {
    triggerGameOver();
  } else if (contactCount > 0 && Math.abs(car.angle) > 1.7) {
    triggerGameOver();
  }

  updateHUD(currentDistance);
}

function triggerGameOver() {
  if (gameOver) return;
  gameOver = true;
  finalDistanceEl.textContent = car.distance.toFixed(1);
  gameOverLayer.classList.remove('hidden');
}

function updateHUD(currentDistance) {
  distanceEl.textContent = currentDistance.toFixed(1);
  const fuelPercent = Math.round(clamp(car.fuel, 0, 1) * 100);
  fuelEl.textContent = fuelPercent;
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#7dd3fc');
  gradient.addColorStop(0.4, '#c4defd');
  gradient.addColorStop(1, '#f8fafc');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-cameraX * 0.15, 0);
  const horizonY = canvas.height * 0.55;
  const amplitude = canvas.height * 0.12;
  const frequency = 0.0045;

  ctx.fillStyle = 'rgba(30, 64, 175, 0.35)';
  ctx.beginPath();
  ctx.moveTo(-400, canvas.height);
  for (let x = -400; x <= canvas.width * 1.6; x += 60) {
    const y = horizonY + Math.sin((x + cameraX * 0.3) * frequency) * amplitude;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(canvas.width * 1.6, canvas.height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
  ctx.beginPath();
  ctx.moveTo(-400, canvas.height);
  for (let x = -400; x <= canvas.width * 1.6; x += 40) {
    const y = horizonY + Math.cos((x + cameraX * 0.2) * frequency * 0.7) * amplitude * 0.6 + 80;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(canvas.width * 1.6, canvas.height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTerrain() {
  const points = terrain.points;
  if (!points.length) return;
  const startIndex = Math.max(0, Math.floor((cameraX - 400) / TERRAIN_STEP));
  const endIndex = Math.min(points.length - 1, Math.ceil((cameraX + canvas.width + 400) / TERRAIN_STEP));

  ctx.save();
  ctx.translate(-cameraX, 0);

  ctx.beginPath();
  ctx.moveTo(points[startIndex].x, points[startIndex].y);
  for (let i = startIndex + 1; i <= endIndex; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineTo(points[endIndex].x, canvas.height + 200);
  ctx.lineTo(points[startIndex].x, canvas.height + 200);
  ctx.closePath();
  const fillGradient = ctx.createLinearGradient(0, canvas.height * 0.4, 0, canvas.height);
  fillGradient.addColorStop(0, '#155e75');
  fillGradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = fillGradient;
  ctx.fill();

  ctx.lineWidth = 6;
  ctx.strokeStyle = '#22d3ee';
  ctx.beginPath();
  ctx.moveTo(points[startIndex].x, points[startIndex].y - 2);
  for (let i = startIndex + 1; i <= endIndex; i += 1) {
    ctx.lineTo(points[i].x, points[i].y - 2);
  }
  ctx.stroke();

  fuelPickups.forEach(pickup => {
    if (pickup.collected) return;
    if (pickup.x < cameraX - 300 || pickup.x > cameraX + canvas.width + 300) return;
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundedRectPath(ctx, -16, -24, 32, 48, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-6, -10, 12, 20);
    ctx.restore();
  });

  ctx.restore();
}

function drawCar() {
  ctx.save();
  ctx.translate(car.position.x - cameraX, car.position.y);
  ctx.rotate(car.angle);

  car.wheels.forEach(wheel => {
    ctx.save();
    const localX = wheel.localOffset.x;
    const localY = wheel.localOffset.y;
    ctx.translate(localX, localY);
    ctx.rotate(wheel.spin);
    ctx.fillStyle = wheel.contact ? '#1f2937' : '#475569';
    ctx.beginPath();
    ctx.arc(0, 0, car.wheelRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, car.wheelRadius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(car.wheelRadius * 0.7, 0);
      ctx.stroke();
    }
    ctx.restore();
  });

  ctx.fillStyle = '#1d4ed8';
  ctx.strokeStyle = '#0b1e51';
  ctx.lineWidth = 6;
  const bodyWidth = car.bodySize.width;
  const bodyHeight = car.bodySize.height;
  ctx.beginPath();
  roundedRectPath(ctx, -bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(148, 197, 255, 0.8)';
  ctx.beginPath();
  roundedRectPath(ctx, -bodyWidth * 0.15, -bodyHeight * 0.35, bodyWidth * 0.4, bodyHeight * 0.45, 12);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(bodyWidth * 0.15, -bodyHeight * 0.18, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.032);
  lastTime = now;
  update(dt);

  drawBackground();
  drawTerrain();
  drawCar();

  requestAnimationFrame(loop);
}

resetGame();
requestAnimationFrame(loop);
