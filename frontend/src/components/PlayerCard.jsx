import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Award, Zap, TrendingUp, Compass } from 'lucide-react';
import { useCountUp } from '../hooks/useCountUp';

// ─── Animation variants ────────────────────────────────────────────────────
const cardContainerVariants = (reduced) => ({
  hidden: {},
  visible: {
    transition: reduced
      ? {}
      : { staggerChildren: 0.08, ease: 'easeOut' },
  },
});

const cardItemVariants = (reduced) => ({
  hidden: reduced ? {} : { opacity: 0, y: 12 },
  visible: reduced
    ? {}
    : { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
});

const iconVariants = (reduced) => ({
  initial: reduced ? {} : { opacity: 0, scale: 0.85 },
  animate: reduced
    ? {}
    : { opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } },
});

export default function PlayerCard({ stats }) {
  if (!stats) return null;

  const reduced = useReducedMotion();

  const {
    player,
    team,
    elo_rating,
    recent_form_score,
    rolling_10_bat_avg,
    rolling_10_bat_sr,
    venue_adjusted_sr,
    venue_info,
  } = stats;

  // Count-up for the four key numbers
  const animatedElo    = useCountUp(elo_rating,          { duration: 800, decimals: 0 });
  const animatedForm   = useCountUp(recent_form_score,   { duration: 800, decimals: 1 });
  const animatedAvg    = useCountUp(rolling_10_bat_avg,  { duration: 800, decimals: 1 });
  const animatedSR     = useCountUp(rolling_10_bat_sr,   { duration: 800, decimals: 1 });

  // Normalizing elo_rating based on a max of 2200
  const maxElo = 2200;
  const eloProgress = Math.min(Math.max(elo_rating / maxElo, 0), 1);

  const ivars = iconVariants(reduced);

  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 mb-6"
      variants={cardContainerVariants(reduced)}
      initial="hidden"
      animate="visible"
    >
      {/* Box 1: Elo Rating */}
      <motion.div
        variants={cardItemVariants(reduced)}
        className="kpi-scorecard"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <motion.span {...ivars}>
              <Award className="h-4 w-4 text-m3TextMuted flex-shrink-0" />
            </motion.span>
            <span className="kpi-title">
              Elo Rating
            </span>
          </div>
          <div className="kpi-number">
            {animatedElo}
          </div>
          <span className="kpi-badge">
            {team}
          </span>
        </div>

        <div className="flex justify-center mt-5">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="30" stroke="var(--m3-border)" strokeWidth="4" fill="transparent" />
              <motion.circle
                cx="36" cy="36" r="30"
                stroke="#6750A4"
                strokeWidth="4"
                fill="transparent"
                strokeLinecap="round"
                initial={{ strokeDashoffset: 188.4 }}
                animate={{ strokeDashoffset: 188.4 - (188.4 * eloProgress) }}
                transition={reduced ? { duration: 0 } : { duration: 0.9, ease: 'easeOut' }}
                style={{ strokeDasharray: 188.4 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-sans font-bold text-m3Text">
              {animatedElo}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Box 2: Recent Form Score */}
      <motion.div
        variants={cardItemVariants(reduced)}
        className="kpi-scorecard"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <motion.span {...ivars}>
              <Zap className="h-4 w-4 text-m3TextMuted flex-shrink-0" />
            </motion.span>
            <span className="kpi-title">
              Recent Form Score
            </span>
          </div>
          <div className="kpi-number">
            {animatedForm.toFixed(1)}
          </div>
          <span className="text-[10px] font-sans font-medium text-m3TextMuted mt-1">
            Weighted Form
          </span>
        </div>

        <div className="w-full mt-5">
          <div className="w-full bg-m3Canvas h-1.5 rounded-full overflow-hidden border border-m3Border/20">
            <motion.div
              className="bg-m3Primary h-full origin-left rounded-full"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.min(Math.max(recent_form_score / 100, 0.05), 1) }}
              transition={reduced ? { duration: 0 } : { duration: 0.9, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-m3TextMuted mt-1.5 font-sans font-medium">
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>0</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>100+</span>
          </div>
        </div>
      </motion.div>

      {/* Box 3: Rolling 10-Innings */}
      <motion.div
        variants={cardItemVariants(reduced)}
        className="kpi-scorecard"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <motion.span {...ivars}>
              <TrendingUp className="h-4 w-4 text-m3TextMuted flex-shrink-0" />
            </motion.span>
            <span className="kpi-title">
              Rolling 10-Innings
            </span>
          </div>
        </div>

        <div className="kpi-label-group">
          <div className="kpi-micro-label">
            <span className="kpi-micro-label-text">Average</span>
            <span className="kpi-number">
              {animatedAvg.toFixed(1)}
            </span>
          </div>
          <div className="kpi-micro-label">
            <span className="kpi-micro-label-text">Strike Rate</span>
            <span className="kpi-number">
              {animatedSR.toFixed(1)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Box 4: Venue-Adjusted SR */}
      <motion.div
        variants={cardItemVariants(reduced)}
        className="kpi-scorecard"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <motion.span {...ivars}>
              <Compass className="h-4 w-4 text-m3TextMuted flex-shrink-0" />
            </motion.span>
            <span className="kpi-title">
              Venue-Adjusted SR
            </span>
          </div>
          <div className="kpi-number">
            {typeof venue_adjusted_sr === 'number' ? (
              <>
                {venue_adjusted_sr >= 0 ? '+' : ''}
                {venue_adjusted_sr.toFixed(1)}
              </>
            ) : '0.0'}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-sans text-m3TextMuted leading-relaxed border-t border-rule/50 pt-2">
            {venue_info || 'Vs venue career strike rate average.'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

