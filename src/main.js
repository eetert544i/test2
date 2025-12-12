import { clamp } from './math.js';
import { Input } from './input.js';
import { Track } from './track.js';
import { Car } from './car.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input();
const track = new Track();
const startPos = { x: 80, y: -60 };
const car = new Car(startPos);

let last = performance.now();
let camera = { x: 0, y: 0 };
let paused = true;
let gameOver = false;
let coins = 0;
let bestDistance = Number(localStorage.getItem('hill-best') || 0);
let overlaysVisible = false;

const ui = {
  distance: document.getElementById('distance'),
  speed: document.getElementById('speed'),
  altitude: document.getElementById('altitude'),
  coins: document.getElementById('coins'),
  best: document.getElementById('best'),
  fuel: document.getElementById('fuelFill'),
  overlay: document.getElementById('overlay'),
  overlayTitle: document.getElementById('overlayTitle'),
  overlayMessage: document.getElementById('overlayMessage'),
  overlayButton: document.getElementById('overlayButton'),
  restart: document.getElementById('restart'),
  pause: document.getElementById('pause'),
};

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function updateUI() {
  ui.distance.textContent = `${Math.floor(car.pos.x / 10)} m`;
  ui.speed.textContent = `${Math.max(0, Math.round(car.vel.x * 0.1))} km/h`;
  ui.altitude.textContent = `${Math.abs(Math.round(car.pos.y / 10))} m`;
  ui.coins.textContent = coins;
  ui.best.textContent = `${Math.floor(bestDistance / 10)} m`;
  ui.fuel.style.width = `${car.fuel * 100}%`;
}

function showOverlay(title, message) {
  ui.overlayTitle.textContent = title;
  ui.overlayMessage.textContent = message;
  ui.overlay.classList.add('active');
  overlaysVisible = true;
}

function hideOverlay() {
  ui.overlay.classList.remove('active');
  overlaysVisible = false;
}

function resetGame() {
  track.reset();
  car.reset(startPos);
  camera = { x: 0, y: 0 };
  coins = 0;
  paused = false;
  gameOver = false;
  hideOverlay();
}

ui.restart.addEventListener('click', resetGame);
ui.pause.addEventListener('click', () => {
  paused = !paused;
  ui.pause.textContent = paused ? 'Resume' : 'Pause';
  if (!paused && overlaysVisible) hideOverlay();
});

input.onChange((state) => {
  if (state.has('Space')) resetGame();
});

function update(dt) {
  if (paused || gameOver) return;

  car.update(dt, input, track);

  if (car.fuel <= 0) {
    triggerGameOver('Out of fuel', 'Collect coins to refuel and keep climbing.');
  }

  const rollHeight = track.sampleHeight(car.pos.x);
  if (car.pos.y - car.wheelRadius > rollHeight + 220) {
    triggerGameOver('Crashed', 'You flipped off the track. Stay balanced!');
  }

  track.coins.forEach((c) => {
    if (c.collected) return;
    const dx = c.x - car.pos.x;
    const dy = c.y - car.pos.y;
    if (Math.hypot(dx, dy) < 32) {
      c.collected = true;
      coins += 1;
      car.fuel = clamp(car.fuel + 0.12, 0, 1);
    }
  });

  bestDistance = Math.max(bestDistance, car.pos.x);
  localStorage.setItem('hill-best', bestDistance);

  const targetCam = { x: car.pos.x - canvas.width / (2 * devicePixelRatio) + 120, y: car.pos.y - 100 };
  camera.x = camera.x + (targetCam.x - camera.x) * Math.min(1, dt * 3);
  camera.y = camera.y + (targetCam.y - camera.y) * Math.min(1, dt * 3);

  updateUI();
}

function triggerGameOver(title, message) {
  gameOver = true;
  paused = true;
  showOverlay(title, message);
  ui.overlayButton.textContent = 'Restart';
  ui.overlayButton.onclick = () => {
    resetGame();
  };
}

function drawBackground() {
  const width = canvas.width / devicePixelRatio;
  const height = canvas.height / devicePixelRatio;
  ctx.save();
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, '#0d1a3a');
  skyGrad.addColorStop(1, '#0b132b');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 3; i++) {
    const offset = (camera.x * 0.1 * (i + 1)) % width;
    const y = 80 + i * 40;
    ctx.beginPath();
    ctx.moveTo(-offset, y);
    ctx.lineTo(width - offset, y + 10);
    ctx.lineTo(width * 1.2 - offset, y);
    ctx.fill();
  }
  ctx.restore();
}

function drawCoins() {
  ctx.save();
  ctx.fillStyle = '#fbbf24';
  ctx.strokeStyle = '#f59e0b';
  for (const c of track.coins) {
    if (c.collected) continue;
    const x = c.x - camera.x;
    const y = c.y - camera.y;
    if (x < -100 || x > canvas.width / devicePixelRatio + 100) continue;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  const width = canvas.width / devicePixelRatio;
  const height = canvas.height / devicePixelRatio;
  ctx.clearRect(0, 0, width, height);
  drawBackground();

  track.draw(ctx, camera);
  drawCoins();
  car.draw(ctx, camera);

  drawFuelWarnings();
}

function drawFuelWarnings() {
  const width = canvas.width / devicePixelRatio;
  const height = canvas.height / devicePixelRatio;
  if (car.fuel < 0.18 && !gameOver) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 122, 122, 0.08)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffb347';
    ctx.font = '16px Inter';
    ctx.fillText('Low fuel! Grab coins to refuel.', 20, height - 30);
    ctx.restore();
  }
}

function loop(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

loop(last);

showOverlay('Welcome driver', 'Hold right arrow to accelerate, left to brake, and A/D to tilt in the air. Collect coins to refuel!');
ui.overlayButton.textContent = 'Start Run';
ui.overlayButton.onclick = () => {
  paused = false;
  gameOver = false;
  hideOverlay();
};
