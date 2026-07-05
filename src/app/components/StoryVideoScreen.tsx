import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { Level } from '../data/levels';

interface StoryVideoScreenProps {
  level: Level;
  onPlay: () => void;
  onBack: () => void;
}

const SCENE_BG: Record<string, { from: string; to: string }> = {
  level_1: { from: '#065F46', to: '#34D399' },
  level_2: { from: '#1E3A8A', to: '#60A5FA' },
  level_3: { from: '#92400E', to: '#FBBF24' },
  level_4: { from: '#4C1D95', to: '#A78BFA' },
  level_5: { from: '#831843', to: '#F472B6' },
  level_6: { from: '#78350F', to: '#FCD34D' },
};

export function StoryVideoScreen({ level, onPlay, onBack }: StoryVideoScreenProps) {
  const [videoEnded, setVideoEnded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sceneBg = SCENE_BG[level.id] ?? SCENE_BG['level_1'];

  // السحر هنا: بنسمع رسايل يوتيوب عشان نعرف الفيديو خلص بجد ولا لسه
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // نتأكد إن الرسالة جاية من يوتيوب
      if (event.origin !== 'https://www.youtube.com') return;
      
      try {
        const data = JSON.parse(event.data);
        // كود 0 في يوتيوب معناه إن الفيديو انتهى للآخر
        if (data.event === 'infoDelivery' && data.info && data.info.playerState === 0) {
          setVideoEnded(true);
        }
        if (data.event === 'onStateChange' && data.info === 0) {
          setVideoEnded(true);
        }
      } catch (error) {
        // لو رسالة تانية نتجاهلها
      }
    };

    window.addEventListener('message', handleMessage);
    
    // بنبعت إشارة ليوتيوب نقوله "إحنا سامعينك، ابعتلنا حالة الفيديو"
    const timer = setInterval(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'listening' }),
          'https://www.youtube.com'
        );
      }
    }, 1000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(timer);
    };
  }, []);

  return (
    <div
      dir="rtl"
      className="relative w-full h-full overflow-hidden"
      style={{ fontFamily: "'Cairo', sans-serif", background: '#000' }}
    >
     {/* ── YOUTUBE EMBED ── */}
      {/* الكود ده بيتأكد إن اللينك سليم 100% عشان أمر الـ Autoplay يشتغل */}
      <iframe
        ref={iframeRef}
        src={level.videoUrl.includes('?') 
          ? `${level.videoUrl}&autoplay=1&controls=1&rel=0&showinfo=0&enablejsapi=1` 
          : `${level.videoUrl}?autoplay=1&controls=1&rel=0&showinfo=0&enablejsapi=1`}
        title={`Story video — ${level.nameAr}`}
        className="absolute inset-0 w-full h-full border-0"
        style={{ zIndex: 10 }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />

      {/* ── TOP BAR (زرار الرجوع بس) ── */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4 z-20 pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl transition-all hover:scale-105 active:scale-95 w-fit shadow-lg"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', color: 'white', fontWeight: 700, fontSize: '0.9rem' }}
          >
            <ChevronLeft size={18} />
            <span>رجوع للمستويات</span>
          </button>
        </div>
      </div>

      {/* ── ENDED STATE (شاشة يلا نلعب بتظهر في النص لما الفيديو يخلص) ── */}
      <AnimatePresence>
        {videoEnded && (
          <motion.div
            key="ended-screen"
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              animate={{ rotate: [0, -8, 8, -5, 5, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', marginBottom: '1rem' }}
            >
              🎬
            </motion.div>
            
            <p className="text-white text-center mb-6" style={{ fontSize: 'clamp(1rem, 3vw, 1.3rem)', fontWeight: 800 }}>
              القصة خلصت.. مستعد للسباق؟
            </p>
            
            <motion.button
              whileHover={{ scale: 1.06 }} 
              whileTap={{ scale: 0.94 }}
              onClick={onPlay}
              className="flex items-center gap-3 px-10 py-4 rounded-3xl shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #F97316, #EF4444)',
                border: '3px solid #FCD34D',
                color: 'white', fontWeight: 900,
                fontSize: 'clamp(1.2rem, 3.5vw, 1.6rem)',
                textShadow: '0 2px 6px rgba(0,0,0,0.35)',
                boxShadow: '0 8px 28px rgba(249,115,22,0.55)',
              }}
            >
              <span>يلا نلعب!</span>
              <span style={{ fontSize: '1.4em' }}>😎</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}