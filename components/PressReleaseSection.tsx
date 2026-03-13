'use client';

import React, { useState, useEffect } from 'react';
import {
  getRecentPressReleases,
  getAllPressReleases,
  getPressReleasesByCategory,
  searchPressReleases,
  type PressRelease,
  type PressReleaseCategory,
} from '../services/pressReleaseService';

// ─── Category Tag Colors ────────────────────────────────────────────────
const categoryStyles: Record<string, string> = {
  Earnings:   'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  ESG:        'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800',
  Innovation: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800',
  Corporate:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
};

const categoryIcons: Record<string, React.ReactNode> = {
  Earnings: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  ESG: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M17 8c.7 0 1.4.1 2 .3M3 18.4l3.3-3.3A9 9 0 0 1 12 3a9 9 0 0 1 9 9c0 2.1-.7 4-1.9 5.6L22 21h-6" />
      <path d="M12 3v9l4 4" />
    </svg>
  ),
  Innovation: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  ),
  Corporate: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
    </svg>
  ),
};

// ─── Format helpers ─────────────────────────────────────────────────────
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const timeAgo = (dateStr: string) => {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

// ─── Press Release Card ─────────────────────────────────────────────────
interface PressReleaseCardProps {
  release: PressRelease;
  onReadMore?: (release: PressRelease) => void;
  variant?: 'compact' | 'full';
}

const PressReleaseCard: React.FC<PressReleaseCardProps> = ({ release, onReadMore, variant = 'compact' }) => {
  const catStyle = categoryStyles[release.category] || categoryStyles.Corporate;
  const catIcon = categoryIcons[release.category] || categoryIcons.Corporate;

  if (variant === 'compact') {
    return (
      <div className="group relative bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/60 rounded-xl overflow-hidden hover:border-neutral-300 dark:hover:border-neutral-600 transition-all duration-300 hover:shadow-lg dark:hover:shadow-black/30">
        {/* Image Banner */}
        <div className="relative h-40 overflow-hidden">
          <img
            src={release.image}
            alt={release.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          {/* Category tag on image */}
          <div className="absolute top-3 left-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border backdrop-blur-sm ${catStyle}`}>
              {catIcon}
              {release.category}
            </span>
          </div>
          {/* Time ago badge */}
          <div className="absolute bottom-3 right-3">
            <span className="text-[10px] font-bold text-white/80 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded">
              {timeAgo(release.date)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
            {formatDate(release.date)}
          </p>
          <h4 className="text-sm font-black text-neutral-900 dark:text-neutral-100 leading-snug mb-3 line-clamp-2 group-hover:text-primary dark:group-hover:text-primary-light transition-colors">
            {release.title}
          </h4>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed line-clamp-3 mb-4">
            {release.excerpt}
          </p>
          <button
            onClick={() => onReadMore?.(release)}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary dark:text-primary-light uppercase tracking-wider hover:gap-2.5 transition-all duration-200 group/btn"
          >
            Read More
            <svg className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Full variant for expanded view
  return (
    <div className="group bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/60 rounded-xl overflow-hidden hover:border-neutral-300 dark:hover:border-neutral-600 transition-all duration-300 hover:shadow-lg dark:hover:shadow-black/30">
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <div className="relative w-full md:w-72 h-48 md:h-auto overflow-hidden flex-shrink-0">
          <img
            src={release.image}
            alt={release.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${catStyle}`}>
              {catIcon}
              {release.category}
            </span>
            <span className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
              {formatDate(release.date)}
            </span>
          </div>
          <h4 className="text-base font-black text-neutral-900 dark:text-neutral-100 leading-snug mb-3 group-hover:text-primary dark:group-hover:text-primary-light transition-colors">
            {release.title}
          </h4>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4 line-clamp-2">
            {release.excerpt}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
              By {release.author}
            </span>
            <button
              onClick={() => onReadMore?.(release)}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary dark:text-primary-light uppercase tracking-wider hover:gap-2.5 transition-all duration-200 group/btn"
            >
              Read Full Release
              <svg className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Full Press Release Detail View ─────────────────────────────────────
interface PressReleaseDetailProps {
  release: PressRelease;
  relatedReleases: PressRelease[];
  onBack: () => void;
  onSelectRelated: (release: PressRelease) => void;
}

const PressReleaseDetail: React.FC<PressReleaseDetailProps> = ({ release, relatedReleases, onBack, onSelectRelated }) => {
  const catStyle = categoryStyles[release.category] || categoryStyles.Corporate;
  const catIcon = categoryIcons[release.category] || categoryIcons.Corporate;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-6 text-[10px] font-black uppercase tracking-widest">
        <button onClick={onBack} className="text-neutral-400 dark:text-neutral-500 hover:text-primary transition-colors">
          Dashboard
        </button>
        <svg className="w-3 h-3 text-neutral-300 dark:text-neutral-600" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <button onClick={onBack} className="text-neutral-400 dark:text-neutral-500 hover:text-primary transition-colors">
          Press Releases
        </button>
        <svg className="w-3 h-3 text-neutral-300 dark:text-neutral-600" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-neutral-700 dark:text-neutral-300 truncate max-w-[200px]">{release.title}</span>
      </nav>

      {/* Hero Banner */}
      <div className="relative h-64 md:h-80 rounded-xl overflow-hidden mb-8">
        <img src={release.image} alt={release.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border backdrop-blur-sm mb-3 ${catStyle}`}>
            {catIcon}
            {release.category}
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">{release.title}</h1>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{release.author}</p>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Touchmicro.Inc</p>
          </div>
        </div>
        <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-700" />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatDate(release.date)}</p>
      </div>

      {/* Full Article Content */}
      <div className="max-w-3xl">
        {release.content.split('\n\n').map((paragraph, i) => (
          <p key={i} className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Related Releases */}
      {relatedReleases.length > 0 && (
        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tight mb-6">Related Releases</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedReleases.map(rel => (
              <PressReleaseCard key={rel.id} release={rel} onReadMore={onSelectRelated} variant="compact" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── All Press Releases View ────────────────────────────────────────────
interface AllPressReleasesViewProps {
  onBack: () => void;
  onSelectRelease: (release: PressRelease) => void;
}

const AllPressReleasesView: React.FC<AllPressReleasesViewProps> = ({ onBack, onSelectRelease }) => {
  const [releases, setReleases] = useState<PressRelease[]>([]);
  const [activeCategory, setActiveCategory] = useState<PressReleaseCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const categories: PressReleaseCategory[] = ['All', 'Earnings', 'ESG', 'Innovation', 'Corporate'];

  useEffect(() => {
    const fetchReleases = async () => {
      setLoading(true);
      let results: PressRelease[];
      if (searchQuery.trim()) {
        results = await searchPressReleases(searchQuery);
        if (activeCategory !== 'All') {
          results = results.filter(r => r.category === activeCategory);
        }
      } else {
        results = await getPressReleasesByCategory(activeCategory);
      }
      setReleases(results);
      setLoading(false);
    };
    fetchReleases();
  }, [activeCategory, searchQuery]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-black text-neutral-500 dark:text-neutral-400 hover:text-primary transition-colors uppercase tracking-widest group mb-6">
        <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tighter mb-2">Press Releases</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
          Touchmicro.Inc is committed to transparent corporate communications. Browse our latest announcements, earnings reports, ESG updates, and innovation milestones.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        {/* Category Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all duration-200 ${
                activeCategory === cat
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white'
                  : 'bg-transparent text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs ml-auto">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search press releases..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : releases.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-neutral-400 dark:text-neutral-500">No press releases found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {releases.map(release => (
            <PressReleaseCard key={release.id} release={release} onReadMore={onSelectRelease} variant="full" />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Preview Section (for Dashboard) ────────────────────────────────────
interface PressReleaseSectionProps {
  onViewAll?: () => void;
  onSelectRelease?: (release: PressRelease) => void;
}

const PressReleasePreview: React.FC<PressReleaseSectionProps> = ({ onViewAll, onSelectRelease }) => {
  const [releases, setReleases] = useState<PressRelease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecent = async () => {
      const recent = await getRecentPressReleases(3);
      setReleases(recent);
      setLoading(false);
    };
    fetchRecent();
  }, []);

  return (
    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm">
      <div className="px-10 py-8 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between bg-neutral-50/30 dark:bg-neutral-900/30">
        <div>
          <h3 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tighter">Latest Press Releases</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Corporate announcements, earnings reports, and investor communications</p>
        </div>
        <button
          onClick={onViewAll}
          className="px-4 py-2 text-xs font-bold bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors uppercase tracking-wider flex items-center gap-2"
        >
          View All Press Releases
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7 7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="p-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {releases.map(release => (
              <PressReleaseCard key={release.id} release={release} onReadMore={onSelectRelease} variant="compact" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Exports ────────────────────────────────────────────────────────────
export { PressReleasePreview, PressReleaseDetail, AllPressReleasesView, PressReleaseCard };
export type { PressRelease };




