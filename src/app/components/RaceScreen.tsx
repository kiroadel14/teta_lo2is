import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Pause, Play, ChevronRight } from 'lucide-react';
import { Level } from '../data/levels';
import { GasStationModal } from './GasStationModal';
import playerCarImg from './player-car.png';
import enemyCar1Img from './enemy-car-1.png'; // عدلنا الاسم هنا
import enemyCar2Img from './enemy-car-2.png';
import enemyCar3Img from './enemy-car-3.png';
import mainLoopSound from './main-loop.mp3';
import crashSound from './crash.mp3';
import fuelBonusSound from './fuel-bonus.mp3';
import winnerGameSound from './winner-game.mp3';
import gameOverSound from './game-over.mp3';
const ENEMY_CARS = [enemyCar1Img, enemyCar2Img, enemyCar3Img];interface Obstacle {
  id: number;
  lane: number; // 0=left, 1=center, 2=right
  t: number; // 0=far, 1=very close
  color: string;
  colorDark: string;
  spriteIndex: number;
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

// Scrolling bollard positions (static x per side, animated y)
const BOLLARD_T_POSITIONS = [0.12, 0.22, 0.34, 0.48, 0.63, 0.79];

export function RaceScreen({ level, onGameOver, onBack }: RaceScreenProps) {
  const [fuel, setFuel] = useState(100);
  const [score, setScore] = useState(0);
  const [playerLane, setPlayerLane] = useState(1);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
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

    mainLoopRef.current.play().catch(() => {});

    return () => {
      mainLoopRef.current?.pause(); // نقفل الصوت لو طلعنا من السباق
    };
  }, []);

  // ── إيقاف وتشغيل الصوت مع الـ Pause ──
  useEffect(() => {
    if (paused || showGasStation) {
      mainLoopRef.current?.pause();
    } else {
      mainLoopRef.current?.play().catch(() => {});
    }
  }, [paused, showGasStation]);
  // Sync refs with state
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { playerLaneRef.current = playerLane; }, [playerLane]);

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

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') moveLeft();
      if (e.key === 'ArrowRight') moveRight();
      if (e.key === 'Escape' || e.key === ' ') setPaused((p) => !p);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [moveLeft, moveRight]);

  // Touch / swipe
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 30) {
      if (dx < 0) moveLeft();
      else moveRight();
    }
    touchStartX.current = null;
  };

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
        // Minimal change: prevents progress bar from freezing due to showGasStationRef gating.
        // (Do not alter fuel/score refs while modal is open.)
        if (showGasStationRef.current) {
          setScore(scoreRef.current);
        }



        // Frame-rate independent progression
        distanceRef.current += DISTANCE_SPEED * deltaSeconds;
        scoreRef.current = Math.floor(distanceRef.current);

        // Fuel drains by real elapsed time
        fuelRef.current = Math.max(0, fuelRef.current - (FUEL_DRAIN_PER_SECOND * deltaSeconds));

        // Road scroll animation
        setScrollOffset((s) => (s + level.obstacleSpeed * deltaSeconds * 6000) % 10);

        // 👈 السطر ده اللي كان ناقص عشان العداد يشتغل!
        spawnFrameCounter.current += deltaSeconds * 60;

        // Spawn obstacles
        if (spawnFrameCounter.current >= level.spawnRate) {
          spawnFrameCounter.current -= level.spawnRate;
          
          const lane = Math.floor(Math.random() * 3);
          // بيختار رقم عشوائي (0 أو 1 أو 2)
          const spriteIndex = Math.floor(Math.random() * ENEMY_CARS.length);

          const newObs: Obstacle = {
            id: obstacleIdCounter.current++,
            lane,
            t: 0.05,
            color: '#000', // لون وهمي عشان الـ interface
            colorDark: '#000', // لون وهمي عشان الـ interface
            spriteIndex   // بنحفظ الرقم هنا
          };
          obstaclesRef.current = [...obstaclesRef.current, newObs];
        }

        // Move obstacles
        obstaclesRef.current = obstaclesRef.current
          .map((obs) => ({ ...obs, t: obs.t + (level.obstacleSpeed * deltaSeconds * 60) }))
          .filter((obs) => obs.t < 1.15);

        // Collision detection
        if (collisionCooldownRef.current > 0) {
          collisionCooldownRef.current -= deltaSeconds * 60;
        } else {
          const hitting = obstaclesRef.current.find(
            (obs) => obs.lane === playerLaneRef.current && obs.t > 0.88 && obs.t < 1.05
          );
          if (hitting) {
            // 👇 السطر الجديد اللي ضفناه عشان يشغل صوت الخبطة
            crashRef.current?.play().catch(() => {}); 
            
            collisionCooldownRef.current = 90;
            fuelRef.current = Math.max(0, fuelRef.current - 20);
            setShowCollision(true);
            setTimeout(() => setShowCollision(false), 600);
          }
        }

        // Distance progress (use score as distance)
        // (distanceProgress already computed for debug logging above)


        // Gas station trigger (mid-race + low fuel)
        if (!gasStationVisitedRef.current && distanceProgress >= 0.45 && fuelRef.current <= 50) {
          gasStationVisitedRef.current = true;
          showGasStationRef.current = true;
          setGasStationVisited(true);
          setShowGasStation(true);
        }

        // Game over: fuel empty (before finish)
        if (fuelRef.current <= 0 && !gameOverFiredRef.current) {
          gameOverFiredRef.current = true;
          // 👇 ده السطر بتاع صوت الخسارة
          gameOverRef.current?.play().catch(() => {});
          const finalScore = scoreRef.current;
          const stars = finalScore >= level.survivalTargetDistance ? 3 : finalScore >= level.survivalTargetDistance * 0.6 ? 2 : finalScore >= level.survivalTargetDistance * 0.3 ? 1 : 0;
          onGameOver({ won: false, score: finalScore, stars });
          return;
        }

        // Win: full distance completed AND still have fuel
        if (distanceRef.current >= level.survivalTargetDistance && fuelRef.current > 0 && !gameOverFiredRef.current) {
          gameOverFiredRef.current = true;
          
          // 👇 السطر ده هيشغل صوت الفوز والاحتفال
          winnerRef.current?.play().catch(() => {}); 
          
          const finalScore = scoreRef.current;
          const stars = fuelRef.current >= 60 ? 3 : fuelRef.current >= 30 ? 2 : 1;
          onGameOver({ won: true, score: finalScore, stars });
          return;
        }


        setFuel(fuelRef.current);
        setScore(scoreRef.current);
        setObstacles([...obstaclesRef.current]);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [level, onGameOver]);

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

  return (
    <div
      dir="rtl"
      className="relative w-full h-full overflow-hidden select-none"
      style={{ fontFamily: "'Cairo', sans-serif", cursor: 'none' }}
      onTouchStart={handleTouchStart}
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
          {/* ── SKY gradient: deep blue → pale horizon haze ── */}
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A5BB5" />
            <stop offset="40%" stopColor="#3D8EE8" />
            <stop offset="75%" stopColor="#79C0F5" />
            <stop offset="100%" stopColor="#C5E8FF" />
          </linearGradient>

          {/* ── ROAD: dark asphalt at viewer, lighter/hazier at horizon ── */}
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

          {/* ── Grass ground ── */}
          <linearGradient id="grassGround" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3EC95A" />
            <stop offset="100%" stopColor="#1A7A30" />
          </linearGradient>

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
            LAYER 2 — DISTANT MOUNTAINS  (behind everything)
            Sharp rocky peaks, snow caps, atmospheric tint
        ════════════════════════════════════════════════════ */}

        {/* Layer A: farthest, most desaturated blue-grey */}
        <polygon points={`2,${HORIZON_Y} 12,${HORIZON_Y - 14} 22,${HORIZON_Y}`} fill="#7B8EC5" opacity="0.45" />
        <polygon points={`10,${HORIZON_Y} 22,${HORIZON_Y - 18} 34,${HORIZON_Y}`} fill="#6E82BE" opacity="0.45" />
        <polygon points={`30,${HORIZON_Y} 42,${HORIZON_Y - 20} 56,${HORIZON_Y}`} fill="#6878B8" opacity="0.50" />
        <polygon points={`44,${HORIZON_Y} 50,${HORIZON_Y - 15} 58,${HORIZON_Y}`} fill="#7080C0" opacity="0.42" />
        <polygon points={`54,${HORIZON_Y} 65,${HORIZON_Y - 22} 78,${HORIZON_Y}`} fill="#6575B8" opacity="0.50" />
        <polygon points={`68,${HORIZON_Y} 80,${HORIZON_Y - 17} 92,${HORIZON_Y}`} fill="#7082BE" opacity="0.45" />
        <polygon points={`80,${HORIZON_Y} 90,${HORIZON_Y - 13} 100,${HORIZON_Y}`} fill="#7A8EC5" opacity="0.42" />

        {/* Layer B: mid range, greener-grey, taller */}
        <polygon points={`-2,${HORIZON_Y} 10,${HORIZON_Y - 11} 20,${HORIZON_Y}`} fill="#5E7A5E" opacity="0.72" />
        <polygon points={`14,${HORIZON_Y} 26,${HORIZON_Y - 15} 38,${HORIZON_Y}`} fill="#507050" opacity="0.72" />
        <polygon points={`35,${HORIZON_Y} 44,${HORIZON_Y - 11} 52,${HORIZON_Y}`} fill="#4E6E4E" opacity="0.72" />
        <polygon points={`60,${HORIZON_Y} 72,${HORIZON_Y - 14} 84,${HORIZON_Y}`} fill="#507050" opacity="0.72" />
        <polygon points={`78,${HORIZON_Y} 88,${HORIZON_Y - 10} 100,${HORIZON_Y}`} fill="#5E7A5E" opacity="0.70" />

        {/* Snow caps on tallest peaks */}
        <polygon points={`14,${HORIZON_Y - 15} 17,${HORIZON_Y - 18.5} 20,${HORIZON_Y - 15}`} fill="white" opacity="0.6" />
        <polygon points={`40,${HORIZON_Y - 17} 44,${HORIZON_Y - 21} 48,${HORIZON_Y - 17}`} fill="white" opacity="0.6" />
        <polygon points={`62,${HORIZON_Y - 19} 65,${HORIZON_Y - 23} 68,${HORIZON_Y - 19}`} fill="white" opacity="0.6" />

        {/* ════════════════════════════════════════════════════
            LAYER 3 — NEAR HILLS  (rolling, bright green)
            These overlap the horizon and define the valley
        ════════════════════════════════════════════════════ */}
        <ellipse cx="5" cy={HORIZON_Y + 2} rx="14" ry="7" fill="#4DD866" />
        <ellipse cx="22" cy={HORIZON_Y + 1} rx="18" ry="8" fill="#45D060" />
        <ellipse cx="40" cy={HORIZON_Y + 2} rx="14" ry="6" fill="#50D868" />
        <ellipse cx="60" cy={HORIZON_Y + 2} rx="14" ry="6" fill="#50D868" />
        <ellipse cx="78" cy={HORIZON_Y + 1} rx="18" ry="8" fill="#45D060" />
        <ellipse cx="95" cy={HORIZON_Y + 2} rx="14" ry="7" fill="#4DD866" />
        {/* Central hill the road crests over */}
        <ellipse cx={VP_X} cy={HORIZON_Y + 2} rx="16" ry="6" fill="#4ADE80" />

        {/* ════════════════════════════════════════════════════
            LAYER 4 — BACKGROUND TREE LINE  (horizon forest)
            Dense silhouette just above horizon level
        ════════════════════════════════════════════════════ */}
        {/* Left forest wall */}
        {[-2, 3, 8, 13, 17, 22].map((bx, i) => (
          <g key={`bfl${i}`}>
            <rect x={bx} y={HORIZON_Y - 4} width="1.2" height="4" fill="#2D5A2D" opacity="0.8" />
            <polygon points={`${bx + 0.6},${HORIZON_Y - 11} ${bx - 2},${HORIZON_Y - 4} ${bx + 3.2},${HORIZON_Y - 4}`}
              fill="#2D5A2D" opacity="0.8" />
          </g>
        ))}
        {/* Right forest wall */}
        {[78, 82, 87, 91, 96, 100].map((bx, i) => (
          <g key={`bfr${i}`}>
            <rect x={bx} y={HORIZON_Y - 4} width="1.2" height="4" fill="#2D5A2D" opacity="0.8" />
            <polygon points={`${bx + 0.6},${HORIZON_Y - 11} ${bx - 2},${HORIZON_Y - 4} ${bx + 3.2},${HORIZON_Y - 4}`}
              fill="#2D5A2D" opacity="0.8" />
          </g>
        ))}

        {/* ════════════════════════════════════════════════════
            LAYER 5 — GROUND & GRASS VERGES
        ════════════════════════════════════════════════════ */}
        <rect x="0" y={HORIZON_Y} width="100" height={ROAD_BOTTOM - HORIZON_Y + 5}
          fill="url(#grassGround)" />

        {/* ════════════════════════════════════════════════════
            LAYER 6 — ROAD (crest + main trapezoid)
        ════════════════════════════════════════════════════ */}

        {/* Road crest — peeks above horizon so road appears to go over the hill */}
        <polygon
          points={`${VP_X - CREST_HALF},${CREST_Y} ${VP_X + CREST_HALF},${CREST_Y} ${RHR},${HORIZON_Y} ${RHL},${HORIZON_Y}`}
          fill="url(#roadCrest)"
        />
        {/* White edge lines on crest */}
        <line x1={VP_X - CREST_HALF} y1={CREST_Y} x2={RHL} y2={HORIZON_Y}
          stroke="white" strokeWidth="0.25" opacity="0.55" />
        <line x1={VP_X + CREST_HALF} y1={CREST_Y} x2={RHR} y2={HORIZON_Y}
          stroke="white" strokeWidth="0.25" opacity="0.55" />

        {/* Main road trapezoid */}
        <polygon
          points={`${RHL},${HORIZON_Y} ${RHR},${HORIZON_Y} ${VP_X + ROAD_HALF_BOTTOM},${ROAD_BOTTOM} ${VP_X - ROAD_HALF_BOTTOM},${ROAD_BOTTOM}`}
          fill="url(#road)"
        />

        {/* Grass verge strips — narrow coloured shoulders between road and trees */}
        {/* Left verge */}
        <polygon
          points={`${RHL - 3},${HORIZON_Y} ${RHL},${HORIZON_Y} ${VP_X - ROAD_HALF_BOTTOM},${ROAD_BOTTOM} ${VP_X - ROAD_HALF_BOTTOM - 10},${ROAD_BOTTOM}`}
          fill="url(#verge)"
        />
        {/* Right verge */}
        <polygon
          points={`${RHR},${HORIZON_Y} ${RHR + 3},${HORIZON_Y} ${VP_X + ROAD_HALF_BOTTOM + 10},${ROAD_BOTTOM} ${VP_X + ROAD_HALF_BOTTOM},${ROAD_BOTTOM}`}
          fill="url(#verge)"
        />

        {/* White road edge lines */}
        <line x1={RHL} y1={HORIZON_Y} x2={VP_X - ROAD_HALF_BOTTOM} y2={ROAD_BOTTOM}
          stroke="white" strokeWidth="0.6" opacity="0.95" />
        <line x1={RHR} y1={HORIZON_Y} x2={VP_X + ROAD_HALF_BOTTOM} y2={ROAD_BOTTOM}
          stroke="white" strokeWidth="0.6" opacity="0.95" />

        {/* ════════════════════════════════════════════════════
            LAYER 7 — LANE MARKINGS
            3 bold dashed white lines, perspective-scaled
        ════════════════════════════════════════════════════ */}
        {[laneDiv1X, laneDiv2X].map((divFn, di) => {
          const segments = 14;
          return Array.from({ length: segments }).map((_, seg) => {
            const tStart = ((seg / segments) + scrollOffset / 100) % 1;
            const tEnd = Math.min(tStart + 0.038, 0.99);
            if (tStart < 0.015 || tEnd >= 1) return null;
            // Perspective-scaled width and opacity
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

        {/* ════════════════════════════════════════════════════
            LAYER 8 — ROADSIDE BOLLARDS  (animated scroll)
            White posts with orange reflector, appear on both kerbs
        ════════════════════════════════════════════════════ */}
        {BOLLARD_T_POSITIONS.map((tBase, bi) => {
          const t = ((tBase + scrollOffset * 0.008) % 0.92) + 0.06;
          if (t > 0.93) return null;
          const y = yAtT(t);
          const sc = 0.3 + t * 0.8;   // scale with depth
          const lx = roadLeftX(t) - 1.2 * sc;
          const rx = roadRightX(t) + 1.2 * sc;
          return (
            <g key={`bol${bi}`} opacity={0.6 + t * 0.35}>
              {/* Left bollard */}
              <rect x={lx - 0.3 * sc} y={y - 2.2 * sc} width={0.6 * sc} height={2.2 * sc} fill="white" rx={0.15 * sc} />
              <rect x={lx - 0.35 * sc} y={y - 2.7 * sc} width={0.7 * sc} height={0.5 * sc} fill="#F97316" rx={0.1 * sc} />
              {/* Right bollard */}
              <rect x={rx - 0.3 * sc} y={y - 2.2 * sc} width={0.6 * sc} height={2.2 * sc} fill="white" rx={0.15 * sc} />
              <rect x={rx - 0.35 * sc} y={y - 2.7 * sc} width={0.7 * sc} height={0.5 * sc} fill="#F97316" rx={0.1 * sc} />
            </g>
          );
        })}

        {/* ════════════════════════════════════════════════════
            LAYER 9 — ROADSIDE TREES  (depth-sorted, dense)
            Left bank: mix of pine + round deciduous
            Right bank: same, offset so they interleave
            Trees get bigger + more spread out near viewer
        ════════════════════════════════════════════════════ */}

        {/* Helper render functions defined inline as arrays */}
        {/* LEFT TREES — 10 trees */}
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
                // Dark conifer — tall triangle with layered tiers
                <>
                  <rect x="-0.5" y="-9" width="1" height="9" fill="#5D3A1A" />
                  <polygon points="0,-18 -3.5,-11 3.5,-11" fill="#1A4A1A" />
                  <polygon points="0,-14 -4.5,-8  4.5,-8" fill="#1E5A1E" />
                  <polygon points="0,-10 -5.5,-4  5.5,-4" fill="#236B23" />
                  <polygon points="0,-6  -6.5,-1  6.5,-1" fill="#267826" />
                </>
              ) : (
                // Round deciduous — trunk + layered canopy
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

        {/* RIGHT TREES — 10 trees (offset depths for interleave) */}
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

        {/* ════════════════════════════════════════════════════
            LAYER 10 — HORIZON ATMOSPHERIC MIST
            Softens road/sky join, adds depth
        ════════════════════════════════════════════════════ */}
        <polygon
          points={`${RHL},${HORIZON_Y} ${RHR},${HORIZON_Y} ${VP_X + ROAD_HALF_BOTTOM},${ROAD_BOTTOM} ${VP_X - ROAD_HALF_BOTTOM},${ROAD_BOTTOM}`}
          fill="url(#roadMist)"
          style={{ pointerEvents: 'none' }}
        />

        {/* ════════════════════════════════════════════════════
            LAYER 11 — CLOUDS  (layered, volumetric)
        ════════════════════════════════════════════════════ */}
        {clouds.map((c, i) => (
          <g key={i} opacity="0.92">
            {/* Shadow base */}
            <ellipse cx={c.x} cy={c.y + c.h * 0.2} rx={c.w * 0.48} ry={c.h * 0.38} fill="#D8EEFF" />
            {/* Main body */}
            <ellipse cx={c.x} cy={c.y} rx={c.w * 0.5} ry={c.h * 0.45} fill="white" />
            {/* Puffs */}
            <ellipse cx={c.x - c.w * 0.2} cy={c.y - c.h * 0.1} rx={c.w * 0.3} ry={c.h * 0.38} fill="white" />
            <ellipse cx={c.x + c.w * 0.18} cy={c.y - c.h * 0.08} rx={c.w * 0.28} ry={c.h * 0.35} fill="white" />
            <ellipse cx={c.x + c.w * 0.05} cy={c.y - c.h * 0.22} rx={c.w * 0.2} ry={c.h * 0.28} fill="white" />
          </g>
        ))}

        {/* Bottom scene vignette — grounds the scene */}
        <rect width="100" height="100" fill="url(#bottomVignette)" style={{ pointerEvents: 'none' }} />

        {/* Obstacle cars */}
        {/* Enemy cars */}
        {obstacles.map((obs) => {
          const cx = laneXAtT(obs.lane, obs.t);
          const cy = yAtT(obs.t);
          // 👈 التعديل هنا: كبرنا معامل الحجم الأساسي من 5 لـ 5.5 عشان تزيد حجم العربية "حاجه بسيطه اوي"
          const s = obs.t * 6; // car size
          if (s < 0.5) return null;

          const imgSrc = ENEMY_CARS[obs.spriteIndex];

          return (
            <g key={obs.id} transform={`translate(${cx}, ${cy})`}>
              {/* ظل أرضي متناسق مع الحجم الجديد، قربناه حاجة بسيطة كمان (cy={s * 0.22}) */}
              <ellipse cx="0" cy={s * 0.22} rx={s * 0.9} ry={s * 0.25} fill="black" opacity="0.45" />
             
              {/* التوسيط والابعاد تعتمد على s الجديد، فتكبر العربيه */}
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
        {/* Player car — motion.g animates x smoothly between lanes */}
        {(() => {
          const s = 8; // size — ~28% of road width, visible at bottom
          const cy = 95; // slightly above bottom edge so top 65% is visible
          return (
            <motion.g
              animate={{ x: laneXAtT(playerLane, 1.0), y: cy }}
              transition={{ type: 'tween', duration: 0.15, ease: 'easeOut' }}
            >
              {/* ── التعديل هنا: ظل أنعم، أصغر، وأقرب للعربية عشان تلمس الأرض ── */}
              <ellipse
                cx="0"
                cy={s * 0.05}     // 👈 قللنا المسافة جداً (كانت 0.15) عشان الظل يلزق تحت العجل فوراً
                rx={s * 0.7}      // 👈 صغرنا عرض الظل (كان 0.85)
                ry={s * 0.15}     // 👈 قللنا سمك الظل (كان 0.22) عشان يبان مسطح على الأرض
                fill="black"
                opacity="0.25"     // 👈 خففنا درجة اللون (كانت 0.4) عشان تبان ناعمة وواقعية على شاشة الموبايل
              />
              {/* صورة عربية اللاعب (كما هي بدون تغيير في الأبعاد) */}
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
          {/* Score — fixed-size box, only the number changes inside */}
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

          {/* Fuel gauge (top-right in RTL = left side visually) */}
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

       {/* Lane indicators */}
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