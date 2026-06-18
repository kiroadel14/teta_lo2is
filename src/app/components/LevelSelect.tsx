import { motion } from 'motion/react';
import { Star, Lock } from 'lucide-react';
import { LEVELS } from '../data/levels';

interface LevelSelectProps {
  onSelectLevel: (levelId: string) => void;
  levelStars: Record<string, number>;
  unlockedLevelIds: Record<string, boolean>;
  onBack?: () => void;
}


export function LevelSelect({ onSelectLevel, levelStars, unlockedLevelIds , onBack}: LevelSelectProps) {
  return (
    <div
      dir="rtl"
      className="relative w-full h-full overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(180deg, #60A5FA 0%, #93C5FD 40%, #BFDBFE 100%)', fontFamily: "'Cairo', sans-serif" }}
    >
      {/* زرار الرجوع المحدث (سهم فقط ومظبوط للموبايل) */}
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center w-12 h-12 rounded-2xl shadow-xl transition-transform hover:scale-105 active:scale-95"
          style={{ border: '3px solid #FCA5A5' }}
          title="رجوع للقائمة الرئيسية"
        >
          {/* أيقونة سهم لليمين (لأن اللعبة عربي) */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
      {/* Clouds */}
      <div className="absolute top-4 left-[10%] w-20 h-10 bg-white/80 rounded-full blur-sm" />
      <div className="absolute top-2 left-[30%] w-28 h-8 bg-white/70 rounded-full blur-sm" />
      <div className="absolute top-6 right-[15%] w-16 h-8 bg-white/75 rounded-full blur-sm" />

      {/* Title */}
      <div className="relative z-10 flex items-center justify-center pt-4 pb-2">
        <div className="px-8 py-2 rounded-2xl shadow-lg" style={{ background: 'linear-gradient(135deg, #F97316, #EF4444)' }}>
          <h1 className="text-white text-center" style={{ fontSize: 'clamp(1.2rem, 3vw, 1.8rem)', fontWeight: 900, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            🏎️ تيتا لوئيس
          </h1>
          <p className="text-orange-100 text-center" style={{ fontSize: 'clamp(0.7rem, 1.5vw, 0.9rem)', fontWeight: 600 }}>
            اختار المستوى
          </p>
        </div>
      </div>

      {/* Level grid — 3×2, rendered from LEVELS array */}
      <div className="relative z-10 flex-1 grid grid-cols-3 grid-rows-2 gap-3 p-4 pb-3">
        {LEVELS.map((level, index) => {
          const stars = levelStars[level.id] ?? -1;
          const isUnlocked = !!unlockedLevelIds[level.id];


          return (
            <motion.button
              key={level.id}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: index * 0.07, type: 'spring', stiffness: 300, damping: 20 }}
              whileHover={isUnlocked ? { scale: 1.05, y: -2 } : {}}
              whileTap={isUnlocked ? { scale: 0.97 } : {}}
              onClick={() => isUnlocked && onSelectLevel(level.id)}
              className="relative rounded-2xl overflow-hidden shadow-lg border-2 flex flex-col items-center justify-between p-2"
              style={{
                background: isUnlocked ? `linear-gradient(135deg, ${level.bgColor}, white)` : 'linear-gradient(135deg, #E5E7EB, #D1D5DB)',
                borderColor: isUnlocked ? level.color : '#9CA3AF',
                cursor: isUnlocked ? 'pointer' : 'not-allowed',
              }}
            >
              {/* Lock overlay */}
              {!isUnlocked && (
                <div className="absolute inset-0 bg-black/30 rounded-2xl flex items-center justify-center z-10">
                  <Lock className="text-white" size={28} />
                </div>
              )}

              {/* Level number badge */}
              <div
                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md"
                style={{ backgroundColor: isUnlocked ? level.color : '#9CA3AF' }}
              >
                <span className="text-white" style={{ fontWeight: 900, fontSize: '0.7rem' }}>
                  {index + 1}
                </span>
              </div>

              {/* Thumbnail / emoji */}
              <div className="mt-1" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
                {level.thumbnail}
              </div>

              {/* Level name */}
              <div className="text-center w-full">
                <p style={{ fontWeight: 700, fontSize: 'clamp(0.6rem, 1.4vw, 0.85rem)', color: isUnlocked ? '#1E3A5F' : '#6B7280' }}>
                  {level.nameAr}
                </p>
              </div>

              {/* Stars */}
              <div className="flex gap-0.5 pb-1">
                {[0, 1, 2].map((i) => (
                  <Star key={i} size={14} fill={stars > i ? '#FCD34D' : 'none'} stroke={stars > i ? '#F59E0B' : '#D1D5DB'} strokeWidth={2} />
                ))}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Bottom grass strip */}
      <div className="h-6 w-full flex-shrink-0" style={{ background: 'linear-gradient(180deg, #22C55E, #16A34A)' }} />
    </div>
  );
}
