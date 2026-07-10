import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LevelSelect } from './components/LevelSelect';
import { RaceScreen } from './components/RaceScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { StoryVideoScreen } from './components/StoryVideoScreen';
import { LEVELS } from './data/levels';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase"; // تأكد إن db موجودة في ملف firebase.ts
import AuthScreen from "./AuthScreen";

type Screen =
  | 'title'
  | 'auth'
  | 'levelSelect'
  | 'story'
  | 'racing'
  | 'results'
  | 'leaderboard';

interface GameResult {
  won: boolean;
  score: number;
  stars: number;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('title');
  const [selectedLevelId, setSelectedLevelId] = useState<string>('level_1');
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [levelStars, setLevelStars] = useState<Record<string, number>>({});
  const [levelScores, setLevelScores] = useState<Record<string, number>>({}); // State لحفظ السكور
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]); // State لحفظ بيانات المتصدرين
  const [raceKey, setRaceKey] = useState(0);

  const [unlockedLevelIds, setUnlockedLevelIds] = useState<Record<string, boolean>>(() => ({
    level_1: true,
  }));

  // 1. متابعة تسجيل الدخول
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. سحب البيانات من Firestore لو اليوزر مسجل دخول
  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.unlockedLevels) {
            const unlockedObj: Record<string, boolean> = {};
            data.unlockedLevels.forEach((id: string) => { unlockedObj[id] = true; });
            unlockedObj.level_1 = true;
            setUnlockedLevelIds(unlockedObj);
          }
          if (data.stars) setLevelStars(data.stars);
          if (data.scores) setLevelScores(data.scores);

          // تحديث بيانات المستخدم القديم لو معندوش اسم
          if (!data.displayName && user.displayName) {
            try { await updateDoc(docRef, { displayName: user.displayName, email: user.email }); } catch (e) { }
          }
        } else {
          await setDoc(docRef, {
            unlockedLevels: ["level_1"],
            stars: {},
            scores: {},
            totalScore: 0,
            currentLevel: "level_1",
            email: user.email,
            displayName: user.displayName || "" // هيحفظ الاسم هنا
          });
          setUnlockedLevelIds({ level_1: true });
          setLevelStars({});
          setLevelScores({});
        }
      };
      fetchUserData();
    } else {
      // لو زائر (Guest) أو عمل تسجيل خروج، نرجع اللعبة للصفر محلياً
      setUnlockedLevelIds({ level_1: true });
      setLevelStars({});
      setLevelScores({});
    }
  }, [user]);

  const unlockedLevelIdsForSelect = useMemo(() => unlockedLevelIds, [unlockedLevelIds]);

  const selectedLevel = LEVELS.find((l) => l.id === selectedLevelId) ?? LEVELS[0];

  const handleSelectLevel = (levelId: string) => {
    setSelectedLevelId(levelId);
    setRaceKey((k) => k + 1);
    setScreen('story');
  };

  // دالة لجلب بيانات المتصدرين من Firestore
  const fetchLeaderboard = async () => {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, orderBy("totalScore", "desc"), limit(10));
      const querySnapshot = await getDocs(q);

      const list: any[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });

      setLeaderboardData(list);
      setScreen('leaderboard');
    } catch (error) {
      console.error("Error fetching leaderboard: ", error);
    }
  };

  // 3. حفظ التقدم في Firestore بعد نهاية السباق (في كل الأحوال)
  const handleGameOver = async (result: GameResult) => {
    setGameResult(result);

    const currentStars = levelStars[selectedLevelId] ?? 0;
    const newStars = Math.max(currentStars, result.stars);
    const updatedStars = { ...levelStars, [selectedLevelId]: newStars };
    setLevelStars(updatedStars);

    const currentScore = levelScores[selectedLevelId] ?? 0;
    const newScore = Math.max(currentScore, result.score);
    const updatedScores = { ...levelScores, [selectedLevelId]: newScore };
    setLevelScores(updatedScores);

    const totalScore = Object.values(updatedScores).reduce((sum, s) => sum + s, 0);

    let updatedUnlockedIds = { ...unlockedLevelIds };
    let nextLevelIdToSave = selectedLevelId;

    if (result.won) {
      const currentIndex = LEVELS.findIndex((l) => l.id === selectedLevelId);
      const nextLevel = currentIndex >= 0 ? LEVELS[currentIndex + 1] : undefined;

      if (nextLevel) {
        updatedUnlockedIds[nextLevel.id] = true;
        nextLevelIdToSave = nextLevel.id;
      }
    }
    setUnlockedLevelIds(updatedUnlockedIds);

    if (user) {
      const docRef = doc(db, "users", user.uid);
      try {
        await updateDoc(docRef, {
          stars: updatedStars,
          scores: updatedScores,
          totalScore: totalScore,
          displayName: user.displayName || "",
          unlockedLevels: Object.keys(updatedUnlockedIds).filter((id) => updatedUnlockedIds[id]),
          currentLevel: nextLevelIdToSave
        });
      } catch (error) {
        await setDoc(docRef, {
          displayName: user.displayName || "",
          totalScore: totalScore,
          stars: updatedStars,
          scores: updatedScores,
          unlockedLevels: Object.keys(updatedUnlockedIds).filter((id) => updatedUnlockedIds[id])
        }, { merge: true });
      }
    }

    setScreen('results');
  };

  const handleRetry = () => {
    setRaceKey((k) => k + 1);
    setScreen('racing');
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white" style={{ background: '#1E3A5F', fontFamily: "'Cairo', sans-serif" }}>
        جاري التحميل...
      </div>
    );
  }

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{ fontFamily: "'Cairo', sans-serif", background: '#1E3A5F' }}
    >
      <AnimatePresence mode="wait">
        {screen === 'title' && (
          <motion.div
            key="title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0"
          >
            <TitleScreen
              onStart={() => setScreen('levelSelect')}
              onLogin={() => setScreen('auth')}
              onShowLeaderboard={fetchLeaderboard}
              user={user}
            />
          </motion.div>
        )}

        {screen === 'leaderboard' && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white"
            dir="rtl"
            style={{ background: '#1E3A5F' }}
          >
            <div className="bg-slate-800/90 p-6 rounded-3xl border-4 border-yellow-400 w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
              <h2 className="text-3xl font-black text-center text-yellow-300 mb-4 drop-shadow">🏆 لوحة المتصدرين</h2>

              <div className="overflow-y-auto flex-1 flex flex-col gap-2 pr-1">
                {leaderboardData.length === 0 ? (
                  <p className="text-center text-slate-400 mt-4">لا يوجد لاعبين حتى الآن</p>
                ) : (
                  leaderboardData.map((player, index) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-3 rounded-xl font-bold ${player.id === user?.uid ? 'bg-yellow-500 text-slate-900 border-2 border-white' : 'bg-slate-700 text-white'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl w-6 text-center">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                        </span>
                        <span className="truncate max-w-[180px] text-sm">
                          {player.displayName ? player.displayName : (player.email ? player.email.split('@')[0] : 'لاعب زائر')}
                        </span>
                      </div>
                      <span className="text-yellow-300 font-black bg-slate-900/40 px-3 py-1 rounded-lg text-sm">
                        {player.totalScore ?? 0} نقطة
                      </span>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => setScreen('title')}
                className="bg-red-600 hover:bg-red-700 text-white font-bold p-2 rounded-xl mt-4 shadow-md transition-all"
              >
                رجوع للقائمة الرئيسية ↩
              </button>
            </div>
          </motion.div>
        )}

        {screen === 'auth' && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <AuthScreen
              onLoginSuccess={() => {
                setScreen('levelSelect');
              }}
              onBack={() => setScreen('title')}
            />
          </motion.div>
        )}

        {screen === 'levelSelect' && (
          <motion.div
            key="levelSelect"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            <LevelSelect onSelectLevel={handleSelectLevel} levelStars={levelStars} unlockedLevelIds={unlockedLevelIdsForSelect}
              onBack={() => setScreen('title')} />
          </motion.div>
        )}

        {screen === 'story' && (
          <motion.div
            key={`story-${selectedLevelId}`}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            <StoryVideoScreen
              level={selectedLevel}
              onPlay={() => { setRaceKey((k) => k + 1); setScreen('racing'); }}
              onBack={() => setScreen('levelSelect')}
            />
          </motion.div>
        )}

        {screen === 'racing' && (
          <motion.div
            key={`race-${raceKey}`}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
          >
            <RaceScreen
              level={selectedLevel}
              onGameOver={handleGameOver}
              onBack={() => setScreen('levelSelect')}
            />
          </motion.div>
        )}

        {screen === 'results' && gameResult && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0"
          >
            <ResultsScreen
              won={gameResult.won}
              score={gameResult.score}
              stars={gameResult.stars}
              levelName={selectedLevel.nameAr}
              onRetry={handleRetry}
              onBack={() => setScreen('levelSelect')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TitleScreen({
  onStart,
  onLogin,
  onShowLeaderboard,
  user,
}: {
  onStart: () => void;
  onLogin: () => void;
  onShowLeaderboard: () => void;
  user: any;
}) {
  return (
    <div
      dir="rtl"
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #1E3A5F 0%, #1D4ED8 40%, #60A5FA 100%)',
        fontFamily: "'Cairo', sans-serif",
      }}
    >
      <motion.button
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={onShowLeaderboard}
        className="absolute top-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          border: '3px solid #FCD34D',
          boxShadow: '0 8px 20px rgba(245, 158, 11, 0.4)',
        }}
        title="لوحة المتصدرين"
      >
        <span className="text-3xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>🏆</span>
      </motion.button>

      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            top: `${(i * 7) % 60}%`,
            left: `${(i * 13 + 5) % 95}%`,
            opacity: 0.4 + (i % 5) * 0.1,
            animation: `twinkle ${2 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${(i * 0.3) % 2}s`,
          }}
        />
      ))}

      {/* Sky layer */}
      <div className="absolute top-0 inset-x-0 bottom-40 z-0 pointer-events-none overflow-hidden">
        {/* السحابة */}
        <div
          className="absolute text-5xl opacity-60"
          style={{ top: '15%', left: '10%', animation: 'moveCloud 40s linear infinite alternate' }}>
          ☁️
        </div>
        <div
          className="absolute text-4xl opacity-50"
          style={{ top: '25%', left: '60%', animation: 'moveCloud 50s linear infinite alternate-reverse' }}>
          ☁️
        </div>

        {/* الطيارة */}
        <div
          className="absolute text-5xl drop-shadow-md"
          style={{ animation: 'flyDiagonalLeft 15s linear infinite both' }}>
          ✈️
        </div>
      </div>

      {/* ── Animated Bottom Landscape (بر وبحر) ── */}
      {/* ضفنا overflow-hidden هنا للطبقة الكبيرة اللي ماسكاهم كلهم عشان المراكب متطلعش برا الشاشة */}
      <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none flex flex-col justify-end z-0 overflow-hidden">

        {/* River layer - شيلنا overflow-hidden من هنا عشان الفلك يبان كامل من فوق */}
        <div className="relative w-full h-12 bg-[#3B82F6] border-t border-blue-400/40 z-0">
          <div className="absolute top-1 left-0 right-0 h-px bg-white/20" />
          <div className="absolute top-3 left-0 right-0 h-px bg-white/10" />
          {/* ضفنا right: '-20%' وكلمة both */}
          <div className="absolute bottom-1 text-4xl drop-shadow-md" style={{ right: '-20%', animation: 'moveLeft 15s linear infinite 2s both' }}>🚤</div>
          {/* رفعنا الفلك (bottom-1 بدل bottom-4) وغيرنا حجمه عشان يبان مظبوط وغيرناه للمركب الخشبي البني 🛶 */}
          <div className="absolute bottom-1 text-4xl drop-shadow-2xl" style={{ right: '-20%', animation: 'moveLeft 14s linear infinite both' }}>🚢</div>
        </div>

        {/* Road layer */}
        <div className="relative w-full h-12 bg-stone-800 border-t border-stone-500 shadow-lg z-0">
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 opacity-40"
            style={{ backgroundImage: 'repeating-linear-gradient(to right, transparent, transparent 20px, white 20px, white 40px)' }}
          />
          {/* ضفنا right: '-20%' وكلمة both */}
          <div className="absolute bottom-1 text-5xl drop-shadow-lg" style={{ right: '-20%', animation: 'moveLeft 8s linear infinite both' }}>🏎️</div>
        </div>
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
        className="flex flex-col items-center gap-3 z-10 mb-8"
      >
        <img
          src="logos/logo.png"
          alt="Teta Lo2is Logo"
          className="w-64 h-auto object-contain mb-1 drop-shadow-2xl"
        />

        <div
          className="px-5 py-2 rounded-2xl shadow-xl text-center max-w-[240px]"
          style={{
            background: 'linear-gradient(135deg, #F97316, #EF4444)',
            border: '3px solid #FCD34D',
            boxShadow: '0 6px 20px rgba(239,68,68,0.4), 0 0 0 3px rgba(252,211,77,0.3)',
          }}
        >
          <p
            className="text-yellow-200 mb-0.5"
            style={{ fontSize: 'clamp(0.55rem, 1.2vw, 0.7rem)', fontWeight: 700, letterSpacing: '0.05em' }}
          >
            لعبة المغامرات التعليمية
          </p>

          <h1
            className="text-white"
            style={{
              fontSize: 'clamp(1.3rem, 4.5vw, 2.2rem)',
              fontWeight: 900,
              textShadow: '0 2px 8px rgba(0,0,0,0.4)',
              lineHeight: 1.1,
            }}
          >
            تيتا لوئيس
          </h1>
          <p className="text-orange-200 mt-0.5" style={{ fontSize: 'clamp(0.5rem, 1vw, 0.65rem)', fontWeight: 600 }}>
            ✨ تعالى نلعب مع تيتا! ✨
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStart}
          className="px-10 py-3 rounded-2xl shadow-xl mt-2 w-full"
          style={{
            background: 'linear-gradient(135deg, #22C55E, #16A34A)',
            color: 'white',
            fontWeight: 900,
            fontSize: 'clamp(0.95rem, 2.5vw, 1.3rem)',
            fontFamily: "'Cairo', sans-serif",
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            border: '3px solid #4ADE80',
            boxShadow: '0 8px 24px rgba(34,197,94,0.4)',
          }}
        >
          🎮 ابدأ اللعب
        </motion.button>

        {user && (
          <motion.button
            onClick={() => signOut(auth)}
            className="px-10 py-3 rounded-2xl shadow-xl mt-3 w-full"
            style={{
              background: "red",
              color: "white",
              fontWeight: 900,
            }}
          >
            🚪 تسجيل الخروج
          </motion.button>
        )}

        {!user && (
          <motion.button
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLogin}
            className="px-10 py-3 rounded-2xl shadow-xl mt-3 w-full"
            style={{
              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
              color: 'white',
              fontWeight: 900,
            }}
          >
            👤 تسجيل الدخول
          </motion.button>
        )}
      </motion.div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.5); }
        }
        @keyframes moveLeft {
          0% { right: -20%; }
          100% { right: 120%; }
        }
        @keyframes moveLeftFlipped {
          0% { right: -20%; transform: scaleX(-1); }
          100% { right: 120%; transform: scaleX(-1); }
        }
        @keyframes moveCloud {
          0% { transform: translateX(0); }
          100% { transform: translateX(30px); }
        }
      `}</style>
    </div>
  );
}