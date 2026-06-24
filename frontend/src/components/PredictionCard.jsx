import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldAlert, Activity } from 'lucide-react';
import { useCountUp } from '../hooks/useCountUp';

export default function PredictionCard({ prediction, onViewWeights }) {
  if (!prediction) return null;

  const reduced = useReducedMotion();

  const {
    status,
    predicted_runs,
    ci_lower,
    ci_upper,
    ci_width,
    message,
  } = prediction;

  const isLowConfidence = status === 'insufficient_data' || ci_width > 40;
  const confidenceLabel = isLowConfidence
    ? 'Insufficient Data'
    : ci_width < 25
    ? 'High Confidence'
    : 'Medium Confidence';

  // [LAYOUT LIFECYCLE TRACKING HOOK - COUNT-UP ANIMATION TRIGGER]
  // Custom hook that registers layout lifecycle updates to animate numeric metrics incrementally 
  // on component mount or data payload updates, ensuring high visual engagement.
  const animatedRuns  = useCountUp(!isLowConfidence ? predicted_runs : null, { duration: 800, decimals: 0 });
  const animatedLower = useCountUp(!isLowConfidence ? ci_lower       : null, { duration: 800, decimals: 0 });
  const animatedUpper = useCountUp(!isLowConfidence ? ci_upper       : null, { duration: 800, decimals: 0 });

  // [FRAMER-MOTION RESPONSIVE ANIMATION STATE]
  // Configures the card entrance transition state. Bypasses translation offsets if accessibility 
  // reduced-motion mode is active, avoiding motion sickness while presenting a sleek ease-out fade.
  const entrance = reduced
    ? {}
    : {
        initial:    { opacity: 0, y: 12 },
        animate:    { opacity: 1, y: 0  },
        transition: { duration: 0.3, ease: 'easeOut', delay: 0.08 },
      };

  return (
    /* [MATERIAL 3 UI COMPONENT PARADIGM - ELEVATED CONTAINER / CARD]
       Adheres to the M3 specification for elevated surfaces, utilizing rounded corners (rounded-2xl) 
       and sub-pixel borders for dark/light mode compatibility. */
    <motion.div
      className="bg-m3Surface rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-m3Border theme-transition"
      {...entrance}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-6 pb-2">
        <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted">
          Predictor Model Output
        </p>
        <span className="text-[10px] font-sans font-bold text-m3Primary bg-m3Indicator/70 px-3 py-1 rounded-full flex items-center gap-1.5 border-none">
          <Activity className="h-3.5 w-3.5" />
          {confidenceLabel}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-8">
        {/* Left: main output */}
        <div className="flex-1">
          {isLowConfidence ? (
            <motion.div
              className="border-l-4 border-l-signal pl-4 flex flex-col gap-3"
              {...(reduced ? {} : {
                initial: { opacity: 0, x: -6 },
                animate: { opacity: 1, x: 0  },
                transition: { duration: 0.25, ease: 'easeOut' },
              })}
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-signal flex-shrink-0" />
                <h4 className="text-sm font-sans font-semibold text-m3Text">Statistical Guardrail Active</h4>
              </div>
              <p className="text-[11px] font-sans text-m3TextMuted leading-relaxed">
                {message || 'The predictor model requires more historical matches for this player/venue combination to make a confident prediction (Confidence Interval width exceeds the limit of 40 runs).'}
              </p>
              <span className="text-[10px] font-sans font-semibold text-signal bg-signalSoft/40 rounded-full px-3 py-1 w-fit">
                Model Status: Suspended
              </span>
            </motion.div>
          ) : (
            <div>
              {/* Big count-up number */}
              <div className="flex flex-wrap items-center gap-3.5 mb-6">
                <div className="flex items-baseline gap-2.5">
                  <span
                    className="text-6xl font-sans font-extrabold text-m3Text tracking-tight animate-count-up"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {animatedRuns}
                  </span>
                  <span className="text-m3TextMuted text-xs font-sans font-bold uppercase tracking-[0.08em]">
                    Runs Predicted
                  </span>
                </div>
                {onViewWeights && (
                  <button
                    onClick={() => onViewWeights()}
                    className="text-[10px] font-sans font-bold text-m3Primary hover:text-white bg-m3Indicator/70 hover:bg-m3Primary border border-m3Border hover:border-transparent px-3.5 py-1.5 rounded-full flex items-center gap-1 transition-all duration-150 active:scale-95 cursor-pointer shadow-sm ml-auto lg:ml-0 theme-transition"
                  >
                    <span>View Model Insight Weights</span>
                  </button>
                )}
              </div>

              {/* CI range */}
              <div className="w-full max-w-lg">
                <div className="flex justify-between text-[10px] font-sans font-semibold text-m3TextMuted mb-2">
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    95% CI Lower ({animatedLower})
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    95% CI Upper ({animatedUpper})
                  </span>
                </div>

                {/* Flat CI bar — scaleX animated */}
                <div className="relative w-full h-2.5 bg-m3Canvas rounded-full flex items-center overflow-hidden border border-m3Border/40">
                  <motion.div
                    className="absolute h-full bg-m3Primary origin-left rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{
                      scaleX: 1,
                    }}
                    style={{
                      left:  `${Math.min(Math.max((ci_lower / 120) * 100, 5), 85)}%`,
                      right: `${100 - Math.min(Math.max((ci_upper / 120) * 100, 15), 95)}%`,
                    }}
                    transition={reduced ? { duration: 0 } : { duration: 0.9, ease: 'easeOut', delay: 0.2 }}
                  />
                  {/* Predicted-runs tick mark */}
                  <motion.div
                    className="absolute h-4 w-1 bg-m3Text z-10 rounded-full"
                    initial={reduced ? {} : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={reduced ? {} : { delay: 0.7, duration: 0.2 }}
                    style={{ left: `${(predicted_runs / 120) * 100}%` }}
                  />
                </div>

                <div className="flex justify-between text-[9px] font-sans font-semibold text-m3TextMuted mt-2">
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>0 Runs</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>Predicted ({Math.round(predicted_runs)})</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>120+ Runs</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: diagnostic panel */}
        <motion.div
          className="bg-m3Canvas/50 p-5 rounded-2xl flex flex-col justify-center min-w-[220px] border border-m3Border theme-transition"
          {...(reduced ? {} : {
            initial:    { opacity: 0 },
            animate:    { opacity: 1 },
            transition: { duration: 0.35, ease: 'easeOut', delay: 0.25 },
          })}
        >
          <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted mb-3 border-b border-m3Border pb-2">
            Model Diagnostic Info
          </p>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Iterations',    value: '100 Bootstraps'  },
              { label: 'ML Estimator', value: 'XGBoost Regressor' },
              {
                label: 'Error Margin',
                value: isLowConfidence || typeof ci_width !== 'number'
                  ? 'N/A'
                  : `± ${(ci_width / 2).toFixed(1)} Runs`,
              },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-xs font-sans">
                <span className="text-m3TextMuted text-[10px] font-semibold uppercase tracking-[0.08em]">
                  {row.label}
                </span>
                <span
                  className="font-mono text-m3Text font-medium"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
