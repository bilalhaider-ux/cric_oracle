import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts';
import { BarChart3 } from 'lucide-react';

// Custom spring bar animation for responsive data visualization
const SpringBar = (props) => {
  const { x, y, width, height, fill, fillOpacity } = props;
  const reduced = useReducedMotion();

  if (width <= 0 || height <= 0) return null;

  const r = 4; // corner radius
  const path = `
    M ${x}, ${y + r}
    A ${r}, ${r}, 0, 0, 1, ${x + r}, ${y}
    L ${x + width - r}, ${y}
    A ${r}, ${r}, 0, 0, 1, ${x + width}, ${y + r}
    L ${x + width}, ${y + height}
    L ${x}, ${y + height}
    Z
  `;

  return (
    <motion.path
      d={path}
      fill={fill}
      fillOpacity={fillOpacity}
      style={{ originY: 1 }}
      initial={reduced ? { scaleY: 1 } : { scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={
        reduced
          ? { duration: 0 }
          : { type: 'spring', stiffness: 100, damping: 15 }
      }
    />
  );
};

export default function Last10Chart({ data }) {
  if (!data || data.length === 0) return null;
  const reduced = useReducedMotion();

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const match = payload[0].payload;
      return (
        <div className="glassmorphic-tooltip">
          <p className="font-sans text-m3TextMuted text-[10px] font-semibold tracking-[0.08em]" style={{ fontVariantNumeric: 'tabular-nums' }}>{match.date}</p>
          <p className="font-sans font-bold text-m3Text">Vs {match.opponent}</p>
          <div className="flex gap-4 mt-1 border-t border-m3Canvas pt-2">
            <div>
              <span className="font-sans text-m3TextMuted text-[9px] uppercase tracking-[0.08em] block">Runs</span>
              <span className="font-sans font-extrabold text-m3Text" style={{ fontVariantNumeric: 'tabular-nums' }}>{match.runs}</span>
            </div>
            <div>
              <span className="font-sans text-m3TextMuted text-[9px] uppercase tracking-[0.08em] block">Balls</span>
              <span className="font-sans font-extrabold text-m3Text" style={{ fontVariantNumeric: 'tabular-nums' }}>{match.balls}</span>
            </div>
            <div>
              <span className="font-sans text-m3TextMuted text-[9px] uppercase tracking-[0.08em] block">SR</span>
              <span className="font-sans font-extrabold text-m3Text" style={{ fontVariantNumeric: 'tabular-nums' }}>{match.strike_rate.toFixed(1)}</span>
            </div>
          </div>
          <span className={`text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-full w-fit mt-1.5 ${
            match.dismissed 
              ? 'bg-rose-100/60 text-rose-600' 
              : 'bg-emerald-100/60 text-emerald-700'
          }`}>
            {match.dismissed ? 'Dismissed' : 'Not Out'}
          </span>
        </div>
      );
    }
    return null;
  };

  const avgRuns  = data.length > 0 ? (data.reduce((a, b) => a + b.runs, 0) / data.length).toFixed(1) : 0;
  const highScore = data.length > 0 ? Math.max(...data.map(d => d.runs)) : 0;
  const notOuts  = data.filter(d => !d.dismissed).length;

  const entrance = reduced
    ? {}
    : {
        initial:    { opacity: 0, y: 12 },
        animate:    { opacity: 1, y: 0  },
        transition: { duration: 0.3, ease: 'easeOut', delay: 0.16 },
      };

  return (
    <motion.div className="bg-m3Surface border border-m3Border rounded-2xl p-6 mb-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] theme-transition" {...entrance}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-2">
        <div>
          <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted">Innings Chronological Log</p>
          <p className="text-[10px] font-sans text-m3TextMuted mt-0.5">Last 10 T20 innings performance</p>
        </div>
        {/* Legend */}
        <div className="flex gap-5 text-[10px] font-sans font-medium text-m3TextMuted">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-[#81c784] rounded-full" />
            <span>Not Out</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-[#e57373] rounded-full" />
            <span>Dismissed</span>
          </div>
        </div>
      </div>

      {/* Summary stats — ledger row */}
      <div className="grid grid-cols-3 gap-0 bg-m3Canvas/50 rounded-2xl border-none mb-6 overflow-hidden">
        {[
          { label: '10-Match Avg', value: avgRuns },
          { label: 'High Score',   value: highScore },
          { label: 'Not Outs',     value: `${notOuts}/${data.length}` },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`p-4 text-center ${i < 2 ? 'border-r border-m3Canvas' : ''}`}
          >
            <p className="text-[9px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted">{s.label}</p>
            <p
              className="text-2xl font-sans font-extrabold text-m3Text mt-1"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart key={JSON.stringify(data)} data={data} margin={{ top: 8, right: 8, left: -24, bottom: 25 }}>
            <CartesianGrid stroke="var(--m3-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="opponent"
              stroke="var(--m3-text-muted)"
              fontSize={10}
              fontFamily="Inter, sans-serif"
              fontWeight={500}
              tickLine={false}
              axisLine={false}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={50}
              tickFormatter={(val) => {
                // Truncate to first word to keep labels readable and compact
                const firstWord = val.split(' ')[0];
                return `vs ${firstWord}`;
              }}
            />
            <YAxis
              stroke="var(--m3-text-muted)"
              fontSize={10}
              fontFamily="Inter, sans-serif"
              fontWeight={500}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128,128,128,0.08)', radius: 4 }} />
            <Bar dataKey="runs" isAnimationActive={false} shape={<SpringBar />}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.dismissed ? '#e57373' : '#81c784'}
                  fillOpacity={0.9}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

