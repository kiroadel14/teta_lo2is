import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { LevelQuestion } from '../data/levels';
import fuelBonusSound from './fuel-bonus.mp3';
import wrongSound from './wrong.mp3';
interface GasStationModalProps {
  questions: LevelQuestion[];
  onComplete: (correctCount: number) => void;
  levelId: string; // 👈 ضفنا السطر ده
}

type AnswerState = 'idle' | 'correct' | 'incorrect';

const SLOT_COLORS: Record<string, { bg: string; text: string }> = {
  red:    { bg: '#EF5350', text: '#ffffff' },
  blue:   { bg: '#1E88E5', text: '#ffffff' },
  green:  { bg: '#43A047', text: '#ffffff' },
  yellow: { bg: '#FDD835', text: '#1a1a1a' },
};

function toArabicNumerals(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
}

// Animated audio wave bars
function AudioWaveIcon({ active }: { active: boolean }) {
  const heights = [0.5, 1, 0.7, 1, 0.6];
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      {heights.map((h, i) => {
        const baseH = h * 8 + 4;
        return (
          <motion.rect
            key={i}
            x={i * 6 + 1}
            width={4}
            rx={2}
            fill="white"
            animate={
              active
                ? { height: [baseH, baseH * 2, baseH * 0.7, baseH], y: [10 - baseH / 2, 10 - baseH, 10 - baseH * 0.35, 10 - baseH / 2] }
                : { height: baseH, y: 10 - baseH / 2 }
            }
            transition={active ? { repeat: Infinity, duration: 0.55 + i * 0.08, ease: 'easeInOut', delay: i * 0.07 } : {}}
          />
        );
      })}
    </svg>
  );
}

export function GasStationModal({ questions, onComplete, levelId }: GasStationModalProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>('idle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showFuelAnim, setShowFuelAnim] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const question = questions[currentQ];
// ── مراجع الأصوات اللحظية ──
  const correctAudioRef = useRef<HTMLAudioElement | null>(null);
  const wrongAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    correctAudioRef.current = new Audio(fuelBonusSound);
    wrongAudioRef.current = new Audio(wrongSound);

    return () => {
      correctAudioRef.current?.pause();
      correctAudioRef.current = null;
      wrongAudioRef.current?.pause();
      wrongAudioRef.current = null;
    };
  }, []);
  // Reset audio on question change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioPlaying(false);
  }, [currentQ]);

  const handleAudio = () => {
    if (audioPlaying) {
      audioRef.current?.pause();
      setAudioPlaying(false);
      return;
    }
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(question.audioUrl);
        audioRef.current.onended = () => setAudioPlaying(false);
        audioRef.current.onerror = () => setAudioPlaying(false); // fail silently if file missing
      }
      audioRef.current.play().catch(() => setAudioPlaying(false));
      setAudioPlaying(true);
    } catch {
      // fail silently
    }
  };

 const handleAnswer = (answerId: string, isCorrect: boolean) => {
    if (answerState !== 'idle') return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setAudioPlaying(false);

    setSelectedId(answerId);
    const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
    setAnswerState(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      // 👇 تشغيل صوت الإجابة الصح فوراً
      correctAudioRef.current?.play().catch(() => {});
      
      setCorrectCount(nextCorrect);
      setShowFuelAnim(true);
      setTimeout(() => setShowFuelAnim(false), 1200);
    } else {
      // 👇 تشغيل صوت الإجابة الغلط فوراً
      wrongAudioRef.current?.play().catch(() => {});
    }

    setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ((q) => q + 1);
        setAnswerState('idle');
        setSelectedId(null);
      } else {
        let count = 3;
        setCountdown(count);
        const timer = setInterval(() => {
          count--;
          if (count <= 0) { clearInterval(timer); setCountdown(null); onComplete(nextCorrect); }
          else setCountdown(count);
        }, 900);
      }
    }, 1400);
  };
  return (
    <div dir="rtl" className="absolute inset-0 flex flex-col items-center justify-end z-50" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Dimmed backdrop */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full rounded-t-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(180deg, #FFF9E6, #FFFBF0)', maxHeight: '85%', borderTop: '4px solid #F97316' }}
      >
        {/* Header */}
        <div className="flex flex-col items-center pt-3 pb-2 px-4" style={{ background: 'linear-gradient(135deg, #F97316, #FB923C)' }}>
          <div className="text-3xl mb-0.5">⛽</div>
          <h2 className="text-white text-center" style={{ fontSize: 'clamp(0.95rem, 2.8vw, 1.4rem)', fontWeight: 900 }}>
            محطة الوقود! 🎯
          </h2>
          {/* RTL progress dots */}
          <div className="flex gap-2 mt-1.5 flex-row-reverse">
            {questions.map((_, i) => (
              <div key={i} className="h-2 rounded-full transition-all duration-300"
                style={{ width: i === currentQ ? 22 : 9, backgroundColor: i < currentQ ? '#FCD34D' : i === currentQ ? 'white' : 'rgba(255,255,255,0.38)' }} />
            ))}
          </div>
          <p className="text-orange-100 mt-0.5" style={{ fontSize: 'clamp(0.6rem, 1.4vw, 0.78rem)', fontWeight: 600 }}>
            سؤال {toArabicNumerals(currentQ + 1)} من {toArabicNumerals(questions.length)}
          </p>
        </div>

        <div className="p-3 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 110px)' }}>
          <AnimatePresence mode="wait">
            {/* Countdown */}
            {countdown !== null ? (
              <motion.div key="countdown" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-8 gap-3">
             <div className="text-5xl mb-3 flex items-center justify-center gap-2" style={{ animation: 'bounce 1s infinite' }}>
                  {['level_3', 'level_6'].includes(levelId) ? (
                    <>☁️ ✈️</> /* ليفل 3 و 6: طيارات */
                  ) : levelId === 'level_4' ? (
                    <>🌊 🚢</> /* ليفل 4: فلك */
                  ) : levelId === 'level_1' ? (
                    <>🌊 🚤</> /* ليفل 1: مركب */
                  ) : (
                    <>💨 🏎️</> /* ليفل 2 و 5: عربيات */
                  )}
                </div>
                <p style={{ fontSize: 'clamp(0.85rem, 2vw, 1.05rem)', fontWeight: 700, color: '#F97316' }}>هنرجع للسباق...</p>
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl"
                  style={{ background: 'linear-gradient(135deg, #F97316, #EF4444)', fontSize: '1.8rem', fontWeight: 900 }}>
                  {toArabicNumerals(countdown)}
                </div>
              </motion.div>
            ) : (
              /* Question card */
              <motion.div key={`q-${currentQ}`} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.22 }}>

                {/* ── AUDIO BUTTON ── */}
                <div className="flex flex-col items-center mb-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
                    onClick={handleAudio}
                    className="flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-lg"
                    style={{
                      background: audioPlaying ? 'linear-gradient(135deg, #22C55E, #16A34A)' : 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                      border: `3px solid ${audioPlaying ? '#4ADE80' : '#60A5FA'}`,
                      minWidth: 180,
                      boxShadow: audioPlaying ? '0 0 16px rgba(34,197,94,0.5)' : '0 4px 16px rgba(59,130,246,0.4)',
                    }}
                  >
                    <AudioWaveIcon active={audioPlaying} />
                    <span className="text-white" style={{ fontSize: 'clamp(0.75rem, 2vw, 0.95rem)', fontWeight: 700 }}>
                      {audioPlaying ? 'بيشتغل...' : 'استمع للسؤال'}
                    </span>
                  </motion.button>
                  <p className="text-center mt-1" style={{ fontSize: 'clamp(0.58rem, 1.3vw, 0.7rem)', color: '#6B7280', fontWeight: 600 }}>
                    {audioPlaying ? '🔊 الصوت شغال — دوس تاني عشان توقف' : 'اضغط عشان تسمع السؤال'}
                  </p>
                </div>

                {/* Question text */}
                <p className="mb-3 text-center" style={{ fontSize: 'clamp(0.95rem, 2.8vw, 1.3rem)', fontWeight: 700, color: '#1E3A5F', lineHeight: 1.4 }}>
                  {question.questionText}
                </p>

                {/* ── ANSWER BUTTONS (color-coded by slot) ── */}
                <div className="grid grid-cols-2 gap-2">
                  {question.answers.map((ans) => {
                    const slotColor = SLOT_COLORS[ans.color];
                    const isSelected = selectedId === ans.id;
                    const isCorrect = ans.id === question.correctAnswerId;
                    const resolved = answerState !== 'idle';

                    // Border + overlay logic
                    let borderStyle = '3px solid transparent';
                    let overlayOpacity = 0;
                    let showCheck = false;
                    let showCross = false;

                    if (resolved) {
                      if (isCorrect) {
                        borderStyle = '3px solid white';
                        showCheck = true;
                      } else if (isSelected && !isCorrect) {
                        overlayOpacity = 0.28;
                        showCross = true;
                      }
                    }

                    return (
                      <motion.button
                        key={ans.id}
                        whileHover={!resolved ? { scale: 1.04 } : {}}
                        whileTap={!resolved ? { scale: 0.95 } : {}}
                        onClick={() => handleAnswer(ans.id, isCorrect)}
                        disabled={resolved}
                        className="relative rounded-2xl p-2.5 flex flex-col items-center justify-center shadow-md overflow-hidden"
                        style={{
                          minHeight: 64,
                          background: slotColor.bg,
                          border: borderStyle,
                          cursor: resolved ? 'default' : 'pointer',
                          transition: 'border 0.2s',
                        }}
                      >
                        {/* Dark overlay for wrong selected */}
                        {overlayOpacity > 0 && (
                          <div className="absolute inset-0 rounded-2xl" style={{ background: `rgba(0,0,0,${overlayOpacity})` }} />
                        )}

                        {/* Content */}
                        <span className="relative z-10" style={{ fontSize: 'clamp(0.72rem, 1.8vw, 0.95rem)', fontWeight: 800, color: slotColor.text, textAlign: 'center' }}>
                          {ans.text}
                        </span>

                        {/* Feedback icon */}
                        {showCheck && (
                          <span className="absolute top-1 left-1 z-20 text-white font-black" style={{ fontSize: '0.9rem', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>✓</span>
                        )}
                        {showCross && (
                          <span className="absolute top-1 left-1 z-20 text-white font-black" style={{ fontSize: '0.9rem', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>✗</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Feedback message */}
                <AnimatePresence>
                  {answerState !== 'idle' && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-3 flex items-center justify-center gap-2">
                      {answerState === 'correct' ? (
                        <>
                          <CheckCircle size={20} className="text-green-500" />
                          <span style={{ fontWeight: 900, fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)', color: '#16A34A' }}>برافو! تمام! 🎉</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={20} className="text-amber-500" />
                          <span style={{ fontWeight: 700, fontSize: 'clamp(0.85rem, 2.2vw, 1rem)', color: '#92400E' }}>معلش، حاول تاني! 💪</span>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* +25% fuel float animation */}
        <AnimatePresence>
          {showFuelAnim && (
            <motion.div
              initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 1, 1, 0], y: -64 }} transition={{ duration: 1.2 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
            >
              <div className="px-4 py-2 rounded-full text-white shadow-xl"
                style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)', fontWeight: 900, fontSize: '1.15rem' }}>
                +٢٥٪ وقود ⛽
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
