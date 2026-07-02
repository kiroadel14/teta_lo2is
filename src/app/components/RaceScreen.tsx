import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Pause, Play, ChevronRight } from 'lucide-react';
import { Level } from '../data/levels';
import { GasStationModal } from './GasStationModal';
import { ImageWithFallback } from './figma/ImageWithFallback';
import playerCarImg from './player-car.png';
import enemyCar1Img from './enemy-car-1.png'; // عدلنا الاسم هنا
import enemyCar2Img from './enemy-car-2.png';
import enemyCar3Img from './enemy-car-3.png';
import mainLoopSound from './main-loop.mp3';
import crashSound from './crash.mp3';
import fuelBonusSound from './fuel-bonus.mp3';
import winnerGameSound from './winner-game.mp3';
import gameOverSound from './game-over.mp3';
const ENEMY_CARS = [enemyCar1Img, enemyCar2Img, enemyCar3Img];

// ── Boat sprites for free-steering river mode ──────────────────────────────
const PLAYER_BOAT_L1 = '/teta_lo2is/images/river/placeholder_player_boat_level1.svg';
const PLAYER_BOAT_L4 = '/teta_lo2is/images/river/placeholder_player_boat_level4.svg';
const ENEMY_BOATS = [
  '/teta_lo2is/images/river/placeholder_enemy_boat_1.svg',
  '/teta_lo2is/images/river/placeholder_enemy_boat_2.svg',
  '/teta_lo2is/images/river/placeholder_enemy_boat_3.svg',
];

interface Obstacle {
  id: number;
  lane: number; // 0=left, 1=center, 2=right  — used in lane mode
  x: number;   // 0..1 continuous — used in free mode (derived from lane in lane mode)
  t: number; // 0=far, 1=very close
  color: string;
  colorDark: string;
  spriteIndex: number;
}

interface WakeParticle {
  id: number;
  x: number; // SVG viewBox units
  y: number;
  opacity: number;
  age: number;
}

interface RaceScreenProps {
  level: Level;
  onGameOver: (result: { won: boolean; score: number; stars: number }) => void;
  onBack: () => void;
}

const OBSTACLE_COLORS = [
  { color: '#3B82F6', dark: '#1D4ED8' },
  { color: '#8B5CF6', dark: '#6D28D9' },
  { color: '#22C55E', dark: '#15803D' },
  { color: '#EC4899', dark: '#BE185D' },
  { color: '#F59E0B', dark: '#B45309' },
];

function toArabicNumerals(n: number): string {
  return String(Math.round(n)).replace(/[0-9]/g, (d) => ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'][parseInt(d)]);
}

// ─────────────────────────────────────────────────────────────
//  ROAD GEOMETRY  (100×100 viewBox units)
//
//  Design goals matching the reference image:
//   • Road horizon sits at y=33, giving 33% sky — mountains visible
//   • Road is WIDE at bottom (full screen width), narrows to a clear
//     band at horizon (~12 units wide) — never a point
//   • True perspective: Y spacing compresses exponentially near horizon
//   • Crest strip above horizon shows road "going over the hill"
// ─────────────────────────────────────────────────────────────

const VP_X = 50;           // Vanishing point x (dead centre)
const HORIZON_Y = 33;     // Y of vanishing horizon line
const ROAD_BOTTOM = 100;   // Bottom of viewbox

// Road width at bottom and at horizon (in viewBox units from VP_X each side)
const ROAD_HALF_BOTTOM = 42;   // → road spans x=8..92 at viewer's feet
const ROAD_HALF_HORIZON = 6.5;  // → road spans x=43.5..56.5 at horizon  (clearly visible!)

// Lane divider inner edges (bottom x, mirrored around VP_X)
// 3 lanes → 4 edges.  Outer edges = road edges.
const LANE_OFFSETS_BOTTOM = [ROAD_HALF_BOTTOM, 28, 14, 0]; // distance from VP_X at bottom

// Lane centres at bottom (used for car placement)
const LANE_CENTERS_BOTTOM = [VP_X - 21, VP_X, VP_X + 21]; // left / centre / right

// Road continuation "crest" above the horizon — key illusion
const CREST_Y = HORIZON_Y - 5;
const CREST_HALF = ROAD_HALF_HORIZON * 0.55;  // narrower as it crests the hill

/**
 * True perspective projection.
 *
 * t=0 → at the horizon, t=1 → at the player's feet.
 *
 * We interpolate between horizonX and bottomX using a power curve
 * that compresses distances near the horizon (objects bunch up in
 * the distance, just like real life).  The horizon values are
 * guaranteed non-zero, so the road NEVER collapses to a point.
 */
function perspX(bottomOffset: number, t: number): number {
  // horizonOffset is the proportionally smaller value at the horizon
  const ratio = ROAD_HALF_HORIZON / ROAD_HALF_BOTTOM;
  const horizonOffset = bottomOffset * ratio;
  // Exponential easing: very compressed near t=0, expanding rapidly near t=1
  const ease = Math.pow(t, 0.65);
  return horizonOffset + (bottomOffset - horizonOffset) * ease;
}

// Road outer edges at any depth t
function roadLeftX(t: number) { return VP_X - perspX(ROAD_HALF_BOTTOM, t); }
function roadRightX(t: number) { return VP_X + perspX(ROAD_HALF_BOTTOM, t); }

function laneDiv1X(t: number) { return VP_X - perspX(LANE_OFFSETS_BOTTOM[2], t); }
function laneDiv2X(t: number) { return VP_X + perspX(LANE_OFFSETS_BOTTOM[2], t); }

// Y at depth t (non-linear: compressed near horizon)
function yAtT(t: number): number {
  // Quadratic compression so middle distance looks more natural
  return HORIZON_Y + (ROAD_BOTTOM - HORIZON_Y) * t;
}

// Lane center X at depth t
function laneXAtT(lane: number, t: number): number {
  const offBottom = Math.abs(LANE_CENTERS_BOTTOM[lane] - VP_X);
  const sign = Math.sign(LANE_CENTERS_BOTTOM[lane] - VP_X);
  return VP_X + sign * perspX(offBottom, t);
}

// Precomputed horizon road edges
const RHL = VP_X - ROAD_HALF_HORIZON;   // Road Horizon Left
const RHR = VP_X + ROAD_HALF_HORIZON;   // Road Horizon Right

// ── Free-mode: convert normalized x (0-1) to SVG X at depth t ──────────────
// x=0 → left bank edge, x=1 → right bank edge
function riverXAtT(normX: number, t: number): number {
  const leftEdge = VP_X - perspX(ROAD_HALF_BOTTOM, t);
  const rightEdge = VP_X + perspX(ROAD_HALF_BOTTOM, t);
  return leftEdge + normX * (rightEdge - leftEdge);
}

// Scrolling bollard positions (static x per side, animated y)
const BOLLARD_T_POSITIONS = [0.12, 0.22, 0.34, 0.48, 0.63, 0.79];

// ── Free-mode steering constants ─────────────────────────────────────────────
const STEER_ACCEL = 0.0016;  // velocity units per frame
const STEER_MAX = 0.028;   // max steering speed
const STEER_DAMP = 0.80;    // velocity multiplier per frame (damping)
// Collision proximity in normalized river units (0-1 scale)
const FREE_COLLISION_RADIUS = 0.13;

// ── Decoration data for river banks (static positions) ──────────────────────
// Each entry: { side: 'L'|'R', type, t, spreadFactor }
// spread = how far off the bank edge (in viewBox units) at the given t depth
const BANK_DECORATIONS = [
  // ── Level 1 (Creation) bank decorations — palm trees, huts, umbrellas ──
  // Left bank
  { side: 'L' as const, type: 'palm', t: 0.10, spread: 4 },
  { side: 'L' as const, type: 'hut', t: 0.22, spread: 5 },
  { side: 'L' as const, type: 'palm', t: 0.35, spread: 5 },
  { side: 'L' as const, type: 'umbrella', t: 0.50, spread: 4 },
  { side: 'L' as const, type: 'palm', t: 0.65, spread: 6 },
  { side: 'L' as const, type: 'hut', t: 0.78, spread: 6 },
  { side: 'L' as const, type: 'umbrella', t: 0.88, spread: 5 },
  // Right bank
  { side: 'R' as const, type: 'hut', t: 0.14, spread: 4 },
  { side: 'R' as const, type: 'palm', t: 0.28, spread: 5 },
  { side: 'R' as const, type: 'umbrella', t: 0.42, spread: 4 },
  { side: 'R' as const, type: 'palm', t: 0.57, spread: 6 },
  { side: 'R' as const, type: 'hut', t: 0.70, spread: 5 },
  { side: 'R' as const, type: 'palm', t: 0.83, spread: 6 },
];

export function RaceScreen({ level, onGameOver, onBack }: RaceScreenProps) {
  const isFreeMode = level.movementMode === 'free';

  const [fuel, setFuel] = useState(100);
  const [score, setScore] = useState(0);
  // Lane mode state
  const [playerLane, setPlayerLane] = useState(1);
  // Free mode state — playerX is normalized 0-1
  const [playerX, setPlayerX] = useState(0.5);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [wakeParticles, setWakeParticles] = useState<WakeParticle[]>([]);
  const [paused, setPaused] = useState(false);
  const [showGasStation, setShowGasStation] = useState(false);
  const [gasStationVisited, setGasStationVisited] = useState(false);
  const [showCollision, setShowCollision] = useState(false);
  const [laneIndicator, setLaneIndicator] = useState<'left' | 'right' | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  const frameRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const distanceRef = useRef(0);
  const fuelRef = useRef(100);
  const scoreRef = useRef(0);
  const playerLaneRef = useRef(1);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const pausedRef = useRef(false);
  const gasStationVisitedRef = useRef(false);
  const showGasStationRef = useRef(false);
  const obstacleIdCounter = useRef(0);
  const spawnFrameCounter = useRef(0);
  const gameOverFiredRef = useRef(false);
  const collisionCooldownRef = useRef(0);

  // ── Free-mode specific refs ──────────────────────────────────────────────
  const playerXRef = useRef(0.5);   // normalized 0-1 across river width
  const playerVXRef = useRef(0);    // current X velocity
  const steerLeftRef = useRef(false);
  const steerRightRef = useRef(false);
  const touchXRef = useRef<number | null>(null);  // live touch X position
  const wakeParticlesRef = useRef<WakeParticle[]>([]);
  const wakeIdCounter = useRef(0);

  const TARGET_DURATION_SECONDS = 90;
  const DISTANCE_SPEED = level.survivalTargetDistance / TARGET_DURATION_SECONDS;
  const FUEL_DRAIN_PER_SECOND = 100 / (TARGET_DURATION_SECONDS * 1.15);

  // ── مراجع الأصوات ──
  const mainLoopRef = useRef<HTMLAudioElement | null>(null);
  const crashRef = useRef<HTMLAudioElement | null>(null);
  const fuelBonusRef = useRef<HTMLAudioElement | null>(null);
  const winnerRef = useRef<HTMLAudioElement | null>(null);
  const gameOverRef = useRef<HTMLAudioElement | null>(null);

  // ── تشغيل وتجهيز الأصوات ──
  useEffect(() => {
    mainLoopRef.current = new Audio(mainLoopSound);
    mainLoopRef.current.loop = true; // عشان يفضل شغال طول السباق
    mainLoopRef.current.volume = 0.3; // نوطي الصوت شوية عشان الإزعاج

    crashRef.current = new Audio(crashSound);
    fuelBonusRef.current = new Audio(fuelBonusSound);
    winnerRef.current = new Audio(winnerGameSound);
    gameOverRef.current = new Audio(gameOverSound);

    mainLoopRef.current.play().catch(() => { });

    return () => {
      mainLoopRef.current?.pause(); // نقفل الصوت لو طلعنا من السباق
    };
  }, []);

  // ── إيقاف وتشغيل الصوت مع الـ Pause ──
  useEffect(() => {
    if (paused || showGasStation) {
      mainLoopRef.current?.pause();
    } else {
      mainLoopRef.current?.play().catch(() => { });
    }
  }, [paused, showGasStation]);
  // Sync refs with state
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { playerLaneRef.current = playerLane; }, [playerLane]);

  // ── LANE MODE: discrete move functions ────────────────────────────────────
  const moveLeft = useCallback(() => {
    setPlayerLane((l) => {
      const next = Math.max(0, l - 1);
      playerLaneRef.current = next;
      setLaneIndicator('right'); // RTL: left button = move right visually
      setTimeout(() => setLaneIndicator(null), 300);
      return next;
    });
  }, []);

  const moveRight = useCallback(() => {
    setPlayerLane((l) => {
      const next = Math.min(2, l + 1);
      playerLaneRef.current = next;
      setLaneIndicator('left');
      setTimeout(() => setLaneIndicator(null), 300);
      return next;
    });
  }, []);

  // ── Keyboard controls ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isFreeMode) {
      // Free mode: hold-to-steer (keydown sets ref, keyup clears it)
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') steerRightRef.current = true;   // RTL: left key = move right on screen
        if (e.key === 'ArrowLeft') steerLeftRef.current = true;
        if (e.key === 'Escape' || e.key === ' ') setPaused((p) => !p);
      };
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') steerRightRef.current = false;
        if (e.key === 'ArrowLeft') steerLeftRef.current = false;
      };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    } else {
      // Lane mode: original discrete handler
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') moveLeft();
        if (e.key === 'ArrowRight') moveRight();
        if (e.key === 'Escape' || e.key === ' ') setPaused((p) => !p);
      };
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }
  }, [isFreeMode, moveLeft, moveRight]);

  // ── Touch controls ────────────────────────────────────────────────────────
  const touchStartX = useRef<number | null>(null);

  // Lane mode touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    if (isFreeMode) {
      touchXRef.current = e.touches[0].clientX;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isFreeMode) {
      touchXRef.current = e.touches[0].clientX;
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isFreeMode) {
      touchXRef.current = null;
      steerLeftRef.current = false;
      steerRightRef.current = false;
      return;
    }
    // Lane mode: swipe detection
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 30) {
      if (dx < 0) moveLeft();
      else moveRight();
    }
    touchStartX.current = null;
  };

  // ── Free-mode: update steer refs from live touch position ─────────────────
  // This runs inside the game loop so no extra effect needed.

  // Main game loop
  useEffect(() => {
    let animId: number;

    const loop = () => {
      if (!pausedRef.current && !showGasStationRef.current && !gameOverFiredRef.current) {
        const now = performance.now();
        const deltaSeconds = Math.min(0.05, (now - lastTimeRef.current) / 1000);
        lastTimeRef.current = now;

        const distanceProgress = distanceRef.current / level.survivalTargetDistance;

        // Keep a visible score UI updated even while Gas Station modal is open.
        if (showGasStationRef.current) {
          setScore(scoreRef.current);
        }

        // ── Shared: frame-rate independent progression ─────────────────────
        distanceRef.current += DISTANCE_SPEED * deltaSeconds;
        scoreRef.current = Math.floor(distanceRef.current);
        fuelRef.current = Math.max(0, fuelRef.current - (FUEL_DRAIN_PER_SECOND * deltaSeconds));

        // Road/river scroll animation
        setScrollOffset((s) => (s + level.obstacleSpeed * deltaSeconds * 6000) % 10);

        // 👈 السطر ده اللي كان ناقص عشان العداد يشتغل!
        spawnFrameCounter.current += deltaSeconds * 60;

        // ── FREE MODE: steering physics ────────────────────────────────────
        if (isFreeMode) {
          // Update steer flags from live touch position
          if (touchXRef.current !== null) {
            const screenMid = window.innerWidth / 2;
            // RTL: touch on left half of screen → steer right (move boat right visually = increase x)
            steerLeftRef.current = touchXRef.current > screenMid;
            steerRightRef.current = touchXRef.current < screenMid;
          }

          // Apply acceleration
          if (steerLeftRef.current) playerVXRef.current -= STEER_ACCEL;
          if (steerRightRef.current) playerVXRef.current += STEER_ACCEL;

          // Clamp velocity
          playerVXRef.current = Math.max(-STEER_MAX, Math.min(STEER_MAX, playerVXRef.current));

          // Apply damping
          playerVXRef.current *= STEER_DAMP;

          // Advance position
          playerXRef.current = Math.max(0.05, Math.min(0.95, playerXRef.current + playerVXRef.current));

          // ── Wake particles ─────────────────────────────────────────────
          // Emit 2 particles behind the player each frame
          const px = riverXAtT(playerXRef.current, 1.0);
          const py = yAtT(1.0) - 2; // just behind/above the boat bottom
          const p1: WakeParticle = { id: wakeIdCounter.current++, x: px - 1.2, y: py, opacity: 0.7, age: 0 };
          const p2: WakeParticle = { id: wakeIdCounter.current++, x: px + 1.2, y: py, opacity: 0.7, age: 0 };
          wakeParticlesRef.current = [
            ...wakeParticlesRef.current.map((p) => ({ ...p, age: p.age + 1, opacity: Math.max(0, 0.7 - p.age * 0.045) }))
              .filter((p) => p.opacity > 0.02),
            p1, p2,
          ].slice(-30); // cap at 30 particles
        }

        // ── Spawn obstacles ────────────────────────────────────────────────
        if (spawnFrameCounter.current >= level.spawnRate) {
          spawnFrameCounter.current -= level.spawnRate;

          const spriteIndex = Math.floor(Math.random() * ENEMY_CARS.length);

          let lane: number;
          let x: number;
          if (isFreeMode) {
            // Continuous random position across river width
            x = Math.random() * 0.82 + 0.09;
            lane = 1; // unused in free mode, but kept for interface compat
          } else {
            lane = Math.floor(Math.random() * 3);
            // Derive continuous x from lane center so collision math is unified
            x = (LANE_CENTERS_BOTTOM[lane] - (VP_X - ROAD_HALF_BOTTOM)) / (ROAD_HALF_BOTTOM * 2);
          }

          const newObs: Obstacle = {
            id: obstacleIdCounter.current++,
            lane,
            x,
            t: 0.05,
            color: '#000', // لون وهمي عشان الـ interface
            colorDark: '#000', // لون وهمي عشان الـ interface
            spriteIndex,
          };
          obstaclesRef.current = [...obstaclesRef.current, newObs];
        }

        // Move obstacles
        obstaclesRef.current = obstaclesRef.current
          .map((obs) => ({ ...obs, t: obs.t + (level.obstacleSpeed * deltaSeconds * 60) }))
          .filter((obs) => obs.t < 1.15);

        // ── Collision detection ────────────────────────────────────────────
        if (collisionCooldownRef.current > 0) {
          collisionCooldownRef.current -= deltaSeconds * 60;
        } else {
          let hitting: Obstacle | undefined;

          if (isFreeMode) {
            // Proximity check in normalized x space
            hitting = obstaclesRef.current.find(
              (obs) => Math.abs(obs.x - playerXRef.current) < FREE_COLLISION_RADIUS
                && obs.t > 0.88 && obs.t < 1.05
            );
          } else {
            hitting = obstaclesRef.current.find(
              (obs) => obs.lane === playerLaneRef.current && obs.t > 0.88 && obs.t < 1.05
            );
          }

          if (hitting) {
            // 👇 السطر الجديد اللي ضفناه عشان يشغل صوت الخبطة
            crashRef.current?.play().catch(() => { });
            collisionCooldownRef.current = 90;
            fuelRef.current = Math.max(0, fuelRef.current - 20);
            setShowCollision(true);
            setTimeout(() => setShowCollision(false), 600);
          }
        }

        // ── Gas station trigger (mid-race + low fuel) ──────────────────────
        if (!gasStationVisitedRef.current && distanceProgress >= 0.45 && fuelRef.current <= 50) {
          gasStationVisitedRef.current = true;
          showGasStationRef.current = true;
          setGasStationVisited(true);
          setShowGasStation(true);
        }

        // ── Game over: fuel empty (before finish) ─────────────────────────
        if (fuelRef.current <= 0 && !gameOverFiredRef.current) {
          gameOverFiredRef.current = true;
          // 👇 ده السطر بتاع صوت الخسارة
          gameOverRef.current?.play().catch(() => { });
          const finalScore = scoreRef.current;
          const stars = finalScore >= level.survivalTargetDistance ? 3 : finalScore >= level.survivalTargetDistance * 0.6 ? 2 : finalScore >= level.survivalTargetDistance * 0.3 ? 1 : 0;
          onGameOver({ won: false, score: finalScore, stars });
          return;
        }

        // ── Win: full distance completed AND still have fuel ───────────────
        if (distanceRef.current >= level.survivalTargetDistance && fuelRef.current > 0 && !gameOverFiredRef.current) {
          gameOverFiredRef.current = true;
          // 👇 السطر ده هيشغل صوت الفوز والاحتفال
          winnerRef.current?.play().catch(() => { });
          const finalScore = scoreRef.current;
          const stars = fuelRef.current >= 60 ? 3 : fuelRef.current >= 30 ? 2 : 1;
          onGameOver({ won: true, score: finalScore, stars });
          return;
        }

        // ── Sync to React state for render ────────────────────────────────
        setFuel(fuelRef.current);
        setScore(scoreRef.current);
        setObstacles([...obstaclesRef.current]);
        if (isFreeMode) {
          setPlayerX(playerXRef.current);
          setWakeParticles([...wakeParticlesRef.current]);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [level, onGameOver, isFreeMode]);

  const handleGasStationComplete = (correctCount: number) => {
    const fuelBonus = correctCount * 25;
    fuelRef.current = Math.min(100, fuelRef.current + fuelBonus);
    setFuel(fuelRef.current);
    showGasStationRef.current = false;
    setShowGasStation(false);
  };

  // Fuel state
  const fuelState: 'critical' | 'low' | 'normal' =
    fuel < 5 ? 'critical' : fuel < 25 ? 'low' : 'normal';

  const fuelBarColor =
    fuelState === 'critical' ? '#EF4444' :
      fuelState === 'low' ? '#F59E0B' : '#22C55E';

  // Clouds positions (static for now)
  const clouds = [
    { x: 12, y: 8, w: 14, h: 6 },
    { x: 35, y: 5, w: 18, h: 7 },
    { x: 65, y: 9, w: 12, h: 5 },
    { x: 82, y: 6, w: 16, h: 6 },
  ];

  // ── Determine which player boat image to use ──────────────────────────────
  const playerBoatSrc = level.id === 'level_4' ? PLAYER_BOAT_L4 : PLAYER_BOAT_L1;
  const isNoahLevel = level.id === 'level_4';

  return (
    <div
      dir="rtl"
      className="relative w-full h-full overflow-hidden select-none"
      style={{ fontFamily: "'Cairo', sans-serif" }}
      onTouchStart={handleTouchStart}
      onTouchMove={isFreeMode ? handleTouchMove : undefined}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── GAME SCENE (SVG) ── */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        style={{ display: 'block' }}
      >
        <defs>
          {/* ── SKY gradient ── */}
          {isFreeMode ? (
            isNoahLevel ? (
              /* Noah's Ark level: stormy dark sky */
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1A2540" />
                <stop offset="40%" stopColor="#2C3E5A" />
                <stop offset="75%" stopColor="#4A6070" />
                <stop offset="100%" stopColor="#7A9BAA" />
              </linearGradient>
            ) : (
              /* Level 1: warm sunny sky */
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1565C0" />
                <stop offset="35%" stopColor="#1E88E5" />
                <stop offset="70%" stopColor="#64B5F6" />
                <stop offset="100%" stopColor="#B3E5FC" />
              </linearGradient>
            )
          ) : (
            /* Lane mode: original sky */
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1A5BB5" />
              <stop offset="40%" stopColor="#3D8EE8" />
              <stop offset="75%" stopColor="#79C0F5" />
              <stop offset="100%" stopColor="#C5E8FF" />
            </linearGradient>
          )}

          {/* ── ROAD: dark asphalt (lane mode only) ── */}
          <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9B9590" />
            <stop offset="18%" stopColor="#777270" />
            <stop offset="100%" stopColor="#3E3C3A" />
          </linearGradient>

          {/* ── Road crest continuation above horizon ── */}
          <linearGradient id="roadCrest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B5B0AB" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#9B9590" stopOpacity="1.0" />
          </linearGradient>

          {/* ── Grass ground (lane mode) ── */}
          <linearGradient id="grassGround" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3EC95A" />
            <stop offset="100%" stopColor="#1A7A30" />
          </linearGradient>

          {/* ── River water surface (free mode) ── */}
          {isFreeMode && (
            isNoahLevel ? (
              <linearGradient id="riverWater" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1C4430" />
                <stop offset="50%" stopColor="#0D3328" />
                <stop offset="100%" stopColor="#071A14" />
              </linearGradient>
            ) : (
              <linearGradient id="riverWater" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1565C0" />
                <stop offset="50%" stopColor="#0D47A1" />
                <stop offset="100%" stopColor="#0A2E6C" />
              </linearGradient>
            )
          )}

          {/* ── Sandy bank gradient (free mode) ── */}
          {isFreeMode && (
            isNoahLevel ? (
              <linearGradient id="sandBank" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7A6040" />
                <stop offset="100%" stopColor="#4A3020" />
              </linearGradient>
            ) : (
              <linearGradient id="sandBank" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8C97A" />
                <stop offset="100%" stopColor="#C8963A" />
              </linearGradient>
            )
          )}

          {/* ── Horizon mist over road ── */}
          <linearGradient id="roadMist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#AEDCFF" stopOpacity="0.50" />
            <stop offset="35%" stopColor="#AEDCFF" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#AEDCFF" stopOpacity="0.0" />
          </linearGradient>

          {/* ── Verge grass darkening towards road ── */}
          <linearGradient id="verge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#52D96B" />
            <stop offset="100%" stopColor="#1E8C34" />
          </linearGradient>

          {/* ── Vignette for fuel warning ── */}
          <radialGradient id="redVignette" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="transparent" />
            <stop offset="100%" stopColor={fuelState !== 'normal' ? '#EF4444' : 'transparent'}
              stopOpacity={fuelState === 'critical' ? 0.4 : 0.2} />
          </radialGradient>

          {/* ── Bottom vignette (adds ground shadow, frames scene) ── */}
          <linearGradient id="bottomVignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="70%" stopColor="black" stopOpacity="0" />
            <stop offset="100%" stopColor="black" stopOpacity="0.35" />
          </linearGradient>

          {/* ── Clip so road doesn't draw above horizon ── */}
          <clipPath id="belowHorizon">
            <rect x="0" y={HORIZON_Y} width="100" height={ROAD_BOTTOM} />
          </clipPath>
          <clipPath id="aboveHorizon">
            <rect x="0" y="0" width="100" height={HORIZON_Y} />
          </clipPath>
        </defs>

        {/* ════════════════════════════════════════════════════
            LAYER 1 — SKY
        ════════════════════════════════════════════════════ */}
        <rect width="100" height="100" fill="url(#sky)" />

        {/* ════════════════════════════════════════════════════
            LAYER 2 — DISTANT MOUNTAINS
        ════════════════════════════════════════════════════ */}

        {/* Layer A: farthest, most desaturated blue-grey */}
        <polygon points={`2,${HORIZON_Y} 12,${HORIZON_Y - 14} 22,${HORIZON_Y}`} fill={isFreeMode ? "#8B7050" : "#7B8EC5"} opacity="0.45" />
        <polygon points={`10,${HORIZON_Y} 22,${HORIZON_Y - 18} 34,${HORIZON_Y}`} fill={isFreeMode ? "#7A6040" : "#6E82BE"} opacity="0.45" />
        <polygon points={`30,${HORIZON_Y} 42,${HORIZON_Y - 20} 56,${HORIZON_Y}`} fill={isFreeMode ? "#8B7050" : "#6878B8"} opacity="0.50" />
        <polygon points={`44,${HORIZON_Y} 50,${HORIZON_Y - 15} 58,${HORIZON_Y}`} fill={isFreeMode ? "#7A6848" : "#7080C0"} opacity="0.42" />
        <polygon points={`54,${HORIZON_Y} 65,${HORIZON_Y - 22} 78,${HORIZON_Y}`} fill={isFreeMode ? "#8B7050" : "#6575B8"} opacity="0.50" />
        <polygon points={`68,${HORIZON_Y} 80,${HORIZON_Y - 17} 92,${HORIZON_Y}`} fill={isFreeMode ? "#7A6040" : "#7082BE"} opacity="0.45" />
        <polygon points={`80,${HORIZON_Y} 90,${HORIZON_Y - 13} 100,${HORIZON_Y}`} fill={isFreeMode ? "#8B7050" : "#7A8EC5"} opacity="0.42" />

        {/* Layer B: mid range */}
        <polygon points={`-2,${HORIZON_Y} 10,${HORIZON_Y - 11} 20,${HORIZON_Y}`} fill={isFreeMode ? "#6B4E30" : "#5E7A5E"} opacity="0.72" />
        <polygon points={`14,${HORIZON_Y} 26,${HORIZON_Y - 15} 38,${HORIZON_Y}`} fill={isFreeMode ? "#5A3E22" : "#507050"} opacity="0.72" />
        <polygon points={`35,${HORIZON_Y} 44,${HORIZON_Y - 11} 52,${HORIZON_Y}`} fill={isFreeMode ? "#4A3018" : "#4E6E4E"} opacity="0.72" />
        <polygon points={`60,${HORIZON_Y} 72,${HORIZON_Y - 14} 84,${HORIZON_Y}`} fill={isFreeMode ? "#5A3E22" : "#507050"} opacity="0.72" />
        <polygon points={`78,${HORIZON_Y} 88,${HORIZON_Y - 10} 100,${HORIZON_Y}`} fill={isFreeMode ? "#6B4E30" : "#5E7A5E"} opacity="0.70" />

        {/* Snow/rock caps on tallest peaks */}
        <polygon points={`14,${HORIZON_Y - 15} 17,${HORIZON_Y - 18.5} 20,${HORIZON_Y - 15}`} fill={isFreeMode ? "#D4B890" : "white"} opacity="0.6" />
        <polygon points={`40,${HORIZON_Y - 17} 44,${HORIZON_Y - 21} 48,${HORIZON_Y - 17}`} fill={isFreeMode ? "#D4B890" : "white"} opacity="0.6" />
        <polygon points={`62,${HORIZON_Y - 19} 65,${HORIZON_Y - 23} 68,${HORIZON_Y - 19}`} fill={isFreeMode ? "#D4B890" : "white"} opacity="0.6" />

        {/* ═══════════════════════════════════════
            FREE MODE: GROUND — Sandy canyon banks + river
            LANE MODE: GROUND — Grass hills
        ═══════════════════════════════════════ */}

        {isFreeMode ? (
          <>
            {/* ── LAYER 3 (free): Sandy ground base fills the bottom area ── */}
            <rect x="0" y={HORIZON_Y} width="100" height={ROAD_BOTTOM - HORIZON_Y + 5} fill="url(#sandBank)" />

            {/* ── LAYER 4 (free): Storm clouds for Noah's Ark level ── */}
            {isNoahLevel && (
              <>
                <ellipse cx="15" cy={HORIZON_Y - 4} rx="12" ry="5" fill="#3A4A5A" opacity="0.9" />
                <ellipse cx="10" cy={HORIZON_Y - 6} rx="8" ry="4" fill="#4A5A6A" opacity="0.8" />
                <ellipse cx="20" cy={HORIZON_Y - 7} rx="7" ry="3.5" fill="#4A5A6A" opacity="0.8" />
                <ellipse cx="45" cy={HORIZON_Y - 5} rx="14" ry="6" fill="#3A4A5A" opacity="0.85" />
                <ellipse cx="40" cy={HORIZON_Y - 8} rx="9" ry="4.5" fill="#4A5A6A" opacity="0.75" />
                <ellipse cx="52" cy={HORIZON_Y - 7} rx="8" ry="4" fill="#4A5A6A" opacity="0.75" />
                <ellipse cx="78" cy={HORIZON_Y - 4} rx="13" ry="5.5" fill="#3A4A5A" opacity="0.9" />
                <ellipse cx="72" cy={HORIZON_Y - 7} rx="8" ry="4" fill="#4A5A6A" opacity="0.8" />
                <ellipse cx="85" cy={HORIZON_Y - 6} rx="7" ry="3.5" fill="#4A5A6A" opacity="0.8" />
              </>
            )}

            {/* ── LAYER 5 (free): River water surface (central trapezoid) ── */}
            <polygon
              points={`${RHL},${HORIZON_Y} ${RHR},${HORIZON_Y} ${VP_X + ROAD_HALF_BOTTOM},${ROAD_BOTTOM} ${VP_X - ROAD_HALF_BOTTOM},${ROAD_BOTTOM}`}
              fill="url(#riverWater)"
            />

            {/* ── Water ripple lines (animated with scrollOffset) ── */}
            {[0.2, 0.35, 0.52, 0.68, 0.82].map((tRipple, ri) => {
              const tAnim = ((tRipple + scrollOffset * 0.004) % 0.9) + 0.08;
              const leftX = riverXAtT(0.1, tAnim);
              const rightX = riverXAtT(0.9, tAnim);
              const ry = yAtT(tAnim);
              const w = rightX - leftX;
              return (
                <ellipse
                  key={`rip${ri}`}
                  cx={(leftX + rightX) / 2}
                  cy={ry}
                  rx={w * 0.42}
                  ry={0.2 + tAnim * 0.3}
                  fill="none"
                  stroke={isNoahLevel ? "#2A6A48" : "#4FC3F7"}
                  strokeWidth={0.25 + tAnim * 0.2}
                  opacity={0.12 + tAnim * 0.18}
                />
              );
            })}

            {/* ── LAYER 6 (free): Foam edge lines along both banks ── */}
            {/* Left foam edge */}
            {[0.15, 0.25, 0.38, 0.52, 0.66, 0.80, 0.91].map((t, fi) => {
              const fx = roadLeftX(t);
              const fy = yAtT(t);
              const sc = 0.3 + t * 0.6;
              return (
                <g key={`lf${fi}`}>
                  <ellipse cx={fx + 0.6 * sc} cy={fy} rx={1.2 * sc} ry={0.35 * sc}
                    fill="white" opacity={0.45 + t * 0.3} />
                  <ellipse cx={fx + 1.8 * sc} cy={fy - 0.1 * sc} rx={0.8 * sc} ry={0.25 * sc}
                    fill="white" opacity={0.3 + t * 0.2} />
                </g>
              );
            })}
            {/* Right foam edge */}
            {[0.15, 0.25, 0.38, 0.52, 0.66, 0.80, 0.91].map((t, fi) => {
              const fx = roadRightX(t);
              const fy = yAtT(t);
              const sc = 0.3 + t * 0.6;
              return (
                <g key={`rf${fi}`}>
                  <ellipse cx={fx - 0.6 * sc} cy={fy} rx={1.2 * sc} ry={0.35 * sc}
                    fill="white" opacity={0.45 + t * 0.3} />
                  <ellipse cx={fx - 1.8 * sc} cy={fy - 0.1 * sc} rx={0.8 * sc} ry={0.25 * sc}
                    fill="white" opacity={0.3 + t * 0.2} />
                </g>
              );
            })}

            {/* ── LAYER 7 (free): Bank decorations ── */}
            {isNoahLevel ? (
              /* Noah level: rocky cliff banks + Ark silhouette on horizon */
              <>
                {/* Rocky cliff shapes left bank */}
                {[0.12, 0.30, 0.55, 0.78].map((t, ci) => {
                  const bx = roadLeftX(t);
                  const by = yAtT(t);
                  const sc = 0.4 + t * 1.2;
                  return (
                    <g key={`rc${ci}`}>
                      <polygon
                        points={`${bx - 1 * sc},${by} ${bx - 3.5 * sc},${by - 4 * sc} ${bx - 6 * sc},${by - 2.5 * sc} ${bx - 8 * sc},${by}`}
                        fill="#4A3020" opacity="0.85"
                      />
                      <polygon
                        points={`${bx - 0.5 * sc},${by} ${bx - 2.5 * sc},${by - 2.5 * sc} ${bx - 4.5 * sc},${by - 1.5 * sc} ${bx - 6 * sc},${by}`}
                        fill="#5A4030" opacity="0.7"
                      />
                    </g>
                  );
                })}
                {/* Rocky cliff shapes right bank */}
                {[0.18, 0.42, 0.65, 0.85].map((t, ci) => {
                  const bx = roadRightX(t);
                  const by = yAtT(t);
                  const sc = 0.4 + t * 1.2;
                  return (
                    <g key={`rcr${ci}`}>
                      <polygon
                        points={`${bx + 1 * sc},${by} ${bx + 3.5 * sc},${by - 4 * sc} ${bx + 6 * sc},${by - 2.5 * sc} ${bx + 8 * sc},${by}`}
                        fill="#4A3020" opacity="0.85"
                      />
                    </g>
                  );
                })}
                {/* Ark silhouette on horizon (far background) */}
                <g opacity="0.55">
                  {/* Ark hull */}
                  <rect x="38" y={HORIZON_Y - 3} width="24" height="3" rx="0.5" fill="#5A3010" />
                  {/* Ark cabin */}
                  <rect x="42" y={HORIZON_Y - 6} width="16" height="3" rx="0.5" fill="#6B3A10" />
                  {/* Ark roof */}
                  <polygon points={`40,${HORIZON_Y - 6} 60,${HORIZON_Y - 6} 50,${HORIZON_Y - 9}`} fill="#7B4010" />
                </g>
              </>
            ) : (
              /* Level 1: palm trees, beach huts, umbrellas */
              BANK_DECORATIONS.map(({ side, type, t, spread }, di) => {
                const bx = side === 'L' ? roadLeftX(t) : roadRightX(t);
                const by = yAtT(t);
                const sc = 0.25 + t * 1.0;
                const sign = side === 'L' ? -1 : 1;
                const tx = bx + sign * spread * (0.4 + t * 0.5) * sc;

                if (type === 'palm') {
                  return (
                    <g key={`dec${di}`} transform={`translate(${tx},${by})`}>
                      {/* Trunk */}
                      <rect x={-0.4 * sc} y={-8 * sc} width={0.8 * sc} height={8 * sc}
                        fill="#8B6914" rx={0.3 * sc} />
                      {/* Trunk curve */}
                      <path d={`M0,0 Q${1.5 * sc},${-4 * sc} 0,${-8 * sc}`}
                        stroke="#A07820" strokeWidth={0.6 * sc} fill="none" opacity="0.5" />
                      {/* Fronds */}
                      {[-50, -20, 10, 40, 70].map((angle, ai) => (
                        <g key={ai} transform={`translate(0,${-8 * sc}) rotate(${angle})`}>
                          <ellipse cx={0} cy={-2.5 * sc} rx={0.5 * sc} ry={2.5 * sc}
                            fill="#1B8A1B" />
                        </g>
                      ))}
                      {/* Coconuts */}
                      <circle cx={0} cy={-7.5 * sc} r={0.5 * sc} fill="#8B4513" opacity="0.7" />
                    </g>
                  );
                }
                if (type === 'hut') {
                  return (
                    <g key={`dec${di}`} transform={`translate(${tx},${by})`}>
                      {/* Hut walls */}
                      <rect x={-2.5 * sc} y={-4 * sc} width={5 * sc} height={4 * sc}
                        fill="#F4D03F" rx={0.4 * sc} />
                      {/* Roof */}
                      <polygon
                        points={`${-3.2 * sc},${-4 * sc} 0,${-7 * sc} ${3.2 * sc},${-4 * sc}`}
                        fill="#E74C3C"
                      />
                      {/* Door */}
                      <rect x={-0.8 * sc} y={-2.5 * sc} width={1.6 * sc} height={2.5 * sc}
                        fill="#8B4513" rx={0.2 * sc} />
                      {/* Window */}
                      <rect x={-2 * sc} y={-3.2 * sc} width={1.2 * sc} height={1.2 * sc}
                        fill="#87CEEB" rx={0.15 * sc} />
                    </g>
                  );
                }
                if (type === 'umbrella') {
                  return (
                    <g key={`dec${di}`} transform={`translate(${tx},${by})`}>
                      {/* Pole */}
                      <rect x={-0.2 * sc} y={-5 * sc} width={0.4 * sc} height={5 * sc}
                        fill="#8B7355" />
                      {/* Canopy */}
                      <ellipse cx={0} cy={-5 * sc} rx={3.5 * sc} ry={1.2 * sc}
                        fill="#E74C3C" />
                      <ellipse cx={0} cy={-5.4 * sc} rx={3 * sc} ry={0.9 * sc}
                        fill="#F39C12" opacity="0.6" />
                      {/* Stripes */}
                      {[-2, -1, 0, 1, 2].map((si) => (
                        <line key={si}
                          x1={si * 1.3 * sc} y1={-5 * sc}
                          x2={si * 1.3 * sc} y2={-5 * sc - 1.2 * sc}
                          stroke={si % 2 === 0 ? "#C0392B" : "#F39C12"}
                          strokeWidth={0.3 * sc} opacity="0.7" />
                      ))}
                    </g>
                  );
                }
                return null;
              })
            )}

            {/* ── LAYER 8 (free): Horizon atmospheric mist ── */}
            <polygon
              points={`${RHL},${HORIZON_Y} ${RHR},${HORIZON_Y} ${VP_X + ROAD_HALF_BOTTOM},${ROAD_BOTTOM} ${VP_X - ROAD_HALF_BOTTOM},${ROAD_BOTTOM}`}
              fill="url(#roadMist)"
              style={{ pointerEvents: 'none' }}
            />

            {/* ── LAYER 9 (free): Wake particles behind boats ── */}
            {wakeParticles.map((wp) => (
              <ellipse
                key={wp.id}
                cx={wp.x}
                cy={wp.y}
                rx={1.4}
                ry={0.45}
                fill="white"
                opacity={wp.opacity}
              />
            ))}

            {/* ── LAYER 10 (free): Normal clouds or Noah storm clouds ── */}
            {!isNoahLevel && clouds.map((c, i) => (
              <g key={i} opacity="0.92">
                <ellipse cx={c.x} cy={c.y + c.h * 0.2} rx={c.w * 0.48} ry={c.h * 0.38} fill="#D8EEFF" />
                <ellipse cx={c.x} cy={c.y} rx={c.w * 0.5} ry={c.h * 0.45} fill="white" />
                <ellipse cx={c.x - c.w * 0.2} cy={c.y - c.h * 0.1} rx={c.w * 0.3} ry={c.h * 0.38} fill="white" />
                <ellipse cx={c.x + c.w * 0.18} cy={c.y - c.h * 0.08} rx={c.w * 0.28} ry={c.h * 0.35} fill="white" />
                <ellipse cx={c.x + c.w * 0.05} cy={c.y - c.h * 0.22} rx={c.w * 0.2} ry={c.h * 0.28} fill="white" />
              </g>
            ))}

            {/* ── LAYER 11 (free): Enemy boats ── */}
            {obstacles.map((obs) => {
              const cx = riverXAtT(obs.x, obs.t);
              const cy = yAtT(obs.t);
              const s = obs.t * 6;
              if (s < 0.5) return null;
              const boatSrc = ENEMY_BOATS[obs.spriteIndex];
              return (
                <g key={obs.id} transform={`translate(${cx}, ${cy})`}>
                  {/* Wake behind enemy */}
                  <ellipse cx={-s * 0.6} cy={s * 0.15} rx={s * 0.7} ry={s * 0.2} fill="white" opacity="0.25" />
                  <ellipse cx={s * 0.6} cy={s * 0.15} rx={s * 0.7} ry={s * 0.2} fill="white" opacity="0.25" />
                  {/* Shadow */}
                  <ellipse cx="0" cy={s * 0.22} rx={s * 0.9} ry={s * 0.25} fill="black" opacity="0.3" />
                  <image
                    href={boatSrc}
                    x={-s * 1.1}
                    y={-s * 1.4}
                    width={s * 2.2}
                    height={s * 2.2}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </g>
              );
            })}

            {/* ── LAYER 12 (free): Player boat ── */}
            {(() => {
              const s = 8;
              const cy = 94;
              const svgX = riverXAtT(playerX, 1.0);
              // Tilt based on velocity
              const tilt = playerVXRef.current * 120; // degrees, small
              return (
                <motion.g
                  animate={{ x: svgX, y: cy }}
                  transition={{ type: 'tween', duration: 0.05, ease: 'linear' }}
                >
                  {/* Player wake */}
                  <ellipse cx={-s * 0.55} cy={s * 0.3} rx={s * 1.0} ry={s * 0.22} fill="white" opacity="0.35" />
                  <ellipse cx={s * 0.55} cy={s * 0.3} rx={s * 1.0} ry={s * 0.22} fill="white" opacity="0.35" />
                  {/* Boat shadow */}
                  <ellipse
                    cx="0"
                    cy={s * 0.08}
                    rx={s * 0.75}
                    ry={s * 0.18}
                    fill="black"
                    opacity="0.22"
                  />
                  <g transform={`rotate(${tilt})`}>
                    <image
                      href={playerBoatSrc}
                      x={-s * 0.95}
                      y={-s * 1.15}
                      width={s * 1.9}
                      height={s * 1.9}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </g>
                </motion.g>
              );
            })()}

          </>
        ) : (
          /* ════════════════════════════════════════════════════
              LANE MODE — original road scene, completely unchanged
          ════════════════════════════════════════════════════ */
          <>
            {/* ════ LAYER 3 — NEAR HILLS ════ */}
            <ellipse cx="5" cy={HORIZON_Y + 2} rx="14" ry="7" fill="#4DD866" />
            <ellipse cx="22" cy={HORIZON_Y + 1} rx="18" ry="8" fill="#45D060" />
            <ellipse cx="40" cy={HORIZON_Y + 2} rx="14" ry="6" fill="#50D868" />
            <ellipse cx="60" cy={HORIZON_Y + 2} rx="14" ry="6" fill="#50D868" />
            <ellipse cx="78" cy={HORIZON_Y + 1} rx="18" ry="8" fill="#45D060" />
            <ellipse cx="95" cy={HORIZON_Y + 2} rx="14" ry="7" fill="#4DD866" />
            <ellipse cx={VP_X} cy={HORIZON_Y + 2} rx="16" ry="6" fill="#4ADE80" />

            {/* ════ LAYER 4 — BACKGROUND TREE LINE ════ */}
            {[-2, 3, 8, 13, 17, 22].map((bx, i) => (
              <g key={`bfl${i}`}>
                <rect x={bx} y={HORIZON_Y - 4} width="1.2" height="4" fill="#2D5A2D" opacity="0.8" />
                <polygon points={`${bx + 0.6},${HORIZON_Y - 11} ${bx - 2},${HORIZON_Y - 4} ${bx + 3.2},${HORIZON_Y - 4}`}
                  fill="#2D5A2D" opacity="0.8" />
              </g>
            ))}
            {[78, 82, 87, 91, 96, 100].map((bx, i) => (
              <g key={`bfr${i}`}>
                <rect x={bx} y={HORIZON_Y - 4} width="1.2" height="4" fill="#2D5A2D" opacity="0.8" />
                <polygon points={`${bx + 0.6},${HORIZON_Y - 11} ${bx - 2},${HORIZON_Y - 4} ${bx + 3.2},${HORIZON_Y - 4}`}
                  fill="#2D5A2D" opacity="0.8" />
              </g>
            ))}

            {/* ════ LAYER 5 — GROUND & GRASS ════ */}
            <rect x="0" y={HORIZON_Y} width="100" height={ROAD_BOTTOM - HORIZON_Y + 5}
              fill="url(#grassGround)" />

            {/* ════ LAYER 6 — ROAD (crest + main trapezoid) ════ */}
            <polygon
              points={`${VP_X - CREST_HALF},${CREST_Y} ${VP_X + CREST_HALF},${CREST_Y} ${RHR},${HORIZON_Y} ${RHL},${HORIZON_Y}`}
              fill="url(#roadCrest)"
            />
            <line x1={VP_X - CREST_HALF} y1={CREST_Y} x2={RHL} y2={HORIZON_Y}
              stroke="white" strokeWidth="0.25" opacity="0.55" />
            <line x1={VP_X + CREST_HALF} y1={CREST_Y} x2={RHR} y2={HORIZON_Y}
              stroke="white" strokeWidth="0.25" opacity="0.55" />
            <polygon
              points={`${RHL},${HORIZON_Y} ${RHR},${HORIZON_Y} ${VP_X + ROAD_HALF_BOTTOM},${ROAD_BOTTOM} ${VP_X - ROAD_HALF_BOTTOM},${ROAD_BOTTOM}`}
              fill="url(#road)"
            />
            {/* Grass verge strips */}
            <polygon
              points={`${RHL - 3},${HORIZON_Y} ${RHL},${HORIZON_Y} ${VP_X - ROAD_HALF_BOTTOM},${ROAD_BOTTOM} ${VP_X - ROAD_HALF_BOTTOM - 10},${ROAD_BOTTOM}`}
              fill="url(#verge)"
            />
            <polygon
              points={`${RHR},${HORIZON_Y} ${RHR + 3},${HORIZON_Y} ${VP_X + ROAD_HALF_BOTTOM + 10},${ROAD_BOTTOM} ${VP_X + ROAD_HALF_BOTTOM},${ROAD_BOTTOM}`}
              fill="url(#verge)"
            />
            {/* White road edge lines */}
            <line x1={RHL} y1={HORIZON_Y} x2={VP_X - ROAD_HALF_BOTTOM} y2={ROAD_BOTTOM}
              stroke="white" strokeWidth="0.6" opacity="0.95" />
            <line x1={RHR} y1={HORIZON_Y} x2={VP_X + ROAD_HALF_BOTTOM} y2={ROAD_BOTTOM}
              stroke="white" strokeWidth="0.6" opacity="0.95" />

            {/* ════ LAYER 7 — LANE MARKINGS ════ */}
            {[laneDiv1X, laneDiv2X].map((divFn, di) => {
              const segments = 14;
              return Array.from({ length: segments }).map((_, seg) => {
                const tStart = ((seg / segments) + scrollOffset / 100) % 1;
                const tEnd = Math.min(tStart + 0.038, 0.99);
                if (tStart < 0.015 || tEnd >= 1) return null;
                const w = 0.12 + tStart * 0.5;
                const op = 0.45 + tStart * 0.5;
                return (
                  <line key={`ld${di}-${seg}`}
                    x1={divFn(tStart)} y1={yAtT(tStart)}
                    x2={divFn(tEnd)} y2={yAtT(tEnd)}
                    stroke="white" strokeWidth={w} opacity={op}
                  />
                );
              });
            })}

            {/* ════ LAYER 8 — ROADSIDE BOLLARDS ════ */}
            {BOLLARD_T_POSITIONS.map((tBase, bi) => {
              const t = ((tBase + scrollOffset * 0.008) % 0.92) + 0.06;
              if (t > 0.93) return null;
              const y = yAtT(t);
              const sc = 0.3 + t * 0.8;
              const lx = roadLeftX(t) - 1.2 * sc;
              const rx = roadRightX(t) + 1.2 * sc;
              return (
                <g key={`bol${bi}`} opacity={0.6 + t * 0.35}>
                  <rect x={lx - 0.3 * sc} y={y - 2.2 * sc} width={0.6 * sc} height={2.2 * sc} fill="white" rx={0.15 * sc} />
                  <rect x={lx - 0.35 * sc} y={y - 2.7 * sc} width={0.7 * sc} height={0.5 * sc} fill="#F97316" rx={0.1 * sc} />
                  <rect x={rx - 0.3 * sc} y={y - 2.2 * sc} width={0.6 * sc} height={2.2 * sc} fill="white" rx={0.15 * sc} />
                  <rect x={rx - 0.35 * sc} y={y - 2.7 * sc} width={0.7 * sc} height={0.5 * sc} fill="#F97316" rx={0.1 * sc} />
                </g>
              );
            })}

            {/* ════ LAYER 9 — ROADSIDE TREES ════ */}
            {[
              { t: 0.08, type: 'pine', spread: 5 },
              { t: 0.14, type: 'round', spread: 6 },
              { t: 0.21, type: 'pine', spread: 7 },
              { t: 0.29, type: 'round', spread: 8 },
              { t: 0.38, type: 'pine', spread: 9 },
              { t: 0.48, type: 'round', spread: 10 },
              { t: 0.58, type: 'pine', spread: 11 },
              { t: 0.68, type: 'round', spread: 12 },
              { t: 0.78, type: 'pine', spread: 13 },
              { t: 0.88, type: 'round', spread: 14 },
            ].map(({ t, type, spread }, i) => {
              const y = yAtT(t);
              const lx = roadLeftX(t);
              const sc = 0.18 + t * 1.6;
              const tx = lx - spread * (0.3 + t * 0.7);
              return (
                <g key={`lt${i}`} transform={`translate(${tx},${y}) scale(${sc})`}>
                  {type === 'pine' ? (
                    <>
                      <rect x="-0.5" y="-9" width="1" height="9" fill="#5D3A1A" />
                      <polygon points="0,-18 -3.5,-11 3.5,-11" fill="#1A4A1A" />
                      <polygon points="0,-14 -4.5,-8  4.5,-8" fill="#1E5A1E" />
                      <polygon points="0,-10 -5.5,-4  5.5,-4" fill="#236B23" />
                      <polygon points="0,-6  -6.5,-1  6.5,-1" fill="#267826" />
                    </>
                  ) : (
                    <>
                      <rect x="-0.6" y="-7" width="1.2" height="7" fill="#6B3A10" />
                      <ellipse cx="0" cy="-10" rx="5" ry="4.5" fill="#1A5C1A" />
                      <ellipse cx="-2.5" cy="-9" rx="3.5" ry="3" fill="#1E6B1E" />
                      <ellipse cx="2.5" cy="-9" rx="3.5" ry="3" fill="#1E6B1E" />
                      <ellipse cx="0" cy="-7.5" rx="4" ry="2.5" fill="#267826" />
                    </>
                  )}
                </g>
              );
            })}
            {[
              { t: 0.10, type: 'round', spread: 5 },
              { t: 0.17, type: 'pine', spread: 6 },
              { t: 0.25, type: 'round', spread: 7 },
              { t: 0.33, type: 'pine', spread: 8 },
              { t: 0.43, type: 'round', spread: 9 },
              { t: 0.53, type: 'pine', spread: 10 },
              { t: 0.63, type: 'round', spread: 11 },
              { t: 0.73, type: 'pine', spread: 12 },
              { t: 0.83, type: 'round', spread: 13 },
              { t: 0.93, type: 'pine', spread: 14 },
            ].map(({ t, type, spread }, i) => {
              const y = yAtT(t);
              const rx = roadRightX(t);
              const sc = 0.18 + t * 1.6;
              const tx = rx + spread * (0.3 + t * 0.7);
              return (
                <g key={`rt${i}`} transform={`translate(${tx},${y}) scale(${sc})`}>
                  {type === 'pine' ? (
                    <>
                      <rect x="-0.5" y="-9" width="1" height="9" fill="#5D3A1A" />
                      <polygon points="0,-18 -3.5,-11 3.5,-11" fill="#1A4A1A" />
                      <polygon points="0,-14 -4.5,-8  4.5,-8" fill="#1E5A1E" />
                      <polygon points="0,-10 -5.5,-4  5.5,-4" fill="#236B23" />
                      <polygon points="0,-6  -6.5,-1  6.5,-1" fill="#267826" />
                    </>
                  ) : (
                    <>
                      <rect x="-0.6" y="-7" width="1.2" height="7" fill="#6B3A10" />
                      <ellipse cx="0" cy="-10" rx="5" ry="4.5" fill="#1A5C1A" />
                      <ellipse cx="-2.5" cy="-9" rx="3.5" ry="3" fill="#1E6B1E" />
                      <ellipse cx="2.5" cy="-9" rx="3.5" ry="3" fill="#1E6B1E" />
                      <ellipse cx="0" cy="-7.5" rx="4" ry="2.5" fill="#267826" />
                    </>
                  )}
                </g>
              );
            })}

            {/* ════ LAYER 10 — HORIZON ATMOSPHERIC MIST ════ */}
            <polygon
              points={`${RHL},${HORIZON_Y} ${RHR},${HORIZON_Y} ${VP_X + ROAD_HALF_BOTTOM},${ROAD_BOTTOM} ${VP_X - ROAD_HALF_BOTTOM},${ROAD_BOTTOM}`}
              fill="url(#roadMist)"
              style={{ pointerEvents: 'none' }}
            />

            {/* ════ LAYER 11 — CLOUDS ════ */}
            {clouds.map((c, i) => (
              <g key={i} opacity="0.92">
                <ellipse cx={c.x} cy={c.y + c.h * 0.2} rx={c.w * 0.48} ry={c.h * 0.38} fill="#D8EEFF" />
                <ellipse cx={c.x} cy={c.y} rx={c.w * 0.5} ry={c.h * 0.45} fill="white" />
                <ellipse cx={c.x - c.w * 0.2} cy={c.y - c.h * 0.1} rx={c.w * 0.3} ry={c.h * 0.38} fill="white" />
                <ellipse cx={c.x + c.w * 0.18} cy={c.y - c.h * 0.08} rx={c.w * 0.28} ry={c.h * 0.35} fill="white" />
                <ellipse cx={c.x + c.w * 0.05} cy={c.y - c.h * 0.22} rx={c.w * 0.2} ry={c.h * 0.28} fill="white" />
              </g>
            ))}

            {/* ════ LAYER 12 — ENEMY CARS ════ */}
            {obstacles.map((obs) => {
              const cx = laneXAtT(obs.lane, obs.t);
              const cy = yAtT(obs.t);
              const s = obs.t * 6;
              if (s < 0.5) return null;
              const imgSrc = ENEMY_CARS[obs.spriteIndex];
              return (
                <g key={obs.id} transform={`translate(${cx}, ${cy})`}>
                  <ellipse cx="0" cy={s * 0.22} rx={s * 0.9} ry={s * 0.25} fill="black" opacity="0.45" />
                  <image
                    href={imgSrc}
                    x={-s * 1.1}
                    y={-s * 1.4}
                    width={s * 2.2}
                    height={s * 2.2}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </g>
              );
            })}

            {/* ════ LAYER 13 — PLAYER CAR ════ */}
            {(() => {
              const s = 8;
              const cy = 95;
              return (
                <motion.g
                  animate={{ x: laneXAtT(playerLane, 1.0), y: cy }}
                  transition={{ type: 'tween', duration: 0.15, ease: 'easeOut' }}
                >
                  <ellipse
                    cx="0"
                    cy={s * 0.05}
                    rx={s * 0.7}
                    ry={s * 0.15}
                    fill="black"
                    opacity="0.25"
                  />
                  <image
                    href={playerCarImg}
                    x={-s * 0.95}
                    y={-s * 1.15}
                    width={s * 1.9}
                    height={s * 1.9}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </motion.g>
              );
            })()}
          </>
        )}

        {/* Bottom scene vignette — grounds the scene (both modes) */}
        <rect width="100" height="100" fill="url(#bottomVignette)" style={{ pointerEvents: 'none' }} />

        {/* Red vignette for low/critical fuel */}
        {fuelState !== 'normal' && (
          <rect width="100" height="100" fill="url(#redVignette)" />
        )}

        {/* Collision flash */}
        {showCollision && (
          <rect width="100" height="100" fill="#EF4444" opacity="0.35" />
        )}
      </svg>

      {/* ── HUD OVERLAY ── */}
      <div className="absolute inset-0 pointer-events-none flex flex-col">
        {/* Top HUD bar */}
        <div className="flex items-center justify-between px-3 pt-2 gap-2">
          {/* Score */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-2xl shadow-lg"
            style={{
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              pointerEvents: 'none',
              minWidth: '5.5rem',
              justifyContent: 'center',
            }}
          >
            <span className="text-yellow-300" style={{ fontSize: '0.75rem' }}>⭐</span>
            <span
              className="text-white"
              style={{
                fontWeight: 900,
                fontSize: 'clamp(0.85rem, 2.5vw, 1.2rem)',
                fontFamily: "'Cairo', sans-serif",
                display: 'inline-block',
                minWidth: '3rem',
                textAlign: 'center',
              }}
            >
              {toArabicNumerals(score)}
            </span>
          </div>

          {/* Pause button (center) */}
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
            style={{
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              pointerEvents: 'all',
            }}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? (
              <Play size={16} className="text-white" fill="white" />
            ) : (
              <Pause size={16} className="text-white" />
            )}
          </button>

          {/* Fuel gauge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl shadow-lg"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', pointerEvents: 'none', minWidth: '30%' }}
          >
            <span
              style={{
                fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
                animation: fuelState === 'critical' ? 'pulse 0.5s infinite' : fuelState === 'low' ? 'pulse 1s infinite' : 'none',
              }}
            >
              ⛽
            </span>
            <div className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${fuel}%`,
                  backgroundColor: fuelBarColor,
                  boxShadow: fuelState !== 'normal' ? `0 0 6px ${fuelBarColor}` : 'none',
                }}
              />
            </div>
            <span
              className="text-white"
              style={{ fontSize: 'clamp(0.6rem, 1.5vw, 0.8rem)', fontWeight: 700, fontFamily: "'Cairo', sans-serif" }}
            >
              {toArabicNumerals(Math.round(fuel))}٪
            </span>
          </div>
        </div>

        {/* Position / Lane indicator */}
        {isFreeMode ? (
          /* Free mode: continuous position bar */
          <div className="flex justify-center mt-1 px-6" dir="ltr">
            <div className="relative w-20 h-2 bg-white/20 rounded-full overflow-visible">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-md transition-none"
                style={{
                  left: `calc(${playerX * 100}% - 6px)`,
                  backgroundColor: '#FCD34D',
                  boxShadow: '0 0 4px rgba(252,211,77,0.7)',
                }}
              />
            </div>
          </div>
        ) : (
          /* Lane mode: original 3 dots */
          <div className="flex justify-center mt-1 gap-2" dir="ltr">
            {[0, 1, 2].map((lane) => (
              <div
                key={lane}
                className="w-2.5 h-2.5 rounded-full transition-all duration-200 shadow"
                style={{
                  backgroundColor: lane === playerLane ? '#FCD34D' : 'rgba(255,255,255,0.35)',
                  transform: lane === playerLane ? 'scale(1.3)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        )}

        {/* Level progress bar */}
        <div className="px-3 mt-1">
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (score / level.survivalTargetDistance) * 100)}%`,
                background: 'linear-gradient(90deg, #22C55E, #FCD34D)',
              }}
            />
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* ── FREE MODE: Hold-to-steer zones ── */}
        {isFreeMode && (
          <div className="flex w-full" style={{ height: '22%', pointerEvents: 'all' }}>
            {/* Left steering zone → in RTL context, steer RIGHT (increase x) */}
            <button
              className="flex-1 flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.08)',
                borderTop: '1px solid rgba(255,255,255,0.12)',
                borderRight: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '1.8rem',
                userSelect: 'none',
                touchAction: 'none',
              }}
              onPointerDown={() => { steerRightRef.current = true; }}
              onPointerUp={() => { steerRightRef.current = false; }}
              onPointerLeave={() => { steerRightRef.current = false; }}
            >
              ◀
            </button>
            {/* Right steering zone → in RTL context, steer LEFT (decrease x) */}
            <button
              className="flex-1 flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.08)',
                borderTop: '1px solid rgba(255,255,255,0.12)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '1.8rem',
                userSelect: 'none',
                touchAction: 'none',
              }}
              onPointerDown={() => { steerLeftRef.current = true; }}
              onPointerUp={() => { steerLeftRef.current = false; }}
              onPointerLeave={() => { steerLeftRef.current = false; }}
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* ── PAUSE OVERLAY ── */}
      {paused && !showGasStation && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-40"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          dir="rtl"
        >
          <div className="text-6xl">⏸️</div>
          <h2 className="text-white" style={{ fontSize: 'clamp(1.2rem, 3vw, 1.8rem)', fontWeight: 900, fontFamily: "'Cairo', sans-serif" }}>
            اللعبة واقفة
          </h2>
          <button
            onClick={() => setPaused(false)}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #F97316, #EF4444)', color: 'white', fontWeight: 900, fontSize: '1rem', fontFamily: "'Cairo', sans-serif" }}
          >
            <Play size={20} fill="white" />
            <span>استمر</span>
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-2 rounded-2xl shadow-md transition-all hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 700, fontSize: '0.9rem', fontFamily: "'Cairo', sans-serif" }}
          >
            <ChevronRight size={18} />
            <span>رجوع للمستويات</span>
          </button>
        </div>
      )}

      {/* ── GAS STATION MODAL ── */}
      <AnimatePresence>
        {showGasStation && (
          <GasStationModal
            questions={level.questions}
            onComplete={handleGasStationComplete}
          />
        )}
      </AnimatePresence>

      {/* Low fuel warning */}
      {fuelState === 'low' && !showGasStation && !gasStationVisited && (
        <div
          className="absolute top-14 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full shadow-lg"
          style={{
            background: 'rgba(245, 158, 11, 0.95)',
            color: 'white',
            fontWeight: 900,
            fontSize: 'clamp(0.65rem, 1.5vw, 0.85rem)',
            fontFamily: "'Cairo', sans-serif",
            animation: 'pulse 1s infinite',
          }}
        >
          ⚠️ الوقود قليل! محطة الوقود جاية!
        </div>
      )}

      {fuelState === 'critical' && !showGasStation && (
        <div
          className="absolute top-14 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full shadow-lg"
          style={{
            background: 'rgba(239, 68, 68, 0.95)',
            color: 'white',
            fontWeight: 900,
            fontSize: 'clamp(0.65rem, 1.5vw, 0.85rem)',
            fontFamily: "'Cairo', sans-serif",
            animation: 'pulse 0.5s infinite',
          }}
        >
          🔴 الوقود خلص! بسرعة بسرعة!
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
