# Neon Asteroids VR

A WebXR arcade shooter built with IWSDK. Pilot a neon wireframe ship through space, destroy asteroids, collect power-ups, and chase high scores across 6 game modes.

## Play

[Play Now](https://ellyz2426.github.io/neon-asteroids/)

## Features

### Core Gameplay
- **Inertia-based ship movement** — thrust, rotate, drift with momentum and drag
- **Arena wraparound** — fly off one side, appear on the other
- **Asteroid splitting** — large -> medium -> small with increasing speed
- **Boss asteroids** — appear every 5 levels with 12 HP, orbiting rings, and split into 4 large asteroids
- **Weapon upgrade system** — kills unlock 5 tiers: Dual Shot -> Fast Reload -> Tri-Beam -> Plasma Bolts -> Omega Cannon

### 9 Power-ups
Shield, Rapid Fire, Spread Shot, Piercing, Slow Motion, Smart Bomb, Extra Life, Homing Missiles, Double Score

### 6 Game Modes
- **Classic** — wave-based, 3 lives
- **Survival** — 1 life, increasingly intense waves
- **Blitz** — 60-second timed high score run
- **Zen** — no death, infinite lives for relaxed play
- **Practice** — easy difficulty for learning
- **Endless** — continuous spawning, no waves, ramps in intensity forever

### 4 Difficulty Levels
Easy (0.5x score), Normal, Hard (1.5x score), Insane (2x score)

### 80 Achievements
Score milestones, level progress, combo chains, boss defeats, mode completions, weapon tier unlocks, and more

### 5 Visual Themes and 8 Ship Skins

### Controls

**Keyboard:** WASD/Arrows (move), Space/J (fire), P/Escape (pause)

**VR Controllers:** Left Stick (turn/thrust), Left Trigger (thrust), Right Trigger (fire), B (pause)

## Technical
- Built with [IWSDK](https://iwsdk.dev) v0.4.x
- 9 PanelUI spatial panels
- ECS architecture with 6 systems
- XR and browser-first dual runtime

## Development
```bash
npm install
npm run dev
```
