import { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Animates a number from the previous value → target using cubic ease-out (no bounce).
 * Automatically resets & re-animates when target changes (i.e. new search).
 * Respects prefers-reduced-motion by jumping directly to the final value.
 *
 * @param {number|null} target   Final value to count to
 * @param {object}      options
 * @param {number}      options.duration  ms (default 800)
 * @param {number}      options.decimals  decimal places kept (default 0)
 * @param {number}      options.delay     ms before animation starts (default 0)
 * @returns {number}  Current animated value
 */
export function useCountUp(target, { duration = 800, decimals = 0, delay = 0 } = {}) {
  const [value, setValue] = useState(0);
  const prefersReduced = useReducedMotion();
  const rafRef        = useRef(null);
  const startRef      = useRef(null);
  const delayTimerRef = useRef(null);

  // Keep track of the previous target value
  const prevTargetRef = useRef(0);

  useEffect(() => {
    // Clear any running animation / delay timer
    if (rafRef.current)        cancelAnimationFrame(rafRef.current);
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    startRef.current = null;

    // Null / invalid target → reset to 0
    if (target === null || target === undefined || isNaN(target)) {
      setValue(0);
      prevTargetRef.current = 0;
      return;
    }

    const startValue = prevTargetRef.current;
    const diff = target - startValue;

    // Reduced-motion users get the final value immediately
    if (prefersReduced) {
      const finalVal = decimals > 0 ? parseFloat(target.toFixed(decimals)) : Math.round(target);
      setValue(finalVal);
      prevTargetRef.current = finalVal;
      return;
    }

    const start = () => {
      const tick = (timestamp) => {
        if (!startRef.current) startRef.current = timestamp;
        const elapsed  = timestamp - startRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Cubic ease-out — precise, no overshoot
        const eased   = 1 - Math.pow(1 - progress, 3);
        const current = startValue + eased * diff;

        setValue(
          decimals > 0
            ? parseFloat(current.toFixed(decimals))
            : Math.round(current)
        );

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          const finalVal = decimals > 0 ? parseFloat(target.toFixed(decimals)) : Math.round(target);
          setValue(finalVal); // guarantee exact formatted final value
          prevTargetRef.current = finalVal;
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    if (delay > 0) {
      delayTimerRef.current = setTimeout(start, delay);
    } else {
      start();
    }

    return () => {
      if (rafRef.current)        cancelAnimationFrame(rafRef.current);
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    };
  }, [target, duration, decimals, delay, prefersReduced]);

  return value;
}
