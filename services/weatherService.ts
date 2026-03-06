/**
 * Weather Service — OpenWeatherMap API Integration
 *
 * Fetches real-time weather data and caches it to avoid
 * excessive API calls. Refreshes every 10 minutes.
 *
 * Used by the Dashboard Greeting Card to display ambient
 * weather info and drive weather-reactive backgrounds.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface WeatherData {
  /** Temperature in Celsius */
  temp: number;
  /** Feels-like temperature */
  feelsLike: number;
  /** Main weather group: Clear, Clouds, Rain, Drizzle, Thunderstorm, Snow, Mist, etc. */
  main: string;
  /** Human-readable description, e.g. "clear sky", "light rain" */
  description: string;
  /** OpenWeatherMap icon code, e.g. "01d", "10n" */
  icon: string;
  /** City name returned by API */
  city: string;
  /** Wind speed in m/s */
  windSpeed: number;
  /** Humidity percentage */
  humidity: number;
  /** Unix timestamp of data fetch */
  fetchedAt: number;
}

/** Simplified weather category for UI theming */
export type WeatherCategory =
  | 'clear'
  | 'clouds'
  | 'overcast'
  | 'rain'
  | 'drizzle'
  | 'thunderstorm'
  | 'snow'
  | 'mist'
  | 'unknown';

// ── Constants ────────────────────────────────────────────────────────

const CACHE_KEY = 'eurolandHub_weatherCache';
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// Default location — Makati, Philippines
const DEFAULT_CITY = 'Makati';
const DEFAULT_LAT = 14.5547;
const DEFAULT_LON = 121.0244;

// ── API Key ──────────────────────────────────────────────────────────

function getApiKey(): string {
  // Vite client
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env.VITE_OPENWEATHERMAP_API_KEY || '';
  }
  // Node fallback
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_OPENWEATHERMAP_API_KEY || process.env.OPENWEATHERMAP_API_KEY || '';
  }
  return '';
}

// ── Cache Helpers ────────────────────────────────────────────────────

function getCachedWeather(): WeatherData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: WeatherData = JSON.parse(raw);
    // Check freshness
    if (Date.now() - data.fetchedAt < CACHE_DURATION_MS) {
      return data;
    }
    return null; // stale
  } catch {
    return null;
  }
}

function setCachedWeather(data: WeatherData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Silently fail
  }
}

// ── API Fetch ────────────────────────────────────────────────────────

/**
 * Fetch current weather from OpenWeatherMap.
 * Uses geolocation coordinates if available, falls back to city name.
 *
 * Returns cached data if still fresh. Returns null if API key is missing
 * or request fails.
 */
export async function fetchWeather(
  options?: { lat?: number; lon?: number; city?: string }
): Promise<WeatherData | null> {
  // 1. Check cache first
  const cached = getCachedWeather();
  if (cached) return cached;

  // 2. Get API key
  const apiKey = getApiKey();
  if (!apiKey) {
    console.debug('[WeatherService] No API key configured (VITE_OPENWEATHERMAP_API_KEY)');
    return null;
  }

  // 3. Build URL
  let url: string;
  if (options?.lat != null && options?.lon != null) {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${options.lat}&lon=${options.lon}&units=metric&appid=${apiKey}`;
  } else {
    const city = options?.city || DEFAULT_CITY;
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`;
  }

  // 4. Fetch
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[WeatherService] API responded ${res.status}`);
      return null;
    }

    const json = await res.json();

    const weather: WeatherData = {
      temp: Math.round(json.main.temp),
      feelsLike: Math.round(json.main.feels_like),
      main: json.weather?.[0]?.main || 'Clear',
      description: json.weather?.[0]?.description || 'clear sky',
      icon: json.weather?.[0]?.icon || '01d',
      city: json.name || DEFAULT_CITY,
      windSpeed: json.wind?.speed ?? 0,
      humidity: json.main?.humidity ?? 0,
      fetchedAt: Date.now(),
    };

    setCachedWeather(weather);
    return weather;
  } catch (err) {
    console.warn('[WeatherService] Fetch failed:', err);
    return null;
  }
}

// ── Weather Category ─────────────────────────────────────────────────

/**
 * Map the raw OWM `main` field to a simplified category for theming.
 */
export function getWeatherCategory(main?: string): WeatherCategory {
  if (!main) return 'unknown';
  const m = main.toLowerCase();
  if (m === 'clear') return 'clear';
  if (m === 'clouds') return 'clouds';
  if (m === 'rain') return 'rain';
  if (m === 'drizzle') return 'drizzle';
  if (m === 'thunderstorm') return 'thunderstorm';
  if (m === 'snow') return 'snow';
  if (['mist', 'smoke', 'haze', 'dust', 'fog', 'sand', 'ash', 'squall', 'tornado'].includes(m)) return 'mist';
  return 'unknown';
}

/**
 * Check if the OWM icon code indicates nighttime (ends with "n").
 */
export function isNightIcon(icon?: string): boolean {
  return icon?.endsWith('n') ?? false;
}

// ── Weather-Reactive Gradient Map ────────────────────────────────────

export interface WeatherGradient {
  bgClass: string;
  overlayClass: string;
  textColor: string;
  subtitleColor: string;
  iconColor: string;
  iconFill: string;
  glowColor: string;
  sweepTint: string;
  shadowClass: string;
  noiseOpacity: string;
}

/**
 * Get a weather+time reactive gradient theme.
 * This overrides the default time-only theme when real weather data is available.
 */
export function getWeatherGradient(category: WeatherCategory, isNight: boolean): WeatherGradient {
  // ── Night Variants ──
  if (isNight) {
    switch (category) {
      case 'clear':
        return {
          bgClass: 'bg-gradient-to-br from-indigo-900 via-purple-900/90 to-blue-950',
          overlayClass: 'bg-gradient-to-br from-indigo-600/10 via-violet-700/5 to-transparent',
          textColor: 'text-white',
          subtitleColor: 'text-slate-300/80',
          iconColor: 'text-slate-300',
          iconFill: 'rgba(148, 163, 184, 0.25)',
          glowColor: 'rgba(129, 140, 248, 0.18)',
          sweepTint: 'via-indigo-300/[0.04]',
          shadowClass: 'shadow-lg shadow-indigo-950/30',
          noiseOpacity: 'opacity-[0.025]',
        };
      case 'clouds':
      case 'overcast':
        return {
          bgClass: 'bg-gradient-to-br from-slate-800 via-indigo-900/80 to-slate-900',
          overlayClass: 'bg-gradient-to-br from-slate-600/10 via-indigo-700/5 to-transparent',
          textColor: 'text-white',
          subtitleColor: 'text-slate-300/80',
          iconColor: 'text-slate-400',
          iconFill: 'rgba(148, 163, 184, 0.20)',
          glowColor: 'rgba(100, 116, 139, 0.15)',
          sweepTint: 'via-slate-300/[0.03]',
          shadowClass: 'shadow-lg shadow-slate-900/30',
          noiseOpacity: 'opacity-[0.03]',
        };
      case 'rain':
      case 'drizzle':
        return {
          bgClass: 'bg-gradient-to-br from-slate-800 via-indigo-900 to-blue-950',
          overlayClass: 'bg-gradient-to-br from-blue-700/10 via-indigo-800/5 to-transparent',
          textColor: 'text-white',
          subtitleColor: 'text-slate-300/80',
          iconColor: 'text-blue-300',
          iconFill: 'rgba(147, 197, 253, 0.20)',
          glowColor: 'rgba(96, 165, 250, 0.12)',
          sweepTint: 'via-blue-300/[0.04]',
          shadowClass: 'shadow-lg shadow-blue-950/30',
          noiseOpacity: 'opacity-[0.03]',
        };
      case 'thunderstorm':
        return {
          bgClass: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-gray-950',
          overlayClass: 'bg-gradient-to-br from-purple-700/10 via-indigo-900/5 to-transparent',
          textColor: 'text-white',
          subtitleColor: 'text-slate-300/70',
          iconColor: 'text-amber-300',
          iconFill: 'rgba(252, 211, 77, 0.20)',
          glowColor: 'rgba(252, 211, 77, 0.10)',
          sweepTint: 'via-amber-300/[0.03]',
          shadowClass: 'shadow-lg shadow-slate-950/40',
          noiseOpacity: 'opacity-[0.035]',
        };
      case 'snow':
        return {
          bgClass: 'bg-gradient-to-br from-slate-700 via-blue-900/80 to-indigo-950',
          overlayClass: 'bg-gradient-to-br from-blue-300/10 via-slate-600/5 to-transparent',
          textColor: 'text-white',
          subtitleColor: 'text-blue-100/80',
          iconColor: 'text-blue-200',
          iconFill: 'rgba(191, 219, 254, 0.25)',
          glowColor: 'rgba(191, 219, 254, 0.15)',
          sweepTint: 'via-blue-200/[0.04]',
          shadowClass: 'shadow-lg shadow-blue-950/25',
          noiseOpacity: 'opacity-[0.03]',
        };
      default:
        return {
          bgClass: 'bg-gradient-to-br from-slate-700 via-indigo-800/80 to-slate-900',
          overlayClass: 'bg-gradient-to-br from-indigo-600/15 via-violet-700/8 to-transparent',
          textColor: 'text-white',
          subtitleColor: 'text-slate-300/80',
          iconColor: 'text-slate-300',
          iconFill: 'rgba(148, 163, 184, 0.22)',
          glowColor: 'rgba(129, 140, 248, 0.15)',
          sweepTint: 'via-indigo-300/[0.04]',
          shadowClass: 'shadow-lg shadow-slate-400/20',
          noiseOpacity: 'opacity-[0.025]',
        };
    }
  }

  // ── Day Variants ──
  switch (category) {
    case 'clear':
      return {
        bgClass: 'bg-gradient-to-br from-sky-200 via-cyan-100 to-yellow-100/80',
        overlayClass: 'bg-gradient-to-br from-sky-200/20 via-cyan-100/10 to-transparent',
        textColor: 'text-neutral-900',
        subtitleColor: 'text-neutral-600',
        iconColor: 'text-amber-500',
        iconFill: 'rgba(245, 158, 11, 0.30)',
        glowColor: 'rgba(245, 158, 11, 0.22)',
        sweepTint: 'via-amber-400/[0.05]',
        shadowClass: 'shadow-lg shadow-sky-200/30',
        noiseOpacity: 'opacity-[0.02]',
      };
    case 'clouds':
      return {
        bgClass: 'bg-gradient-to-br from-slate-200 via-blue-100/80 to-sky-100',
        overlayClass: 'bg-gradient-to-br from-slate-200/20 via-blue-100/10 to-transparent',
        textColor: 'text-neutral-900',
        subtitleColor: 'text-neutral-600',
        iconColor: 'text-slate-500',
        iconFill: 'rgba(148, 163, 184, 0.25)',
        glowColor: 'rgba(148, 163, 184, 0.18)',
        sweepTint: 'via-slate-400/[0.04]',
        shadowClass: 'shadow-lg shadow-slate-200/30',
        noiseOpacity: 'opacity-[0.02]',
      };
    case 'overcast':
      return {
        bgClass: 'bg-gradient-to-br from-gray-300 via-slate-200 to-neutral-200',
        overlayClass: 'bg-gradient-to-br from-gray-300/15 via-slate-200/10 to-transparent',
        textColor: 'text-neutral-900',
        subtitleColor: 'text-neutral-600',
        iconColor: 'text-gray-500',
        iconFill: 'rgba(107, 114, 128, 0.22)',
        glowColor: 'rgba(107, 114, 128, 0.15)',
        sweepTint: 'via-gray-400/[0.03]',
        shadowClass: 'shadow-lg shadow-gray-300/25',
        noiseOpacity: 'opacity-[0.02]',
      };
    case 'rain':
    case 'drizzle':
      return {
        bgClass: 'bg-gradient-to-br from-slate-300 via-blue-200/80 to-indigo-200',
        overlayClass: 'bg-gradient-to-br from-blue-200/20 via-slate-200/10 to-transparent',
        textColor: 'text-neutral-900',
        subtitleColor: 'text-neutral-600',
        iconColor: 'text-blue-500',
        iconFill: 'rgba(59, 130, 246, 0.25)',
        glowColor: 'rgba(59, 130, 246, 0.18)',
        sweepTint: 'via-blue-400/[0.05]',
        shadowClass: 'shadow-lg shadow-blue-200/25',
        noiseOpacity: 'opacity-[0.025]',
      };
    case 'thunderstorm':
      return {
        bgClass: 'bg-gradient-to-br from-slate-400 via-indigo-300 to-purple-200',
        overlayClass: 'bg-gradient-to-br from-indigo-300/15 via-purple-200/10 to-transparent',
        textColor: 'text-neutral-900',
        subtitleColor: 'text-neutral-700',
        iconColor: 'text-amber-500',
        iconFill: 'rgba(245, 158, 11, 0.25)',
        glowColor: 'rgba(245, 158, 11, 0.18)',
        sweepTint: 'via-amber-400/[0.04]',
        shadowClass: 'shadow-lg shadow-indigo-300/25',
        noiseOpacity: 'opacity-[0.03]',
      };
    case 'snow':
      return {
        bgClass: 'bg-gradient-to-br from-blue-100 via-slate-100 to-white',
        overlayClass: 'bg-gradient-to-br from-blue-100/20 via-slate-50/15 to-transparent',
        textColor: 'text-neutral-900',
        subtitleColor: 'text-neutral-600',
        iconColor: 'text-blue-400',
        iconFill: 'rgba(96, 165, 250, 0.25)',
        glowColor: 'rgba(96, 165, 250, 0.18)',
        sweepTint: 'via-blue-300/[0.04]',
        shadowClass: 'shadow-lg shadow-blue-100/25',
        noiseOpacity: 'opacity-[0.02]',
      };
    case 'mist':
      return {
        bgClass: 'bg-gradient-to-br from-gray-200 via-slate-200/80 to-neutral-200',
        overlayClass: 'bg-gradient-to-br from-gray-200/15 via-slate-100/10 to-transparent',
        textColor: 'text-neutral-900',
        subtitleColor: 'text-neutral-600',
        iconColor: 'text-gray-400',
        iconFill: 'rgba(156, 163, 175, 0.22)',
        glowColor: 'rgba(156, 163, 175, 0.15)',
        sweepTint: 'via-gray-300/[0.03]',
        shadowClass: 'shadow-lg shadow-gray-200/20',
        noiseOpacity: 'opacity-[0.025]',
      };
    default:
      return {
        bgClass: 'bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100',
        overlayClass: 'bg-gradient-to-br from-sky-200/20 via-blue-100/15 to-transparent',
        textColor: 'text-neutral-900',
        subtitleColor: 'text-neutral-600',
        iconColor: 'text-sky-500',
        iconFill: 'rgba(56, 189, 248, 0.28)',
        glowColor: 'rgba(56, 189, 248, 0.22)',
        sweepTint: 'via-sky-500/[0.06]',
        shadowClass: 'shadow-lg shadow-sky-200/30',
        noiseOpacity: 'opacity-[0.02]',
      };
  }
}

/**
 * Get a weather condition emoji for minimal inline display.
 */
export function getWeatherEmoji(category: WeatherCategory, isNight: boolean): string {
  if (isNight) {
    switch (category) {
      case 'clear': return '🌙';
      case 'clouds': return '☁️';
      case 'rain':
      case 'drizzle': return '🌧️';
      case 'thunderstorm': return '⛈️';
      case 'snow': return '🌨️';
      case 'mist': return '🌫️';
      default: return '🌙';
    }
  }
  switch (category) {
    case 'clear': return '☀️';
    case 'clouds': return '⛅';
    case 'rain':
    case 'drizzle': return '🌧️';
    case 'thunderstorm': return '⛈️';
    case 'snow': return '❄️';
    case 'mist': return '🌫️';
    default: return '☀️';
  }
}

/**
 * Capitalize first letter of each word in a string.
 */
export function capitalizeDescription(desc: string): string {
  return desc.replace(/\b\w/g, c => c.toUpperCase());
}

