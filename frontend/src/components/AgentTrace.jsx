import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, Cpu, Loader2, MessageSquareCode, Terminal, Sparkles, ChevronDown } from 'lucide-react';
import { synth } from '../hooks/audioSynth';

// ─── Animation Variants ───────────────────────────────────────────────────
// [MATERIAL 3 / FRAMER-MOTION ANIMATION STATE CONFIGURATION]
// Handles layout transitions dynamically using spring-based physics for premium micro-interactions.
// Integrates user-agent accessibility parameters (reduced motion override) to respect system-level preferences.
const logLineVariants = (reduced) => ({
  hidden: reduced ? {} : { opacity: 0, y: 8 },
  visible: reduced
    ? {}
    : {
        opacity: 1,
        y: 0,
        transition: {
          type: 'spring',
          stiffness: 150,
          damping: 16
        }
      },
});

const narratorVariants = (reduced) => ({
  hidden:   reduced ? {} : { opacity: 0, scaleY: 0.98, originY: 0 },
  visible:  reduced
    ? {}
    : { opacity: 1, scaleY: 1, transition: { duration: 0.35, ease: 'easeOut' } },
});

// ─── Component ────────────────────────────────────────────────────────────

export default function AgentTrace({ activeStep, logs = [], finalInsight }) {
  const reduced = useReducedMotion();
  const [typedInsight, setTypedInsight] = useState('');
  const [logsExpanded, setLogsExpanded] = useState(false);
  const logContainerRef = useRef(null);

  // [LAYOUT LIFECYCLE TRACKING HOOK - AUDIO SYNCHRONIZATION]
  // Triggers tick audio effect on change to match chronological log additions.
  useEffect(() => {
    if (logs.length > 0) {
      synth.playTick();
    }
  }, [logs.length]);

  // [LAYOUT LIFECYCLE TRACKING HOOK - SUCCESS FEEDBACK STATE]
  // Plays final audio alert only when step transitions to completion.
  useEffect(() => {
    if (activeStep === 5) {
      synth.playDone();
    }
  }, [activeStep]);

  // [TYPEWRITER SIMULATION STREAMING CONSTRAINT BOUNDARY]
  // Throttles and streams the multi-agent final text insight character-by-character.
  // Utilizes clean state resetting boundaries to clear previous outputs when a new query commences,
  // preventing out-of-order execution, race conditions, or text overlaps.
  useEffect(() => {
    if (!finalInsight) {
      setTypedInsight('');
      return;
    }
    
    setTypedInsight('');
    let active = true;
    let idx = 0;
    
    const tick = () => {
      if (!active) return;
      const char = finalInsight.charAt(idx);
      setTypedInsight((prev) => prev + char);
      if (idx % 2 === 0) {
        synth.playTick();
      }
      idx++;
      if (idx < finalInsight.length) {
        setTimeout(tick, 20);
      }
    };
    
    setTimeout(tick, 20);

    return () => {
      active = false;
    };
  }, [finalInsight]);

  // [LAYOUT LIFECYCLE TRACKING HOOK - SCROLL BOUNDARY ANCHOR]
  // Auto-scrolls the terminal logs panel to the bottom when new console lines are appended.
  useEffect(() => {
    if (logContainerRef.current) {
      const container = logContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [logs, logsExpanded]);

  const steps = [
    { id: 1, name: 'PlannerAgent' },
    { id: 2, name: 'FeatureAgent' },
    { id: 3, name: 'PredictorAgent' },
    { id: 4, name: 'NarratorAgent' },
  ];

  const ts = () =>
    new Date().toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });

  const getAgentColorClass = (agent) => {
    switch (agent) {
      case 'PlannerAgent':   return 'text-cyan-400 font-semibold';
      case 'FeatureAgent':   return 'text-purple-300 font-semibold';
      case 'PredictorAgent': return 'text-emerald-400 font-semibold';
      case 'NarratorAgent':  return 'text-amber-300 font-semibold';
      default:               return 'text-sky-300 font-semibold';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-6 space-y-6">

      {/* ── 1. Interactive Multi-Agent Visual Node Map ────────────────── */}
      <div className="bg-m3Surface rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-m3Border theme-transition">
        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-m3Border">
          <Cpu className="h-4.5 w-4.5 text-m3Primary flex-shrink-0" />
          <h3 className="text-xs font-sans font-bold uppercase tracking-[0.1em] text-m3Text">
            Multi-Agent Cognitive Workflow
          </h3>
        </div>

        <div className="w-full overflow-x-auto pb-4 scrollbar-thin">
          <div className="relative flex items-center justify-between w-full py-6 px-4 min-w-[600px] select-none">
            {/* SVG Connector overlay behind the nodes */}
            <svg className="absolute left-[12%] right-[12%] top-[38px] h-2 w-[76%] pointer-events-none overflow-visible z-0">
              {/* Background connector path */}
              <line x1="0" y1="4" x2="100%" y2="4" stroke="var(--m3-border)" strokeWidth="3" strokeLinecap="round" />
              
              {/* Animated Glowing connector pulses */}
              {activeStep >= 2 && (
                <motion.line
                  x1="0" y1="4" x2="33.33%" y2="4"
                  stroke="#c084fc" strokeWidth="3" strokeLinecap="round"
                  initial={{ strokeDasharray: "8 4", strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: -24 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                />
              )}
              {activeStep >= 3 && (
                <motion.line
                  x1="33.33%" y1="4" x2="66.66%" y2="4"
                  stroke="#818cf8" strokeWidth="3" strokeLinecap="round"
                  initial={{ strokeDasharray: "8 4", strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: -24 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                />
              )}
              {activeStep >= 4 && (
                <motion.line
                  x1="66.66%" y1="4" x2="100%" y2="4"
                  stroke="#22d3ee" strokeWidth="3" strokeLinecap="round"
                  initial={{ strokeDasharray: "8 4", strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: -24 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                />
              )}
            </svg>

            {/* Visual Node Items */}
            {steps.map((step, idx) => {
              const isCompleted = step.id < activeStep;
              const isActive    = step.id === activeStep;

              return (
                <motion.div
                  key={step.id}
                  className="relative flex flex-col items-center z-10 w-32"
                  initial={reduced ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.08 }}
                >
                  {/* Node Circle */}
                  <motion.div
                    animate={isActive && !reduced ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-md theme-transition ${
                      isCompleted 
                        ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-700/80 text-emerald-600 dark:text-emerald-400' 
                        : isActive 
                        ? 'bg-indigo-50 border-indigo-400 dark:bg-indigo-950/30 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.25)]' 
                        : 'bg-m3Surface border-m3Border text-m3TextMuted'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5 stroke-[3px]" />
                    ) : isActive ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <span className="text-[10px] font-mono font-bold">{step.id}</span>
                    )}
                  </motion.div>

                  {/* Node labels */}
                  <span className={`text-[11px] font-sans font-bold mt-3 theme-transition ${
                    isCompleted ? 'text-m3TextMuted line-through decoration-m3TextMuted/40' 
                    : isActive ? 'text-m3Primary font-extrabold' 
                    : 'text-m3TextMuted font-medium'
                  }`}>
                    {step.name}
                  </span>
                  <span className="text-[9px] text-m3TextMuted uppercase tracking-wider font-semibold mt-0.5">
                    {step.id === 1 ? 'Plan' : step.id === 2 ? 'Fetch' : step.id === 3 ? 'Predict' : 'Narrate'}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 2. Expandable Developer Terminal Console (Dugout Monitor) ────── */}
      <div className="bg-m3Surface border border-m3Border rounded-2xl overflow-hidden shadow-sm theme-transition">
        {/* Expandable Header bar */}
        <button
          onClick={() => {
            synth.playClick();
            setLogsExpanded(!logsExpanded);
          }}
          className="w-full flex items-center justify-between px-6 py-4 text-xs font-bold uppercase tracking-wider text-m3Text hover:bg-m3Canvas/40 transition-colors focus:outline-none"
        >
          <div className="flex items-center gap-2.5">
            <Terminal className="h-4 w-4 text-m3Primary" />
            <span>View Raw Developer Trace Logs</span>
          </div>
          <motion.div
            animate={{ rotate: logsExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4.5 w-4.5 text-m3TextMuted" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {logsExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden border-t border-m3Border bg-[#0b0f19]"
            >
              {/* Console logs output */}
              <div
                ref={logContainerRef}
                className="p-6 max-h-80 overflow-y-auto flex flex-col gap-2 min-h-[140px] font-mono text-[11.5px] leading-relaxed bg-[#0b0f19] scrollbar-thin scrollbar-slate-800 scroll-smooth"
              >
                <AnimatePresence>
                  {logs.map((log, index) => (
                    <motion.div
                      key={index}
                      variants={logLineVariants(reduced)}
                      initial="hidden"
                      animate="visible"
                      className="flex items-start gap-3"
                    >
                      <span className="text-slate-500 select-none flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {ts()}
                      </span>
                      <span className="text-slate-500/60 select-none flex-shrink-0">
                        [<span className={getAgentColorClass(log.agent)}>{log.agent}</span>]
                      </span>
                      <span className={log.type === 'warning' ? 'text-rose-400 font-bold' : 'text-slate-100'}>
                        {log.text}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Running sequence cursor */}
                {activeStep < 5 && activeStep > 0 && (
                  <div className="flex items-center gap-2 text-slate-500/80 mt-1 font-mono">
                    <span>$ executing sequence</span>
                    <span className="w-1.5 h-3 bg-cyan-400 inline-block animate-pulse" />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 3. Gemini AI Style Narrator Output ────────────────────────────── */}
      <AnimatePresence>
        {finalInsight && (
          <motion.div
            key="narrator"
            variants={narratorVariants(reduced)}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="relative overflow-hidden bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-transparent border border-purple-500/10 rounded-2xl p-6.5 pl-7 shadow-[0_10px_35px_rgba(99,102,241,0.04)]"
          >
            {/* Left border gradient accent */}
            <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b from-purple-500 to-blue-500" />

            {/* Sparkling icon anchored at top right */}
            <div className="absolute top-5 right-5 flex items-center justify-center p-2 rounded-full bg-purple-500/10 shadow-inner">
              <Sparkles className="h-4.5 w-4.5 text-purple-500 animate-pulse" />
            </div>

            <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-500/10">
              <p className="text-[10px] font-sans font-bold uppercase tracking-[0.12em] text-purple-600 flex items-center gap-2">
                <MessageSquareCode className="h-4.5 w-4.5 text-purple-500" />
                NarratorAgent // Broadcast Summary Feed
              </p>
              <span className="text-[9px] font-sans font-extrabold bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full px-3 py-1 uppercase tracking-[0.1em] shadow-sm mr-10">
                ON AIR
              </span>
            </div>

            {/* AI Generated Commentary */}
            <p className="text-[16px] sm:text-[17px] font-sans font-medium text-m3Text leading-relaxed italic pt-1 pr-12">
              "{typedInsight}"
              <span className="w-1.5 h-4 bg-purple-500 inline-block ml-0.5 animate-pulse rounded-full" />
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
