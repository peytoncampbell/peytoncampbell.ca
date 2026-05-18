import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LIVE_STATUS } from './data';

export default function LiveTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % LIVE_STATUS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="work-status-ticker hidden lg:flex items-center gap-2.5 rounded-full border border-cyan-300/20 bg-slate-950/70 px-3.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_rgba(2,6,23,0.2)] backdrop-blur-xl"
      aria-live="polite"
    >
      <div className="flex h-2 w-2 items-center justify-center rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.75)]">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-100" />
      </div>
      
      <div className="h-3.5 w-px bg-cyan-100/20" />
      
      <div className="relative h-5 w-[300px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute flex w-full items-center gap-2 text-xs"
          >
            <span className="whitespace-nowrap font-mono font-bold uppercase tracking-[0.18em] text-cyan-200">
              {LIVE_STATUS[index].label}
            </span>
            <span className="text-slate-500">/</span>
            <span className="truncate font-semibold text-slate-100">
              {LIVE_STATUS[index].value}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

