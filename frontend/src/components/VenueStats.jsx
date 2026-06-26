import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Map, Calendar, Target, Zap } from 'lucide-react';
import { synth } from '../hooks/audioSynth';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:8001/api/' : '');

const FEATURED_VENUES = [
  { name: 'Gaddafi Stadium',                  country: '🇵🇰', query: 'Lahore',        description: 'High-scoring flat pitch. Pacers dominate early.' },
  { name: 'Eden Gardens',                      country: '🇮🇳', query: 'Eden Gardens',  description: 'Spin-friendly surface. Massive home crowd effect.' },
  { name: 'Wankhede Stadium',                  country: '🇮🇳', query: 'Wankhede',      description: 'Small ground, high-scoring. Dew factor at night.' },
  { name: 'Melbourne Cricket Ground',          country: '🇦🇺', query: 'Melbourne Cricket Ground', description: 'Largest ground. Seam movement, big outfield.' },
  { name: 'Dubai International Cricket Stadium', country: '🇦🇪', query: 'Dubai International', description: 'Neutral venue. Spin-dominant, low first-innings totals.' },
  { name: 'Shere Bangla National Stadium',     country: '🇧🇩', query: 'Shere Bangla',  description: 'Most T20 matches in the dataset. Slow, turning pitch.' },
];

export default function VenueStats({ stats, onSearch, isLoading, onClear }) {
  const [query, setQuery]           = useState('');
  const [isFocused, setIsFocused]   = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg]     = useState(false);
  const debounceRef = useRef(null);

  // Fetch venue autocomplete suggestions
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setSuggestions([]); setShowSugg(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}venues?q=${encodeURIComponent(query)}&limit=6`);
        setSuggestions(res.data || []);
        setShowSugg(true);
      } catch { setSuggestions([]); }
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowSugg(false);
    if (query.trim()) {
      synth.playRun();
      onSearch(query.trim());
    }
  };

  const handleSuggClick = (name) => {
    synth.playClick();
    setQuery(name);
    setShowSugg(false);
    onSearch(name);
  };

  const handleFeaturedClick = (venue) => {
    synth.playClick();
    setQuery(venue.query);
    setShowSugg(false);
    onSearch(venue.query);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">

      {/* Search block */}
      <div className="bg-m3Surface border border-m3Border rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.02)] theme-transition overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-m3Canvas">
          <Map className="h-4 w-4 text-m3TextMuted" />
          <div>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted">Venue Intelligence</p>
            <h3 className="text-lg font-sans font-extrabold text-m3Text tracking-tight mt-0.5">Stadium Analytics &amp; Pitch Reports</h3>
          </div>
        </div>

        <div className="p-6">
          {/* Search form */}
          <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
            <div className="flex-1 relative">
              <div className={`bg-m3Canvas border flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all focus-within:ring-2 focus-within:ring-m3Primary/30 ${isFocused ? 'border-m3Primary' : 'border-transparent'}`}>
                <Search className={`h-4 w-4 flex-shrink-0 ${isFocused ? 'text-m3Primary' : 'text-m3TextMuted'}`} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                  placeholder="Search any stadium (e.g. Wankhede, Dubai, Eden Gardens)..."
                  className="bg-transparent text-m3Text placeholder-m3TextMuted focus:outline-none w-full text-sm font-sans"
                  required
                />
              </div>
              {/* Autocomplete dropdown */}
              <AnimatePresence>
                {showSugg && suggestions.length > 0 && (
                  <motion.ul
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 right-0 top-full mt-1 bg-m3Surface border border-m3Border rounded-xl shadow-lg z-50 overflow-hidden"
                  >
                    {suggestions.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onMouseDown={() => handleSuggClick(name)}
                          className="w-full text-left px-4 py-2.5 text-sm font-sans text-m3Text hover:bg-m3Canvas transition-colors duration-100 flex items-center gap-2"
                        >
                          <Map className="h-3.5 w-3.5 text-m3TextMuted flex-shrink-0" />
                          {name}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-6 bg-m3Primary text-white text-[11px] font-sans font-medium uppercase tracking-[0.08em] rounded-xl transition-all duration-150 cursor-pointer active:scale-97 transform-gpu active:duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3Primary/30 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-m3Primary/90 flex items-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Searching...</span>
                </>
              ) : 'Search'}
            </button>
          </form>

          {/* Featured venues — modern interactive cards */}
          {!stats && (
            <div>
              <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted mb-3 pl-1">
                Featured Stadiums — Click to Load
              </p>
              <div className="flex flex-col gap-3">
                {FEATURED_VENUES.map((v, i) => (
                  <motion.button
                    key={v.name}
                    type="button"
                    onClick={() => handleFeaturedClick(v)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-5 px-5 py-4 text-left cursor-pointer transition-all duration-150 active:scale-97 transform-gpu active:duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3Primary/30 bg-m3Canvas/40 hover:bg-m3Canvas/90 rounded-2xl border-none shadow-[0_2px_8px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <Map className="h-4.5 w-4.5 text-m3Primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3">
                        <p className="font-sans font-semibold text-m3Text text-sm">{v.name}</p>
                        <span className="text-[10px] font-sans text-m3TextMuted font-medium">{v.country}</span>
                      </div>
                      <p className="text-xs font-sans text-m3TextMuted mt-1">{v.description}</p>
                    </div>
                    <span className="text-[10px] font-sans font-semibold text-m3TextMuted flex-shrink-0 bg-m3Canvas rounded-full px-2.5 py-1 theme-transition">Cap. {v.capacity}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Stats results */}
          {stats && !stats.error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-5 border-b border-m3Canvas pb-4">
                <div>
                  <h4 className="font-sans font-extrabold text-m3Text text-lg tracking-tight">{stats.venue}</h4>
                  <p className="text-[10px] font-sans text-m3TextMuted mt-0.5 uppercase tracking-[0.08em] font-semibold">Official T20 Venue Statistics</p>
                </div>
                <span className="text-[10px] font-sans font-bold text-m3Primary bg-m3Indicator/70 px-3 py-1 rounded-full">
                  Live Data
                </span>
              </div>

              {/* Stats — clean rounded rows */}
              <div className="bg-m3Canvas/30 rounded-2xl p-2 flex flex-col gap-2 border-none">
                {[
                  { icon: Calendar, label: 'Total T20 Matches',   value: stats.total_matches,           sub: 'Recorded matches'      },
                  { icon: Target,   label: 'Avg Runs / Match',     value: stats.average_runs_per_match,  sub: 'Average innings runs'  },
                  { icon: Zap,      label: 'Baseline Strike Rate', value: stats.average_strike_rate,     sub: 'Runs per 100 balls'    },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="flex items-center gap-5 px-5 py-4 bg-m3Surface rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.01),0_1px_2px_rgba(0,0,0,0.02)] border border-m3Border theme-transition">
                      <Icon className="h-4.5 w-4.5 text-m3Primary flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted">{row.label}</p>
                        <p className="text-[10px] font-sans text-m3TextMuted mt-0.5">{row.sub}</p>
                      </div>
                      <span
                        className="font-sans text-2xl font-extrabold text-m3Text tracking-tight"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {row.value}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  synth.playClick();
                  setQuery('');
                  if (onClear) onClear();
                }}
                className="mt-6 text-[10px] font-sans font-semibold text-m3Primary hover:text-m3Primary/80 cursor-pointer transition-all duration-150 active:scale-97 transform-gpu active:duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3Primary/30 uppercase tracking-[0.08em] bg-m3Indicator/30 rounded-full px-4 py-2 w-fit block"
              >
                ← Search Another Stadium
              </button>
            </motion.div>
          )}

          {/* Error state */}
          {stats && stats.error && (
            <div className="p-4 border-l-4 border-l-signal bg-signalSoft/20 rounded-xl text-signal text-sm font-sans font-medium">
              ⚠️ {stats.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

