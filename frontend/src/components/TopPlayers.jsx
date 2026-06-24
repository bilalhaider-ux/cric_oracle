import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Trophy, TrendingUp, Zap, Sparkles } from 'lucide-react';
import { synth } from '../hooks/audioSynth';

const TEAM_FLAGS = {
  'Pakistan':     '🇵🇰',
  'India':        '🇮🇳',
  'Australia':    '🇦🇺',
  'England':      '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'South Africa': '🇿🇦',
  'New Zealand':  '🇳🇿',
  'West Indies':  '🌴',
  'Sri Lanka':    '🇱🇰',
  'Bangladesh':   '🇧🇩',
  'Afghanistan':  '🇦🇫',
};

export default function TopPlayers({ players, activeMetric, onMetricChange }) {
  const reduced = useReducedMotion();
  const metrics = [
    { id: 'elo_rating',         name: 'Elo Rating',   icon: Trophy    },
    { id: 'recent_form_score',  name: 'Form Score',   icon: Zap       },
    { id: 'rolling_10_bat_avg', name: 'Batting Avg',  icon: TrendingUp },
    { id: 'rolling_10_bat_sr',  name: 'Strike Rate',  icon: Sparkles  },
  ];

  const handleMetricClick = (id) => {
    synth.playClick();
    onMetricChange(id);
  };

  const getMetricUnit = (metric) => {
    if (metric === 'elo_rating')         return 'pts';
    if (metric === 'recent_form_score')  return '/100';
    if (metric === 'rolling_10_bat_avg') return 'avg';
    if (metric === 'rolling_10_bat_sr')  return 'SR';
    return '';
  };

  return (
    <div className="bg-m3Surface border border-m3Border rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.02)] theme-transition w-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-m3Canvas">
        <div>
          <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted">Leaderboard</p>
          <h3 className="text-lg font-sans font-extrabold text-m3Text tracking-tight mt-0.5">T20 World Rankings</h3>
        </div>
        <span className="text-[10px] font-sans font-semibold text-m3TextMuted bg-m3Canvas rounded-full px-3 py-1">
          Top 10
        </span>
      </div>

      {/* Metric selector — M3 segmented/pills control */}
      <div className="flex flex-wrap gap-2 p-4 border-b border-m3Canvas bg-m3Canvas/30">
        {metrics.map((m) => {
          const Icon = m.icon;
          const isActive = activeMetric === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handleMetricClick(m.id)}
              className={`flex items-center gap-2 px-4 py-2 text-[10px] font-sans font-semibold uppercase tracking-[0.08em] transition-all duration-150 cursor-pointer active:scale-97 transform-gpu active:duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3Primary/30 rounded-full border-none ${
                isActive
                  ? 'text-m3Primary bg-m3Indicator/70 font-bold shadow-sm'
                  : 'text-m3TextMuted hover:text-m3Text hover:bg-m3Canvas'
              }`}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{m.name}</span>
            </button>
          );
        })}
      </div>

      {/* Leaderboard rows — elevated Material 3 layout */}
      {players && players.length > 0 && (
        <div className="flex flex-col">
          {/* Column headers */}
          <div className="grid grid-cols-[3rem_1fr_auto] gap-4 px-6 py-2.5 border-b border-m3Canvas bg-m3Canvas/10">
            <span className="text-[9px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted">Rank</span>
            <span className="text-[9px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted">Player</span>
            <span className="text-[9px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted text-right">{getMetricUnit(activeMetric)}</span>
          </div>

          {players.map((p, i) => {
            const flag = TEAM_FLAGS[p?.team] || '🏏';
            return (
              <motion.div
                key={p.rank || i}
                initial={reduced ? false : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut', delay: reduced ? 0 : i * 0.04 }}
                className="grid grid-cols-[3rem_1fr_auto] gap-4 items-center px-6 py-4 border-b border-m3Canvas/60 last:border-b-0 hover:bg-m3Canvas/40 transition-colors duration-150"
              >
                {/* Rank — bold, tabular nums */}
                <span
                  className={`font-sans font-extrabold text-sm text-m3Text ${i < 3 ? 'text-m3Primary' : 'text-m3TextMuted'}`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  #{p.rank}
                </span>

                {/* Player info */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg flex-shrink-0">{flag}</span>
                  <div className="min-w-0">
                    <p className="font-sans font-semibold text-m3Text text-sm truncate">{p.player}</p>
                    <p className="font-sans text-[10px] text-m3TextMuted uppercase tracking-[0.04em]">{p.team}</p>
                  </div>
                </div>

                {/* Score */}
                <span
                  className="font-sans font-extrabold text-sm text-m3Text text-right"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {p.score?.toFixed(1)}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {(!players || players.length === 0) && (
        <div className="text-center py-16 text-m3TextMuted text-sm font-sans italic">
          Loading leaderboard data...
        </div>
      )}
    </div>
  );
}

