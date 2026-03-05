/**
 * Greeting Time & Weather Service
 * 
 * Provides time segment detection, sunrise/sunset calculation,
 * weather condition simulation, dynamic theme/color system,
 * and animation trigger logic for the dashboard greeting card.
 * 
 * Architecture:
 * - Currently uses fallback sunrise/sunset times
 * - Weather is simulated based on time of day
 * - Ready for future API integration (OpenWeatherMap, etc.)
 * 
 * Migration path:
 * 1. Replace getSunriseSunset() with real geolocation + API call
 * 2. Replace getWeatherCondition() with real weather API
 */

// ── Types ────────────────────────────────────────────────────────────

export type TimeSegment = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export type WeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'night_clear' | 'night_cloudy';

/** Future: weather can override the time-of-day icon */
export type WeatherIconOverride = 'rain' | 'storm' | 'snow' | null;

export interface SunriseSunset {
  sunrise: number; // hour (0-23)
  sunset: number;  // hour (0-23)
}

export interface TimeContext {
  segment: TimeSegment;
  greeting: string;
  weather: WeatherCondition;
  sunriseSunset: SunriseSunset;
  hour: number;
}

/**
 * Greeting card theme — applied dynamically per time segment.
 * Controls card background, overlay, text color, sweep tint, shadow,
 * icon styling, and radial glow for ambient depth.
 *
 * Inspired by weather-card UIs: rich visible gradients, filled icons,
 * warm/cool glows — adapted for a professional IR dashboard.
 */
export interface GreetingTheme {
  /** Tailwind bg classes — same in both light and dark mode (time-accurate) */
  bgClass: string;
  /** Subtle overlay gradient for ambient depth */
  overlayClass: string;
  /** Text color class for h1 greeting (readable on time-accurate bg) */
  textColor: string;
  /** Subtitle text color class */
  subtitleColor: string;
  /** Sweep animation tint (via-color for the sweep gradient) */
  sweepTint: string;
  /** Shadow color hint */
  shadowClass: string;
  /** Icon stroke color */
  iconColor: string;
  /** Icon fill color (CSS rgba for SVG fill) */
  iconFill: string;
  /** Radial glow CSS color behind icon area */
  glowColor: string;
  /** Noise texture opacity */
  noiseOpacity: string;
}

// ── LocalStorage Keys ────────────────────────────────────────────────

const STORAGE_KEYS = {
  LAST_SEGMENT: 'eurolandHub_lastGreetingSegment',
  LAST_WEATHER: 'eurolandHub_lastGreetingWeather',
  LAST_ANIMATED_AT: 'eurolandHub_lastGreetingAnimatedAt',
} as const;

// ── Sunrise / Sunset ─────────────────────────────────────────────────

/**
 * Get sunrise and sunset times for the current date.
 * 
 * Currently uses fallback values.
 * Future: Use geolocation + sunrise-sunset API or OpenWeatherMap.
 * 
 * Fallback: Sunrise 6:00 AM, Sunset 6:00 PM
 */
export const getSunriseSunset = (): SunriseSunset => {
  // TODO: Replace with real API call when ready
  return {
    sunrise: 6,  // 6:00 AM fallback
    sunset: 18,  // 6:00 PM fallback
  };
};

// ── Time Segment Detection ───────────────────────────────────────────

/**
 * Determine the current time segment based on hour and sunrise/sunset.
 * 
 * Segments:
 * - dawn:      sunrise to 8:00 AM
 * - morning:   8:00 AM to 11:59 AM
 * - afternoon: 12:00 PM to 4:59 PM (sunset - 1)
 * - evening:   5:00 PM (sunset - 1) to 9:00 PM (sunset + 3)
 * - night:     9:00 PM to sunrise
 */
export const getTimeSegment = (hour?: number): TimeSegment => {
  const currentHour = hour ?? new Date().getHours();
  const { sunrise, sunset } = getSunriseSunset();

  // Dawn: sunrise to 8 AM
  if (currentHour >= sunrise && currentHour < 8) {
    return 'dawn';
  }
  // Morning: 8 AM to noon
  if (currentHour >= 8 && currentHour < 12) {
    return 'morning';
  }
  // Afternoon: noon to 5 PM
  if (currentHour >= 12 && currentHour < 17) {
    return 'afternoon';
  }
  // Evening: 5 PM to 9 PM
  if (currentHour >= 17 && currentHour < 21) {
    return 'evening';
  }
  // Night: 9 PM onwards or before sunrise
  return 'night';
};

// ── Greeting Text ────────────────────────────────────────────────────

/**
 * Get contextual greeting text based on time segment.
 */
export const getGreetingText = (segment?: TimeSegment): string => {
  const s = segment ?? getTimeSegment();
  switch (s) {
    case 'dawn':      return 'Good morning';
    case 'morning':   return 'Good morning';
    case 'afternoon': return 'Good afternoon';
    case 'evening':   return 'Good evening';
    case 'night':     return 'Good evening';
    default:          return 'Welcome';
  }
};

/**
 * Get a contextual subtitle based on time segment.
 */
export const getGreetingSubtitle = (segment?: TimeSegment): string => {
  const s = segment ?? getTimeSegment();
  switch (s) {
    case 'dawn':      return 'Early start — your investor dashboard is primed and ready.';
    case 'morning':   return 'Your investor dashboard is primed and ready.';
    case 'afternoon': return 'Markets are active — stay on top of your IR updates.';
    case 'evening':   return 'Wrapping up — here\u2019s your dashboard overview.';
    case 'night':     return 'Late session — your dashboard is ready when you are.';
    default:          return 'Your investor dashboard is primed and ready.';
  }
};

// ── Greeting Theme / Color System ────────────────────────────────────

/**
 * Get the greeting card theme for a given time segment.
 * 
 * Returns Tailwind classes for card bg, overlay, text, sweep,
 * shadow, and icon colors. All colors are subtle, low-saturation,
 * and professional — not weather-app bright.
 */
export const getGreetingTheme = (segment?: TimeSegment): GreetingTheme => {
  const s = segment ?? getTimeSegment();

  // ── Time-accurate colors — SAME in both light and dark mode ──
  // The greeting card is its own "island" that always reflects
  // the real sky/ambient color for the current time of day.
  // Dark/light mode does NOT change these colors.

  switch (s) {
    case 'dawn':
      // Warm coral → peach → gold — real sunrise warmth
      return {
        bgClass: 'bg-gradient-to-br from-rose-200 via-amber-100 to-yellow-50',
        overlayClass: 'bg-gradient-to-br from-orange-200/30 via-amber-100/20 to-transparent',
        textColor: 'text-neutral-800',
        subtitleColor: 'text-neutral-600/80',
        sweepTint: 'via-amber-600/[0.06]',
        shadowClass: 'shadow-lg shadow-amber-200/30',
        iconColor: 'text-amber-600',
        iconFill: 'rgba(251, 146, 60, 0.30)',
        glowColor: 'rgba(251, 191, 36, 0.25)',
        noiseOpacity: 'opacity-[0.02]',
      };

    case 'morning':
      // Golden warm clarity — bright, energetic morning sky
      return {
        bgClass: 'bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-50/80',
        overlayClass: 'bg-gradient-to-br from-yellow-200/20 via-amber-100/10 to-transparent',
        textColor: 'text-neutral-900',
        subtitleColor: 'text-neutral-500',
        sweepTint: 'via-amber-500/[0.05]',
        shadowClass: 'shadow-lg shadow-amber-100/30',
        iconColor: 'text-amber-500',
        iconFill: 'rgba(245, 158, 11, 0.25)',
        glowColor: 'rgba(245, 158, 11, 0.20)',
        noiseOpacity: 'opacity-[0.02]',
      };

    case 'afternoon':
      // Sky blue daylight — the sky IS light blue in the afternoon
      return {
        bgClass: 'bg-gradient-to-br from-sky-200 via-blue-100 to-indigo-100/60',
        overlayClass: 'bg-gradient-to-br from-sky-200/25 via-blue-100/15 to-transparent',
        textColor: 'text-neutral-900',
        subtitleColor: 'text-neutral-600',
        sweepTint: 'via-sky-500/[0.06]',
        shadowClass: 'shadow-lg shadow-sky-200/30',
        iconColor: 'text-sky-500',
        iconFill: 'rgba(56, 189, 248, 0.25)',
        glowColor: 'rgba(56, 189, 248, 0.20)',
        noiseOpacity: 'opacity-[0.02]',
      };

    case 'evening':
      // Sunset orange → purple → indigo — real twilight transition
      return {
        bgClass: 'bg-gradient-to-br from-orange-200 via-rose-200/80 to-indigo-300/60',
        overlayClass: 'bg-gradient-to-br from-orange-200/20 via-violet-200/15 to-transparent',
        textColor: 'text-neutral-900',
        subtitleColor: 'text-neutral-700/70',
        sweepTint: 'via-indigo-600/[0.05]',
        shadowClass: 'shadow-lg shadow-indigo-200/25',
        iconColor: 'text-orange-400',
        iconFill: 'rgba(251, 146, 60, 0.25)',
        glowColor: 'rgba(251, 146, 60, 0.18)',
        noiseOpacity: 'opacity-[0.02]',
      };

    case 'night':
      // Deep navy → charcoal — real dark sky, same in both modes
      return {
        bgClass: 'bg-gradient-to-br from-slate-700 via-indigo-800/80 to-slate-900',
        overlayClass: 'bg-gradient-to-br from-indigo-600/15 via-violet-700/8 to-transparent',
        textColor: 'text-white',
        subtitleColor: 'text-slate-300/70',
        sweepTint: 'via-indigo-300/[0.04]',
        shadowClass: 'shadow-lg shadow-slate-400/20',
        iconColor: 'text-slate-300',
        iconFill: 'rgba(148, 163, 184, 0.18)',
        glowColor: 'rgba(129, 140, 248, 0.12)',
        noiseOpacity: 'opacity-[0.025]',
      };

    default:
      return {
        bgClass: 'bg-gradient-to-br from-sky-200 via-blue-100 to-indigo-100/60',
        overlayClass: '',
        textColor: 'text-neutral-900',
        subtitleColor: 'text-neutral-500',
        sweepTint: 'via-neutral-900/[0.03]',
        shadowClass: 'shadow-md',
        iconColor: 'text-neutral-600',
        iconFill: 'rgba(115, 115, 115, 0.15)',
        glowColor: 'transparent',
        noiseOpacity: 'opacity-[0.02]',
      };
  }
};

// ── Weather Condition ────────────────────────────────────────────────

/**
 * Get simulated weather condition.
 * 
 * Currently: Simulates based on time of day for ambient mood.
 * Future: Replace with real weather API (OpenWeatherMap, WeatherAPI, etc.)
 */
export const getWeatherCondition = (segment?: TimeSegment): WeatherCondition => {
  const s = segment ?? getTimeSegment();
  switch (s) {
    case 'dawn':      return 'sunny';
    case 'morning':   return 'sunny';
    case 'afternoon': return 'sunny';
    case 'evening':   return 'night_clear';
    case 'night':     return 'night_clear';
    default:          return 'sunny';
  }
};

/**
 * Future: Get weather-based icon override.
 * When weather API is connected, strong weather conditions
 * can override the time-of-day icon.
 * 
 * Returns null when no override is needed (use time icon).
 */
export const getWeatherIconOverride = (_weather?: WeatherCondition): WeatherIconOverride => {
  // TODO: Implement when real weather API is connected
  // Example:
  // if (weather === 'rain') return 'rain';
  // if (weather === 'snow') return 'snow';
  return null;
};

// ── Animation Trigger Logic ──────────────────────────────────────────

/**
 * Determine if the greeting animation should trigger.
 */
export const shouldTriggerGreetingAnimation = (): {
  shouldAnimate: boolean;
  context: TimeContext;
  reason?: 'segment_change' | 'weather_change' | 'first_visit';
} => {
  const sunriseSunset = getSunriseSunset();
  const hour = new Date().getHours();
  const segment = getTimeSegment(hour);
  const weather = getWeatherCondition(segment);
  const greeting = getGreetingText(segment);

  const context: TimeContext = { segment, greeting, weather, sunriseSunset, hour };

  try {
    const lastSegment = localStorage.getItem(STORAGE_KEYS.LAST_SEGMENT);
    const lastWeather = localStorage.getItem(STORAGE_KEYS.LAST_WEATHER);

    if (!lastSegment) {
      localStorage.setItem(STORAGE_KEYS.LAST_SEGMENT, segment);
      localStorage.setItem(STORAGE_KEYS.LAST_WEATHER, weather);
      localStorage.setItem(STORAGE_KEYS.LAST_ANIMATED_AT, Date.now().toString());
      return { shouldAnimate: true, context, reason: 'first_visit' };
    }

    if (segment !== lastSegment) {
      localStorage.setItem(STORAGE_KEYS.LAST_SEGMENT, segment);
      localStorage.setItem(STORAGE_KEYS.LAST_WEATHER, weather);
      localStorage.setItem(STORAGE_KEYS.LAST_ANIMATED_AT, Date.now().toString());
      return { shouldAnimate: true, context, reason: 'segment_change' };
    }

    if (weather !== lastWeather) {
      localStorage.setItem(STORAGE_KEYS.LAST_WEATHER, weather);
      localStorage.setItem(STORAGE_KEYS.LAST_ANIMATED_AT, Date.now().toString());
      return { shouldAnimate: true, context, reason: 'weather_change' };
    }

    return { shouldAnimate: false, context };
  } catch {
    return { shouldAnimate: true, context, reason: 'first_visit' };
  }
};

/**
 * Get current time context without triggering animation logic.
 */
export const getCurrentTimeContext = (): TimeContext => {
  const hour = new Date().getHours();
  const segment = getTimeSegment(hour);
  const weather = getWeatherCondition(segment);
  const greeting = getGreetingText(segment);
  const sunriseSunset = getSunriseSunset();
  return { segment, greeting, weather, sunriseSunset, hour };
};

/**
 * Force-update localStorage with current segment.
 */
export const markSegmentAnimated = (segment: TimeSegment, weather: WeatherCondition): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SEGMENT, segment);
    localStorage.setItem(STORAGE_KEYS.LAST_WEATHER, weather);
    localStorage.setItem(STORAGE_KEYS.LAST_ANIMATED_AT, Date.now().toString());
  } catch {
    // Silently fail
  }
};

// ── Widget Display Helpers ──────────────────────────────────────────

/**
 * Get formatted "Day • Time" string for widget display.
 * Example: "Thursday • 2:45 PM"
 */
export const getWidgetDateLine = (date?: Date): string => {
  const now = date ?? new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'long' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} \u2022 ${time}`;
};

/**
 * Check if current segment is daytime (shows sun + clouds vs moon + stars).
 */
export const isDaytime = (segment?: TimeSegment): boolean => {
  const s = segment ?? getTimeSegment();
  return s === 'dawn' || s === 'morning' || s === 'afternoon';
};

/**
 * Get IRO location using browser Geolocation API + reverse geocoding.
 * Falls back to timezone-based city name if geolocation fails or is denied.
 */
export const getLocationString = async (): Promise<string> => {
  // Try browser geolocation first
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          enableHighAccuracy: false,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocoding using OpenStreetMap Nominatim API (free, no key required)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'EurolandHUB/1.0', // Required by Nominatim
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          // Prefer city, then town, then municipality, then state
          const city = data.address?.city || data.address?.town || data.address?.municipality || data.address?.state;
          if (city) {
            return city;
          }
        }
      } catch (e) {
        // Silently fall through to timezone fallback
        console.debug('Reverse geocoding failed, using timezone fallback');
      }
    } catch (e) {
      // Geolocation denied or failed, fall through to timezone fallback
      console.debug('Geolocation failed, using timezone fallback');
    }
  }

  // Fallback: Extract city from browser timezone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = tz.split('/');
    return parts[parts.length - 1].replace(/_/g, ' ');
  } catch {
    return '';
  }
};
