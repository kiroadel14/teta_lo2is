import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Star, RotateCcw, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ResultsScreenProps {
  won: boolean;
  score: number;
  stars: number;
  levelName: string;
  onRetry: () => void;
  onBack: () => void;
}

function toArabicNumerals(n: number): string {
  const arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n)
    .replace(/[0-9]/g, (d) => arabic[parseInt(d)]);
}

export function ResultsScreen({ won, score, stars, levelName, onRetry, onBack }: ResultsScreenProps) {
  const confettiFired = useRef(false);

  useEffect(() => {
    if (won && !confettiFired.current) {
      confettiFired.current = true;
      const end = Date.now() + 2000;
      const fire = () => {
        confetti({
          particleCount: 6,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#F97316', '#FCD34D', '#22C55E', '#3B82F6', '#EF4444'],
        });
        confetti({
          particleCount: 6,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#F97316', '#FCD34D', '#22C55E', '#3B82F6', '#EF4444'],
        });
        if (Date.now() < end) requestAnimationFrame(fire);
      };
      fire();
    }
  }, [won]);

  return (
    <div
      dir="rtl"
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        fontFamily: "'Cairo', sans-serif",
        background: won
          ? 'linear-gradient(135deg, #FEF3C7 0%, #FFF9E6 40%, #DCFCE7 100%)'
          : 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #E0F2FE 100%)',
      }}
    >
      {/* Decorative background shapes */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.12 }}
      >
        {won && (
          <>
            {['★', '⭐', '🌟', '✨', '🎉', '🎊', '⭐', '★'].map((s, i) => (
              <span
                key={i}
                className="absolute text-4xl"
                style={{
                  top: `${10 + (i * 12) % 80}%`,
                  left: `${(i * 13) % 90}%`,
                  transform: `rotate(${i * 45}deg)`,
                  fontSize: `${1.5 + (i % 3) * 0.8}rem`,
                }}
              >
                {s}
              </span>
            ))}
          </>
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4 px-6 max-w-lg w-full">
        {/* Main illustration */}
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          className="text-6xl"
          style={{ fontSize: 'clamp(3rem, 10vw, 5rem)' }}
        >
          {won ? '🏆' : '🚩'}
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <h1
            style={{
              fontSize: 'clamp(1.3rem, 4vw, 2rem)',
              fontWeight: 900,
              color: won ? '#D97706' : '#1E3A5F',
              textShadow: won ? '0 2px 8px rgba(217,119,6,0.25)' : 'none',
            }}
          >
            {won ? 'أحسنت يا بطل! 🎉' : 'خلصت بنزين! جرب تاني 💪'}
          </h1>
          <p style={{ fontSize: 'clamp(0.7rem, 1.8vw, 0.9rem)', color: '#5B8DB8', fontWeight: 600, marginTop: 4 }}>
            {levelName}
          </p>
          <p
            style={{
              fontSize: 'clamp(0.6rem, 1.6vw, 0.85rem)',
              color: '#374151',
              fontWeight: 800,
              marginTop: 6,
              opacity: 0.9,
              textShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            {won ? 'كملت المسافة  ✅' : 'البنزين خلص⛽❌'}
          </p>

        </motion.div>

        {/* Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
          className="rounded-2xl px-8 py-3 shadow-lg text-center"
          style={{ background: 'white', border: '3px solid #FCD34D' }}
        >
          <p style={{ fontSize: 'clamp(0.65rem, 1.5vw, 0.8rem)', color: '#5B8DB8', fontWeight: 700 }}>مجموع نقاطك</p>
          <p
            style={{
              fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
              fontWeight: 900,
              color: '#F97316',
              lineHeight: 1.1,
            }}
          >
            {toArabicNumerals(score)}
          </p>
          <p style={{ fontSize: 'clamp(0.6rem, 1.3vw, 0.75rem)', color: '#9CA3AF', fontWeight: 600 }}>نقطة</p>
        </motion.div>

        {/* Stars */}
        {won && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex gap-3"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.5 + i * 0.15, type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Star
                  size={40}
                  fill={stars > i ? '#FCD34D' : 'none'}
                  stroke={stars > i ? '#F59E0B' : '#D1D5DB'}
                  strokeWidth={2}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex gap-3 w-full"
        >
          {/* Back to levels */}
          <button
            onClick={onBack}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 shadow-md transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #E0F2FE, #BFDBFE)',
              border: '2px solid #93C5FD',
              color: '#1E3A5F',
              fontWeight: 700,
              fontSize: 'clamp(0.7rem, 1.8vw, 0.95rem)',
              fontFamily: "'Cairo', sans-serif",
            }}
          >
            <span>رجوع للمستويات</span>
            <ChevronRight size={18} />
          </button>

          {/* Retry */}
          <button
            onClick={onRetry}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 shadow-lg transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #F97316, #EF4444)',
              border: '2px solid #F97316',
              color: 'white',
              fontWeight: 900,
              fontSize: 'clamp(0.7rem, 1.8vw, 0.95rem)',
              fontFamily: "'Cairo', sans-serif",
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            <RotateCcw size={18} />
            <span>إعادة المحاولة</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
