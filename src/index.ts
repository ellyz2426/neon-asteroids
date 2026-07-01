import {
  World,
  createSystem,
  PanelUI,
  PanelDocument,
  UIKitDocument,
  UIKit,
  Follower,
  ScreenSpace,
  InputComponent,
  eq,
  Entity,
} from '@iwsdk/core';
import {
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  PlaneGeometry,
  ConeGeometry,
  TorusGeometry,
  OctahedronGeometry,
  IcosahedronGeometry,
  RingGeometry,
  Group,
  Vector3,
  Vector2,
  Color,
  FogExp2,
  DirectionalLight,
  AmbientLight,
  PointLight,
  AdditiveBlending,
  DoubleSide,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
  Raycaster,
  Object3D,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  CircleGeometry,
  BackSide,
  Quaternion,
  Euler,
  Matrix4,
  ShaderMaterial,
  Clock,
} from '@iwsdk/core';

// Workaround: dist types expose input as XRInputManager but runtime is InputManager
// which has .keyboard and .xr. Define a minimal interface to avoid (as any).
interface StatefulKB {
  getKeyPressed(code: string): boolean;
  getKeyDown(code: string): boolean;
  getKeyUp(code: string): boolean;
}
interface StatefulGP {
  getButtonDown(id: string): boolean;
  getButtonPressed(id: string): boolean;
  getAxesValues(id: string): { x: number; y: number } | undefined;
  gamepad?: Gamepad;
}
interface FullInputManager {
  keyboard: StatefulKB;
  xr: {
    gamepads: {
      left?: StatefulGP;
      right?: StatefulGP;
    };
  };
}

// ============================================================
// GAME CONSTANTS & TYPES
// ============================================================
type GameState = 'title' | 'mode' | 'difficulty' | 'countdown' | 'playing' | 'pause' | 'gameover' | 'leaderboard' | 'achievements' | 'settings' | 'help' | 'skins';
type GameMode = 'classic' | 'survival' | 'zen' | 'blitz' | 'practice';
type Difficulty = 'easy' | 'normal' | 'hard' | 'insane';
type AsteroidSize = 'large' | 'medium' | 'small' | 'boss';

interface AsteroidData {
  mesh: Group;
  velocity: Vector3;
  rotSpeed: Vector3;
  size: AsteroidSize;
  hp: number;
  maxHp: number;
  radius: number;
  active: boolean;
  spawnTime: number;
}

interface BulletData {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  active: boolean;
  piercing: boolean;
}

interface ParticleData {
  mesh: Points | Mesh;
  velocity: Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

interface PowerUpData {
  mesh: Group;
  type: PowerUpType;
  life: number;
  active: boolean;
  bobPhase: number;
}

type PowerUpType = 'shield' | 'rapid' | 'spread' | 'piercing' | 'slow' | 'bomb' | 'life' | 'homing' | 'double';

interface Achievement {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
}

const ARENA_RADIUS = 25;
const ARENA_HEIGHT = 15;
const SHIP_THRUST = 12;
const SHIP_TURN_SPEED = 3.5;
const SHIP_MAX_SPEED = 15;
const SHIP_DRAG = 0.992;
const BULLET_SPEED = 30;
const BULLET_LIFE = 1.8;
const FIRE_RATE = 0.15;
const RAPID_FIRE_RATE = 0.06;
const SPREAD_ANGLE = 0.25;
const ASTEROID_SPEEDS: Record<AsteroidSize, number> = { boss: 2, large: 3, medium: 5, small: 8 };
const ASTEROID_RADII: Record<AsteroidSize, number> = { boss: 3.5, large: 2.2, medium: 1.2, small: 0.6 };
const ASTEROID_HP: Record<AsteroidSize, number> = { boss: 12, large: 3, medium: 2, small: 1 };
const ASTEROID_SCORE: Record<AsteroidSize, number> = { boss: 500, large: 20, medium: 50, small: 100 };
const MAX_ASTEROIDS = 40;
const MAX_BULLETS = 30;
const MAX_PARTICLES = 60;
const POWERUP_DURATION = 8;
const SHIELD_DURATION = 6;

const THEMES = [
  { name: 'Neon Holodeck', grid: '#004444', accent: '#00ffff', bg: '#000a0a', fog: '#001111', ship: '#00ffff', bullet: '#00ffff', asteroid: '#00aaaa' },
  { name: 'Crimson Nebula', grid: '#440000', accent: '#ff4444', bg: '#0a0000', fog: '#110000', ship: '#ff4444', bullet: '#ff6644', asteroid: '#aa3333' },
  { name: 'Solar Flare', grid: '#443300', accent: '#ffaa00', bg: '#0a0800', fog: '#110a00', ship: '#ffaa00', bullet: '#ffcc44', asteroid: '#aa7700' },
  { name: 'Ultra Violet', grid: '#220044', accent: '#aa44ff', bg: '#050008', fog: '#080011', ship: '#aa44ff', bullet: '#cc66ff', asteroid: '#7733aa' },
  { name: 'Emerald Void', grid: '#003300', accent: '#44ff44', bg: '#000a00', fog: '#001100', ship: '#44ff44', bullet: '#66ff66', asteroid: '#33aa33' },
];

const SHIP_SKINS = [
  { name: 'Neon Arrow', color: '#00ffff', emissive: '#004444', unlock: '' },
  { name: 'Solar Dart', color: '#ff8800', emissive: '#442200', unlock: '500 pts' },
  { name: 'Plasma Hawk', color: '#ff44ff', emissive: '#440044', unlock: '2000 pts' },
  { name: 'Frost Wing', color: '#4488ff', emissive: '#002244', unlock: '5000 pts' },
  { name: 'Venom Fang', color: '#44ff44', emissive: '#004400', unlock: '10K pts' },
  { name: 'Gold Eagle', color: '#ffdd00', emissive: '#443300', unlock: 'Lvl 10' },
  { name: 'Void Phantom', color: '#8800ff', emissive: '#220044', unlock: 'Lvl 20' },
  { name: 'Inferno Blaze', color: '#ff4400', emissive: '#441100', unlock: '50K pts' },
];

// ============================================================
// GAME STATE MANAGER
// ============================================================
class GameManager {
  state: GameState = 'title';
  mode: GameMode = 'classic';
  difficulty: Difficulty = 'normal';
  score: number = 0;
  highScore: number = 0;
  lives: number = 3;
  level: number = 1;
  combo: number = 0;
  maxCombo: number = 0;
  comboTimer: number = 0;
  totalKills: number = 0;
  totalShots: number = 0;
  totalHits: number = 0;
  gamesPlayed: number = 0;
  bestLevel: number = 1;
  totalPlayTime: number = 0;
  sessionStart: number = 0;

  // Ship state
  shipPos: Vector3 = new Vector3(0, 0, 0);
  shipVel: Vector3 = new Vector3(0, 0, 0);
  shipAngle: number = 0;
  shipThrusting: boolean = false;
  invulnTimer: number = 0;
  respawnTimer: number = 0;
  alive: boolean = true;

  // Weapons
  fireTimer: number = 0;
  rapidFire: boolean = false;
  spreadShot: boolean = false;
  piercingShot: boolean = false;
  homingShot: boolean = false;
  doubleScore: boolean = false;
  shieldActive: boolean = false;
  powerUpTimers: Map<PowerUpType, number> = new Map();

  // Game flow
  countdownVal: number = 3;
  blitzTimer: number = 60;
  waveDelay: number = 0;
  asteroidsCleared: number = 0;

  // Settings
  currentTheme: number = 0;
  currentSkin: number = 0;
  masterVol: number = 100;
  sfxVol: number = 100;

  // Toast
  toastQueue: string[] = [];
  toastTimer: number = 0;

  // Achievements
  achievements: Achievement[] = [];
  achPage: number = 0;
  leaderboard: { score: number; mode: string; level: number; date: string }[] = [];

  // PowerUp tracking
  powerupsCollected: number = 0;
  shieldsUsed: number = 0;
  bombsUsed: number = 0;
  perfectLevels: number = 0;

  // Slow motion
  slowMotion: boolean = false;
  slowTimer: number = 0;

  modesPlayed: Set<string> = new Set();
  themesPlayed: Set<number> = new Set();

  // Kill streak tracking
  recentKillTimes: number[] = [];
  gameTime: number = 0;

  // Score popup queue
  scorePopups: { text: string; pos: Vector3; life: number; maxLife: number }[] = [];

  // Boss tracking
  bossActive: boolean = false;
  bossesDefeated: number = 0;
  bossesInGame: number = 0;
  noThrustKills: number = 0;
  lastThrustTime: number = 0;
  livesLostInGame: number = 0;
  powerupTypesCollected: Set<PowerUpType> = new Set();

  constructor() {
    this.initAchievements();
  }

  initAchievements() {
    this.achievements = [
      { id: 'first_kill', name: 'First Blood', desc: 'Destroy your first asteroid', unlocked: false },
      { id: 'score_500', name: 'Getting Started', desc: 'Score 500 points', unlocked: false },
      { id: 'score_2000', name: 'Space Ace', desc: 'Score 2000 points', unlocked: false },
      { id: 'score_5000', name: 'Star Hunter', desc: 'Score 5000 points', unlocked: false },
      { id: 'score_10000', name: 'Asteroid Slayer', desc: 'Score 10,000 points', unlocked: false },
      { id: 'score_25000', name: 'Galactic Legend', desc: 'Score 25,000 points', unlocked: false },
      { id: 'score_50000', name: 'Cosmic Champion', desc: 'Score 50,000 points', unlocked: false },
      { id: 'score_100000', name: 'Universal Master', desc: 'Score 100,000 points', unlocked: false },
      { id: 'level_5', name: 'Wave Rider', desc: 'Reach Level 5', unlocked: false },
      { id: 'level_10', name: 'Deep Space', desc: 'Reach Level 10', unlocked: false },
      { id: 'level_20', name: 'Final Frontier', desc: 'Reach Level 20', unlocked: false },
      { id: 'level_30', name: 'Beyond Infinity', desc: 'Reach Level 30', unlocked: false },
      { id: 'combo_5', name: 'Chain Reaction', desc: 'Get a 5x combo', unlocked: false },
      { id: 'combo_10', name: 'Unstoppable', desc: 'Get a 10x combo', unlocked: false },
      { id: 'combo_20', name: 'Combo King', desc: 'Get a 20x combo', unlocked: false },
      { id: 'combo_50', name: 'Absolute Mayhem', desc: 'Get a 50x combo', unlocked: false },
      { id: 'no_miss_level', name: 'Sharpshooter', desc: 'Clear a level without missing', unlocked: false },
      { id: 'no_damage', name: 'Untouchable', desc: 'Clear Level 5 without taking damage', unlocked: false },
      { id: 'rapid_fire', name: 'Bullet Storm', desc: 'Collect Rapid Fire power-up', unlocked: false },
      { id: 'spread_shot', name: 'Wide Angle', desc: 'Collect Spread Shot power-up', unlocked: false },
      { id: 'piercing', name: 'Armor Piercing', desc: 'Collect Piercing power-up', unlocked: false },
      { id: 'shield_save', name: 'Close Call', desc: 'Shield blocks a hit', unlocked: false },
      { id: 'bomb_clear', name: 'Screen Wipe', desc: 'Use a Smart Bomb', unlocked: false },
      { id: 'ten_powerups', name: 'Power Hungry', desc: 'Collect 10 power-ups', unlocked: false },
      { id: 'games_10', name: 'Regular Pilot', desc: 'Play 10 games', unlocked: false },
      { id: 'games_50', name: 'Veteran', desc: 'Play 50 games', unlocked: false },
      { id: 'kill_100', name: 'Centurion', desc: 'Destroy 100 asteroids total', unlocked: false },
      { id: 'kill_500', name: 'Rock Breaker', desc: 'Destroy 500 asteroids total', unlocked: false },
      { id: 'kill_1000', name: 'Asteroid Annihilator', desc: 'Destroy 1000 asteroids total', unlocked: false },
      { id: 'accuracy_90', name: 'Marksman', desc: '90% accuracy in a game (min 20 shots)', unlocked: false },
      { id: 'all_modes', name: 'Jack of All Trades', desc: 'Play all game modes', unlocked: false },
      { id: 'perfect_3', name: 'Perfectionist', desc: 'Clear 3 levels without taking damage', unlocked: false },
      { id: 'survival_120', name: 'Survivor', desc: 'Survive 120 seconds in Survival mode', unlocked: false },
      { id: 'blitz_5000', name: 'Speed Demon', desc: 'Score 5000 in Blitz mode', unlocked: false },
      { id: 'zen_master', name: 'Zen Master', desc: 'Play Zen mode for 5 minutes', unlocked: false },
      { id: 'all_skins', name: 'Collector', desc: 'Unlock all ship skins', unlocked: false },
      { id: 'close_call', name: 'Danger Zone', desc: 'Survive at 0.5 radius from asteroid', unlocked: false },
      { id: 'triple_split', name: 'Chain Splitter', desc: 'Destroy a large asteroid and all fragments', unlocked: false },
      { id: 'bounce_shot', name: 'Ricochet', desc: 'Hit asteroid near arena edge', unlocked: false },
      { id: 'speed_kill', name: 'Quick Draw', desc: 'Destroy asteroid within 0.5s of spawn', unlocked: false },
      { id: 'level_50', name: 'Endless Void', desc: 'Reach Level 50', unlocked: false },
      { id: 'bomb_3', name: 'Demolition Expert', desc: 'Use 3 Smart Bombs in one game', unlocked: false },
      { id: 'shields_5', name: 'Barrier Master', desc: 'Use 5 shields in one game', unlocked: false },
      { id: 'streak_10', name: 'Kill Streak', desc: 'Destroy 10 asteroids in 5 seconds', unlocked: false },
      { id: 'no_powerup', name: 'Purist', desc: 'Reach Level 5 without collecting powerups', unlocked: false },
      { id: 'all_themes', name: 'Fashionista', desc: 'Play in all 5 visual themes', unlocked: false },
      { id: 'max_lives', name: 'Stockpiler', desc: 'Reach 9 lives', unlocked: false },
      { id: 'double_spread', name: 'Bullet Hell', desc: 'Have Rapid Fire + Spread active together', unlocked: false },
      { id: 'marathon', name: 'Marathon Runner', desc: 'Play for 30 minutes total', unlocked: false },
      { id: 'boss_kill', name: 'Boss Slayer', desc: 'Defeat a boss asteroid', unlocked: false },
      { id: 'boss_5', name: 'Boss Hunter', desc: 'Defeat 5 boss asteroids', unlocked: false },
      { id: 'boss_10', name: 'Nemesis', desc: 'Defeat 10 boss asteroids', unlocked: false },
      { id: 'score_250000', name: 'Quarter Million', desc: 'Score 250,000 points', unlocked: false },
      { id: 'score_500000', name: 'Half Million', desc: 'Score 500,000 points', unlocked: false },
      { id: 'kill_5000', name: 'Extinction Event', desc: 'Destroy 5000 asteroids total', unlocked: false },
      { id: 'combo_100', name: 'Beyond Insane', desc: 'Get a 100x combo', unlocked: false },
      { id: 'level_100', name: 'Ascended', desc: 'Reach Level 100', unlocked: false },
      { id: 'survival_300', name: 'Iron Will', desc: 'Survive 300 seconds in Survival mode', unlocked: false },
      { id: 'hard_clear', name: 'Hardcore', desc: 'Clear Level 10 on Hard difficulty', unlocked: false },
      { id: 'insane_clear', name: 'Insane Pilot', desc: 'Clear Level 5 on Insane difficulty', unlocked: false },
      { id: 'homing_kills', name: 'Heat Seeker', desc: 'Collect Homing Missiles power-up', unlocked: false },
      { id: 'double_score', name: 'Midas Touch', desc: 'Collect Double Score power-up', unlocked: false },
      { id: 'all_powerups', name: 'Full Arsenal', desc: 'Collect all 9 power-up types', unlocked: false },
      { id: 'speed_run', name: 'Speed Runner', desc: 'Reach Level 10 in under 3 minutes', unlocked: false },
      { id: 'no_thrust', name: 'Drifter', desc: 'Destroy 5 asteroids without thrusting', unlocked: false },
      { id: 'triple_boss', name: 'Boss Rush', desc: 'Defeat 3 bosses in one game', unlocked: false },
      { id: 'one_life', name: 'Flawless', desc: 'Reach Level 15 without losing a life', unlocked: false },
    ];
  }

  unlock(id: string): boolean {
    const a = this.achievements.find(x => x.id === id);
    if (a && !a.unlocked) {
      a.unlocked = true;
      this.toastQueue.push(`Achievement: ${a.name}!`);
      return true;
    }
    return false;
  }

  checkAchievements() {
    if (this.totalKills >= 1) this.unlock('first_kill');
    if (this.score >= 500) this.unlock('score_500');
    if (this.score >= 2000) this.unlock('score_2000');
    if (this.score >= 5000) this.unlock('score_5000');
    if (this.score >= 10000) this.unlock('score_10000');
    if (this.score >= 25000) this.unlock('score_25000');
    if (this.score >= 50000) this.unlock('score_50000');
    if (this.score >= 100000) this.unlock('score_100000');
    if (this.level >= 5) this.unlock('level_5');
    if (this.level >= 10) this.unlock('level_10');
    if (this.level >= 20) this.unlock('level_20');
    if (this.level >= 30) this.unlock('level_30');
    if (this.combo >= 5) this.unlock('combo_5');
    if (this.combo >= 10) this.unlock('combo_10');
    if (this.combo >= 20) this.unlock('combo_20');
    if (this.combo >= 50) this.unlock('combo_50');
    if (this.powerupsCollected >= 10) this.unlock('ten_powerups');
    if (this.gamesPlayed >= 10) this.unlock('games_10');
    if (this.gamesPlayed >= 50) this.unlock('games_50');
    if (this.totalKills >= 100) this.unlock('kill_100');
    if (this.totalKills >= 500) this.unlock('kill_500');
    if (this.totalKills >= 1000) this.unlock('kill_1000');
    if (this.perfectLevels >= 3) this.unlock('perfect_3');
    if (this.modesPlayed.size >= 5) this.unlock('all_modes');
    if (this.level >= 50) this.unlock('level_50');
    if (this.bombsUsed >= 3) this.unlock('bomb_3');
    if (this.shieldsUsed >= 5) this.unlock('shields_5');
    if (this.lives >= 9) this.unlock('max_lives');
    if (this.rapidFire && this.spreadShot) this.unlock('double_spread');
    if (this.totalPlayTime >= 1800) this.unlock('marathon');
    if (this.themesPlayed.size >= 5) this.unlock('all_themes');
    if (this.bossesDefeated >= 1) this.unlock('boss_kill');
    if (this.bossesDefeated >= 5) this.unlock('boss_5');
    if (this.bossesDefeated >= 10) this.unlock('boss_10');
    if (this.score >= 250000) this.unlock('score_250000');
    if (this.score >= 500000) this.unlock('score_500000');
    if (this.totalKills >= 5000) this.unlock('kill_5000');
    if (this.combo >= 100) this.unlock('combo_100');
    if (this.level >= 100) this.unlock('level_100');
    if (this.difficulty === 'hard' && this.level >= 10) this.unlock('hard_clear');
    if (this.difficulty === 'insane' && this.level >= 5) this.unlock('insane_clear');
    if (this.powerupTypesCollected.size >= 9) this.unlock('all_powerups');
    if (this.bossesInGame >= 3) this.unlock('triple_boss');
    if (this.level >= 15 && this.livesLostInGame === 0) this.unlock('one_life');
    if (this.noThrustKills >= 5) this.unlock('no_thrust');
  }

  addScore(base: number, pos?: Vector3) {
    const diffMult = this.difficulty === 'easy' ? 0.5 : this.difficulty === 'hard' ? 1.5 : this.difficulty === 'insane' ? 2.0 : 1.0;
    const scoreMult = this.doubleScore ? 2 : 1;
    const multiplier = 1 + Math.min(this.combo * 0.1, 5);
    const pts = Math.round(base * multiplier * diffMult * scoreMult);
    this.score += pts;
    this.combo++;
    this.comboTimer = 3;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.score > this.highScore) this.highScore = this.score;

    // Score popup
    if (pos) {
      const popupText = this.combo > 1 ? `+${pts} (${this.combo}x)` : `+${pts}`;
      this.scorePopups.push({ text: popupText, pos: pos.clone(), life: 1.2, maxLife: 1.2 });
      if (this.scorePopups.length > 10) this.scorePopups.shift();
    }

    // Kill streak tracking
    this.recentKillTimes.push(this.gameTime);
    // Remove kills older than 5 seconds
    this.recentKillTimes = this.recentKillTimes.filter(t => this.gameTime - t < 5);
    if (this.recentKillTimes.length >= 10) this.unlock('streak_10');

    this.checkAchievements();
  }

  resetGame() {
    this.score = 0;
    this.lives = this.mode === 'survival' ? 1 : this.mode === 'zen' ? 99 : 3;
    this.level = 1;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.shipPos.set(0, 0, 0);
    this.shipVel.set(0, 0, 0);
    this.shipAngle = 0;
    this.invulnTimer = 2;
    this.alive = true;
    this.fireTimer = 0;
    this.rapidFire = false;
    this.spreadShot = false;
    this.piercingShot = false;
    this.homingShot = false;
    this.doubleScore = false;
    this.shieldActive = false;
    this.slowMotion = false;
    this.powerUpTimers.clear();
    this.countdownVal = 3;
    this.blitzTimer = 60;
    this.waveDelay = 0;
    this.asteroidsCleared = 0;
    this.sessionStart = 0;
    this.respawnTimer = 0;
    this.modesPlayed.add(this.mode);
    this.themesPlayed.add(this.currentTheme);
    this.recentKillTimes = [];
    this.gameTime = 0;
    this.scorePopups = [];
    this.bossActive = false;
    this.bossesInGame = 0;
    this.noThrustKills = 0;
    this.lastThrustTime = 0;
    this.livesLostInGame = 0;
    this.powerupTypesCollected = new Set();
  }

  saveLeaderboard() {
    this.leaderboard.push({
      score: this.score,
      mode: this.mode,
      level: this.level,
      date: new Date().toLocaleDateString(),
    });
    this.leaderboard.sort((a, b) => b.score - a.score);
    if (this.leaderboard.length > 20) this.leaderboard.length = 20;
  }
}

// ============================================================
// ASTEROID MESH FACTORY
// ============================================================
function createAsteroidMesh(size: AsteroidSize, theme: typeof THEMES[0]): Group {
  const group = new Group();
  const radius = ASTEROID_RADII[size];
  const detail = size === 'boss' ? 2 : size === 'large' ? 1 : size === 'medium' ? 1 : 0;
  const color = new Color(size === 'boss' ? '#ff2200' : theme.asteroid);

  // Main body - irregular icosahedron
  const geo = new IcosahedronGeometry(radius, detail);
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const noise = 1 + (Math.random() - 0.5) * (size === 'boss' ? 0.3 : 0.4);
    positions.setXYZ(i, x * noise, y * noise, z * noise);
  }
  geo.computeVertexNormals();

  const mat = new MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.15),
    emissive: color.clone().multiplyScalar(size === 'boss' ? 0.2 : 0.1),
    roughness: 0.9,
    metalness: 0.2,
    transparent: true,
    opacity: size === 'boss' ? 0.5 : 0.4,
  });
  const body = new Mesh(geo, mat);
  group.add(body);

  // Wireframe edges
  const edges = new EdgesGeometry(geo);
  const lineMat = new LineBasicMaterial({
    color: color,
    transparent: true,
    opacity: size === 'boss' ? 1.0 : 0.8,
  });
  const wireframe = new LineSegments(edges, lineMat);
  group.add(wireframe);

  // Glow core
  const coreMat = new MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: size === 'boss' ? 0.15 : 0.08,
  });
  const core = new Mesh(new SphereGeometry(radius * 0.7, 8, 8), coreMat);
  group.add(core);

  // Boss: add orbiting ring
  if (size === 'boss') {
    const ringGeo = new TorusGeometry(radius * 1.2, 0.08, 8, 24);
    const ringMat = new MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new Mesh(ringGeo, ringMat);
    ring.name = 'boss-ring';
    group.add(ring);

    // Second ring at angle
    const ring2 = new Mesh(
      new TorusGeometry(radius * 1.0, 0.06, 8, 20),
      new MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.4 })
    );
    ring2.rotation.x = Math.PI / 3;
    ring2.name = 'boss-ring2';
    group.add(ring2);
  }

  return group;
}

function createShipMesh(skin: typeof SHIP_SKINS[0]): Group {
  const group = new Group();
  const color = new Color(skin.color);
  const emissive = new Color(skin.emissive);

  // Main body - arrow/triangle shape
  const bodyGeo = new ConeGeometry(0.3, 0.8, 3);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.3),
    emissive: emissive,
    roughness: 0.3,
    metalness: 0.8,
    transparent: true,
    opacity: 0.6,
  });
  const body = new Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Wireframe
  const edges = new EdgesGeometry(bodyGeo);
  const lineMat = new LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
  group.add(new LineSegments(edges, lineMat));

  // Engine glow
  const engineGeo = new SphereGeometry(0.1, 8, 8);
  const engineMat = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
  });
  const engine = new Mesh(engineGeo, engineMat);
  engine.position.set(0, 0, 0.35);
  engine.name = 'engine';
  group.add(engine);

  // Wing tips
  for (const side of [-1, 1]) {
    const wingGeo = new BoxGeometry(0.05, 0.05, 0.3);
    const wingMat = new MeshStandardMaterial({
      color: color.clone().multiplyScalar(0.5),
      emissive: emissive.clone().multiplyScalar(0.5),
      transparent: true,
      opacity: 0.7,
    });
    const wing = new Mesh(wingGeo, wingMat);
    wing.position.set(side * 0.25, 0, 0.15);
    group.add(wing);
  }

  // Shield visual (hidden by default)
  const shieldGeo = new SphereGeometry(0.6, 16, 16);
  const shieldMat = new MeshBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0,
    side: DoubleSide,
  });
  const shield = new Mesh(shieldGeo, shieldMat);
  shield.name = 'shield';
  group.add(shield);

  return group;
}

function createBulletMesh(color: Color): Mesh {
  const geo = new CylinderGeometry(0.03, 0.03, 0.4, 6);
  geo.rotateX(Math.PI / 2);
  const mat = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
  });
  return new Mesh(geo, mat);
}

function createPowerUpMesh(type: PowerUpType): Group {
  const group = new Group();
  const colors: Record<PowerUpType, number> = {
    shield: 0x00ff88,
    rapid: 0xff4444,
    spread: 0xffaa00,
    piercing: 0xff44ff,
    slow: 0x4488ff,
    bomb: 0xff0000,
    life: 0x44ff44,
    homing: 0xff8844,
    double: 0xffff00,
  };
  const color = new Color(colors[type]);

  // Outer ring
  const ringGeo = new TorusGeometry(0.3, 0.05, 8, 16);
  const ringMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
  group.add(new Mesh(ringGeo, ringMat));

  // Core icon (simple shape per type)
  let iconGeo: BoxGeometry | SphereGeometry | ConeGeometry | OctahedronGeometry | CylinderGeometry;
  if (type === 'shield') iconGeo = new SphereGeometry(0.15, 8, 8);
  else if (type === 'rapid') iconGeo = new ConeGeometry(0.12, 0.25, 4);
  else if (type === 'spread') iconGeo = new BoxGeometry(0.2, 0.2, 0.2);
  else if (type === 'piercing') iconGeo = new ConeGeometry(0.08, 0.3, 3);
  else if (type === 'slow') iconGeo = new OctahedronGeometry(0.15);
  else if (type === 'bomb') iconGeo = new SphereGeometry(0.18, 6, 6);
  else if (type === 'homing') iconGeo = new ConeGeometry(0.1, 0.25, 6);
  else if (type === 'double') iconGeo = new CylinderGeometry(0.12, 0.12, 0.2, 8);
  else iconGeo = new BoxGeometry(0.15, 0.15, 0.15); // life

  const iconMat = new MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.5),
    emissive: color.clone().multiplyScalar(0.3),
    transparent: true,
    opacity: 0.7,
  });
  group.add(new Mesh(iconGeo, iconMat));

  return group;
}

// ============================================================
// ENVIRONMENT BUILDER
// ============================================================
function buildEnvironment(scene: Object3D, theme: typeof THEMES[0]): Points {
  // Cast to Scene for fog/background access
  const s = scene as any;
  s.fog = new FogExp2(new Color(theme.fog).getHex(), 0.02);
  s.background = new Color(theme.bg);

  // Ambient light
  const ambient = new AmbientLight(new Color(theme.accent).getHex(), 0.15);
  scene.add(ambient);

  // Main directional
  const dirLight = new DirectionalLight(0xffffff, 0.4);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  // Accent lights
  const accentColor = new Color(theme.accent).getHex();
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const light = new PointLight(accentColor, 0.5, ARENA_RADIUS * 2);
    light.position.set(
      Math.cos(angle) * ARENA_RADIUS * 0.8,
      ARENA_HEIGHT * 0.3,
      Math.sin(angle) * ARENA_RADIUS * 0.8
    );
    scene.add(light);
  }

  // Ground grid
  const gridColor = new Color(theme.grid);
  const gridSize = ARENA_RADIUS * 2;
  const gridDiv = 30;
  const gridStep = gridSize / gridDiv;

  for (let i = -gridDiv / 2; i <= gridDiv / 2; i++) {
    const pos = i * gridStep;
    // X lines
    const xGeo = new BufferGeometry().setFromPoints([
      new Vector3(pos, 0, -gridSize / 2),
      new Vector3(pos, 0, gridSize / 2),
    ]);
    const xLine = new LineSegments(xGeo, new LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.3 }));
    scene.add(xLine);

    // Z lines
    const zGeo = new BufferGeometry().setFromPoints([
      new Vector3(-gridSize / 2, 0, pos),
      new Vector3(gridSize / 2, 0, pos),
    ]);
    const zLine = new LineSegments(zGeo, new LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.3 }));
    scene.add(zLine);
  }

  // Arena boundary walls (transparent wireframe)
  const wallColor = new Color(theme.accent);
  const wallSegments = 32;
  for (let i = 0; i < wallSegments; i++) {
    const a1 = (i / wallSegments) * Math.PI * 2;
    const a2 = ((i + 1) / wallSegments) * Math.PI * 2;
    const x1 = Math.cos(a1) * ARENA_RADIUS;
    const z1 = Math.sin(a1) * ARENA_RADIUS;
    const x2 = Math.cos(a2) * ARENA_RADIUS;
    const z2 = Math.sin(a2) * ARENA_RADIUS;

    // Bottom ring
    const bGeo = new BufferGeometry().setFromPoints([
      new Vector3(x1, 0, z1), new Vector3(x2, 0, z2),
    ]);
    scene.add(new LineSegments(bGeo, new LineBasicMaterial({ color: wallColor, transparent: true, opacity: 0.15 })));

    // Top ring
    const tGeo = new BufferGeometry().setFromPoints([
      new Vector3(x1, ARENA_HEIGHT, z1), new Vector3(x2, ARENA_HEIGHT, z2),
    ]);
    scene.add(new LineSegments(tGeo, new LineBasicMaterial({ color: wallColor, transparent: true, opacity: 0.1 })));

    // Verticals
    if (i % 4 === 0) {
      const vGeo = new BufferGeometry().setFromPoints([
        new Vector3(x1, 0, z1), new Vector3(x1, ARENA_HEIGHT, z1),
      ]);
      scene.add(new LineSegments(vGeo, new LineBasicMaterial({ color: wallColor, transparent: true, opacity: 0.1 })));
    }
  }

  // Star field (animated)
  const starCount = 600;
  const starPositions = new Float32Array(starCount * 3);
  const starVelocities: number[] = [];
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = ARENA_RADIUS * 1.5 + Math.random() * 20;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    starVelocities.push((Math.random() - 0.5) * 0.02);
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new Float32BufferAttribute(starPositions, 3));
  const starMat = new PointsMaterial({
    color: 0xffffff,
    size: 0.08,
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
  });
  const starField = new Points(starGeo, starMat);
  scene.add(starField);

  return starField;
}

// ============================================================
// MAIN ENTRY
// ============================================================
async function main() {
  const container = document.getElementById('app') as HTMLDivElement;

  const world = await World.create(container, {
    xr: { offer: 'once' },
    browserControls: true,
    render: {
      defaultLighting: false,
      camera: { position: [0, 12, 8], lookAt: [0, 1.5, 0] },
    },
    features: {
      grabbing: false,
      locomotion: false,
      physics: false,
    },
  } as any);

  const game = new GameManager();
  const theme = THEMES[game.currentTheme];

  // Build environment
  const starField = buildEnvironment(world.scene, theme);

  // Ship mesh
  const shipGroup = createShipMesh(SHIP_SKINS[game.currentSkin]);
  shipGroup.position.set(0, 1.5, 0);
  world.scene.add(shipGroup);

  // Object pools
  const asteroids: AsteroidData[] = [];
  const bullets: BulletData[] = [];
  const particles: ParticleData[] = [];
  const powerups: PowerUpData[] = [];

  // Pre-populate bullet pool
  const bulletColor = new Color(theme.bullet);
  for (let i = 0; i < MAX_BULLETS; i++) {
    const mesh = createBulletMesh(bulletColor);
    mesh.visible = false;
    world.scene.add(mesh);
    bullets.push({ mesh, velocity: new Vector3(), life: 0, active: false, piercing: false });
  }

  // ============================================================
  // GAME LOGIC HELPERS
  // ============================================================
  function spawnAsteroid(size: AsteroidSize, pos?: Vector3) {
    if (asteroids.filter(a => a.active).length >= MAX_ASTEROIDS) return;

    const mesh = createAsteroidMesh(size, THEMES[game.currentTheme]);
    const radius = ASTEROID_RADII[size];

    let spawnPos: Vector3;
    if (pos) {
      spawnPos = pos.clone();
    } else {
      // Spawn at arena edge
      const angle = Math.random() * Math.PI * 2;
      const edgeR = ARENA_RADIUS * 0.85;
      spawnPos = new Vector3(
        Math.cos(angle) * edgeR,
        1.5,
        Math.sin(angle) * edgeR
      );
    }
    mesh.position.copy(spawnPos);
    world.scene.add(mesh);

    // Velocity toward center-ish
    const diffSpeedMult = game.difficulty === 'easy' ? 0.7 : game.difficulty === 'hard' ? 1.3 : game.difficulty === 'insane' ? 1.6 : 1.0;
    const speed = ASTEROID_SPEEDS[size] * (0.7 + Math.random() * 0.6) * (1 + game.level * 0.08) * diffSpeedMult;
    const toCenter = new Vector3(-spawnPos.x, 0, -spawnPos.z).normalize();
    const offset = new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).multiplyScalar(0.5);
    const vel = toCenter.add(offset).normalize().multiplyScalar(speed);

    asteroids.push({
      mesh,
      velocity: vel,
      rotSpeed: new Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ),
      size,
      hp: ASTEROID_HP[size],
      maxHp: ASTEROID_HP[size],
      radius,
      active: true,
      spawnTime: game.gameTime,
    });
  }

  function spawnWave() {
    const count = Math.min(3 + Math.floor(game.level * 1.2), 12);
    for (let i = 0; i < count; i++) {
      setTimeout(() => spawnAsteroid('large'), i * 200);
    }
    // Add some medium asteroids at higher levels
    if (game.level >= 3) {
      const medCount = Math.min(Math.floor((game.level - 2) * 0.8), 6);
      for (let i = 0; i < medCount; i++) {
        setTimeout(() => spawnAsteroid('medium'), (count + i) * 200);
      }
    }
    // Boss every 5 levels (starting level 5)
    if (game.level % 5 === 0 && !game.bossActive) {
      game.bossActive = true;
      game.toastQueue.push('!! BOSS INCOMING !!');
      setTimeout(() => spawnAsteroid('boss'), (count + 3) * 200);
    }
  }

  function fireBullet(pos: Vector3, angle: number, offset: number = 0) {
    const bullet = bullets.find(b => !b.active);
    if (!bullet) return;

    const dir = new Vector3(
      -Math.sin(angle + offset),
      0,
      -Math.cos(angle + offset)
    );

    bullet.mesh.position.copy(pos);
    bullet.mesh.rotation.y = angle + offset;
    bullet.mesh.visible = true;
    bullet.velocity.copy(dir).multiplyScalar(BULLET_SPEED);
    bullet.life = BULLET_LIFE;
    bullet.active = true;
    bullet.piercing = game.piercingShot;
    game.totalShots++;
  }

  function spawnExplosion(pos: Vector3, color: Color, count: number = 8, shakeAmount: number = 0.3) {
    // Trigger screen shake
    shakeState.intensity = Math.max(shakeState.intensity, shakeAmount);

    for (let i = 0; i < count && particles.filter(p => p.active).length < MAX_PARTICLES; i++) {
      const size = 0.03 + Math.random() * 0.06;
      const geo = new BoxGeometry(size, size, size);
      const mat = new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new Mesh(geo, mat);
      mesh.position.copy(pos);
      world.scene.add(mesh);

      const vel = new Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 8
      );

      const maxLife = 0.5 + Math.random() * 0.5;
      particles.push({ mesh, velocity: vel, life: maxLife, maxLife, active: true });
    }
  }

  function spawnPowerUp(pos: Vector3) {
    const dropChance = game.difficulty === 'easy' ? 0.20 : game.difficulty === 'hard' ? 0.10 : game.difficulty === 'insane' ? 0.07 : 0.15;
    if (Math.random() > dropChance) return;
    const types: PowerUpType[] = ['shield', 'rapid', 'spread', 'piercing', 'slow', 'bomb', 'life', 'homing', 'double'];
    const weights = [15, 20, 15, 15, 10, 5, 10, 12, 8]; // homing + double have moderate rarity
    const totalW = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalW;
    let type: PowerUpType = 'rapid';
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) { type = types[i]; break; }
    }

    const mesh = createPowerUpMesh(type);
    mesh.position.copy(pos);
    mesh.position.y = 1.5;
    world.scene.add(mesh);

    powerups.push({
      mesh,
      type,
      life: 10,
      active: true,
      bobPhase: Math.random() * Math.PI * 2,
    });
  }

  function destroyAsteroid(ast: AsteroidData, bulletPos?: Vector3) {
    const pos = ast.mesh.position.clone();
    const color = new Color(ast.size === 'boss' ? '#ff2200' : THEMES[game.currentTheme].asteroid);

    // Score
    game.addScore(ASTEROID_SCORE[ast.size], pos);
    game.totalKills++;
    game.asteroidsCleared++;

    // Speed kill check
    if (game.gameTime - ast.spawnTime < 0.5) {
      game.unlock('speed_kill');
    }

    // No-thrust kill tracking
    if (game.gameTime - game.lastThrustTime > 2) {
      game.noThrustKills++;
    }

    // Speed run check
    if (game.level >= 10 && game.gameTime < 180) {
      game.unlock('speed_run');
    }

    // Explosion
    const shakeAmt = ast.size === 'boss' ? 1.0 : ast.size === 'large' ? 0.5 : ast.size === 'medium' ? 0.3 : 0.15;
    const particleCount = ast.size === 'boss' ? 25 : ast.size === 'large' ? 15 : ast.size === 'medium' ? 10 : 6;
    spawnExplosion(pos, color, particleCount, shakeAmt);

    // Split
    if (ast.size === 'boss') {
      game.bossesDefeated++;
      game.bossesInGame++;
      game.bossActive = false;
      game.toastQueue.push('BOSS DESTROYED!');
      for (let i = 0; i < 4; i++) {
        const offset = new Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
        spawnAsteroid('large', pos.clone().add(offset));
      }
    } else if (ast.size === 'large') {
      for (let i = 0; i < 3; i++) {
        const offset = new Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
        spawnAsteroid('medium', pos.clone().add(offset));
      }
    } else if (ast.size === 'medium') {
      for (let i = 0; i < 2; i++) {
        const offset = new Vector3((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5);
        spawnAsteroid('small', pos.clone().add(offset));
      }
    }

    // Power-up chance
    spawnPowerUp(pos);

    // Remove
    world.scene.remove(ast.mesh);
    ast.active = false;
  }

  function handleShipHit() {
    if (game.invulnTimer > 0) return;

    if (game.shieldActive) {
      game.shieldActive = false;
      game.powerUpTimers.delete('shield');
      game.unlock('shield_save');
      game.toastQueue.push('Shield destroyed!');
      spawnExplosion(game.shipPos.clone().setY(1.5), new Color(0x00ff88), 12, 0.4);
      game.invulnTimer = 1;
      return;
    }

    game.lives--;
    game.combo = 0;
    game.comboTimer = 0;
    game.livesLostInGame++;
    spawnExplosion(game.shipPos.clone().setY(1.5), new Color(THEMES[game.currentTheme].ship), 20, 0.8);

    if (game.lives <= 0) {
      game.alive = false;
      game.state = 'gameover';
      game.gamesPlayed++;
      game.saveLeaderboard();
      game.checkAchievements();
      shipGroup.visible = false;
    } else {
      game.invulnTimer = 2.5;
      game.respawnTimer = 1;
      game.shipPos.set(0, 0, 0);
      game.shipVel.set(0, 0, 0);
      game.shipAngle = 0;
      shipGroup.visible = false;
    }
  }

  function activateBomb() {
    game.bombsUsed++;
    game.unlock('bomb_clear');
    game.toastQueue.push('SMART BOMB!');

    // Destroy all active asteroids
    for (const ast of asteroids) {
      if (!ast.active) continue;
      game.addScore(ASTEROID_SCORE[ast.size], ast.mesh.position.clone());
      game.totalKills++;
      game.asteroidsCleared++;
      spawnExplosion(ast.mesh.position.clone(), new Color(THEMES[game.currentTheme].asteroid), 6, 0.15);
      world.scene.remove(ast.mesh);
      ast.active = false;
    }
    game.bossActive = false;
  }

  function collectPowerUp(pu: PowerUpData) {
    game.powerupsCollected++;
    game.powerupTypesCollected.add(pu.type);

    switch (pu.type) {
      case 'shield':
        game.shieldActive = true;
        game.shieldsUsed++;
        game.powerUpTimers.set('shield', SHIELD_DURATION);
        game.toastQueue.push('Shield Active!');
        break;
      case 'rapid':
        game.rapidFire = true;
        game.powerUpTimers.set('rapid', POWERUP_DURATION);
        game.toastQueue.push('Rapid Fire!');
        game.unlock('rapid_fire');
        break;
      case 'spread':
        game.spreadShot = true;
        game.powerUpTimers.set('spread', POWERUP_DURATION);
        game.toastQueue.push('Spread Shot!');
        game.unlock('spread_shot');
        break;
      case 'piercing':
        game.piercingShot = true;
        game.powerUpTimers.set('piercing', POWERUP_DURATION);
        game.toastQueue.push('Piercing Rounds!');
        game.unlock('piercing');
        break;
      case 'slow':
        game.slowMotion = true;
        game.slowTimer = 5;
        game.powerUpTimers.set('slow', 5);
        game.toastQueue.push('Slow Motion!');
        break;
      case 'bomb':
        activateBomb();
        break;
      case 'life':
        game.lives = Math.min(game.lives + 1, 9);
        game.toastQueue.push('+1 Life!');
        break;
      case 'homing':
        game.homingShot = true;
        game.powerUpTimers.set('homing', POWERUP_DURATION);
        game.toastQueue.push('Homing Missiles!');
        game.unlock('homing_kills');
        break;
      case 'double':
        game.doubleScore = true;
        game.powerUpTimers.set('double', 10);
        game.toastQueue.push('DOUBLE SCORE!');
        game.unlock('double_score');
        break;
    }

    world.scene.remove(pu.mesh);
    pu.active = false;
    game.checkAchievements();
  }

  function wrapPosition(pos: Vector3) {
    const r = ARENA_RADIUS * 0.9;
    const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    if (dist > r) {
      // Wrap to opposite side
      pos.x = -pos.x * 0.9;
      pos.z = -pos.z * 0.9;
    }
  }

  // ============================================================
  // PANEL UI SETUP
  // ============================================================
  // HUD panel
  const hudEntity = world.createTransformEntity();
  hudEntity.addComponent(PanelUI, { config: './ui/hud.json' });
  hudEntity.addComponent(Follower, {});
  const fv = hudEntity.getVectorView(Follower, 'offsetPosition');
  fv[0] = 0; fv[1] = 0.2; fv[2] = -0.8;

  // Menu panel
  const menuEntity = world.createTransformEntity();
  menuEntity.addComponent(PanelUI, { config: './ui/menu.json' });
  menuEntity.addComponent(Follower, {});
  const mv = menuEntity.getVectorView(Follower, 'offsetPosition');
  mv[0] = 0; mv[1] = 0; mv[2] = -1.2;

  // Game over panel
  const overEntity = world.createTransformEntity();
  overEntity.addComponent(PanelUI, { config: './ui/gameover.json' });
  overEntity.addComponent(Follower, {});
  const ov = overEntity.getVectorView(Follower, 'offsetPosition');
  ov[0] = 0; ov[1] = 0; ov[2] = -1.2;

  // Achievements panel
  const achEntity = world.createTransformEntity();
  achEntity.addComponent(PanelUI, { config: './ui/achvlist.json' });
  achEntity.addComponent(Follower, {});
  const av = achEntity.getVectorView(Follower, 'offsetPosition');
  av[0] = 0; av[1] = 0; av[2] = -1.2;

  // Toast panel
  const toastEntity = world.createTransformEntity();
  toastEntity.addComponent(PanelUI, { config: './ui/toast.json' });
  toastEntity.addComponent(Follower, {});
  const tv = toastEntity.getVectorView(Follower, 'offsetPosition');
  tv[0] = 0; tv[1] = -0.2; tv[2] = -0.8;

  // Settings panel
  const settingsEntity = world.createTransformEntity();
  settingsEntity.addComponent(PanelUI, { config: './ui/settings.json' });
  settingsEntity.addComponent(Follower, {});
  const sv = settingsEntity.getVectorView(Follower, 'offsetPosition');
  sv[0] = 0; sv[1] = 0; sv[2] = -1.2;

  // Pause panel
  const pauseEntity = world.createTransformEntity();
  pauseEntity.addComponent(PanelUI, { config: './ui/pause.json' });
  pauseEntity.addComponent(Follower, {});
  const pv = pauseEntity.getVectorView(Follower, 'offsetPosition');
  pv[0] = 0; pv[1] = 0; pv[2] = -1.2;

  // Minimap panel (positioned top-right of view)
  const minimapEntity = world.createTransformEntity();
  minimapEntity.addComponent(PanelUI, { config: './ui/minimap.json' });
  minimapEntity.addComponent(Follower, {});
  const mmv = minimapEntity.getVectorView(Follower, 'offsetPosition');
  mmv[0] = 0.35; mmv[1] = 0.15; mmv[2] = -0.8;

  // Powerbar panel (positioned bottom of HUD)
  const powerbarEntity = world.createTransformEntity();
  powerbarEntity.addComponent(PanelUI, { config: './ui/powerbar.json' });
  powerbarEntity.addComponent(Follower, {});
  const pbv = powerbarEntity.getVectorView(Follower, 'offsetPosition');
  pbv[0] = 0; pbv[1] = -0.15; pbv[2] = -0.8;

  // Screen shake state
  const shakeState = { intensity: 0, decay: 0.92 };

  // ============================================================
  // ECS SYSTEMS
  // ============================================================
  class GameUISystem extends createSystem({
    hud: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/hud.json')] },
    menu: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/menu.json')] },
    over: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/gameover.json')] },
    ach: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/achvlist.json')] },
    toast: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/toast.json')] },
    settings: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/settings.json')] },
    pause: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/pause.json')] },
    minimap: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/minimap.json')] },
    powerbar: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/powerbar.json')] },
  }) {
    private hudDoc: UIKitDocument | null = null;
    private menuDoc: UIKitDocument | null = null;
    private overDoc: UIKitDocument | null = null;
    private achDoc: UIKitDocument | null = null;
    private toastDoc: UIKitDocument | null = null;
    private settingsDoc: UIKitDocument | null = null;
    private pauseDoc: UIKitDocument | null = null;
    private minimapDoc: UIKitDocument | null = null;
    private powerbarDoc: UIKitDocument | null = null;

    init() {
      this.queries.hud.subscribe('qualify', (entity) => {
        this.hudDoc = PanelDocument.data.document[entity.index] as UIKitDocument;
      });

      this.queries.menu.subscribe('qualify', (entity) => {
        this.menuDoc = PanelDocument.data.document[entity.index] as UIKitDocument;
        this.wireMenu();
      });

      this.queries.over.subscribe('qualify', (entity) => {
        this.overDoc = PanelDocument.data.document[entity.index] as UIKitDocument;
        this.wireGameOver();
      });

      this.queries.ach.subscribe('qualify', (entity) => {
        this.achDoc = PanelDocument.data.document[entity.index] as UIKitDocument;
        this.wireAchievements();
      });

      this.queries.toast.subscribe('qualify', (entity) => {
        this.toastDoc = PanelDocument.data.document[entity.index] as UIKitDocument;
      });

      this.queries.settings.subscribe('qualify', (entity) => {
        this.settingsDoc = PanelDocument.data.document[entity.index] as UIKitDocument;
        this.wireSettings();
      });

      this.queries.pause.subscribe('qualify', (entity) => {
        this.pauseDoc = PanelDocument.data.document[entity.index] as UIKitDocument;
        this.wirePause();
      });

      this.queries.minimap.subscribe('qualify', (entity) => {
        this.minimapDoc = PanelDocument.data.document[entity.index] as UIKitDocument;
      });

      this.queries.powerbar.subscribe('qualify', (entity) => {
        this.powerbarDoc = PanelDocument.data.document[entity.index] as UIKitDocument;
      });
    }

    wireMenu() {
      if (!this.menuDoc) return;
      const doc = this.menuDoc;

      const btnClassic = doc.getElementById('btn-classic') as UIKit.Text | undefined;
      btnClassic?.addEventListener('click', () => { game.mode = 'classic'; game.difficulty = 'normal'; startGame(); });

      const btnSurvival = doc.getElementById('btn-survival') as UIKit.Text | undefined;
      btnSurvival?.addEventListener('click', () => { game.mode = 'survival'; game.difficulty = 'normal'; startGame(); });

      const btnZen = doc.getElementById('btn-zen') as UIKit.Text | undefined;
      btnZen?.addEventListener('click', () => { game.mode = 'zen'; game.difficulty = 'normal'; startGame(); });

      const btnBlitz = doc.getElementById('btn-blitz') as UIKit.Text | undefined;
      btnBlitz?.addEventListener('click', () => { game.mode = 'blitz'; game.difficulty = 'normal'; startGame(); });

      const btnPractice = doc.getElementById('btn-practice') as UIKit.Text | undefined;
      btnPractice?.addEventListener('click', () => { game.mode = 'practice'; game.difficulty = 'easy'; startGame(); });

      const btnAch = doc.getElementById('btn-achievements') as UIKit.Text | undefined;
      btnAch?.addEventListener('click', () => { game.state = 'achievements'; game.achPage = 0; });

      const btnLb = doc.getElementById('btn-leaderboard') as UIKit.Text | undefined;
      btnLb?.addEventListener('click', () => { game.state = 'leaderboard'; });

      const btnHelp = doc.getElementById('btn-help') as UIKit.Text | undefined;
      btnHelp?.addEventListener('click', () => { game.state = 'help'; });

      const btnSettings = doc.getElementById('btn-settings') as UIKit.Text | undefined;
      btnSettings?.addEventListener('click', () => { game.state = 'settings'; });
    }

    wireGameOver() {
      if (!this.overDoc) return;
      const doc = this.overDoc;

      const btnRetry = doc.getElementById('btn-retry') as UIKit.Text | undefined;
      btnRetry?.addEventListener('click', () => startGame());

      const btnMenu = doc.getElementById('btn-menu') as UIKit.Text | undefined;
      btnMenu?.addEventListener('click', () => {
        game.state = 'title';
        clearArena();
      });
    }

    wireAchievements() {
      if (!this.achDoc) return;
      const doc = this.achDoc;

      const btnBack = doc.getElementById('btn-back') as UIKit.Text | undefined;
      btnBack?.addEventListener('click', () => { game.state = 'title'; });

      const btnPrev = doc.getElementById('btn-prev') as UIKit.Text | undefined;
      btnPrev?.addEventListener('click', () => {
        game.achPage = Math.max(0, game.achPage - 1);
      });

      const btnNext = doc.getElementById('btn-next') as UIKit.Text | undefined;
      btnNext?.addEventListener('click', () => {
        const maxPage = Math.floor((game.achievements.length - 1) / 8);
        game.achPage = Math.min(maxPage, game.achPage + 1);
      });
    }

    wireSettings() {
      if (!this.settingsDoc) return;
      const doc = this.settingsDoc;

      const btnBack = doc.getElementById('btn-back-settings') as UIKit.Text | undefined;
      btnBack?.addEventListener('click', () => { game.state = 'title'; });

      const skinPrev = doc.getElementById('skin-prev') as UIKit.Text | undefined;
      skinPrev?.addEventListener('click', () => {
        game.currentSkin = (game.currentSkin - 1 + SHIP_SKINS.length) % SHIP_SKINS.length;
      });

      const skinNext = doc.getElementById('skin-next') as UIKit.Text | undefined;
      skinNext?.addEventListener('click', () => {
        game.currentSkin = (game.currentSkin + 1) % SHIP_SKINS.length;
      });

      const themePrev = doc.getElementById('theme-prev') as UIKit.Text | undefined;
      themePrev?.addEventListener('click', () => {
        game.currentTheme = (game.currentTheme - 1 + THEMES.length) % THEMES.length;
      });

      const themeNext = doc.getElementById('theme-next') as UIKit.Text | undefined;
      themeNext?.addEventListener('click', () => {
        game.currentTheme = (game.currentTheme + 1) % THEMES.length;
      });

      const diffs: Difficulty[] = ['easy', 'normal', 'hard', 'insane'];
      const diffPrev = doc.getElementById('diff-prev') as UIKit.Text | undefined;
      diffPrev?.addEventListener('click', () => {
        const idx = diffs.indexOf(game.difficulty);
        game.difficulty = diffs[(idx - 1 + diffs.length) % diffs.length];
      });

      const diffNext = doc.getElementById('diff-next') as UIKit.Text | undefined;
      diffNext?.addEventListener('click', () => {
        const idx = diffs.indexOf(game.difficulty);
        game.difficulty = diffs[(idx + 1) % diffs.length];
      });
    }

    wirePause() {
      if (!this.pauseDoc) return;
      const doc = this.pauseDoc;

      const btnResume = doc.getElementById('btn-resume') as UIKit.Text | undefined;
      btnResume?.addEventListener('click', () => { game.state = 'playing'; });

      const btnRestart = doc.getElementById('btn-restart-pause') as UIKit.Text | undefined;
      btnRestart?.addEventListener('click', () => { startGame(); });

      const btnQuit = doc.getElementById('btn-quit-pause') as UIKit.Text | undefined;
      btnQuit?.addEventListener('click', () => {
        game.state = 'title';
        clearArena();
      });
    }

    updateSettings() {
      if (!this.settingsDoc) return;
      const show = game.state === 'settings';

      const root = this.settingsDoc.getElementById('settings-root') as UIKit.Container | undefined;
      root?.setProperties({ display: show ? 'flex' : 'none' });

      if (!show) return;

      const skinName = this.settingsDoc.getElementById('skin-name') as UIKit.Text | undefined;
      skinName?.setProperties({ text: SHIP_SKINS[game.currentSkin].name });

      const skinLock = this.settingsDoc.getElementById('skin-lock') as UIKit.Text | undefined;
      const unlock = SHIP_SKINS[game.currentSkin].unlock;
      skinLock?.setProperties({ text: unlock ? `Unlock: ${unlock}` : 'Default', display: 'flex' });

      const themeName = this.settingsDoc.getElementById('theme-name') as UIKit.Text | undefined;
      themeName?.setProperties({ text: THEMES[game.currentTheme].name });

      // Stats
      const xpLevel = Math.floor(game.totalKills / 25) + 1;
      const xpCurrent = game.totalKills % 25;
      const setText = (id: string, text: string) => {
        const el = this.settingsDoc?.getElementById(id) as UIKit.Text | undefined;
        el?.setProperties({ text });
      };
      setText('stat-xp', `XP: ${xpCurrent}/25 -- Level ${xpLevel}`);
      setText('stat-games', `Games Played: ${game.gamesPlayed}`);
      setText('stat-kills', `Total Kills: ${game.totalKills}`);
      setText('stat-time', `Play Time: ${Math.floor(game.totalPlayTime / 60)}m`);
      const acc = game.totalShots > 0 ? Math.round((game.totalHits / game.totalShots) * 100) : 0;
      setText('stat-accuracy', `Accuracy: ${acc}%`);
      setText('stat-best', `Best Score: ${game.highScore}`);
      setText('stat-bosses', `Bosses Defeated: ${game.bossesDefeated}`);

      // Difficulty display
      const diffDescs: Record<Difficulty, string> = {
        easy: 'Slower rocks, more drops',
        normal: 'Standard experience',
        hard: 'Faster rocks, fewer drops, 1.5x score',
        insane: 'Extreme speed, rare drops, 2x score',
      };
      const diffName = this.settingsDoc.getElementById('diff-name') as UIKit.Text | undefined;
      diffName?.setProperties({ text: game.difficulty.toUpperCase() });
      const diffDesc = this.settingsDoc.getElementById('diff-desc') as UIKit.Text | undefined;
      diffDesc?.setProperties({ text: diffDescs[game.difficulty] });
    }

    updatePause() {
      if (!this.pauseDoc) return;
      const show = game.state === 'pause';

      const root = this.pauseDoc.getElementById('pause-root') as UIKit.Container | undefined;
      root?.setProperties({ display: show ? 'flex' : 'none' });

      if (!show) return;

      const scoreText = this.pauseDoc.getElementById('pause-score') as UIKit.Text | undefined;
      scoreText?.setProperties({ text: `Score: ${game.score}` });

      const levelText = this.pauseDoc.getElementById('pause-level') as UIKit.Text | undefined;
      levelText?.setProperties({ text: `Level: ${game.level}` });
    }

    updateMinimap() {
      if (!this.minimapDoc) return;
      const show = game.state === 'playing' || game.state === 'countdown';

      const root = this.minimapDoc.getElementById('minimap-root') as UIKit.Container | undefined;
      root?.setProperties({ display: show ? 'flex' : 'none' });

      if (!show) return;

      const activeCount = asteroids.filter(a => a.active).length;
      const countText = this.minimapDoc.getElementById('minimap-count') as UIKit.Text | undefined;
      const bossAst = asteroids.find(a => a.active && a.size === 'boss');
      const countStr = bossAst
        ? `Asteroids: ${activeCount} [BOSS ${Math.ceil((bossAst.hp / bossAst.maxHp) * 100)}%]`
        : `Asteroids: ${activeCount}`;
      countText?.setProperties({ text: countStr });

      const waveText = this.minimapDoc.getElementById('minimap-wave') as UIKit.Text | undefined;
      const bossLabel = game.level % 5 === 0 ? ' (BOSS)' : '';
      waveText?.setProperties({ text: `Wave ${game.level}${bossLabel}` });
    }

    updatePowerbar() {
      if (!this.powerbarDoc) return;
      const playing = game.state === 'playing';
      const hasPowerups = game.powerUpTimers.size > 0;

      const root = this.powerbarDoc.getElementById('powerbar-root') as UIKit.Container | undefined;
      root?.setProperties({ display: (playing && hasPowerups) ? 'flex' : 'none' });

      if (!playing || !hasPowerups) return;

      const entries = Array.from(game.powerUpTimers.entries());
      for (let i = 0; i < 5; i++) {
        const el = this.powerbarDoc.getElementById(`power-${i}`) as UIKit.Text | undefined;
        if (i < entries.length) {
          const [type, timer] = entries[i];
          const label = type.toUpperCase();
          const secs = Math.ceil(timer);
          el?.setProperties({ text: `${label}: ${secs}s`, display: 'flex' });
        } else {
          el?.setProperties({ display: 'none' });
        }
      }
    }

    update(delta: number) {
      this.updateHUD();
      this.updateMenuVisibility();
      this.updateGameOver();
      this.updateAchievements();
      this.updateSettings();
      this.updatePause();
      this.updateMinimap();
      this.updatePowerbar();
      this.updateToast(delta);
    }

    updateHUD() {
      if (!this.hudDoc) return;
      const showHud = game.state === 'playing' || game.state === 'countdown';

      const root = this.hudDoc.getElementById('hud-root') as UIKit.Container | undefined;
      root?.setProperties({ display: showHud ? 'flex' : 'none' });

      if (!showHud) return;

      const score = this.hudDoc.getElementById('score') as UIKit.Text | undefined;
      score?.setProperties({ text: `Score: ${game.score}` });

      const lives = this.hudDoc.getElementById('lives') as UIKit.Text | undefined;
      lives?.setProperties({ text: `Lives: ${game.lives}` });

      const level = this.hudDoc.getElementById('level') as UIKit.Text | undefined;
      level?.setProperties({ text: `Level ${game.level}` });

      const combo = this.hudDoc.getElementById('combo') as UIKit.Text | undefined;
      if (game.combo > 1) {
        combo?.setProperties({ text: `${game.combo}x Combo!`, display: 'flex' });
      } else {
        combo?.setProperties({ display: 'none' });
      }

      const powerup = this.hudDoc.getElementById('powerup') as UIKit.Text | undefined;
      const activePowerups: string[] = [];
      if (game.rapidFire) activePowerups.push('RAPID');
      if (game.spreadShot) activePowerups.push('SPREAD');
      if (game.piercingShot) activePowerups.push('PIERCE');
      if (game.shieldActive) activePowerups.push('SHIELD');
      if (game.slowMotion) activePowerups.push('SLOW');
      if (game.homingShot) activePowerups.push('HOMING');
      if (game.doubleScore) activePowerups.push('2xSCORE');
      powerup?.setProperties({
        text: activePowerups.length > 0 ? activePowerups.join(' | ') : '',
        display: activePowerups.length > 0 ? 'flex' : 'none',
      });

      // Blitz timer
      const blitz = this.hudDoc.getElementById('blitz') as UIKit.Text | undefined;
      if (game.mode === 'blitz') {
        blitz?.setProperties({ text: `Time: ${Math.ceil(game.blitzTimer)}s`, display: 'flex' });
      } else {
        blitz?.setProperties({ display: 'none' });
      }

      // Countdown overlay
      const countdown = this.hudDoc.getElementById('countdown') as UIKit.Text | undefined;
      if (game.state === 'countdown') {
        countdown?.setProperties({ text: `${Math.ceil(game.countdownVal)}`, display: 'flex' });
      } else {
        countdown?.setProperties({ display: 'none' });
      }
    }

    updateMenuVisibility() {
      if (!this.menuDoc) return;
      const showMenu = game.state === 'title' || game.state === 'help' || game.state === 'leaderboard' || game.state === 'settings';

      const root = this.menuDoc.getElementById('menu-root') as UIKit.Container | undefined;
      root?.setProperties({ display: showMenu ? 'flex' : 'none' });

      if (!showMenu) return;

      // Update high score display
      const hs = this.menuDoc.getElementById('high-score') as UIKit.Text | undefined;
      hs?.setProperties({ text: `High Score: ${game.highScore}` });

      // Update stats
      const stats = this.menuDoc.getElementById('stats') as UIKit.Text | undefined;
      stats?.setProperties({
        text: `Games: ${game.gamesPlayed} | Kills: ${game.totalKills} | Best Lvl: ${game.bestLevel}`,
      });

      // Help/leaderboard sub-panels
      const helpPanel = this.menuDoc.getElementById('help-panel') as UIKit.Container | undefined;
      helpPanel?.setProperties({ display: game.state === 'help' ? 'flex' : 'none' });

      const lbPanel = this.menuDoc.getElementById('lb-panel') as UIKit.Container | undefined;
      lbPanel?.setProperties({ display: game.state === 'leaderboard' ? 'flex' : 'none' });

      const mainBtns = this.menuDoc.getElementById('main-buttons') as UIKit.Container | undefined;
      mainBtns?.setProperties({ display: game.state === 'title' ? 'flex' : 'none' });

      if (game.state === 'leaderboard') {
        for (let i = 0; i < 10; i++) {
          const row = this.menuDoc.getElementById(`lb-${i}`) as UIKit.Text | undefined;
          if (game.leaderboard[i]) {
            const e = game.leaderboard[i];
            row?.setProperties({ text: `${i + 1}. ${e.score} (${e.mode} Lvl${e.level})`, display: 'flex' });
          } else {
            row?.setProperties({ text: `${i + 1}. ---`, display: 'flex' });
          }
        }
      }

      // Help back button
      if (game.state === 'help' || game.state === 'leaderboard') {
        const backBtn = this.menuDoc.getElementById('btn-back-menu') as UIKit.Text | undefined;
        if (backBtn && !(backBtn as any)._wired) {
          backBtn.addEventListener('click', () => { game.state = 'title'; });
          (backBtn as any)._wired = true;
        }
      }
    }

    updateGameOver() {
      if (!this.overDoc) return;
      const show = game.state === 'gameover';

      const root = this.overDoc.getElementById('over-root') as UIKit.Container | undefined;
      root?.setProperties({ display: show ? 'flex' : 'none' });

      if (!show) return;

      const finalScore = this.overDoc.getElementById('final-score') as UIKit.Text | undefined;
      finalScore?.setProperties({ text: `Score: ${game.score}` });

      const finalMode = this.overDoc.getElementById('final-mode') as UIKit.Text | undefined;
      finalMode?.setProperties({ text: game.mode.charAt(0).toUpperCase() + game.mode.slice(1) });

      const finalDiff = this.overDoc.getElementById('final-diff') as UIKit.Text | undefined;
      finalDiff?.setProperties({ text: game.difficulty.toUpperCase() });

      const finalLevel = this.overDoc.getElementById('final-level') as UIKit.Text | undefined;
      finalLevel?.setProperties({ text: `Level: ${game.level}` });

      const finalKills = this.overDoc.getElementById('final-kills') as UIKit.Text | undefined;
      finalKills?.setProperties({ text: `Kills: ${game.asteroidsCleared}` });

      const finalCombo = this.overDoc.getElementById('final-combo') as UIKit.Text | undefined;
      finalCombo?.setProperties({ text: `Best Combo: ${game.maxCombo}x` });

      const accuracy = game.totalShots > 0 ? Math.round((game.totalHits / game.totalShots) * 100) : 0;
      const finalAcc = this.overDoc.getElementById('final-accuracy') as UIKit.Text | undefined;
      finalAcc?.setProperties({ text: `Accuracy: ${accuracy}%` });

      const finalPowerups = this.overDoc.getElementById('final-powerups') as UIKit.Text | undefined;
      finalPowerups?.setProperties({ text: `Power-ups: ${game.powerupsCollected}` });

      const finalTime = this.overDoc.getElementById('final-time') as UIKit.Text | undefined;
      const secs = Math.floor(game.gameTime);
      finalTime?.setProperties({ text: `Time: ${Math.floor(secs / 60)}m ${secs % 60}s` });

      const isNew = game.score >= game.highScore && game.score > 0;
      const newHs = this.overDoc.getElementById('new-highscore') as UIKit.Text | undefined;
      newHs?.setProperties({ display: isNew ? 'flex' : 'none' });
    }

    updateAchievements() {
      if (!this.achDoc) return;
      const show = game.state === 'achievements';

      const root = this.achDoc.getElementById('ach-root') as UIKit.Container | undefined;
      root?.setProperties({ display: show ? 'flex' : 'none' });

      if (!show) return;

      const start = game.achPage * 8;
      const unlocked = game.achievements.filter(a => a.unlocked).length;

      const counter = this.achDoc.getElementById('ach-counter') as UIKit.Text | undefined;
      counter?.setProperties({ text: `${unlocked}/${game.achievements.length} Unlocked` });

      for (let i = 0; i < 8; i++) {
        const ach = game.achievements[start + i];
        const name = this.achDoc.getElementById(`ach-name-${i}`) as UIKit.Text | undefined;
        const desc = this.achDoc.getElementById(`ach-desc-${i}`) as UIKit.Text | undefined;
        const row = this.achDoc.getElementById(`ach-row-${i}`) as UIKit.Container | undefined;

        if (ach) {
          row?.setProperties({ display: 'flex' });
          const prefix = ach.unlocked ? '[*] ' : '[ ] ';
          name?.setProperties({ text: prefix + ach.name });
          desc?.setProperties({ text: ach.desc });
        } else {
          row?.setProperties({ display: 'none' });
        }
      }

      const pageInfo = this.achDoc.getElementById('page-info') as UIKit.Text | undefined;
      const maxPage = Math.floor((game.achievements.length - 1) / 8);
      pageInfo?.setProperties({ text: `Page ${game.achPage + 1}/${maxPage + 1}` });
    }

    updateToast(delta: number) {
      if (!this.toastDoc) return;

      if (game.toastTimer > 0) {
        game.toastTimer -= delta;
        if (game.toastTimer <= 0) {
          const text = this.toastDoc.getElementById('toast-text') as UIKit.Text | undefined;
          text?.setProperties({ display: 'none' });
        }
      } else if (game.toastQueue.length > 0) {
        const msg = game.toastQueue.shift()!;
        const text = this.toastDoc.getElementById('toast-text') as UIKit.Text | undefined;
        text?.setProperties({ text: msg, display: 'flex' });
        game.toastTimer = 2;
      }
    }
  }

  class GameplaySystem extends createSystem({}) {
    private levelShotsAtStart: number = 0;
    private levelHitsAtStart: number = 0;
    private levelDamageTaken: boolean = false;
    private sessionTime: number = 0;

    init() {}

    update(delta: number, time: number) {
      const dt = game.slowMotion ? delta * 0.4 : delta;

      // State machine
      if (game.state === 'countdown') {
        this.updateCountdown(delta);
        return;
      }
      if (game.state !== 'playing') return;

      this.sessionTime += delta;
      game.totalPlayTime += delta;
      game.gameTime += delta;

      // Input
      this.handleInput(dt);

      // Ship physics
      this.updateShip(dt);

      // Bullets
      this.updateBullets(dt);

      // Asteroids
      this.updateAsteroids(dt);

      // Particles
      this.updateParticles(dt);

      // PowerUps
      this.updatePowerUps(dt, time);

      // Collisions
      this.checkCollisions();

      // Combo decay
      if (game.comboTimer > 0) {
        game.comboTimer -= dt;
        if (game.comboTimer <= 0) {
          game.combo = 0;
        }
      }

      // PowerUp timers
      this.updatePowerUpTimers(dt);

      // Wave check
      this.checkWaveComplete(dt);

      // Blitz timer
      if (game.mode === 'blitz') {
        game.blitzTimer -= delta;
        if (game.blitzTimer <= 0) {
          game.state = 'gameover';
          game.gamesPlayed++;
          game.saveLeaderboard();
          game.checkAchievements();
        }
      }

      // Respawn
      if (game.respawnTimer > 0) {
        game.respawnTimer -= delta;
        if (game.respawnTimer <= 0) {
          shipGroup.visible = true;
        }
      }

      // Invuln flicker
      if (game.invulnTimer > 0) {
        game.invulnTimer -= delta;
        shipGroup.visible = Math.floor(game.invulnTimer * 10) % 2 === 0;
        if (game.invulnTimer <= 0) {
          shipGroup.visible = true;
        }
      }

      // Shield visual
      const shieldMesh = shipGroup.getObjectByName('shield') as Mesh | undefined;
      if (shieldMesh) {
        const sMat = shieldMesh.material as MeshBasicMaterial;
        sMat.opacity = game.shieldActive ? 0.15 + Math.sin(time * 4) * 0.05 : 0;
      }

      // Engine glow
      const engineMesh = shipGroup.getObjectByName('engine') as Mesh | undefined;
      if (engineMesh) {
        const eMat = engineMesh.material as MeshBasicMaterial;
        eMat.opacity = game.shipThrusting ? 0.8 : 0.2;
        engineMesh.scale.setScalar(game.shipThrusting ? 1.5 : 0.8);
      }

      // Thruster trail particles
      if (game.shipThrusting && game.alive && Math.random() < 0.6) {
        const trailPos = game.shipPos.clone();
        trailPos.y = 1.5;
        // Offset behind ship
        trailPos.x += Math.sin(game.shipAngle) * 0.4;
        trailPos.z += Math.cos(game.shipAngle) * 0.4;

        const trailColor = new Color(THEMES[game.currentTheme].ship);
        const size = 0.02 + Math.random() * 0.04;
        const geo = new BoxGeometry(size, size, size);
        const mat = new MeshBasicMaterial({ color: trailColor, transparent: true, opacity: 0.7 });
        const mesh = new Mesh(geo, mat);
        mesh.position.copy(trailPos);
        world.scene.add(mesh);

        const vel = new Vector3(
          Math.sin(game.shipAngle) * (3 + Math.random() * 2) + (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 1,
          Math.cos(game.shipAngle) * (3 + Math.random() * 2) + (Math.random() - 0.5) * 2
        );
        if (particles.filter(p => p.active).length < MAX_PARTICLES) {
          particles.push({ mesh, velocity: vel, life: 0.3 + Math.random() * 0.2, maxLife: 0.5, active: true });
        } else {
          world.scene.remove(mesh);
        }
      }

      // Achievements check
      if (game.mode === 'survival' && this.sessionTime >= 120) {
        game.unlock('survival_120');
      }
      if (game.mode === 'survival' && this.sessionTime >= 300) {
        game.unlock('survival_300');
      }
      if (game.mode === 'blitz' && game.score >= 5000) {
        game.unlock('blitz_5000');
      }
      if (game.mode === 'zen' && this.sessionTime >= 300) {
        game.unlock('zen_master');
      }
    }

    updateCountdown(delta: number) {
      game.countdownVal -= delta;
      if (game.countdownVal <= 0) {
        game.state = 'playing';
        this.levelShotsAtStart = game.totalShots;
        this.levelHitsAtStart = game.totalHits;
        this.levelDamageTaken = false;
        this.sessionTime = 0;
        spawnWave();
      }
    }

    handleInput(dt: number) {
      if (!game.alive || game.respawnTimer > 0) return;

      const _input = this.input as unknown as FullInputManager;
      const kb = _input.keyboard;
      const right = _input.xr?.gamepads?.right;
      const left = _input.xr?.gamepads?.left;

      // Rotation
      let turnInput = 0;
      if (kb.getKeyPressed('KeyA') || kb.getKeyPressed('ArrowLeft')) turnInput += 1;
      if (kb.getKeyPressed('KeyD') || kb.getKeyPressed('ArrowRight')) turnInput -= 1;

      // XR thumbstick
      const lStick = left?.getAxesValues(InputComponent.Thumbstick);
      if (lStick && Math.abs(lStick.x) > 0.15) turnInput -= lStick.x;

      game.shipAngle += turnInput * SHIP_TURN_SPEED * dt;

      // Thrust
      game.shipThrusting = false;
      if (kb.getKeyPressed('KeyW') || kb.getKeyPressed('ArrowUp')) {
        game.shipThrusting = true;
      }
      const lStickY = lStick?.y ?? 0;
      if (lStickY < -0.15) game.shipThrusting = true;

      // XR trigger thrust
      if (left?.getButtonPressed(InputComponent.Trigger)) {
        game.shipThrusting = true;
      }

      if (game.shipThrusting) {
        game.lastThrustTime = game.gameTime;
        game.noThrustKills = 0;
        const thrust = new Vector3(
          -Math.sin(game.shipAngle) * SHIP_THRUST * dt,
          0,
          -Math.cos(game.shipAngle) * SHIP_THRUST * dt
        );
        game.shipVel.add(thrust);
      }

      // Fire
      game.fireTimer -= dt;
      const fireRate = game.rapidFire ? RAPID_FIRE_RATE : FIRE_RATE;
      const wantFire = kb.getKeyPressed('Space') ||
        right?.getButtonPressed(InputComponent.Trigger) ||
        kb.getKeyPressed('KeyJ');

      if (wantFire && game.fireTimer <= 0) {
        game.fireTimer = fireRate;
        const bulletPos = game.shipPos.clone().setY(1.5);

        if (game.spreadShot) {
          fireBullet(bulletPos, game.shipAngle, -SPREAD_ANGLE);
          fireBullet(bulletPos, game.shipAngle, 0);
          fireBullet(bulletPos, game.shipAngle, SPREAD_ANGLE);
        } else {
          fireBullet(bulletPos, game.shipAngle, 0);
        }
      }

      // Pause
      if (kb.getKeyDown('KeyP') || kb.getKeyDown('Escape') ||
        right?.getButtonDown(InputComponent.B_Button)) {
        game.state = 'pause';
      }
    }

    updateShip(dt: number) {
      if (!game.alive) return;

      // Apply drag
      game.shipVel.multiplyScalar(SHIP_DRAG);

      // Clamp speed
      const speed = game.shipVel.length();
      if (speed > SHIP_MAX_SPEED) {
        game.shipVel.multiplyScalar(SHIP_MAX_SPEED / speed);
      }

      // Move
      game.shipPos.add(game.shipVel.clone().multiplyScalar(dt));

      // Wrap
      wrapPosition(game.shipPos);

      // Update mesh
      shipGroup.position.set(game.shipPos.x, 1.5, game.shipPos.z);
      shipGroup.rotation.y = game.shipAngle;
    }

    updateBullets(dt: number) {
      for (const b of bullets) {
        if (!b.active) continue;
        b.life -= dt;
        if (b.life <= 0) {
          b.active = false;
          b.mesh.visible = false;
          continue;
        }

        // Homing behavior: gently curve toward nearest asteroid
        if (b.piercing === false && game.homingShot) {
          let closestDist = 15;
          let closestPos: Vector3 | null = null;
          for (const ast of asteroids) {
            if (!ast.active) continue;
            const d = b.mesh.position.distanceTo(ast.mesh.position);
            if (d < closestDist) {
              closestDist = d;
              closestPos = ast.mesh.position;
            }
          }
          if (closestPos) {
            const toTarget = closestPos.clone().sub(b.mesh.position).normalize();
            b.velocity.lerp(toTarget.multiplyScalar(BULLET_SPEED), 0.05);
          }
        }

        b.mesh.position.add(b.velocity.clone().multiplyScalar(dt));

        // Wrap bullets
        const pos = b.mesh.position;
        const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        if (dist > ARENA_RADIUS) {
          b.active = false;
          b.mesh.visible = false;
        }
      }
    }

    updateAsteroids(dt: number) {
      for (const ast of asteroids) {
        if (!ast.active) continue;

        ast.mesh.position.add(ast.velocity.clone().multiplyScalar(dt));
        ast.mesh.rotation.x += ast.rotSpeed.x * dt;
        ast.mesh.rotation.y += ast.rotSpeed.y * dt;
        ast.mesh.rotation.z += ast.rotSpeed.z * dt;

        // Boss ring animation
        if (ast.size === 'boss') {
          const ring = ast.mesh.getObjectByName('boss-ring');
          if (ring) ring.rotation.z += dt * 2;
          const ring2 = ast.mesh.getObjectByName('boss-ring2');
          if (ring2) ring2.rotation.y += dt * 1.5;

          // Boss pulsing glow (HP-based)
          const hpRatio = ast.hp / ast.maxHp;
          ast.mesh.children.forEach(child => {
            if (child instanceof Mesh && child.name !== 'boss-ring' && child.name !== 'boss-ring2') {
              const mat = child.material as MeshStandardMaterial | MeshBasicMaterial;
              if ('emissive' in mat) {
                mat.emissive.setHex(hpRatio > 0.5 ? 0xff2200 : hpRatio > 0.25 ? 0xff6600 : 0xffaa00);
                mat.emissiveIntensity = 0.3 + (1 - hpRatio) * 0.5;
              }
            }
          });
        }

        // Wrap
        wrapPosition(ast.mesh.position);

        // Keep at play height
        ast.mesh.position.y = 1.5;
      }
    }

    updateParticles(dt: number) {
      for (const p of particles) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          world.scene.remove(p.mesh);
          continue;
        }
        p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
        p.velocity.multiplyScalar(0.96);
        const alpha = p.life / p.maxLife;
        if (p.mesh instanceof Mesh) {
          (p.mesh.material as MeshBasicMaterial).opacity = alpha;
        }
        p.mesh.scale.setScalar(alpha);
      }
    }

    updatePowerUps(dt: number, time: number) {
      for (const pu of powerups) {
        if (!pu.active) continue;
        pu.life -= dt;
        if (pu.life <= 0) {
          world.scene.remove(pu.mesh);
          pu.active = false;
          continue;
        }
        // Bob and spin
        pu.bobPhase += dt * 3;
        pu.mesh.position.y = 1.5 + Math.sin(pu.bobPhase) * 0.2;
        pu.mesh.rotation.y += dt * 2;

        // Flash when about to expire
        if (pu.life < 3) {
          pu.mesh.visible = Math.floor(pu.life * 4) % 2 === 0;
        }
      }
    }

    checkCollisions() {
      if (!game.alive || game.respawnTimer > 0) return;

      const shipR = 0.35;
      const shipY = 1.5;

      // Bullet-asteroid
      for (const b of bullets) {
        if (!b.active) continue;
        for (const ast of asteroids) {
          if (!ast.active) continue;
          const dist = b.mesh.position.distanceTo(ast.mesh.position);
          if (dist < ast.radius + 0.1) {
            game.totalHits++;
            ast.hp--;
            if (ast.hp <= 0) {
              destroyAsteroid(ast, b.mesh.position);
            } else {
              // Damage flash
              spawnExplosion(b.mesh.position.clone(), new Color(THEMES[game.currentTheme].bullet), 3);
            }
            if (!b.piercing) {
              b.active = false;
              b.mesh.visible = false;
            }
            break;
          }
        }
      }

      // Ship-asteroid
      for (const ast of asteroids) {
        if (!ast.active) continue;
        const dx = game.shipPos.x - ast.mesh.position.x;
        const dz = game.shipPos.z - ast.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < ast.radius + shipR) {
          handleShipHit();
          this.levelDamageTaken = true;
          break;
        }

        // Close call check
        if (dist < ast.radius + 0.5 && dist > ast.radius + shipR) {
          game.unlock('close_call');
        }
      }

      // Ship-powerup
      for (const pu of powerups) {
        if (!pu.active) continue;
        const dx = game.shipPos.x - pu.mesh.position.x;
        const dz = game.shipPos.z - pu.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.5) {
          collectPowerUp(pu);
        }
      }
    }

    updatePowerUpTimers(dt: number) {
      for (const [type, timer] of game.powerUpTimers) {
        const newTimer = timer - dt;
        if (newTimer <= 0) {
          game.powerUpTimers.delete(type);
          switch (type) {
            case 'rapid': game.rapidFire = false; break;
            case 'spread': game.spreadShot = false; break;
            case 'piercing': game.piercingShot = false; break;
            case 'shield': game.shieldActive = false; break;
            case 'slow': game.slowMotion = false; break;
            case 'homing': game.homingShot = false; break;
            case 'double': game.doubleScore = false; break;
          }
        } else {
          game.powerUpTimers.set(type, newTimer);
        }
      }
    }

    checkWaveComplete(dt: number) {
      const activeCount = asteroids.filter(a => a.active).length;

      if (activeCount === 0 && game.state === 'playing') {
        game.waveDelay += dt;

        if (game.waveDelay >= 1.5) {
          // Check accuracy achievement
          const levelShots = game.totalShots - this.levelShotsAtStart;
          const levelHits = game.totalHits - this.levelHitsAtStart;
          if (levelShots > 0 && levelHits >= levelShots) {
            game.unlock('no_miss_level');
          }
          if (!this.levelDamageTaken) {
            game.perfectLevels++;
            if (game.level >= 5) game.unlock('no_damage');
          }

          game.level++;
          if (game.level > game.bestLevel) game.bestLevel = game.level;
          game.waveDelay = 0;
          this.levelShotsAtStart = game.totalShots;
          this.levelHitsAtStart = game.totalHits;
          this.levelDamageTaken = false;
          game.toastQueue.push(`Level ${game.level}!`);
          game.checkAchievements();
          spawnWave();

          // Survival: continuously harder
          if (game.mode === 'survival' && game.level % 3 === 0) {
            game.toastQueue.push('Intensity rising!');
          }
        }
      } else {
        game.waveDelay = 0;
      }
    }
  }

  // Pause handling system
  class PauseSystem extends createSystem({}) {
    init() {}

    update(delta: number) {
      if (game.state !== 'pause' && game.state !== 'help' && game.state !== 'leaderboard' && game.state !== 'achievements' && game.state !== 'settings') return;

      const _input = this.input as unknown as FullInputManager;
      const kb = _input.keyboard;
      const right = _input.xr?.gamepads?.right;

      if (game.state === 'pause') {
        if (kb.getKeyDown('KeyP') || kb.getKeyDown('Escape') ||
          right?.getButtonDown(InputComponent.B_Button)) {
          game.state = 'playing';
        }
        if (kb.getKeyDown('KeyQ')) {
          game.state = 'title';
          clearArena();
        }
      }
    }
  }

  // Camera follow system
  class CameraFollowSystem extends createSystem({}) {
    init() {}

    update(delta: number) {
      if (game.state !== 'playing' && game.state !== 'countdown') return;

      // Position camera above and behind player (top-down-ish view)
      const camHeight = 12;
      const camDist = 8;
      const targetX = game.shipPos.x;
      const targetZ = game.shipPos.z;

      // Smooth follow
      const cam = this.camera;
      const lerpFactor = 1 - Math.pow(0.05, delta);

      cam.position.x += (targetX - cam.position.x) * lerpFactor;
      cam.position.y += (camHeight - cam.position.y) * lerpFactor;
      cam.position.z += (targetZ + camDist - cam.position.z) * lerpFactor;

      // Apply screen shake
      if (shakeState.intensity > 0.01) {
        cam.position.x += (Math.random() - 0.5) * shakeState.intensity;
        cam.position.y += (Math.random() - 0.5) * shakeState.intensity * 0.5;
        cam.position.z += (Math.random() - 0.5) * shakeState.intensity;
        shakeState.intensity *= shakeState.decay;
      } else {
        shakeState.intensity = 0;
      }

      cam.lookAt(targetX, 1.5, targetZ);
    }
  }

  // Environment animation system
  class EnvironmentSystem extends createSystem({}) {
    private time: number = 0;

    init() {}

    update(delta: number) {
      this.time += delta;

      // Animate star field - subtle twinkling
      if (starField) {
        starField.rotation.y += delta * 0.003;
        const positions = starField.geometry.attributes.position;
        // Twinkle a few stars per frame
        for (let i = 0; i < 5; i++) {
          const idx = Math.floor(Math.random() * 600);
          const scale = 0.95 + Math.random() * 0.1;
          positions.setX(idx, positions.getX(idx) * scale);
        }
        positions.needsUpdate = true;
      }

      // Arena boundary proximity warning
      if (game.state === 'playing' && game.alive) {
        const dist = Math.sqrt(game.shipPos.x * game.shipPos.x + game.shipPos.z * game.shipPos.z);
        const edgeDist = ARENA_RADIUS * 0.9 - dist;
        const dangerZone = 5; // Start warning within 5 units of edge

        if (edgeDist < dangerZone && edgeDist > 0) {
          const danger = 1 - (edgeDist / dangerZone);
          // Pulse the ship engine color to warn
          const engineMesh = shipGroup.getObjectByName('engine') as Mesh | undefined;
          if (engineMesh) {
            const pulse = Math.sin(this.time * 8) * 0.3 + 0.5;
            const eMat = engineMesh.material as MeshBasicMaterial;
            eMat.color.setRGB(1, 1 - danger * pulse, 1 - danger);
          }
        }
      }
    }
  }

  // Register systems
  world.registerSystem(GameUISystem);
  world.registerSystem(GameplaySystem);
  world.registerSystem(PauseSystem);
  world.registerSystem(CameraFollowSystem);
  world.registerSystem(EnvironmentSystem);

  // ============================================================
  // START GAME
  // ============================================================
  function startGame() {
    game.resetGame();
    game.state = 'countdown';
    clearArena();
    shipGroup.visible = true;
    shipGroup.position.set(0, 1.5, 0);
    game.sessionStart = Date.now();
  }

  function clearArena() {
    for (const ast of asteroids) {
      if (ast.active) {
        world.scene.remove(ast.mesh);
        ast.active = false;
      }
    }
    for (const b of bullets) {
      b.active = false;
      b.mesh.visible = false;
    }
    for (const p of particles) {
      if (p.active) {
        world.scene.remove(p.mesh);
        p.active = false;
      }
    }
    for (const pu of powerups) {
      if (pu.active) {
        world.scene.remove(pu.mesh);
        pu.active = false;
      }
    }
  }

  // Start at title
  game.state = 'title';
}

main();
