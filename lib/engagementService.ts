import { Applicant, EngagementRecord, EngagementLevel, UserActivity, ContentEngagement } from './types';
import { getWorkflowStatusInternal, getGeneralAccountStatus } from './shareholdingsVerification';

// ── Constants ───────────────────────────────────────────────────────────

const DOCUMENT_TITLES = [
  'Q4 2025 Earnings Report',
  'ESG Impact Report 2025',
  'Dividend Declaration – FY2025',
  'Board Governance Charter Update',
  'Annual General Meeting Notice 2026',
  'Strategic Partnership Press Release',
  'Q3 2025 Investor Presentation',
  'Material Information Disclosure',
  'Sustainability Roadmap 2026',
  'Corporate Governance Report',
];

// ── Engagement Score Weights ────────────────────────────────────────────

const ENGAGEMENT_WEIGHTS = {
  documentView: 1,      // Per document view
  comment: 5,           // Per comment posted
  reaction: 2,          // Per reaction (like, etc.)
  download: 3,          // Per document download
  login: 0.5,           // Per login event
  eventJoined: 10,      // Per event joined
  eventRequested: 5,     // Per event requested
  meetingRequest: 8,    // Per meeting request
};

// ── Seeded Random ───────────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

// ── Status Mapping ───────────────────────────────────────────────────────

/**
 * Get user status (verified/unverified) from applicant
 */
export async function getUserStatus(applicant: Applicant): Promise<'verified' | 'unverified'> {
  const internalStatus = await getWorkflowStatusInternal(applicant);
  const generalStatus = getGeneralAccountStatus(internalStatus);
  return generalStatus === 'VERIFIED' ? 'verified' : 'unverified';
}

/**
 * Get engagement level from score
 */
export function getEngagementLevel(score: number): EngagementLevel {
  if (score >= 65) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

// ── Engagement Score Calculation ────────────────────────────────────────

/**
 * Calculate engagement score using defined formula
 */
export function calculateEngagementScore(record: {
  documentsViewed: number;
  commentsPosted: number;
  reactions: number;
  downloads: number;
  logins: number;
  eventActivity: { joined: number; requested: number };
  meetingRequests: number;
}): number {
  const score =
    record.documentsViewed * ENGAGEMENT_WEIGHTS.documentView +
    record.commentsPosted * ENGAGEMENT_WEIGHTS.comment +
    record.reactions * ENGAGEMENT_WEIGHTS.reaction +
    record.downloads * ENGAGEMENT_WEIGHTS.download +
    record.logins * ENGAGEMENT_WEIGHTS.login +
    record.eventActivity.joined * ENGAGEMENT_WEIGHTS.eventJoined +
    record.eventActivity.requested * ENGAGEMENT_WEIGHTS.eventRequested +
    record.meetingRequests * ENGAGEMENT_WEIGHTS.meetingRequest;
  
  // Normalize to 0-100 scale
  return Math.min(100, Math.round(score));
}

// ── Data Generation Functions ────────────────────────────────────────────

/**
 * Generate engagement records from applicants
 */
export async function generateEngagementRecords(applicants: Applicant[]): Promise<EngagementRecord[]> {
  // Get all user statuses in parallel
  const statusPromises = applicants.map(applicant => getUserStatus(applicant));
  const userStatuses = await Promise.all(statusPromises);
  
  const records: EngagementRecord[] = [];
  
  for (let i = 0; i < applicants.length; i++) {
    const applicant = applicants[i];
    const seed = i * 17 + applicant.id.charCodeAt(0);
    
    // Get user status from pre-fetched array
    const userStatus = userStatuses[i];
    
    // Generate document views
    const docCount = seededInt(seed + 1, 1, 6);
    const documentsViewed = Array.from({ length: docCount }, (_, i) => {
      const docSeed = seed + i * 7;
      return {
        documentId: `doc-${seededInt(docSeed, 1, 8)}`,
        documentTitle: DOCUMENT_TITLES[seededInt(docSeed + 2, 0, DOCUMENT_TITLES.length - 1)],
        readCompletion: seededInt(docSeed + 3, 10, 100),
        viewedAt: new Date(Date.now() - seededInt(docSeed + 4, 0, 30) * 24 * 60 * 60 * 1000).toISOString(),
      };
    });

    const recentDoc = documentsViewed.sort(
      (a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()
    )[0];

    // Generate interaction counts
    const likes = seededInt(seed + 10, 0, 45);
    const comments = seededInt(seed + 11, 0, 20);
    const reactions = seededInt(seed + 12, 0, 30);
    const downloads = seededInt(seed + 16, 0, 15);
    const logins = seededInt(seed + 17, 1, 50);
    const joined = seededInt(seed + 13, 0, 8);
    const requested = seededInt(seed + 14, 0, 3);
    const meetingRequests = seededInt(seed + 15, 0, 4);

    // Calculate engagement score using defined formula
    const engagementScore = calculateEngagementScore({
      documentsViewed: documentsViewed.length,
      commentsPosted: comments,
      reactions: reactions + likes,
      downloads,
      logins,
      eventActivity: { joined, requested },
      meetingRequests,
    });

    const engagementLevel = getEngagementLevel(engagementScore);

    // Generate comments posted
    const commentsPosted = Array.from({ length: Math.min(comments, 5) }, (_, i) => {
      const cSeed = seed + 20 + i;
      const commentTexts = [
        'Great transparency in the quarterly report.',
        'Looking forward to the dividend payout.',
        'The ESG initiatives are impressive.',
        'Can we get more details on the expansion strategy?',
        'Strong financial position this quarter.',
        'Governance improvements are noted.',
        'The digital transformation is showing results.',
        'Well-executed retail expansion strategy.',
      ];
      return {
        documentTitle: DOCUMENT_TITLES[seededInt(cSeed, 0, DOCUMENT_TITLES.length - 1)],
        commentText: commentTexts[seededInt(cSeed + 1, 0, commentTexts.length - 1)],
        postedAt: new Date(Date.now() - seededInt(cSeed + 2, 0, 30) * 24 * 60 * 60 * 1000).toISOString(),
      };
    });

    // Parse lastActive to compute a proper timestamp
    let lastActiveDate: Date;
    const now = new Date();
    if (applicant.lastActive.includes('hour')) {
      const hours = parseInt(applicant.lastActive) || 1;
      lastActiveDate = new Date(now.getTime() - hours * 60 * 60 * 1000);
    } else if (applicant.lastActive.includes('day')) {
      const days = parseInt(applicant.lastActive) || 1;
      lastActiveDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    } else if (applicant.lastActive.includes('week')) {
      const weeks = parseInt(applicant.lastActive) || 1;
      lastActiveDate = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    } else if (applicant.lastActive.includes('month')) {
      const months = parseInt(applicant.lastActive) || 1;
      lastActiveDate = new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
    } else {
      lastActiveDate = new Date(applicant.lastActive);
      if (isNaN(lastActiveDate.getTime())) {
        lastActiveDate = new Date(now.getTime() - seededInt(seed + 30, 0, 14) * 24 * 60 * 60 * 1000);
      }
    }

    records.push({
      investorId: applicant.id,
      investorName: applicant.fullName,
      investorEmail: applicant.email,
      userStatus,
      profilePictureUrl: applicant.profilePictureUrl,
      lastActive: lastActiveDate.toISOString(),
      recentlyViewed: recentDoc
        ? {
            documentId: recentDoc.documentId,
            documentTitle: recentDoc.documentTitle,
            readCompletion: recentDoc.readCompletion,
          }
        : undefined,
      documentsViewed,
      interactions: { likes, comments, reactions },
      commentsPosted,
      eventActivity: { joined, requested },
      meetingRequests,
      engagementScore,
      engagementLevel,
      downloads,
      logins,
    });
  }
  
  return records;
}

/**
 * Generate most engaged content from engagement records
 */
export function generateMostEngagedContent(records: EngagementRecord[]): ContentEngagement[] {
  const contentMap: Record<string, { views: number; avgRead: number; comments: number; totalRead: number; interactions: number }> = {};
  const totalInvestors = records.length;
  
  records.forEach((r) => {
    r.documentsViewed.forEach((d) => {
      if (!contentMap[d.documentTitle]) {
        contentMap[d.documentTitle] = { views: 0, avgRead: 0, comments: 0, totalRead: 0, interactions: 0 };
      }
      contentMap[d.documentTitle].views++;
      contentMap[d.documentTitle].totalRead += d.readCompletion;
    });
    r.commentsPosted.forEach((c) => {
      if (contentMap[c.documentTitle]) {
        contentMap[c.documentTitle].comments++;
      }
    });
    // Count reactions/interactions
    const totalInteractions = r.interactions.likes + r.interactions.reactions;
    r.documentsViewed.forEach((d) => {
      if (contentMap[d.documentTitle]) {
        contentMap[d.documentTitle].interactions += totalInteractions;
      }
    });
  });
  
  return Object.entries(contentMap)
    .map(([title, data]) => ({
      title,
      views: data.views,
      avgRead: data.views > 0 ? Math.round(data.totalRead / data.views) : 0,
      comments: data.comments,
      interactions: data.interactions,
      readPercentage: totalInvestors > 0 ? Math.round((data.views / totalInvestors) * 100) : 0,
    }))
    .sort((a, b) => b.views - a.views);
}

/**
 * Generate user activities from engagement records
 */
export function generateUserActivities(records: EngagementRecord[]): UserActivity[] {
  const activities: UserActivity[] = [];
  let activityId = 0;

  records.forEach((record) => {
    // Document views
    record.documentsViewed.forEach((doc) => {
      activities.push({
        id: `activity-${activityId++}`,
        userId: record.investorId,
        userName: record.investorName,
        userStatus: record.userStatus,
        activityType: 'view',
        contentTitle: doc.documentTitle,
        contentType: 'document',
        timestamp: doc.viewedAt,
        details: `Read ${doc.readCompletion}%`,
      });
    });

    // Comments posted
    record.commentsPosted.forEach((comment) => {
      activities.push({
        id: `activity-${activityId++}`,
        userId: record.investorId,
        userName: record.investorName,
        userStatus: record.userStatus,
        activityType: 'comment',
        contentTitle: comment.documentTitle,
        contentType: 'document',
        timestamp: comment.postedAt,
        details: comment.commentText,
      });
    });

    // Downloads (estimated from engagement data)
    for (let i = 0; i < record.downloads; i++) {
      const doc = record.documentsViewed[Math.floor(Math.random() * record.documentsViewed.length)];
      if (doc) {
        activities.push({
          id: `activity-${activityId++}`,
          userId: record.investorId,
          userName: record.investorName,
          userStatus: record.userStatus,
          activityType: 'download',
          contentTitle: doc.documentTitle,
          contentType: 'document',
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    // Reactions
    const totalReactions = record.interactions.likes + record.interactions.reactions;
    for (let i = 0; i < totalReactions; i++) {
      const doc = record.documentsViewed[Math.floor(Math.random() * record.documentsViewed.length)];
      if (doc) {
        activities.push({
          id: `activity-${activityId++}`,
          userId: record.investorId,
          userName: record.investorName,
          userStatus: record.userStatus,
          activityType: 'reaction',
          contentTitle: doc.documentTitle,
          contentType: 'document',
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    // Logins (estimated from lastActive)
    if (record.logins > 0) {
      for (let i = 0; i < Math.min(record.logins, 10); i++) {
        activities.push({
          id: `activity-${activityId++}`,
          userId: record.investorId,
          userName: record.investorName,
          userStatus: record.userStatus,
          activityType: 'login',
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    // Registration (if account was created)
    if (record.userStatus === 'verified') {
      activities.push({
        id: `activity-${activityId++}`,
        userId: record.investorId,
        userName: record.investorName,
        userStatus: record.userStatus,
        activityType: 'registration',
        timestamp: record.lastActive,
        details: 'Account registered and verified',
      });
    }
  });

  // Sort by timestamp (most recent first)
  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Generate active investors metrics
 */
export function generateActiveInvestorsMetrics(records: EngagementRecord[]) {
  const now = Date.now();
  const today = records.filter((r) => now - new Date(r.lastActive).getTime() < 24 * 60 * 60 * 1000).length;
  const thisWeek = records.filter((r) => now - new Date(r.lastActive).getTime() < 7 * 24 * 60 * 60 * 1000).length;
  const thisMonth = records.filter((r) => now - new Date(r.lastActive).getTime() < 30 * 24 * 60 * 60 * 1000).length;
  return { today, thisWeek, thisMonth };
}

/**
 * Generate content engagement data (for donut chart)
 */
export function generateContentEngagementData(records: EngagementRecord[]) {
  let fullyRead = 0;
  let partiallyRead = 0;
  let skipped = 0;
  records.forEach((r) => {
    r.documentsViewed.forEach((d) => {
      if (d.readCompletion >= 80) fullyRead++;
      else if (d.readCompletion >= 30) partiallyRead++;
      else skipped++;
    });
  });
  return { fullyRead, partiallyRead, skipped };
}

/**
 * Generate interaction metrics
 */
export function generateInteractionMetrics(records: EngagementRecord[]) {
  const totals = records.reduce(
    (acc, r) => ({
      comments: acc.comments + r.interactions.comments,
      likes: acc.likes + r.interactions.likes,
      rsvps: acc.rsvps + r.eventActivity.joined,
      meetingRequests: acc.meetingRequests + r.meetingRequests,
    }),
    { comments: 0, likes: 0, rsvps: 0, meetingRequests: 0 }
  );
  // Generate sparkline data (7 days)
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const daySeed = i * 31 + 42;
    return Math.round(((totals.comments + totals.likes) / 7) * (0.6 + seededRandom(daySeed) * 0.8));
  });
  return { ...totals, total: totals.comments + totals.likes + totals.rsvps + totals.meetingRequests, chartData };
}

