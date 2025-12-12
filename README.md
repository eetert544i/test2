# Hill Climber (browser edition)

A lightweight, canvas-based driving game inspired by hill climbing racers. Accelerate, brake, and tilt to keep your buggy upright while collecting coins to refuel.

## Playing locally

1. Start a simple web server from the repository root:
   ```bash
   python -m http.server 8000
   ```
2. Open [http://localhost:8000](http://localhost:8000) in your browser.
3. Click **Start Run** on the overlay (or tap the pause button) to begin.
4. Drive as far as you can without running out of fuel or flipping off the terrain.
   - **Right Arrow**: Accelerate / move forward
   - **Left Arrow**: Brake / reverse
   - **A / D**: Tilt your buggy mid-air to land safely
   - **Space**: Instant restart
   - **Pause/Restart buttons**: On-screen controls in the top bar
5. Collect the floating coins to refuel (each coin adds a chunk of fuel). Fuel and best distance are shown in the HUD.
6. Your best distance is remembered between runs via `localStorage`.
