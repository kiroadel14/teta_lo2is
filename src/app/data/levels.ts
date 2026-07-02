/*
 * ASSET MANIFEST — replace placeholder URLs with real files:
 *
 * VIDEO FILES  → place in /public/video/level[N]/story.mp4
 * AUDIO FILES  → place in /public/audio/levels/level[N]/question[Q].mp3
 *
 * Each level has:
 *   - 1 video file  (story.mp4)
 *   - 3 audio files (question1.mp3, question2.mp3, question3.mp3)
 *
 * Total: 6 videos + 18 audio files
 * No level shares video or audio with any other level.
 */

export interface LevelQuestion {
  id: string;           // e.g. "l1_q1"
  questionText: string; // Arabic question text
  answers: {
    id: string;                                     // "a" | "b" | "c" | "d"
    text: string;                                   // Arabic answer text
    color: 'red' | 'blue' | 'green' | 'yellow';    // fixed per slot: a=red, b=blue, c=green, d=yellow
  }[];
  correctAnswerId: string; // must match one answers[].id
  audioUrl: string;        // e.g. "/audio/levels/level1/question1.mp3"
}

export interface Level {
  id: string;                     // "level_1" through "level_6"
  nameAr: string;                 // Arabic level name
  videoUrl: string;               // "/video/level[N]/story.mp4"
  thumbnail: string;              // placeholder emoji or image path
  color: string;                  // hex accent color for this level's UI tile
  bgColor: string;                // light background tint for tile
  emoji: string;                  // decorative emoji for scene placeholder
  survivalTargetDistance: number; // score units player must reach to win
  obstacleSpeed: number;          // t-units per frame obstacles advance
  spawnRate: number;              // frames between obstacle spawns
  locked: boolean;                // whether this level is locked initially
  questions: LevelQuestion[];     // exactly 3 questions
  /**
   * Movement mode for the race scene.
   * 'lane'  → classic 3-lane road/car mode (default for all levels).
   * 'free'  → continuous free-steering river/boat mode (Levels 1 & 4).
   * Omitting this field is equivalent to 'lane'.
   */
  movementMode?: 'lane' | 'free';
}

// ── Helper: build a question with fixed a/b/c/d color slots ──────────────────
function q(
  id: string,
  questionText: string,
  a: string,
  b: string,
  c: string,
  d: string,
  correctId: 'a' | 'b' | 'c' | 'd',
  level: number,
  qNum: number,
): LevelQuestion {
  return {
    id,
    questionText,
    answers: [
      { id: 'a', text: a, color: 'red' },
      { id: 'b', text: b, color: 'blue' },
      { id: 'c', text: c, color: 'green' },
      { id: 'd', text: d, color: 'yellow' },
    ],
    correctAnswerId: correctId,
    audioUrl: `audio/levels/level${level}/question${qNum}.mp3`,
  };
}

export const LEVELS: Level[] = [
  {
    id: 'level_1',
    nameAr: 'الخليقة',
    videoUrl: 'https://www.youtube.com/embed/KJ0Sn9Oncbs',
    thumbnail: '🌿',
    color: '#22C55E',
    bgColor: '#DCFCE7',
    emoji: '🌿',
    survivalTargetDistance: 1000,
    obstacleSpeed: 0.008,
    spawnRate: 90,
    locked: false,
    movementMode: 'free',
    questions: [
      q('l1_q1', 'فى اى يوم خلق الله الشمس و القمر و النجوم ؟', 'اليوم ٤', 'اليوم ٣', 'اليوم ١', 'اليوم ٥', 'c', 1, 2),
      q('l1_q2', 'ماذا خلق الله ف اليوم الخامس ؟', 'الإنسان', 'السماء', 'الطيور و الأسماك', 'الجلد', 'c', 1, 1),
      q('l1_q3', 'لماذا خلق الله الإنسان ف اليوم السادس ', 'ليخلق الزهور', 'ليعتنى بالعالم الجميل', 'ليخلق الأسماك ', 'ليخلق السماء ', 'b', 1, 3),
    ],
  },
  {
    id: 'level_2',
    nameAr: 'آدم و حواء',
    videoUrl: 'https://www.youtube.com/embed/sHgEoyM0LR8',
    thumbnail: '🐍',
    color: '#0f5c2f',
    bgColor: '#DBEAFE',
    emoji: '🐍',
    survivalTargetDistance: 1100,
    obstacleSpeed: 0.010,
    spawnRate: 80,
    locked: true,
    questions: [

      q('l2_q1', 'ربنا أوصى آدم مايكلش من شجره اسمها ايه ', 'شجره معرفه الخير و الشر', '-', 'شجره الحياه', 'شجره الموز', 'a', 2, 1),
      q('l2_q2', 'ادم و حواء عملوا ليهم  لبس من ورق ايه لما اكتشفوا  أنهم عريانين ', 'ورق الجوافه ', '-', 'ورق التين.', '-', 'c', 2, 2),
      q('l2_q3', 'مين اللى خالى حوآء تاكل من الشجره ', 'الأسد.', '-', 'الحيه', 'زرافه.', 'c', 2, 3),
    ],
  },
  {
    id: 'level_3',
    nameAr: 'قايين وهابيل',
    videoUrl: 'https://www.youtube.com/embed/QGAtn5CXuWg',
    thumbnail: '🏜️',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    emoji: '🏜️',
    survivalTargetDistance: 1200,
    obstacleSpeed: 0.012,
    spawnRate: 70,
    locked: true,
    questions: [

      q('l3_q1', 'من هما أول ولدين لابينا آدم وأمنا حواء', 'قايين وهابيل ', 'يعقوب وعيسو', 'يوسف وبنيامين', '-', 'a', 3, 1),
      q('l3_q2', 'ماذا قدم قايين لله', 'بعض من ثمار الأرض ', 'أفضل خرافة', '-', '-', 'a', 3, 2),
      q('l3_q3', 'ماذا قدم هابيل لله', 'أفضل وأحسن خروف عنده', 'قمح وشعير', '-', '-', 'a', 3, 3),
    ],
  },
  {
    id: 'level_4',
    nameAr: 'نوح و الفلك',
    videoUrl: 'https://www.youtube.com/embed/bLYSvgulfqw',
    thumbnail: '🌊',
    color: '#3B82F6',
    bgColor: '#EDE9FE',
    emoji: '🌊',
    survivalTargetDistance: 1500,
    obstacleSpeed: 0.014,
    spawnRate: 60,
    locked: true,
    movementMode: 'free',
    questions: [
      q('l4_q1', 'مين اللى ربنا طلب منه يبنى الفلك', 'إبراهيم', '-', 'يوسف ', 'نوح ', 'd', 4, 1),
      q('l4_q2', 'الحيوانات دخلت الفلك ازاى', 'عشره عشره', '-', 'اتنين اتنين ', 'واحده واحده', 'c', 4, 2),
      q('l4_q3', 'بعد ما نوح بعت الحمامه رجعت معاها ايه ', 'ورقه زيتون ', '-', 'حجر', 'ورده ', 'a', 4, 3),
    ],
  },
  {
    id: 'level_5',
    nameAr: 'بابل',
    videoUrl: 'https://www.youtube.com/embed/-1WjU3CMRHQ',
    thumbnail: '🌎',
    color: '#EC4899',
    bgColor: '#FCE7F3',
    emoji: '🌎',
    survivalTargetDistance: 1800,
    obstacleSpeed: 0.016,
    spawnRate: 50,
    locked: true,
    questions: [
      q('l5_q1', 'الشعب قرر يبني ايه ؟ ', 'بيت صغير', 'سور', '-', 'مدينة و برج كبير', 'd', 5, 1),
      q('l5_q2', 'ربنا علشان يمنعهم من بناء البرج عمل ايه', 'نزل مطر شديد', 'بلبل ألسنتهم.', '-', 'نزل نار على المدينة.', 'b', 5, 2),
      q('l5_q3', 'اسم المدينه بقي ايه ', 'بابل ', 'مصر', '-', 'نينوي.', 'a', 5, 3),
    ],
  },
  {
    id: 'level_6',
    nameAr: 'إبراهيم',
    videoUrl: 'https://www.youtube.com/embed/01SdS8OEb_E',
    thumbnail: '⭐',
    color: '#F97316',
    bgColor: '#FFEDD5',
    emoji: '⭐',
    survivalTargetDistance: 2000,
    obstacleSpeed: 0.018,
    spawnRate: 40,
    locked: true,
    questions: [
      q('l6_q1', 'ابراهيم جده الكبير كان اسمه ايه', 'سام', 'اسحق.', 'يعقوب', 'نوح', 'a', 6, 1),
      q('l6_q2', 'ابراهيم اسمه األول كان ايه', 'ابيمالك', 'شيت', 'إبرام ', 'تاراح', 'c', 6, 2),
      q('l6_q3', 'ابن اخو ابراهيم كان اسمه ايه', 'تاراح', 'نوح', 'لوط', 'المطر', 'c', 6, 3),
    ],
  },
];
