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
import coinSound from './coin.mp3';
import playerPlaneImg from './player-plane.png';
import greaseImg from './grease.png';
import playerboatImg from './player-boat.png';
import sharkImg from './shark.png';
import rockImg from './rock.png';
import orbitImg from './orbit.png';
import whirlpoolImg from './whirlpool.png';
// ... (imports) ...
//import whirlpoolImg from './whirlpool.png'; // 👈 استيراد صورة الدوامة الجديدة
// 👈 مصفوفة ليفل 1 (جذع شجرة ودوامة)
const logImg = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect x='15' y='30' width='70' height='40' rx='8' fill='%238B4513'/%3E%3Cline x1='25' y1='40' x2='75' y2='40' stroke='%235C2E0B' stroke-width='3'/%3E%3Cline x1='20' y1='50' x2='80' y2='50' stroke='%235C2E0B' stroke-width='3'/%3E%3Cline x1='30' y1='60' x2='70' y2='60' stroke='%235C2E0B' stroke-width='3'/%3E%3Cellipse cx='15' cy='50' rx='6' ry='20' fill='%23CD853F'/%3E%3C/svg%3E";
// المصفوفة العادية لليفل 2
const ENEMY_CARS = [enemyCar1Img, enemyCar2Img, enemyCar3Img];
const LEVEL_5_ENEMIES = [enemyCar1Img, enemyCar2Img, enemyCar3Img, greaseImg];

// ── Boat sprites for free-steering river mode ──────────────────────────────
const PLAYER_BOAT_L1 = playerboatImg;
const PLAYER_BOAT_L4 = orbitImg;

// 👇 التعديل هيكون في السطرين دول بس 👇
const LEVEL_1_ENEMIES = [logImg, whirlpoolImg];

// 👈 مصفوفة ليفل 1 (جذع شجرة فقط)

// 👈 مصفوفة ليفل 4 (صخور فقط)
const LEVEL_4_ENEMIES = [rockImg];

// ── Flappy mode sprites ──────────────────────────────────────────────────
const FLAPPY_AIRPLANE = playerPlaneImg;
const PIPE_TOP = '/teta_lo2is/images/flappy/placeholder_pipe_top.svg';
const PIPE_BOTTOM = '/teta_lo2is/images/flappy/placeholder_pipe_bottom.svg';
const FLAPPY_SKY = '/teta_lo2is/images/flappy/placeholder_sky_background.svg';
const FLAPPY_SKYLINE = '/teta_lo2is/images/flappy/placeholder_city_skyline_silhouette.svg';
const FLAPPY_CLOUDS = '/teta_lo2is/images/flappy/placeholder_cloud_band.svg';
const FLAPPY_GROUND = '/teta_lo2is/images/flappy/placeholder_ground_strip.svg';

interface Obstacle {
  id: number;
  lane: number; // 0=left, 1=center, 2=right  — used in lane mode
  x: number;   // 0..1 continuous — used in free mode (derived from lane in lane mode)
  t: number; // 0=far, 1=very close
  color: string;
  colorDark: string;
  spriteIndex: number;
  gapY?: number; // 0..100 vertical center of pipe gap (used in flappy mode)
}

interface Coin {
  id: number;
  lane: number;
  x: number;
  t: number;
  gapY?: number;
}

interface WakeParticle {
  id: number;
  x: number; // SVG viewBox units
  y: number;
  opacity: number;
  age: number;
}

interface FuelPenaltyFeedback {
  id: number;
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

// ── ROAD GEOMETRY  (100×100 viewBox units) ──
const VP_X = 50;
const HORIZON_Y = 33;
const ROAD_BOTTOM = 100;

// التعديلات الجديدة عشان نعرض الطريق ونظبط المسافات مع الزوم
// Road width at bottom and at horizon (in viewBox units from VP_X each side)
const ROAD_HALF_BOTTOM = 44;   // 👈 عرضنا النهر جداً من تحت
const ROAD_HALF_HORIZON = 8;   // 👈 وعرضناه من عند الأفق

// Lane divider inner edges (bottom x, mirrored around VP_X)
// 3 lanes → 4 edges.  Outer edges = road edges.
const LANE_OFFSETS_BOTTOM = [ROAD_HALF_BOTTOM, 29, 14.5, 0];

// Lane centres at bottom (used for car placement)
const LANE_CENTERS_BOTTOM = [VP_X - 29, VP_X, VP_X + 29];

const CREST_Y = HORIZON_Y - 5;
const CREST_HALF = ROAD_HALF_HORIZON * 0.55;

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
  const ratio = ROAD_HALF_HORIZON / ROAD_HALF_BOTTOM;
  const horizonOffset = bottomOffset * ratio;
  
  // 👇 لغينا الانحناء (Math.pow) اللي كان بيخلي العوائق تحدف لبره
  // وبكده كل العوائق هتنزل في خط مستقيم 100% متوافق مع ضفاف النهر
  return horizonOffset + (bottomOffset - horizonOffset) * t;
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
const COIN_VALUE = 10;
const COIN_SPAWN_RATE = 110;
const COIN_SPRITE_SRC = '/teta_lo2is/images/common/placeholder_coin.png';
const LANE_COIN_SAFE_T_WINDOW = 0.58;
const FREE_COIN_SAFE_T_WINDOW = 0.52;
const FREE_COIN_SAFE_X_MARGIN = 0.30;
const FLAPPY_COIN_SAFE_GAP_MARGIN = 8;

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

const BANK_DECOR_VARIANTS = [
  { offset: -0.28, y: 0.10, scale: 0.92, rotate: -3 },
  { offset: 0.18, y: -0.04, scale: 1.06, rotate: 2 },
  { offset: -0.08, y: 0.14, scale: 0.98, rotate: -1 },
  { offset: 0.34, y: -0.08, scale: 1.12, rotate: 3 },
  { offset: -0.20, y: 0.05, scale: 1.03, rotate: -2 },
  { offset: 0.10, y: 0.12, scale: 0.95, rotate: 1 },
];

const WATER_SPARKLES = [
  { x: 0.34, t: 0.18, rx: 1.6, ry: 0.42, phase: 0.1, opacity: 0.70 },
  { x: 0.62, t: 0.24, rx: 2.0, ry: 0.48, phase: 1.8, opacity: 0.78 },
  { x: 0.48, t: 0.36, rx: 2.3, ry: 0.52, phase: 2.5, opacity: 0.56 },
  { x: 0.71, t: 0.46, rx: 1.9, ry: 0.46, phase: 4.2, opacity: 0.72 },
  { x: 0.29, t: 0.58, rx: 2.5, ry: 0.58, phase: 3.4, opacity: 0.50 },
  { x: 0.57, t: 0.68, rx: 2.2, ry: 0.52, phase: 5.0, opacity: 0.60 },
  { x: 0.76, t: 0.78, rx: 1.7, ry: 0.44, phase: 2.9, opacity: 0.70 },
  { x: 0.42, t: 0.88, rx: 2.8, ry: 0.62, phase: 0.8, opacity: 0.48 },
];

function shorelinePath(side: 'L' | 'R', inset: number): string {
  const samples = [0, 0.18, 0.36, 0.54, 0.72, 0.9, 1];

  // 1. جلب إحداثيات النقطة اللي تحت خالص (أسفل الشاشة)
  const bottomT = 0; // بافتراض إن 0 هي بداية الشاشة من تحت
  const bottomX = side === 'L'
    ? roadLeftX(bottomT) + inset
    : roadRightX(bottomT) - inset;
  const bottomY = yAtT(bottomT);

  // 2. جلب إحداثيات النقطة اللي فوق خالص (عند خط الأفق)
  const topT = 1; // بافتراض إن 1 هي أبعد نقطة في الأفق
  const topX = side === 'L'
    ? roadLeftX(topT) + inset
    : roadRightX(topT) - inset;
  const topY = yAtT(topT);

  return samples.map((t, i) => {
    // نجيب ارتفاع الـ Y عند النقطة الحالية
    const y = yAtT(t);

    // 3. (السر هنا) معادلة الخط المستقيم: 
    // بنحسب نسبة الـ y الحالية بالنسبة للمسافة الكلية، وبناءً عليها بنستنتج الـ x 
    // عشان نضمن إن كل النقاط تقع على خط مستقيم واحد بدون أي كسرات
    const progress = (y - bottomY) / (topY - bottomY);
    const x = bottomX + progress * (topX - bottomX);

    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

interface SeamlessAudio {
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  paused: boolean;
}

interface SfxPlayer {
  playCrash: () => void;
  playCoin: () => void;
  setMuted: (muted: boolean) => void;
  stopAll: () => void;
}

export function RaceScreen({ level, onGameOver, onBack }: RaceScreenProps) {
  const isFreeMode = level.movementMode === 'free';
  const isFlappyMode = level.movementMode === 'flappy';

  const [fuel, setFuel] = useState(100);
  const [score, setScore] = useState(0);
  // Lane mode state
  const [playerLane, setPlayerLane] = useState(1);
  // Free mode state — playerX is normalized 0-1
  const [playerX, setPlayerX] = useState(0.5);
  // Flappy mode state
  const [playerY, setPlayerY] = useState(50);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [wakeParticles, setWakeParticles] = useState<WakeParticle[]>([]);
  const [paused, setPaused] = useState(false);
  const [showGasStation, setShowGasStation] = useState(false);
  const [gasStationVisited, setGasStationVisited] = useState(false);
  const [showGasStationWarning, setShowGasStationWarning] = useState(false);
  const [showCollision, setShowCollision] = useState(false);
  const [fuelPenaltyFeedbacks, setFuelPenaltyFeedbacks] = useState<FuelPenaltyFeedback[]>([]);
  const [laneIndicator, setLaneIndicator] = useState<'left' | 'right' | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
const [waveTimer, setWaveTimer] = useState(0); // 👈 السطر الجديد
  const frameRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const distanceRef = useRef(0);
  const fuelRef = useRef(100);
  const scoreRef = useRef(0);
  const playerLaneRef = useRef(1);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const coinsCollectedRef = useRef(0);
  const pausedRef = useRef(false);
  const gasStationVisitedRef = useRef(false);
  const showGasStationRef = useRef(false);
  const showGasStationWarningRef = useRef(false);
  const obstacleIdCounter = useRef(0);
  const spawnFrameCounter = useRef(0);
  const coinIdCounter = useRef(0);
  const coinSpawnFrameCounter = useRef(0);
  const gameOverFiredRef = useRef(false);
  const collisionCooldownRef = useRef(0);
  const fuelPenaltyFeedbackIdRef = useRef(0);
  const fuelPenaltyTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Free-mode specific refs ──────────────────────────────────────────────
  const playerXRef = useRef(0.5);   // normalized 0-1 across river width
  const playerVXRef = useRef(0);    // current X velocity
  const steerLeftRef = useRef(false);
  const steerRightRef = useRef(false);
  const boatWaveRef = useRef(0);    // horizontal sway for level 4 boat
  const boatBounceRef = useRef(0);  // vertical bob during a wave impact
  const boatRollRef = useRef(0);    // small tilt for level 4 boat
  const waveEventActiveRef = useRef(false);
  const waveEventTimerRef = useRef(0);
  const waveEventProgressRef = useRef(0);
  const waveEventDirectionRef = useRef(1);
  const waveEventPatternRef = useRef<'single' | 'cycle'>('single');
  const touchXRef = useRef<number | null>(null);  // live touch X position
  const wakeParticlesRef = useRef<WakeParticle[]>([]);
  const wakeIdCounter = useRef(0);

  // ── Flappy mode specific refs ──────────────────────────────────────────────
  const playerYRef = useRef(50);
  const playerVYRef = useRef(0);

  const TARGET_DURATION_SECONDS = 90;
  const DISTANCE_SPEED = level.survivalTargetDistance / TARGET_DURATION_SECONDS;
  const FUEL_DRAIN_PER_SECOND = 100 / (TARGET_DURATION_SECONDS * 1.15);

  // ── مراجع الأصوات ──
  const mainLoopRef = useRef<SeamlessAudio | null>(null);
  const sfxPlayerRef = useRef<SfxPlayer | null>(null);

  // ── تشغيل وتجهيز الأصوات ──
  useEffect(() => {
    let isCleanedUp = false;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();

    // Main Loop
    const mainGainNode = audioCtx.createGain();
    mainGainNode.gain.value = 0.3; // نوطي الصوت شوية عشان الإزعاج
    mainGainNode.connect(audioCtx.destination);

    // SFX
    const sfxGainNode = audioCtx.createGain();
    sfxGainNode.gain.value = 1.0;
    sfxGainNode.connect(audioCtx.destination);

    let mainSourceNode: AudioBufferSourceNode | null = null;
    let mainAudioBuffer: AudioBuffer | null = null;
    let mainIsPlaying = false;

    const seamlessLoop: SeamlessAudio = {
      play: async () => {
        mainIsPlaying = true;
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        if (!mainSourceNode && mainAudioBuffer) {
          mainSourceNode = audioCtx.createBufferSource();
          mainSourceNode.buffer = mainAudioBuffer;
          mainSourceNode.loop = true;
          mainSourceNode.connect(mainGainNode);
          mainSourceNode.start();
        }
      },
      pause: () => {
        mainIsPlaying = false;
        if (audioCtx.state === 'running') {
          audioCtx.suspend();
        }
      },
      get paused() {
        return !mainIsPlaying;
      },
      stop: () => {
        mainIsPlaying = false;
        if (mainSourceNode) {
          try { mainSourceNode.stop(); } catch (e) { }
          mainSourceNode.disconnect();
          mainSourceNode = null;
        }
        audioCtx.close().catch(() => { });
      }
    };

    mainLoopRef.current = seamlessLoop;

    const loadBuffer = async (url: string) => {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioCtx.decodeAudioData(arrayBuffer);
      } catch (e) {
        return null;
      }
    };

    loadBuffer(mainLoopSound).then(decoded => {
      if (isCleanedUp) return;
      mainAudioBuffer = decoded;
      if (mainIsPlaying && !mainSourceNode) {
        mainSourceNode = audioCtx.createBufferSource();
        mainSourceNode.buffer = mainAudioBuffer;
        mainSourceNode.loop = true;
        mainSourceNode.connect(mainGainNode);
        mainSourceNode.start();
      }
    });

    const sfxBuffers: Record<string, AudioBuffer | null> = {
      crash: null,
      coin: null
    };
    const activeSfxSources = new Set<AudioBufferSourceNode>();

    loadBuffer(crashSound).then(b => { if (!isCleanedUp) sfxBuffers.crash = b; });
    loadBuffer(coinSound).then(b => { if (!isCleanedUp) sfxBuffers.coin = b; });

    const playSfx = (bufferName: keyof typeof sfxBuffers, volume = 1.0) => {
      const buffer = sfxBuffers[bufferName];
      if (!buffer || isCleanedUp) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      if (volume !== 1.0) {
        const volumeGain = audioCtx.createGain();
        volumeGain.gain.value = volume;
        volumeGain.connect(sfxGainNode);
        source.connect(volumeGain);
      } else {
        source.connect(sfxGainNode);
      }
      activeSfxSources.add(source);
      source.onended = () => activeSfxSources.delete(source);
      source.start();
    };

    sfxPlayerRef.current = {
      playCrash: () => playSfx('crash'),
      playCoin: () => playSfx('coin', 0.5),
      setMuted: (muted: boolean) => {
        sfxGainNode.gain.value = muted ? 0 : 1.0;
      },
      stopAll: () => {
        activeSfxSources.forEach((source) => {
          try { source.stop(); } catch (e) { }
          source.disconnect();
        });
        activeSfxSources.clear();
      }
    };

    mainLoopRef.current.play().catch(() => { });

    return () => {
      isCleanedUp = true;
      sfxPlayerRef.current?.stopAll();
      mainLoopRef.current?.stop();
    };
  }, []);

  // ── إيقاف وتشغيل الصوت مع الـ Pause ──
  useEffect(() => {
    if (paused || showGasStation) {
      mainLoopRef.current?.pause();
      sfxPlayerRef.current?.setMuted(true);
    } else {
      mainLoopRef.current?.play().catch(() => { });
      sfxPlayerRef.current?.setMuted(false);
    }
  }, [paused, showGasStation]);
  // Sync refs with state
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { playerLaneRef.current = playerLane; }, [playerLane]);
  useEffect(() => {
    return () => {
      fuelPenaltyTimersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

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
    if (isFlappyMode) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'ArrowUp') {
          playerVYRef.current = -1.2;
        }
        if (e.key === 'Escape') setPaused((p) => !p);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    } else if (isFreeMode) {
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
    // 👇 ده السطر اللي هيجبر الصوت يشتغل أول ما يلمس الشاشة لو كان معلق
    if (mainLoopRef.current && mainLoopRef.current.paused && !paused && !showGasStation) {
      mainLoopRef.current.play().catch(() => { });
    }

    touchStartX.current = e.touches[0].clientX;
    if (isFreeMode) {
      touchXRef.current = e.touches[0].clientX;
    } else if (isFlappyMode) {
      playerVYRef.current = -1.2;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isFreeMode) {
      touchXRef.current = e.touches[0].clientX;
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isFlappyMode) return; // handled on touch start
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

        // ── Gas station warning (5 seconds before trigger) ─────────────────
        if (!gasStationVisitedRef.current && !showGasStationRef.current) {
          const currentDistanceProgress = distanceRef.current / level.survivalTargetDistance;
          const timeToDistance = Math.max(0, (0.45 - currentDistanceProgress) * TARGET_DURATION_SECONDS);
          const timeToFuel = Math.max(0, (fuelRef.current - 50) / FUEL_DRAIN_PER_SECOND);
          const estimatedTime = Math.max(timeToDistance, timeToFuel);

          const shouldWarn = estimatedTime <= 5 && estimatedTime > 0;
          if (shouldWarn && !showGasStationWarningRef.current) {
            showGasStationWarningRef.current = true;
            setShowGasStationWarning(true);
          } else if (!shouldWarn && showGasStationWarningRef.current) {
            showGasStationWarningRef.current = false;
            setShowGasStationWarning(false);
          }
        } else if (showGasStationWarningRef.current) {
          showGasStationWarningRef.current = false;
          setShowGasStationWarning(false);
        }

        // Road/river scroll animation
        // Road/river scroll animation
        setScrollOffset((s) => (s + level.obstacleSpeed * deltaSeconds * 6000) % 100000);
        // 👈 السطر ده اللي كان ناقص عشان العداد يشتغل!
        spawnFrameCounter.current += deltaSeconds * 60;
        coinSpawnFrameCounter.current += deltaSeconds * 60;

        // ── FLAPPY MODE: physics ──────────────────────────────────────────
        if (isFlappyMode) {
          playerVYRef.current += 0.08 * deltaSeconds * 60; // Gravity
          playerVYRef.current = Math.max(-1.5, Math.min(2.5, playerVYRef.current)); // terminal velocity
          playerYRef.current += playerVYRef.current * deltaSeconds * 60;
          playerYRef.current = Math.max(5, Math.min(95, playerYRef.current)); // clamp inside view
        }

// ── FREE MODE: steering physics ────────────────────────────────────
        if (isFreeMode) {
          // Update steer flags from live touch position
          if (touchXRef.current !== null) {
            const screenMid = window.innerWidth / 2;
            // التعديل هنا: اللمس يمين يروح يمين، واللمس شمال يروح شمال
            steerLeftRef.current = touchXRef.current < screenMid;
            steerRightRef.current = touchXRef.current > screenMid;
          }

          // Apply acceleration
          if (steerLeftRef.current) playerVXRef.current -= STEER_ACCEL;
          if (steerRightRef.current) playerVXRef.current += STEER_ACCEL;

          // Clamp velocity
          playerVXRef.current = Math.max(-STEER_MAX, Math.min(STEER_MAX, playerVXRef.current));

          // Apply damping
          playerVXRef.current *= STEER_DAMP;

          const isLevel4 = level.id === 'level_4' || level.id === '4';
          if (isLevel4) {
            waveEventTimerRef.current += deltaSeconds;
            
            // 1. دورة الموجة كل 3 ثواني بالظبط
            if (waveEventTimerRef.current >= 3.0) {
              waveEventTimerRef.current = 0;
              waveEventActiveRef.current = false;
            }

            // 2. الموجة بتاخد ثانيتين عشان توصل للفلك.. أول ما توصل نضرب الفلك!
            if (waveEventTimerRef.current >= 2.0 && !waveEventActiveRef.current) {
              waveEventActiveRef.current = true;
              waveEventProgressRef.current = 0;
              waveEventDirectionRef.current = Math.random() < 0.5 ? -1 : 1;
              waveEventPatternRef.current = Math.random() < 0.6 ? 'single' : 'cycle';
            }

            if (waveEventActiveRef.current) {
              waveEventProgressRef.current += deltaSeconds;
              const duration = waveEventPatternRef.current === 'cycle' ? 1.0 : 0.8;
              
              if (waveEventProgressRef.current <= duration) {
                const normalized = waveEventProgressRef.current / duration;
                const impact = Math.sin(normalized * Math.PI);
                const sway = 0.15;
                const roll = 8;

                if (waveEventPatternRef.current === 'single') {
                  boatWaveRef.current = impact * sway * waveEventDirectionRef.current;
                  boatRollRef.current = impact * roll * waveEventDirectionRef.current;
                } else {
                  boatWaveRef.current = Math.sin(normalized * Math.PI * 2) * sway * waveEventDirectionRef.current;
                  boatRollRef.current = Math.sin(normalized * Math.PI * 2) * roll * waveEventDirectionRef.current;
                }
                boatBounceRef.current = impact * 1.8;
              } else {
                // لما الموجة تخلص تأثيرها
                boatWaveRef.current = 0;
                boatBounceRef.current = 0;
                boatRollRef.current = 0;
              }
            } else {
              boatWaveRef.current = 0;
              boatBounceRef.current = 0;
              boatRollRef.current = 0;
            }
          }

          // 🌀 ── قوة سحب الدوامة (لليفل 1 فقط) ── 🌀
         // 🌀 ── قوة سحب الدوامة (لليفل 1 فقط) ── 🌀
          let suctionForce = 0;
          const isLevel1 = level.id === 'level_1' || level.id === '1';

          if (isLevel1) {
            obstaclesRef.current.forEach((obs) => {
              const imgSrc = LEVEL_1_ENEMIES[obs.spriteIndex];
              const isWhirlpool = imgSrc === whirlpoolImg;
              
              if (isWhirlpool) {
                const distX = obs.x - playerXRef.current;
                const distT = obs.t - 1.0; 
                
                // لو المركب قريب من الدوامة.. ابدأ اسحبه ببطء
                if (Math.abs(distT) < 0.25 && Math.abs(distX) < 0.3) {
                  // لو حاسس السحبة ضعيفة، كبر الرقم 0.015 ده لـ 0.025 مثلاً
                  suctionForce += (distX * 0.015); 
                }
              }
            });
          }

          // Advance position (دمج حركة اللاعب الأصلية + تأثيرات الموج + قوة السحب)
          playerXRef.current = Math.max(0.05, Math.min(0.95, playerXRef.current + playerVXRef.current + suctionForce));
          // ── Wake particles ─────────────────────────────────────────────
          // Emit 2 particles behind the player each frame
          const px = riverXAtT(playerXRef.current, 1.0);
          const py = yAtT(1.0) - 8;
          const p1: WakeParticle = { id: wakeIdCounter.current++, x: px - 2.1, y: py, opacity: 0.9, age: 0 };
          const p2: WakeParticle = { id: wakeIdCounter.current++, x: px + 2.1, y: py, opacity: 0.9, age: 0 };
          wakeParticlesRef.current = [
            ...wakeParticlesRef.current.map((p) => ({ ...p, age: p.age + 1, y: p.y + 0.18, opacity: Math.max(0, 0.9 - p.age * 0.045) }))
              .filter((p) => p.opacity > 0.02),
            p1, p2,
          ].slice(-20); // cap at 38 particles
        }

        // ── Spawn obstacles ────────────────────────────────────────────────
        if (spawnFrameCounter.current >= level.spawnRate) {
          spawnFrameCounter.current -= level.spawnRate;

          // بنحدد المصفوفة حسب الليفل (نفترض إن اسم ليفل 5 هو 'level_5' زي ما مكتوب عندك في باقي المستويات)
         const isLevel5 = level.id === 'level_5' || level.id === '5';
          const isLevel4 = level.id === 'level_4' || level.id === '4';
          const isLevel1 = level.id === 'level_1' || level.id === '1';

          let currentEnemies = ENEMY_CARS;
          if (isLevel5) {
            currentEnemies = LEVEL_5_ENEMIES;
          } else if (isLevel4 && isFreeMode) {
            currentEnemies = LEVEL_4_ENEMIES;
          } else if (isLevel1 && isFreeMode) {
            currentEnemies = LEVEL_1_ENEMIES;
          }
          const spriteIndex = Math.floor(Math.random() * currentEnemies.length);
          let lane: number;
          let x: number;
          let gapY: number | undefined;
          if (isFlappyMode) {
            x = 0; // Not used
            lane = 1; // Not used
            gapY = 30 + Math.random() * 40; // 30 to 70
          } else if (isFreeMode) {
            // Keep obstacles inside the river banks, not right on the edges.
            const obstacleMinX = 0.15;
            const obstacleMaxX = 0.85;
            x = Math.random() * (obstacleMaxX - obstacleMinX) + obstacleMinX;
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
            gapY,
          };
          obstaclesRef.current = [...obstaclesRef.current, newObs];
        }

        // Move obstacles
        obstaclesRef.current = obstaclesRef.current
          .map((obs) => ({ ...obs, t: obs.t + (level.obstacleSpeed * deltaSeconds * 60) }))
          .filter((obs) => obs.t < 1.15);

        if (coinSpawnFrameCounter.current >= COIN_SPAWN_RATE) {
          coinSpawnFrameCounter.current -= COIN_SPAWN_RATE;
          const newCoins: Coin[] = [];

          if (isFlappyMode) {
            const pipeForCoin = obstaclesRef.current.find((obs) =>
              obs.t > 0.04 && obs.t < 0.35 &&
              obs.gapY !== undefined &&
              obs.gapY > FLAPPY_COIN_SAFE_GAP_MARGIN &&
              obs.gapY < 100 - FLAPPY_COIN_SAFE_GAP_MARGIN &&
              !coinsRef.current.some((coin) => Math.abs(coin.t - obs.t) < 0.18)
            );
            if (pipeForCoin) {
              newCoins.push({
                id: coinIdCounter.current++,
                lane: 1,
                x: 0,
                t: pipeForCoin.t,
                gapY: pipeForCoin.gapY,
              });
            }
          } else if (isFreeMode) {
            let x: number | null = null;
            for (let attempt = 0; attempt < 12; attempt += 1) {
              const candidateX = 0.18 + Math.random() * 0.64;
              const isSafe = !obstaclesRef.current.some((obs) =>
                Math.abs(obs.t - 0.05) < FREE_COIN_SAFE_T_WINDOW &&
                Math.abs(obs.x - candidateX) < FREE_COIN_SAFE_X_MARGIN
              );
              if (isSafe) {
                x = candidateX;
                break;
              }
            }
            if (x !== null) {
              newCoins.push({
                id: coinIdCounter.current++,
                lane: 1,
                x,
                t: 0.05,
              });
            }
          } else {
            const safeLanes = [0, 1, 2].filter((lane) =>
              !obstaclesRef.current.some((obs) =>
                obs.lane === lane &&
                [0.05, 0.12, 0.19].some((coinT) => Math.abs(obs.t - coinT) < LANE_COIN_SAFE_T_WINDOW)
              ) &&
              !coinsRef.current.some((coin) =>
                coin.lane === lane &&
                [0.05, 0.12, 0.19].some((coinT) => Math.abs(coin.t - coinT) < LANE_COIN_SAFE_T_WINDOW)
              )
            );
            if (safeLanes.length > 0) {
              const spawnTriple = Math.random() < 0.3 && safeLanes.length >= 3;
              if (spawnTriple) {
                // Spread 3 coins across all 3 safe lanes at the same depth.
                // Shuffle safeLanes so the order is random.
                const shuffled = [...safeLanes].sort(() => Math.random() - 0.5);
                for (let i = 0; i < 3; i += 1) {
                  const laneForCoin = shuffled[i];
                  newCoins.push({
                    id: coinIdCounter.current++,
                    lane: laneForCoin,
                    x: (LANE_CENTERS_BOTTOM[laneForCoin] - (VP_X - ROAD_HALF_BOTTOM)) / (ROAD_HALF_BOTTOM * 2),
                    t: 0.05,
                  });
                }
              } else {
                // Single coin in one random safe lane.
                const lane = safeLanes[Math.floor(Math.random() * safeLanes.length)];
                newCoins.push({
                  id: coinIdCounter.current++,
                  lane,
                  x: (LANE_CENTERS_BOTTOM[lane] - (VP_X - ROAD_HALF_BOTTOM)) / (ROAD_HALF_BOTTOM * 2),
                  t: 0.05,
                });
              }
            }
          }

          if (newCoins.length > 0) {
            coinsRef.current = [...coinsRef.current, ...newCoins];
          }
        }

        coinsRef.current = coinsRef.current
          .map((coin) => ({ ...coin, t: coin.t + (level.obstacleSpeed * deltaSeconds * 60) }))
          .filter((coin) => coin.t < 1.15);

        const coinsBeforeCollection = coinsRef.current.length;
        coinsRef.current = coinsRef.current.filter((coin) => {
          if (isFlappyMode) {
            const coinX = 110 - (coin.t / 1.15) * 130;
            const coinY = coin.gapY ?? 50;
            return !(Math.abs(25 - coinX) < 6.5 && Math.abs(playerYRef.current - coinY) < 6);
          }
          if (isFreeMode) {
            return !(Math.abs(coin.x - playerXRef.current) < 0.09 && coin.t > 0.88 && coin.t < 1.06);
          }
          return !(coin.lane === playerLaneRef.current && coin.t > 0.88 && coin.t < 1.06);
        });
        const collectedThisFrame = coinsBeforeCollection - coinsRef.current.length;
        if (collectedThisFrame > 0) {
          coinsCollectedRef.current += collectedThisFrame;
          setCoinsCollected(coinsCollectedRef.current);
          for (let i = 0; i < collectedThisFrame; i += 1) {
            sfxPlayerRef.current?.playCoin();
          }
        }

        // ── Collision detection ────────────────────────────────────────────
        if (collisionCooldownRef.current > 0) {
          collisionCooldownRef.current -= deltaSeconds * 60;
        } else {
          let hitting: Obstacle | undefined;

          if (isFlappyMode) {
            const playerFixX = 25;
            const playerW = 8;
            const playerH = 6;
            hitting = obstaclesRef.current.find((obs) => {
              const pipeX = 110 - (obs.t / 1.15) * 130;
              const pipeW = 12;
              const gapH = level.id === 'level_6' ? 14 : 18;
              const gapStart = obs.gapY! - gapH;
              const gapEnd = obs.gapY! + gapH;

              if (Math.abs(playerFixX - pipeX) < (playerW / 2 + pipeW / 2)) {
                if (playerYRef.current - playerH / 2 < gapStart || playerYRef.current + playerH / 2 > gapEnd) {
                  return true;
                }
              }
              return false;
            });
          } else if (isFreeMode) {
            // Proximity check in normalized x space
            hitting = obstaclesRef.current.find(
              (obs) => Math.abs(obs.x - playerXRef.current) < FREE_COLLISION_RADIUS
                && obs.t > 0.88 && obs.t < 1.05
            );
          } else {
            // t > 0.72: geometrically, the enemy's near-edge image bottom (y = 33 + 71.8*t)
            // reaches the player's front (y ≈ 85) when t ≈ 0.727 — fire before deep overlap.
            hitting = obstaclesRef.current.find(
              (obs) => obs.lane === playerLaneRef.current && obs.t > 0.72 && obs.t < 1.05
            );
          }

          if (hitting) {
            // 👇 السطر الجديد اللي ضفناه عشان يشغل صوت الخبطة
            sfxPlayerRef.current?.playCrash();
            collisionCooldownRef.current = 90;
            fuelRef.current = Math.max(0, fuelRef.current - 5);
            const feedbackId = fuelPenaltyFeedbackIdRef.current++;
            setFuelPenaltyFeedbacks((feedbacks) => [...feedbacks.slice(-2), { id: feedbackId }]);
            const feedbackTimer = setTimeout(() => {
              setFuelPenaltyFeedbacks((feedbacks) => feedbacks.filter((feedback) => feedback.id !== feedbackId));
              fuelPenaltyTimersRef.current = fuelPenaltyTimersRef.current.filter((timer) => timer !== feedbackTimer);
            }, 900);
            fuelPenaltyTimersRef.current.push(feedbackTimer);
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
          sfxPlayerRef.current?.stopAll();
          mainLoopRef.current?.stop();
          const distanceScore = scoreRef.current;
          const stars = distanceScore >= level.survivalTargetDistance ? 3 : distanceScore >= level.survivalTargetDistance * 0.6 ? 2 : distanceScore >= level.survivalTargetDistance * 0.3 ? 1 : 0;
          const finalScore = distanceScore + (coinsCollectedRef.current * COIN_VALUE);
          onGameOver({ won: false, score: finalScore, stars });
          return;
        }

        // ── Win: full distance completed AND still have fuel ───────────────
        if (distanceRef.current >= level.survivalTargetDistance && fuelRef.current > 0 && !gameOverFiredRef.current) {
          gameOverFiredRef.current = true;
          sfxPlayerRef.current?.stopAll();
          mainLoopRef.current?.stop();
          const distanceScore = scoreRef.current;
          const stars = fuelRef.current >= 60 ? 3 : fuelRef.current >= 30 ? 2 : 1;
          const finalScore = distanceScore + (coinsCollectedRef.current * COIN_VALUE);
          onGameOver({ won: true, score: finalScore, stars });
          return;
        }

        // ── Sync to React state for render ────────────────────────────────
        setFuel(fuelRef.current);
        setScore(scoreRef.current);
        setObstacles([...obstaclesRef.current]);
        setCoins([...coinsRef.current]);
        if (isFlappyMode) {
          setPlayerY(playerYRef.current);
        } else if (isFreeMode) {
          setPlayerX(playerXRef.current);
          setWakeParticles([...wakeParticlesRef.current]);
          setWaveTimer(waveEventTimerRef.current); // 👈 السطر الجديد ده عشان نربط الموجة بالشاشة
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [level, onGameOver, isFreeMode, isFlappyMode]);

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
  const fuelVisualPercent = Math.max(0, Math.min(100, fuel));

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
  const flappyBaseSpeed = scrollOffset * (130 / 115);

  return (
    <div
      dir="rtl"
      className="relative w-full h-full overflow-hidden select-none bg-[#1A5BB5]"
      style={{ fontFamily: "'Cairo', sans-serif" }}
      onTouchStart={handleTouchStart}
      onTouchMove={isFreeMode ? handleTouchMove : undefined}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── GAME SCENE (SVG) ── */}
      <svg
        // التعديل هنا: خلينا العرض 70 بدل 100 عشان اللعبة تعرض على اللاب فتتظبط على التليفون
        viewBox={isFlappyMode ? "0 0 100 100" : "15 0 70 100"}
        preserveAspectRatio="none"
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
              <radialGradient id="riverWater" gradientUnits="userSpaceOnUse" cx="50" cy="96" r="78" fx="50" fy="100">
                <stop offset="0%" stopColor="#082E58" />
                <stop offset="45%" stopColor="#0B6F86" />
                <stop offset="78%" stopColor="#52C7CE" />
                <stop offset="100%" stopColor="#D8F8F5" />
              </radialGradient>
            ) : (
              <radialGradient id="riverWater" gradientUnits="userSpaceOnUse" cx="50" cy="96" r="78" fx="50" fy="100">
                <stop offset="0%" stopColor="#06255C" />
                <stop offset="44%" stopColor="#075BA4" />
                <stop offset="76%" stopColor="#22B8CC" />
                <stop offset="100%" stopColor="#E7FFFA" />
              </radialGradient>
            )
          )}

          {isFreeMode && (
            <>
              <linearGradient id="wetSandLeft" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={isNoahLevel ? "#3D2D25" : "#A67132"} stopOpacity="0" />
                <stop offset="60%" stopColor={isNoahLevel ? "#5F4A39" : "#B6843F"} stopOpacity="0.75" />
                <stop offset="100%" stopColor={isNoahLevel ? "#77624D" : "#D6B061"} stopOpacity="0.88" />
              </linearGradient>
              <linearGradient id="wetSandRight" x1="1" y1="0" x2="0" y2="0">
                <stop offset="0%" stopColor={isNoahLevel ? "#3D2D25" : "#A67132"} stopOpacity="0" />
                <stop offset="60%" stopColor={isNoahLevel ? "#5F4A39" : "#B6843F"} stopOpacity="0.75" />
                <stop offset="100%" stopColor={isNoahLevel ? "#77624D" : "#D6B061"} stopOpacity="0.88" />
              </linearGradient>
              <linearGradient id="riverHorizonSheen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
                <stop offset="35%" stopColor="#BFF8FF" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="waterSparkle" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                <stop offset="45%" stopColor="#E8FFFF" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </radialGradient>
            </>
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
          {/* ── انعكاس الشمس على الماية ── */}
          <linearGradient id="waterGlare" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.4" />
            <stop offset="50%" stopColor="white" stopOpacity="0.1" />
            <stop offset="100%" stopColor="white" stopOpacity="0.0" />
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
          {/* 👇 الكود اللي كان ناقص ضفناه هنا بـ 0.65 جاهز 👇 */}
          <clipPath id="sharkClip" clipPathUnits="objectBoundingBox">
            <rect x="0" y="0" width="1" height="0.65" />
          </clipPath>
        </defs>

        {isFlappyMode ? (
          <>
            {/* ════════════════════════════════════════════════════
                FLAPPY MODE SCENE
            ════════════════════════════════════════════════════ */}
            {/* Sky Background */}
            <image href={FLAPPY_SKY} x="0" y="0" width="100" height="100" preserveAspectRatio="none" />



            {/* Distant Skyline (slow parallax, 0.5x base speed) */}
            <g transform={`translate(${-(flappyBaseSpeed * 0.5) % 100}, 0)`}>
              <image href={FLAPPY_SKYLINE} x="0" y="20" width="100" height="60" preserveAspectRatio="none" />
              <image href={FLAPPY_SKYLINE} x="100" y="20" width="100" height="60" preserveAspectRatio="none" />
            </g>

            {/* Cloud Band (medium parallax, 0.25x base speed) */}
            {/* Each cloud is a nested <svg viewBox="0 0 120 48"> so it always renders at its
                natural 2.5:1 aspect ratio regardless of the outer SVG's non-uniform stretch.
                Six clouds cover a 200-unit wide strip (two 100-unit tiles) so the parallax
                translate(0 .. -100) loops seamlessly. */}
            <g transform={`translate(${-(flappyBaseSpeed * 0.25) % 100}, 0)`}>
              {/* ── Tile A: x 0-100 ── */}
              <svg x={2} y={5} width={28} height={11} viewBox="0 0 120 48" preserveAspectRatio="xMidYMid meet">
                <ellipse cx="60" cy="42" rx="52" ry="10" fill="#D8EEFF" opacity="0.75" />
                <ellipse cx="60" cy="36" rx="50" ry="14" fill="white" opacity="0.92" />
                <ellipse cx="28" cy="26" rx="24" ry="18" fill="white" />
                <ellipse cx="60" cy="20" rx="28" ry="20" fill="white" />
                <ellipse cx="90" cy="24" rx="22" ry="16" fill="white" />
                <ellipse cx="44" cy="18" rx="14" ry="11" fill="white" />
              </svg>
              <svg x={38} y={4} width={38} height={15} viewBox="0 0 120 48" preserveAspectRatio="xMidYMid meet">
                <ellipse cx="60" cy="42" rx="52" ry="10" fill="#D8EEFF" opacity="0.75" />
                <ellipse cx="60" cy="36" rx="50" ry="14" fill="white" opacity="0.92" />
                <ellipse cx="28" cy="26" rx="24" ry="18" fill="white" />
                <ellipse cx="60" cy="20" rx="28" ry="20" fill="white" />
                <ellipse cx="90" cy="24" rx="22" ry="16" fill="white" />
                <ellipse cx="75" cy="16" rx="16" ry="12" fill="white" />
              </svg>
              <svg x={76} y={7} width={22} height={9} viewBox="0 0 120 48" preserveAspectRatio="xMidYMid meet">
                <ellipse cx="60" cy="42" rx="52" ry="10" fill="#D8EEFF" opacity="0.75" />
                <ellipse cx="60" cy="36" rx="50" ry="14" fill="white" opacity="0.92" />
                <ellipse cx="28" cy="26" rx="24" ry="18" fill="white" />
                <ellipse cx="60" cy="20" rx="28" ry="20" fill="white" />
                <ellipse cx="90" cy="24" rx="22" ry="16" fill="white" />
              </svg>
              {/* ── Tile B: x 100-200 (identical layout + 100) ── */}
              <svg x={102} y={5} width={28} height={11} viewBox="0 0 120 48" preserveAspectRatio="xMidYMid meet">
                <ellipse cx="60" cy="42" rx="52" ry="10" fill="#D8EEFF" opacity="0.75" />
                <ellipse cx="60" cy="36" rx="50" ry="14" fill="white" opacity="0.92" />
                <ellipse cx="28" cy="26" rx="24" ry="18" fill="white" />
                <ellipse cx="60" cy="20" rx="28" ry="20" fill="white" />
                <ellipse cx="90" cy="24" rx="22" ry="16" fill="white" />
                <ellipse cx="44" cy="18" rx="14" ry="11" fill="white" />
              </svg>
              <svg x={138} y={4} width={38} height={15} viewBox="0 0 120 48" preserveAspectRatio="xMidYMid meet">
                <ellipse cx="60" cy="42" rx="52" ry="10" fill="#D8EEFF" opacity="0.75" />
                <ellipse cx="60" cy="36" rx="50" ry="14" fill="white" opacity="0.92" />
                <ellipse cx="28" cy="26" rx="24" ry="18" fill="white" />
                <ellipse cx="60" cy="20" rx="28" ry="20" fill="white" />
                <ellipse cx="90" cy="24" rx="22" ry="16" fill="white" />
                <ellipse cx="75" cy="16" rx="16" ry="12" fill="white" />
              </svg>
              <svg x={176} y={7} width={22} height={9} viewBox="0 0 120 48" preserveAspectRatio="xMidYMid meet">
                <ellipse cx="60" cy="42" rx="52" ry="10" fill="#D8EEFF" opacity="0.75" />
                <ellipse cx="60" cy="36" rx="50" ry="14" fill="white" opacity="0.92" />
                <ellipse cx="28" cy="26" rx="24" ry="18" fill="white" />
                <ellipse cx="60" cy="20" rx="28" ry="20" fill="white" />
                <ellipse cx="90" cy="24" rx="22" ry="16" fill="white" />
              </svg>
            </g>

            {/* Ground Strip (fast parallax, matches obstacle speed 1.0x) */}
            <g transform={`translate(${-(flappyBaseSpeed * 1.0) % 100}, 85)`}>
              <image href={FLAPPY_GROUND} x="0" y="0" width="100" height="15" preserveAspectRatio="none" />
              <image href={FLAPPY_GROUND} x="100" y="0" width="100" height="15" preserveAspectRatio="none" />
            </g>

            {/* Pipes */}
            {obstacles.map((obs) => {
              const pipeX = 110 - (obs.t / 1.15) * 130;
              const pipeW = 12;
              const gapH = level.id === 'level_6' ? 14 : 18;
              const gapStart = obs.gapY! - gapH;
              const gapEnd = obs.gapY! + gapH;

              return (
                <g key={obs.id}>
                  {/* Top Pipe */}
                  <image
                    href={PIPE_TOP}
                    x={pipeX - pipeW / 2}
                    y={gapStart - 100}
                    width={pipeW}
                    height={100}
                    preserveAspectRatio="none"
                  />
                  {/* Bottom Pipe */}
                  <image
                    href={PIPE_BOTTOM}
                    x={pipeX - pipeW / 2}
                    y={gapEnd}
                    width={pipeW}
                    height={100}
                    preserveAspectRatio="none"
                  />
                </g>
              );
            })}

            {coins.map((coin) => {
              const coinX = 110 - (coin.t / 1.15) * 130;
              const coinY = coin.gapY ?? 50;
              const coinSize = 5;
              return (
                <g key={coin.id} transform={`translate(${coinX}, ${coinY})`}>
                  <ellipse cx="0" cy="1.8" rx="2.8" ry="0.8" fill="black" opacity="0.18" />
                  <image
                    href={COIN_SPRITE_SRC}
                    x={-coinSize / 2}
                    y={-coinSize / 2}
                    width={coinSize}
                    height={coinSize}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </g>
              );
            })}

            {/* Player Airplane */}
            <motion.g
              animate={{ y: playerY }}
              transition={{ type: 'tween', duration: 0.05, ease: 'linear' }}
            >
              <g transform={`translate(25, 0) rotate(${playerVYRef.current * 15})`}>
                <image
                  href={FLAPPY_AIRPLANE}
                  x={-6}
                  y={-4.5}
                  width={12}
                  height={9}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            </motion.g>
          </>
        ) : (
          <>
            {/* ════════════════════════════════════════════════════
                LAYER 1 — SKY
            ════════════════════════════════════════════════════ */}
            <rect width="100" height="100" fill="url(#sky)" />

            {/* ════════════════════════════════════════════════════
            LAYER 2 — DISTANT MOUNTAINS
        ════════════════════════════════════════════════════ */}

            {/* Layer A: farthest, most desaturated blue-grey */}
            {/* Layer A: farthest, most desaturated blue-grey (Tropical Style) */}
            <polygon points={`2,${HORIZON_Y} 12,${HORIZON_Y - 14} 22,${HORIZON_Y}`} fill={isFreeMode ? "#9DB6BE" : "#7B8EC5"} opacity={isFreeMode ? "0.38" : "0.45"} />
            <polygon points={`10,${HORIZON_Y} 22,${HORIZON_Y - 18} 34,${HORIZON_Y}`} fill={isFreeMode ? "#8FADB8" : "#6E82BE"} opacity={isFreeMode ? "0.36" : "0.45"} />
            <polygon points={`30,${HORIZON_Y} 42,${HORIZON_Y - 20} 56,${HORIZON_Y}`} fill={isFreeMode ? "#88A8B5" : "#6878B8"} opacity={isFreeMode ? "0.40" : "0.50"} />
            <polygon points={`44,${HORIZON_Y} 50,${HORIZON_Y - 15} 58,${HORIZON_Y}`} fill={isFreeMode ? "#A8BEC4" : "#7080C0"} opacity={isFreeMode ? "0.32" : "0.42"} />
            <polygon points={`54,${HORIZON_Y} 65,${HORIZON_Y - 22} 78,${HORIZON_Y}`} fill={isFreeMode ? "#7FA2B0" : "#6575B8"} opacity={isFreeMode ? "0.38" : "0.50"} />
            <polygon points={`68,${HORIZON_Y} 80,${HORIZON_Y - 17} 92,${HORIZON_Y}`} fill={isFreeMode ? "#90ACB7" : "#7082BE"} opacity={isFreeMode ? "0.36" : "0.45"} />
            <polygon points={`80,${HORIZON_Y} 90,${HORIZON_Y - 13} 100,${HORIZON_Y}`} fill={isFreeMode ? "#A7BBC1" : "#7A8EC5"} opacity={isFreeMode ? "0.34" : "0.42"} />
            {/* Layer B: mid range (Tropical Forest Style) */}
            <polygon points={`-2,${HORIZON_Y} 10,${HORIZON_Y - 11} 20,${HORIZON_Y}`} fill={isFreeMode ? "#2D5A2D" : "#5E7A5E"} opacity="0.72" />
            <polygon points={`14,${HORIZON_Y} 26,${HORIZON_Y - 15} 38,${HORIZON_Y}`} fill={isFreeMode ? "#2D5A2D" : "#507050"} opacity="0.72" />
            <polygon points={`35,${HORIZON_Y} 44,${HORIZON_Y - 11} 52,${HORIZON_Y}`} fill={isFreeMode ? "#3E4A30" : "#4E6E4E"} opacity="0.72" />
            <polygon points={`60,${HORIZON_Y} 72,${HORIZON_Y - 14} 84,${HORIZON_Y}`} fill={isFreeMode ? "#2D5A2D" : "#507050"} opacity="0.72" />
            <polygon points={`78,${HORIZON_Y} 88,${HORIZON_Y - 10} 100,${HORIZON_Y}`} fill={isFreeMode ? "#2D5A2D" : "#5E7A5E"} opacity="0.70" />
            {/* Tallest peak tips (Tropical Forest Canopy Style) */}
            <polygon points={`14,${HORIZON_Y - 15} 17,${HORIZON_Y - 18.5} 20,${HORIZON_Y - 15}`} fill={isFreeMode ? "#F7FBFF" : "white"} opacity={isFreeMode ? "0.48" : "0.6"} />
            <polygon points={`40,${HORIZON_Y - 17} 44,${HORIZON_Y - 21} 48,${HORIZON_Y - 17}`} fill={isFreeMode ? "#F7FBFF" : "white"} opacity={isFreeMode ? "0.50" : "0.6"} />
            <polygon points={`62,${HORIZON_Y - 19} 65,${HORIZON_Y - 23} 68,${HORIZON_Y - 19}`} fill={isFreeMode ? "#F7FBFF" : "white"} opacity={isFreeMode ? "0.52" : "0.6"} />
            {/* ═══════════════════════════════════════
            FREE MODE: GROUND — Sandy canyon banks + river
            LANE MODE: GROUND — Grass hills
        ═══════════════════════════════════════ */}

            {isFreeMode ? (
              <>
                {/* ── LAYER 3 (free): Sandy ground base fills the bottom area ── */}
                <rect x="0" y={HORIZON_Y} width="100" height={ROAD_BOTTOM - HORIZON_Y + 5} fill="url(#sandBank)" />
                <polygon
                  points={`${RHL - 2.2},${HORIZON_Y} ${RHL + 0.5},${HORIZON_Y} 2,100 -9,100`}
                  fill="url(#wetSandLeft)"
                  opacity="0.78"
                />
                <polygon
                  points={`${RHR - 0.5},${HORIZON_Y} ${RHR + 2.2},${HORIZON_Y} 109,100 98,100`}
                  fill="url(#wetSandRight)"
                  opacity="0.78"
                />

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
                  points={`${VP_X - ROAD_HALF_HORIZON},${HORIZON_Y} ${VP_X + ROAD_HALF_HORIZON},${HORIZON_Y} 100,100 0,100`}
                  fill="url(#riverWater)"
                />
                <polygon
                  points={`${VP_X - ROAD_HALF_HORIZON},${HORIZON_Y} ${VP_X + ROAD_HALF_HORIZON},${HORIZON_Y} 100,100 0,100`}
                  fill="url(#riverHorizonSheen)"
                  opacity="0.75"
                  style={{ pointerEvents: 'none' }}
                />

                {/* انعكاس السماء في منتصف النهر لإعطاء واقعية وعمق 3D */}
                <polygon
                  points={`${VP_X - 2.2},${HORIZON_Y} ${VP_X + 1.2},${HORIZON_Y} 58,100 41,100`}
                  fill="white"
                  opacity="0.028"
                  style={{ pointerEvents: 'none' }}
                />

                <path
                  d={`M ${riverXAtT(0.35, 0.12)} ${yAtT(0.12)}
                    C ${riverXAtT(0.55, 0.24)} ${yAtT(0.24)}, ${riverXAtT(0.44, 0.42)} ${yAtT(0.42)}, ${riverXAtT(0.58, 0.58)} ${yAtT(0.58)}
                    S ${riverXAtT(0.46, 0.84)} ${yAtT(0.84)}, ${riverXAtT(0.61, 1)} ${yAtT(1)}`}
                  fill="none"
                  stroke={isNoahLevel ? "#7EDDD7" : "#77E0EF"}
                  strokeWidth="8.5"
                  strokeOpacity="0.13"
                  strokeLinecap="round"
                  style={{ pointerEvents: 'none' }}
                />
                <path
                  d={`M ${riverXAtT(0.70, 0.18)} ${yAtT(0.18)}
                    C ${riverXAtT(0.58, 0.32)} ${yAtT(0.32)}, ${riverXAtT(0.74, 0.50)} ${yAtT(0.50)}, ${riverXAtT(0.63, 0.70)}
                    ${yAtT(0.70)} S ${riverXAtT(0.72, 0.92)} ${yAtT(0.92)}, ${riverXAtT(0.66, 1)} ${yAtT(1)}`}
                  fill="none"
                  stroke={isNoahLevel ? "#0A4468" : "#0B5D9B"}
                  strokeWidth="10"
                  strokeOpacity="0.14"
                  strokeLinecap="round"
                  style={{ pointerEvents: 'none' }}
                />
                {[0.18, 0.31, 0.47, 0.62, 0.79, 0.91].map((tPatch, pi) => {
                  const x = riverXAtT([0.32, 0.66, 0.43, 0.73, 0.54, 0.38][pi], tPatch);
                  const y = yAtT(tPatch);
                  const sc = 0.8 + tPatch * 2.3;
                  return (
                    <ellipse
                      key={`mottle${pi}`}
                      cx={x}
                      cy={y}
                      rx={sc * (pi % 2 === 0 ? 2.1 : 1.5)}
                      ry={sc * 0.32}
                      fill={pi % 2 === 0 ? "#B8F8FF" : "#075083"}
                      opacity={pi % 2 === 0 ? 0.14 : 0.12}
                      transform={`rotate(${pi % 2 === 0 ? -7 : 9} ${x} ${y})`}
                      style={{ pointerEvents: 'none' }}
                    />
                  );
                })}

                {/* ── الأمواج العادية اللي في الخلفية ── */}
                {(
                  isNoahLevel ? [0.15, 0.45, 0.75] : [0.16, 0.33, 0.51, 0.70]
                ).map((tWave, wi) => {
                  const speedFactor = isNoahLevel ? 0.0012 : (0.0025 + wi * 0.0008);
                  const tAnim = ((tWave + scrollOffset * speedFactor) % 0.9) + 0.08;
                  const y = yAtT(tAnim);
                  
                  // 1. زقينا الأطراف لجوا (0.05 و 0.95) عشان تفضل دايماً جوه الماية ومتطلعش ع الرملة
                  const leftX = riverXAtT(0.05, tAnim);
                  const rightX = riverXAtT(0.95, tAnim);
                  const width = rightX - leftX;
                  
                  if (isNoahLevel) {
                    // 2. في ليفل 4: بنرسم موجات مندمجة مع الماية (Swells) مسطحة عشان متبانش طايرة
                    const amp = 0.5 + Math.pow(tAnim, 1.5) * 4.0; 
                    return (
                      <g key={`wave${wi}`} opacity={0.2 + tAnim * 0.4}>
                        {/* جسم الموجة الغامق (نايم على الماية) */}
                        <path
                          d={`M ${leftX} ${y} Q ${leftX + width/2} ${y - amp} ${rightX} ${y} Q ${leftX + width/2} ${y + amp * 1.5} ${leftX} ${y} Z`}
                          fill="#083E63"
                          opacity="0.6"
                        />
                        {/* لمعة خفيفة زرقا فوق الموجة عشان تديها تجسيم 3D */}
                        <path
                          d={`M ${leftX + width*0.1} ${y} Q ${leftX + width/2} ${y - amp*0.5} ${rightX - width*0.1} ${y}`}
                          fill="none"
                          stroke="#4A90E2"
                          strokeWidth={0.3 + tAnim * 1.2}
                          strokeLinecap="round"
                          opacity="0.5"
                        />
                      </g>
                    );
                  }

                  // 3. في ليفل 1: خطوط الماية العادية القديمة
                  const amp = 0.55 + wi * 0.16;
                  const phase = (wi * 1.7 + level.id.length * 0.3) % 3;
                  const c1x = leftX + width * 0.24;
                  const c2x = leftX + width * 0.48;
                  const c3x = leftX + width * 0.72;
                  return (
                    <path
                      key={`wave${wi}`}
                      d={`M ${leftX} ${y} C ${c1x} ${y - amp - phase * 0.14}, ${c2x} ${y + amp * 1.1}, ${c3x} ${y} S ${rightX - width * 0.12} ${y - amp * 0.7}, ${rightX} ${y + amp * 0.35}`}
                      fill="none"
                      stroke="#DFFBFF"
                      strokeWidth={0.28 + tAnim * 0.34}
                      opacity={0.24 + tAnim * 0.18}
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* 🌊 ── الموجة الضخمة المتزامنة (لليفل 4 بس) ── 🌊 */}
                {isNoahLevel && (
                  <g>
                    {(() => {
                      const tAnim = waveTimer / 2.0; 
                      
                      if (tAnim > 0.02 && tAnim < 1.2) {
                        const y = yAtT(tAnim);
                        
                        // 👇 1. تعديل عرض الموجة (عشان تاخد البحر كله)
                        const leftX = riverXAtT(0.02, tAnim);  // 👈 0.0 يعني من أقصى حافة الشمال
                        const rightX = riverXAtT(0.98, tAnim); // 👈 1.0 يعني لأقصى حافة اليمين
                        const width = rightX - leftX;
                        
                        const amp = 0.8 + Math.pow(tAnim, 1.8) * 5.5; 
                        
                        return (
                          <g opacity={Math.min(1, tAnim * 5, (1.2 - tAnim) * 5)}>
                            {/* 👇 2. تعديل ظل الموجة (قللنا الشفافية عشان ميبقاش تقيل ومقفل) */}
                            <path
                              d={`M ${leftX} ${y} Q ${leftX + width/2} ${y + amp * 0.8} ${rightX} ${y} L ${rightX} ${y+3} Q ${leftX + width/2} ${y + amp * 0.8 + 3} ${leftX} ${y+3} Z`}
                              fill="#031A38"
                              opacity="0.1" // 👈 التعديل هنا: قللنا الظل لـ 0.15 بدل 0.4
                            />
                            {/* جسم الموجة نفسه */}
                            <path
                              d={`M ${leftX} ${y} Q ${leftX + width/2} ${y - amp} ${rightX} ${y} Q ${leftX + width/2} ${y + amp * 0.5} ${leftX} ${y} Z`}
                              fill="#0B6F86"
                              opacity="0.6"
                            />
                            {/* الرغوة البيضا فوق الموجة */}
                            <path
                              d={`M ${leftX + width * 0.02} ${y - amp * 0.1} Q ${leftX + width/2} ${y - amp * 1.2} ${rightX - width * 0.02} ${y - amp * 0.1}`}
                              fill="none"
                              stroke="#D8F8F5"
                              strokeWidth={0.8 + tAnim * 1.5}
                              strokeLinecap="round"
                              opacity="0.75"
                            />
                          </g>
                        );
                      }
                      return null;
                    })()}
                  </g>
                )}
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
                {WATER_SPARKLES.map((sparkle, si) => {
                  const tAnim = ((sparkle.t + scrollOffset * (0.0012 + si * 0.00012)) % 0.9) + 0.06;
                  const pulse = 0.55 + 0.45 * Math.sin(scrollOffset * 0.035 + sparkle.phase);
                  const scale = 0.5 + tAnim * 0.9;
                  const sx = riverXAtT(sparkle.x, tAnim);
                  const sy = yAtT(tAnim);
                  const opacity = sparkle.opacity * pulse;
                  return (
                    <g key={`sparkle${si}`} opacity={opacity} style={{ pointerEvents: 'none' }}>
                      <ellipse
                        cx={sx}
                        cy={sy}
                        rx={sparkle.rx * scale}
                        ry={sparkle.ry * scale}
                        fill="url(#waterSparkle)"
                      />
                      <line
                        x1={sx - sparkle.rx * scale * 0.75}
                        y1={sy}
                        x2={sx + sparkle.rx * scale * 0.75}
                        y2={sy}
                        stroke="#FFFFFF"
                        strokeWidth={0.13 + tAnim * 0.08}
                        strokeLinecap="round"
                      />
                      <line
                        x1={sx}
                        y1={sy - sparkle.ry * scale * 1.2}
                        x2={sx}
                        y2={sy + sparkle.ry * scale * 1.2}
                        stroke="#E8FFFF"
                        strokeWidth={0.09 + tAnim * 0.06}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}

                <path
                  d={shorelinePath('L', 0.65)}
                  fill="none"
                  stroke="white"
                  strokeWidth="0.62"
                  strokeOpacity={isNoahLevel ? 0.36 : 0.52}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: 'none' }}
                />
                <path
                  d={shorelinePath('R', 0.65)}
                  fill="none"
                  stroke="white"
                  strokeWidth="0.62"
                  strokeOpacity={isNoahLevel ? 0.36 : 0.52}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: 'none' }}
                />
                <path
                  d={shorelinePath('L', 1.55)}
                  fill="none"
                  stroke={isNoahLevel ? "#D9F6F1" : "#E9FFFB"}
                  strokeWidth="0.26"
                  strokeOpacity={isNoahLevel ? 0.28 : 0.42}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: 'none' }}
                />
                <path
                  d={shorelinePath('R', 1.55)}
                  fill="none"
                  stroke={isNoahLevel ? "#D9F6F1" : "#E9FFFB"}
                  strokeWidth="0.26"
                  strokeOpacity={isNoahLevel ? 0.28 : 0.42}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: 'none' }}
                />

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
                    {[0.12, 0.30, 0.55, 0.78].map((tBase, ci) => {
                      // ضفنا scrollOffset عشان الصخور تتحرك
                      const tAnim = (tBase + (scrollOffset / 100)) % 1;
                      if (tAnim < 0.02 || tAnim > 0.98) return null;

                      const bx = roadLeftX(tAnim);
                      const by = yAtT(tAnim);
                      const sc = 0.4 + tAnim * 1.2;
                      // إبعاد الصخور عن النهر
                      const pushOut = Math.pow(tAnim, 2) * 12;
                      return (
                        <g key={`rc${ci}`} transform={`translate(-${pushOut}, 0)`}>
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
                    {[0.18, 0.42, 0.65, 0.85].map((tBase, ci) => {
                      const tAnim = (tBase + (scrollOffset / 100)) % 1;
                      if (tAnim < 0.02 || tAnim > 0.98) return null;

                      const bx = roadRightX(tAnim);
                      const by = yAtT(tAnim);
                      const sc = 0.4 + tAnim * 1.2;
                      const pushOut = Math.pow(tAnim, 2) * 12;
                      return (
                        <g key={`rcr${ci}`} transform={`translate(${pushOut}, 0)`}>
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

                    // 1. قسمنا scrollOffset على 125 عشان يمشي بنفس سرعة المراكب بالظبط
                    const tAnim = (t + (scrollOffset / 125)) % 1;

                    // 2. إخفاء العناصر عند الأفق تماماً لتجنب ظهورها بشكل مفاجئ (Popping)
                    if (tAnim < 0.02 || tAnim > 0.98) return null;

                    // 3. حساب المكان والحجم لتطبيق المنظور (Perspective) 
                    const bx = side === 'L' ? roadLeftX(tAnim) : roadRightX(tAnim);
                    const by = yAtT(tAnim);

                    // 4. تكبير العنصر بحدة (Scale) كل ما يقرب من أسفل الشاشة
                    const variant = BANK_DECOR_VARIANTS[di % BANK_DECOR_VARIANTS.length];
                    const sc = (0.15 + Math.pow(tAnim, 1.5) * 2) * variant.scale;
                    const sign = side === 'L' ? -1 : 1;

                    // 5. حساب البعد عن النهر لضمان التناسق البصري
                    const tx = bx + sign * (spread * sc * 1.2 + Math.pow(tAnim, 2) * 15 + variant.offset * sc);
                    const ty = by + variant.y * sc;
                    if (type === 'palm') {
                      return (
                        <g key={`dec${di}`} transform={`translate(${tx},${ty}) rotate(${variant.rotate * 0.35})`}>
                          <ellipse cx={0} cy={0.35 * sc} rx={2.2 * sc} ry={0.42 * sc} fill="#4A2A12" opacity="0.20" />
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
                        <g key={`dec${di}`} transform={`translate(${tx},${ty}) rotate(${variant.rotate})`}>
                          <ellipse cx={0} cy={0.35 * sc} rx={3.4 * sc} ry={0.55 * sc} fill="#4A2A12" opacity="0.22" />
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
                        <g key={`dec${di}`} transform={`translate(${tx},${ty}) rotate(${variant.rotate})`}>
                          <ellipse cx={0} cy={0.25 * sc} rx={3.1 * sc} ry={0.42 * sc} fill="#4A2A12" opacity="0.18" />
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
                    rx={1.8 + wp.age * 0.06}
                    ry={0.45 + wp.age * 0.012}
                    fill="white"
                    opacity={wp.opacity * 0.72}
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

                {coins.map((coin) => {
                  const cx = riverXAtT(coin.x, coin.t);
                  const cy = yAtT(coin.t);
                  const s = Math.max(1.8, coin.t * 4.2);
                  return (
                    <g key={coin.id} transform={`translate(${cx}, ${cy})`}>
                      <ellipse cx="0" cy={s * 0.38} rx={s * 0.7} ry={s * 0.2} fill="black" opacity="0.18" />
                      <image
                        href={COIN_SPRITE_SRC}
                        x={-s * 0.5}
                        y={-s * 0.8}
                        width={s}
                        height={s}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </g>
                  );
                })}

               {/* ── LAYER 11 (free): Obstacles & Whirlpools ── */}
                {obstacles.map((obs) => {
                  const cx = riverXAtT(obs.x, obs.t);
                  const cy = yAtT(obs.t);
                  const s = obs.t * 6; // سكيل التكبير
                  if (s < 0.5) return null;

                  const isLevel4 = level.id === 'level_4' || level.id === '4';
                  const currentRiverEnemies = isLevel4 ? LEVEL_4_ENEMIES : LEVEL_1_ENEMIES;
                  const imgSrc = currentRiverEnemies[obs.spriteIndex] || currentRiverEnemies[0];
                  const isWhirlpool = imgSrc === whirlpoolImg;
                  const isRock = imgSrc === rockImg;

                  return (
                    <g key={obs.id} transform={`translate(${cx}, ${cy})`}>
                   {isWhirlpool ? (

    /* ================= تصميم الدوامة الحية (مدمجة مع الماية) ================= */
     <g transform={`translate(0, ${s * 0.07})`}> 
      
      {/* 1. موجات متحركة بتوسع حوالين الدوامة */}
      <g style={{ transformOrigin: '0px 0px' }}>
        <ellipse cx="0" cy="0" rx={s * 1.6} ry={s * 0.35} fill="none" stroke="#87CEFA" strokeWidth={s * 0.04} style={{ animation: 'rockRipple 2s linear infinite' }} />
        <ellipse cx="0" cy="0" rx={s * 1.6} ry={s * 0.35} fill="none" stroke="#87CEFA" strokeWidth={s * 0.04} style={{ animation: 'rockRipple 2s linear infinite 1s' }} />
      </g>

    
      {/* 3. تعديل المنظور (Perspective) 
          الجروب ده بيضغط الدوامة (scaleY) عشان "تنام" على سطح الماية وتطابق الـ 3D */}
      <g style={{ transform: 'scaleY(0.50)', transformOrigin: '0px 0px' }}>
        
        {/* الجروب الداخلي ده للأنيميشن عشان تلف وهي نايمة على السطح بشكل طبيعي */}
        <g style={{ transformOrigin: '0px 0px', animation: 'whirlpoolChurn 1.5s ease-in-out infinite' }}>
          <image
            href={imgSrc}
            x={-s * 1.5} 
            y={-s * 1.5} 
            width={s * 3.0} 
            height={s * 3.0} 
            preserveAspectRatio="xMidYMid meet"
            opacity="0.70" 
            style={{ 
              filter: 'hue-rotate(15deg) saturate(0.9) brightness(0.6) contrast(1.1)' 
            }}
          />
        </g>
      </g>

      {/* 4. طبقة ماية شفافة فوق الصورة عشان تدمج الألوان وتخفي أي حواف مقطوعة */}
      <ellipse cx="0" cy={s * 0.1} rx={s * 1.4} ry={s * 0.3} fill="#075BA4" opacity="0.35" style={{ mixBlendMode: 'overlay' }} />

      {/* 5. دوائر ثابتة للحافة تدي نعومة لشكل الدوامة الخارجي */}
      <ellipse cx="0" cy={s * 0.1} rx={s * 1.2} ry={s * 0.25} fill="none" stroke="#87CEFA" strokeWidth={s * 0.05} opacity="0.5" />
    </g>
  ) : isRock ? (
                        /* ================= تصميم الصخرة (موجات حية) ================= */
                        <g>
                          {/* 1. موجات المياه المتحركة (Ripples) اللي بتوسع حوالين الصخرة */}
                          <g style={{ transformOrigin: '0px 0px' }}>
                            <ellipse cx="0" cy={s * 0.1} rx={s * 0.9} ry={s * 0.25} fill="none" stroke="#D8F8F5" strokeWidth={s * 0.05} style={{ animation: 'rockRipple 2s linear infinite' }} />
                            <ellipse cx="0" cy={s * 0.1} rx={s * 0.9} ry={s * 0.25} fill="none" stroke="#D8F8F5" strokeWidth={s * 0.05} style={{ animation: 'rockRipple 2s linear infinite 1s' }} />
                          </g>

                          {/* 2. ظل غامق تحت الصخرة يثبتها في الأرض */}
                          <ellipse cx="0" cy={s * 0.1} rx={s * 0.8} ry={s * 0.2} fill="#0A2E6C" opacity="0.6" />
                          
                          {/* 3. صورة الصخرة */}
                          <image href={imgSrc} x={-s * 0.9} y={-s * 1.0} width={s * 1.8} height={s * 1.8} preserveAspectRatio="xMidYMid meet" />
                          
                          {/* 4. رشة مياه ثابتة قدام الصخرة تدي إحساس إن تيار الماية بيخبط فيها */}
                          <path d={`M ${-s * 0.4} ${s * 0.15} Q 0 ${s * 0.3} ${s * 0.4} ${s * 0.15}`} fill="none" stroke="white" strokeWidth={s * 0.06} strokeLinecap="round" opacity="0.5" />
                        </g>
                      ) : (
                        /* ================= تصميم جذع الشجرة ================= */
                        <g>
                          {/* 1. صغرنا موجات المياه وظبطنا مركز الحركة بدقة عشان نمنع اللجلجة نهائياً */}
                          <ellipse cx="0" cy={s * 0.1} rx={s * 1.3} ry={s * 0.25} fill="none" stroke="white" strokeWidth={s * 0.03} style={{ transformOrigin: `0px ${s * 0.1}px`, animation: 'rockRipple 2s linear infinite' }} />
                          <ellipse cx="0" cy={s * 0.1} rx={s * 1.3} ry={s * 0.25} fill="none" stroke="white" strokeWidth={s * 0.03} style={{ transformOrigin: `0px ${s * 0.1}px`, animation: 'rockRipple 2s linear infinite 1s' }} />
                          
                          {/* 2. صغرنا دايرة الماية الثابتة تحت الجذع */}
                          <ellipse cx="0" cy={s * 0.1} rx={s * 1.6} ry={s * 0.3} fill="none" stroke="white" strokeWidth={s * 0.04} opacity="0.4" />
                          
                          {/* 3. صورة الجذع الثابتة */}
                          <image href={imgSrc} x={-s * 1.8} y={-s * 1.2} width={s * 3.6} height={s * 2.4} preserveAspectRatio="xMidYMid meet" />
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* ── LAYER 12 (free): Player boat ── */}
                {(() => {
                  // التعديل هنا: لو إحنا في ليفل الفلك كبر الحجم لـ 14، ولو مركب عادي خليه 8 زي ما هو
                  const s = isNoahLevel ? 14 : 10;
                  const cy = 94 + (isNoahLevel ? boatBounceRef.current : 0);
                  const svgX = riverXAtT(playerX, 1.0) + (isNoahLevel ? boatWaveRef.current : 0);
                  // Tilt based on horizontal sway for level 4
                  const tilt = isNoahLevel ? boatRollRef.current : playerVXRef.current * 120;
                  return (
                    <motion.g
                      animate={{ x: svgX, y: cy }}
                      transition={{ type: 'tween', duration: 0.05, ease: 'linear' }}
                    >
                      {/* Player wake */}
                      <path
                        d={`M ${-s * 0.18} ${s * 0.08} C ${-s * 0.75} ${s * 0.22}, ${-s * 1.08} ${s * 0.52}, ${-s * 1.35} ${s * 0.76}`}
                        fill="none"
                        stroke="white"
                        strokeWidth={s * 0.16}
                        strokeOpacity="0.66"
                        strokeLinecap="round"
                      />
                      <path
                        d={`M ${s * 0.18} ${s * 0.08} C ${s * 0.75} ${s * 0.22}, ${s * 1.08} ${s * 0.52}, ${s * 1.35} ${s * 0.76}`}
                        fill="none"
                        stroke="white"
                        strokeWidth={s * 0.16}
                        strokeOpacity="0.66"
                        strokeLinecap="round"
                      />
                      <ellipse cx={-s * 0.55} cy={s * 0.42} rx={s * 1.1} ry={s * 0.18} fill="white" opacity="0.38" />
                      <ellipse cx={s * 0.55} cy={s * 0.42} rx={s * 1.1} ry={s * 0.18} fill="white" opacity="0.38" />
                      <ellipse cx={0} cy={s * 0.62} rx={s * 0.65} ry={s * 0.12} fill="#DFFBFF" opacity="0.42" />
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
                    const tStart = ((seg / segments) + scrollOffset / 150) % 1;
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
                {/* Left Trees */}
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
                ].map(({ t: tBase, type, spread }, i) => {
                  // تحريك الأشجار مع الطريق
                  const tAnim = (tBase + (scrollOffset / 150)) % 1;
                  if (tAnim < 0.01 || tAnim > 0.99) return null;

                  const y = yAtT(tAnim);
                  const lx = roadLeftX(tAnim);
                  const sc = 0.18 + tAnim * 1.6;
                  // إبعاد الأشجار تدريجياً عن الطريق لتجنب التداخل
                  const tx = lx - (spread * sc * 0.8 + Math.pow(tAnim, 2) * 15);

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

                {/* Right Trees */}
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
                ].map(({ t: tBase, type, spread }, i) => {
                  const tAnim = (tBase + (scrollOffset / 150)) % 1;
                  if (tAnim < 0.01 || tAnim > 0.99) return null;

                  const y = yAtT(tAnim);
                  const rx = roadRightX(tAnim);
                  const sc = 0.18 + tAnim * 1.6;
                  // إبعاد الأشجار تدريجياً عن الطريق
                  const tx = rx + (spread * sc * 0.8 + Math.pow(tAnim, 2) * 15);

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

                {coins.map((coin) => {
                  const cx = laneXAtT(coin.lane, coin.t);
                  const cy = yAtT(coin.t);
                  const s = Math.max(1.8, coin.t * 4.2);
                  return (
                    <g key={coin.id} transform={`translate(${cx}, ${cy})`}>
                      <ellipse cx="0" cy={s * 0.38} rx={s * 0.7} ry={s * 0.2} fill="black" opacity="0.18" />
                      <image
                        href={COIN_SPRITE_SRC}
                        x={-s * 0.5}
                        y={-s * 0.8}
                        width={s}
                        height={s}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </g>
                  );
                })}
                {/* ════ LAYER 12 — ENEMY CARS ════ */}
                {obstacles.map((obs) => {
                  const cx = laneXAtT(obs.lane, obs.t);
                  const cy = yAtT(obs.t);
                  const s = obs.t * 6;
                  if (s < 0.5) return null;

                  const isLevel5 = level.id === 'level_5' || level.id === '5';
                  const currentEnemies = isLevel5 ? LEVEL_5_ENEMIES : ENEMY_CARS;
                  const imgSrc = currentEnemies[obs.spriteIndex] || ENEMY_CARS[0];

                  // حددنا إذا كان العائق ده هو الشحم (رقم 3 في مصفوفة LEVEL_5_ENEMIES)
                  const isGrease = isLevel5 && obs.spriteIndex === 3;

                  return (
                    <g key={obs.id} transform={`translate(${cx}, ${cy})`}>
                      {/* الظل يترسم للعربيات بس، الشحم ملوش ظل لأنه بقعة على الأرض */}
                      {!isGrease && !(isLevel5 || (level.id === 'level_2' || level.id === '2')) && (
                        /* التعديل: الظل بقى 1.0 عشان يناسب عرض 2.6 */
                        <ellipse cx="0" cy={s * 0.22} rx={s * 1.0} ry={s * 0.25} fill="black" opacity="0.45" />
                      )}

                      <image
                        href={imgSrc}
                        /* التعديل: السنترة بقت على -1.3 (اللي هي نص الـ 2.6) */
                        x={-s * 1.3}
                        y={isGrease ? -s * 0.8 : -s * 1.4}
                        /* التعديل: العرض بقى 2.6 */
                        width={s * 2.6}
                        height={s * 2.2}
                        preserveAspectRatio="none"
                      />
                    </g>
                  );
                })}

                {/* ════ LAYER 13 — PLAYER CAR ════ */}
                {(() => {
                  const isLevel5 = level.id === 'level_5' || level.id === '5';
                  const s = 8;
                  const cy = 93;
                  return (
                    <motion.g
                      animate={{ x: laneXAtT(playerLane, 1.0), y: cy }}
                      transition={{ type: 'tween', duration: 0.15, ease: 'easeOut' }}
                    >
                      {!(isLevel5 || (level.id === 'level_2' || level.id === '2')) && (
                        <ellipse
                          cx="0"
                          cy={s * 0.05}
                          /* التعديل: ظل عربية اللاعب بقى 1.0 برضه */
                          rx={s * 0.90}
                          ry={s * 0.12}
                          fill="black"
                          opacity="0.25"
                        />
                      )}
                      <image
                        href={playerCarImg}
                        /* التعديل: السنترة بقت على -1.3 */
                        x={-s * 1.3}
                        y={-s * 0.98}
                        /* التعديل: العرض بقى 2.6 */
                        width={s * 2.6}
                        height={s * 1.9}
                        preserveAspectRatio="none"
                      />
                    </motion.g>
                  );
                })()}
              </>
            )}
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
          {/* Score + coins */}
          <div className="flex items-center gap-1.5">
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
              <ImageWithFallback
                src={COIN_SPRITE_SRC}
                alt=""
                style={{ width: 14, height: 14, objectFit: 'contain' }}
              />
              <motion.span
                key={coinsCollected}
                initial={{ scale: 1.12 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
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
                {toArabicNumerals(coinsCollected)}
              </motion.span>
            </div>
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
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-2xl shadow-lg"
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
                className="h-full rounded-full"
                style={{
                  width: `${fuelVisualPercent}%`,
                  backgroundColor: fuelBarColor,
                  boxShadow: fuelState !== 'normal' ? `0 0 6px ${fuelBarColor}` : 'none',
                }}
              />
            </div>
            <AnimatePresence initial={false}>
              {fuelPenaltyFeedbacks.map((feedback, index) => (
                <motion.span
                  key={feedback.id}
                  dir="ltr"
                  className="absolute"
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.98 }}
                  transition={{ duration: 0.85, ease: 'easeOut' }}
                  style={{
                    top: -22 - index * 8,
                    right: 18 + index * 14,
                    color: '#FF2D2D',
                    fontSize: '0.95rem',
                    fontWeight: 900,
                    lineHeight: 1,
                    fontFamily: "'Cairo', sans-serif",
                    textShadow: '0 1px 2px rgba(0,0,0,0.75), 0 0 4px rgba(255,45,45,0.45)',
                    pointerEvents: 'none',
                  }}
                >
                  -5
                </motion.span>
              ))}
            </AnimatePresence>
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
          <div className="absolute bottom-0 left-0 right-0 w-full flex" style={{ height: '25%', pointerEvents: 'all' }} dir="ltr">
            {/* الزرار الأول: السهم الشمال */}
            <button
              /* التعديل: قللنا الرقم لـ 8 عشان السهم يروح ناحية حافة الشاشة الشمال أكتر ويبعد عن النص */
              className="flex-1 flex items-end justify-start pl-8 pb-6"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.85)',
                fontSize: '2rem',
                textShadow: '0 4px 15px rgba(0,0,0,0.7)',
                userSelect: 'none',
                touchAction: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                steerLeftRef.current = true;
                touchXRef.current = null;
              }}
              onPointerUp={(e) => { e.stopPropagation(); steerLeftRef.current = false; }}
              onPointerLeave={(e) => { e.stopPropagation(); steerLeftRef.current = false; }}
            >
              ◀
            </button>

            {/* الزرار التاني: السهم اليمين */}
            <button
              /* التعديل: قللنا الرقم لـ 8 عشان السهم يروح ناحية حافة الشاشة اليمين أكتر ويبعد عن النص */
              className="flex-1 flex items-end justify-end pr-8 pb-6"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.85)',
                fontSize: '2rem',
                textShadow: '0 4px 15px rgba(0,0,0,0.7)',
                userSelect: 'none',
                touchAction: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                steerRightRef.current = true;
                touchXRef.current = null;
              }}
              onPointerUp={(e) => { e.stopPropagation(); steerRightRef.current = false; }}
              onPointerLeave={(e) => { e.stopPropagation(); steerRightRef.current = false; }}
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
            levelId={level.id} // 👈 السطر ده هو اللي هيمنع الـ Crash ويبعت رقم الليفل صح!
            onComplete={handleGasStationComplete}
          />
        )}
      </AnimatePresence>

      {/* Gas station warning */}
      {showGasStationWarning && !showGasStation && !gasStationVisited && (
        <div
          className="absolute top-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg z-20 flex justify-center items-center gap-2"
          style={{
            background: 'rgba(234, 179, 8, 0.95)', // Yellow
            color: '#1e293b', // Dark text for contrast
            fontWeight: 900,
            fontSize: 'clamp(0.85rem, 2vw, 1.1rem)',
            fontFamily: "'Cairo', sans-serif",
            animation: 'pulse 1s infinite',
            whiteSpace: 'nowrap'
          }}
        >
          <span>⚠️</span>
          <span>محطة البنزين جاية</span>
        </div>
      )}

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
          ⚠️ خلي بالك البنزين قليل !
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
          🔴 البنزين خلص! بسرعة بسرعة!
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
          }
     @keyframes rockRipple {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }

     `}</style>
    </div>
  );
}
