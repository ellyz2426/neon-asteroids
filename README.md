# Neon Asteroids VR

A neon-holodeck arcade asteroids game built with IWSDK. Inertia-based ship combat with progressive waves, boss fights, weapon upgrades, and full VR controller support.

## Play

https://ellyz2426.github.io/neon-asteroids/

## Features

### Gameplay
- **6 Game Modes:** Classic, Survival, Blitz (60s), Zen, Practice, Endless
- **4 Difficulty Levels:** Easy, Normal, Hard, Insane (with score multipliers)
- **Progressive Wave System:** Increasingly challenging waves with boss fights every 5 levels
- **Boss Asteroids:** 12 HP with orbiting rings, damage-based glow, trail particles
- **Weapon Upgrade System:** 5 tiers earned through kills (Dual Shot -> Fast Reload -> Tri-Beam -> Plasma Bolts -> Omega Cannon)
- **Power-up Magnet:** Tier 3+ weapons attract nearby power-ups
- **Wave Clear Bonus:** Extra points for clearing waves quickly
- **Combo System:** Score multiplier that builds with consecutive kills (up to 6x)
- **Kill Streaks:** Track rapid kills for bonus achievements

### Power-Ups (9 types)
Shield, Rapid Fire, Spread Shot, Piercing, Slow Motion, Smart Bomb, Extra Life, Homing Missiles, Double Score

### Visuals
- 5 visual themes (Neon Holodeck, Crimson Nebula, Solar Flare, Ultra Violet, Emerald Void)
- 8 unlockable ship skins with earn requirements
- Screen shake on explosions (intensity scales with asteroid size)
- Shockwave ring effects on large explosions
- Ship debris fragments on death
- Boss trail particles with HP-based color
- 3D score popup indicators with combo-based coloring
- Thruster trail particle effects
- Animated star field with twinkling
- Arena boundary proximity warning

### Progression
- **80 Achievements** across score, levels, combos, power-ups, modes, accuracy, kills
- **localStorage Persistence** -- high scores, achievements, stats, leaderboard, settings saved across sessions
- **Ship Skin Unlocking** -- earn skins through score and level milestones
- **XP/Level System** based on total kills
- **Performance Rating** (D -> S) at game over

### Controls
- **Keyboard:** WASD/Arrows to move, Space/J to fire, P/Escape to pause
- **VR Controllers:** Left thumbstick to turn/thrust, left trigger to thrust, right trigger to fire, B to pause

### Technical
- Built with IWSDK (Immersive Web SDK)
- 9 PanelUI spatial panels (HUD, Menu, Game Over, Achievements, Settings, Pause, Minimap, Power Bar, Toast)
- ECS architecture with 5 custom systems
- XR controller support via InputComponent
- Object pooling for bullets and particles
- Follower-based head-locked HUD panels

## Development

```bash
npm install
npm run dev
npm run build
```

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
