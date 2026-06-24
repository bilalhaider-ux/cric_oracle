import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Search, MapPin, User, Zap, Globe, Trophy, Filter } from 'lucide-react';
import { synth } from '../hooks/audioSynth';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8001/api/';

const QUICK_PLAYERS = [
  { name: 'Babar Azam',       flag: 'PK', team: 'Pakistan' },
  { name: 'Virat Kohli',      flag: 'IN', team: 'India'    },
  { name: 'Jos Buttler',      flag: 'UK', team: 'England' },
  { name: 'Travis Head',      flag: 'AU', team: 'Australia'},
];

const QUICK_VENUES = [
  { name: 'Gaddafi Stadium', label: 'Gaddafi Stadium' },
  { name: 'Melbourne Cricket Ground', label: 'MCG'    },
  { name: 'Eden Park',       label: 'Auckland'       },
];

// Match filter options
const MATCH_FILTERS = [
  {
    value: 'all',
    label: 'All Matches',
    shortLabel: 'All',
    icon: Filter,
    description: 'International + League combined',
  },
  {
    value: 'international',
    label: 'International',
    shortLabel: 'Int\'l',
    icon: Globe,
    description: 'T20I bilateral series & ICC events',
  },
  {
    value: 'league',
    label: 'League',
    shortLabel: 'League',
    icon: Trophy,
    description: 'IPL, PSL, BBL, CPL, Vitality Blastâ€¦',
  },
];

/* â”€â”€ Highlight matching substring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function HighlightMatch({ text, query }) {
  if (!query) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <span className="text-m3Primary font-bold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </span>
  );
}

export default function PlayerSearch({ onSearch, isLoading }) {
  const [playerName, setPlayerName] = useState('');
  const [venue, setVenue] = useState('');
  const [matchFilter, setMatchFilter] = useState('all');
  const [isPlayerFocused, setIsPlayerFocused] = useState(false);
  const [isVenueFocused, setIsVenueFocused] = useState(false);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFetching, setIsFetching] = useState(false);

  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const reduced = useReducedMotion();

  /* â”€â”€ Fetch suggestions (debounced) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setIsFetching(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}players`, {
        params: { q: query, limit: 12 },
      });
      setSuggestions(data || []);
      setShowDropdown(data && data.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setPlayerName(val);

    // Debounce API calls by 300ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  /* â”€â”€ Select a suggestion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const selectSuggestion = (name) => {
    synth.playClick();
    setPlayerName(name);
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
    // Re-focus input after selection
    inputRef.current?.focus();
  };

  /* â”€â”€ Keyboard navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  /* â”€â”€ Close dropdown on outside click â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* â”€â”€ Cleanup debounce on unmount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (playerName.trim()) {
      setShowDropdown(false);
      synth.playRun();
      onSearch({ playerName: playerName.trim(), venue: venue.trim(), matchFilter });
    }
  };

  const handlePlayerChipClick = (name) => {
    synth.playClick();
    setPlayerName(name);
    setShowDropdown(false);
  };

  const handleVenueChipClick = (name) => {
    synth.playClick();
    setVenue(name);
  };

  const handleFilterClick = (val) => {
    synth.playClick();
    setMatchFilter(val);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-6 space-y-6">

      {/* Quick player chips */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted">
          Quick Select Player
        </p>
        <div className="flex flex-wrap gap-3">
          {QUICK_PLAYERS.map((p) => {
            const isSelected = playerName === p.name;
            return (
              <button
                key={p.name}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handlePlayerChipClick(p.name)}
                className={`group flex items-center gap-2 px-3 py-1.5 text-xs font-sans font-medium transition-all duration-200 rounded-[100px] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3Primary/20 active:scale-95 transform-gpu cursor-pointer theme-transition ${
                  isSelected
                    ? 'bg-m3Primary text-white border-m3Primary shadow-sm'
                    : 'bg-transparent text-m3TextMuted hover:text-m3Text hover:bg-m3Canvas/40 border-m3Border'
                }`}
              >
                {/* Mini Avatar nationality flag frame */}
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] uppercase font-bold overflow-hidden flex-shrink-0 border transition-colors ${
                  isSelected
                    ? 'bg-m3Primary/50 text-white border-m3Primary/20'
                    : 'bg-m3Canvas/60 text-m3TextMuted border-m3Border group-hover:bg-m3Canvas/80'
                }`}>
                  {p.flag}
                </span>
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted">
          Match Type Filter
        </p>

        {/* [MATERIAL 3 UI COMPONENT PARADIGM - SEGMENTED CONTROL / CHIPS]
            Implements standard Material 3 segmented pill design. It uses absolute positioning 
            with layoutId matching for smooth sliding active indicator transitions. */}
        <div className="relative flex p-1 bg-m3Canvas rounded-full border border-m3Border w-fit gap-1 select-none theme-transition">
          {MATCH_FILTERS.map((f) => {
            const Icon = f.icon;
            const isActive = matchFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => handleFilterClick(f.value)}
                title={f.description}
                className={`
                  relative flex items-center gap-2 px-5 py-2 cursor-pointer
                  text-[10px] font-sans font-semibold uppercase tracking-[0.08em]
                  transition-colors duration-200 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3Primary/20 z-10 theme-transition
                  ${isActive ? 'text-white font-bold' : 'text-m3TextMuted hover:text-m3Text'}
                `}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{f.shortLabel}</span>

                {/* [FRAMER-MOTION RESPONSIVE ANIMATION STATE]
                    Animates active state pill using physics-driven layout transitions (spring mechanics), 
                    ensuring layout fluidity across screens. */}
                {isActive && (
                  <motion.span
                    layoutId="filter-active-indicator"
                    className="absolute inset-0 bg-m3Primary rounded-full -z-10 shadow-sm"
                    transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Active filter description */}
        <p className="text-[10px] font-sans text-m3TextMuted pl-2">
          {MATCH_FILTERS.find(f => f.value === matchFilter)?.description}
        </p>
      </div>

      {/* â”€â”€ Search form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <motion.form
        onSubmit={handleSubmit}
        className="bg-m3Surface rounded-2xl p-4.5 flex flex-col md:flex-row items-stretch gap-3 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-m3Border theme-transition"
        initial={reduced ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Player input â€” with autocomplete dropdown */}
        <div className="flex-1 relative" ref={dropdownRef}>
          <div
            className={`bg-m3Canvas border flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all focus-within:ring-2 focus-within:ring-m3Primary/20 theme-transition ${
              isPlayerFocused ? 'border-m3Primary' : 'border-m3Border'
            }`}
          >
            <User
              className={`h-4 w-4 flex-shrink-0 transition-colors ${
                isPlayerFocused ? 'text-m3Primary' : 'text-m3TextMuted'
              }`}
            />
            <input
              ref={inputRef}
              type="text"
              value={playerName}
              onFocus={() => {
                setIsPlayerFocused(true);
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              onBlur={() => setIsPlayerFocused(false)}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Search player name (e.g. Babar Azam)"
              className="w-full bg-transparent text-m3Text placeholder-m3TextMuted focus:outline-none text-sm font-sans"
              disabled={isLoading}
              required
              autoComplete="off"
              role="combobox"
              aria-expanded={showDropdown}
              aria-autocomplete="list"
              aria-controls="player-suggestions-list"
              aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
            />
            {/* Fetching spinner */}
            {isFetching && (
              <div className="h-3.5 w-3.5 border-2 border-m3Primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
          </div>

          {/* â”€â”€ Autocomplete Dropdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <AnimatePresence>
            {showDropdown && suggestions.length > 0 && (
              <motion.ul
                id="player-suggestions-list"
                role="listbox"
                initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                className="absolute z-50 left-0 right-0 mt-2 bg-m3Surface border border-m3Border rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] overflow-hidden origin-top backdrop-blur-sm"
                style={{ maxHeight: '280px', overflowY: 'auto' }}
              >
                {suggestions.map((name, idx) => (
                  <motion.li
                    key={name}
                    id={`suggestion-${idx}`}
                    role="option"
                    aria-selected={idx === activeIndex}
                    initial={reduced ? {} : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.025, duration: 0.15 }}
                    onMouseDown={(e) => {
                      e.preventDefault(); // prevent input blur
                      selectSuggestion(name);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-100 text-sm font-sans select-none ${
                      idx === activeIndex
                        ? 'bg-m3Primary/10 text-m3Text'
                        : 'text-m3TextMuted hover:bg-m3Canvas/50 hover:text-m3Text'
                    }`}
                  >
                    <User className="h-3.5 w-3.5 flex-shrink-0 text-m3TextMuted" />
                    <HighlightMatch text={name} query={playerName} />
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {/* Venue input */}
        <div
          className={`flex-1 bg-m3Canvas border flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all focus-within:ring-2 focus-within:ring-m3Primary/20 theme-transition ${
            isVenueFocused ? 'border-m3Primary' : 'border-m3Border'
          }`}
        >
          <MapPin
            className={`h-4 w-4 flex-shrink-0 transition-colors ${
              isVenueFocused ? 'text-m3Primary' : 'text-m3TextMuted'
            }`}
          />
          <input
            type="text"
            value={venue}
            onFocus={() => setIsVenueFocused(true)}
            onBlur={() => setIsVenueFocused(false)}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Target Venue (e.g. Lahore) - Optional"
            className="w-full bg-transparent text-m3Text placeholder-m3TextMuted focus:outline-none text-sm font-sans"
            disabled={isLoading}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !playerName.trim()}
          className="px-8 py-2.5 bg-m3Primary text-white rounded-xl text-[11px] font-sans font-semibold uppercase tracking-[0.08em] flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer active:scale-95 transform-gpu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3Primary/20 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-m3Primary/90 shadow-sm"
        >
          {isLoading ? (
            <>
              <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Zap className="h-3.5 w-3.5" />
              <span>Run Oracle</span>
            </>
          )}
        </button>
      </motion.form>

      {/* Quick venue chips */}
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.08em] text-m3TextMuted">Venues:</span>
        <div className="flex flex-wrap gap-2">
          {QUICK_VENUES.map((v) => {
            const isSelected = venue === v.name;
            return (
              <button
                key={v.name}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleVenueChipClick(v.name)}
                className={`text-[10px] font-sans font-medium uppercase tracking-[0.08em] px-3.5 py-1.5 transition-all duration-150 cursor-pointer active:scale-95 transform-gpu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m3Primary/20 rounded-full border theme-transition ${
                  isSelected
                    ? 'bg-m3Primary text-white border-m3Primary shadow-sm'
                    : 'bg-transparent text-m3TextMuted hover:text-m3Text hover:bg-m3Canvas/40 border-m3Border'
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="bg-m3Surface border border-m3Border p-5 flex flex-col gap-3 overflow-hidden animate-pulse rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.02)] theme-transition"
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.15 }}
            >
              <div className="h-3 bg-m3Canvas w-1/3 rounded-full" />
              <div className="h-8 bg-m3Canvas w-3/4 rounded-full" />
              <div className="h-2 bg-m3Canvas w-full rounded-full" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
