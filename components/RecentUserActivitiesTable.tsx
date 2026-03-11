'use client';

import React from 'react';

interface UserActivity {
  id: string;
  userName: string;
  userStatus: 'verified' | 'unverified';
  activityType: 'view' | 'comment' | 'download' | 'reaction' | 'login' | 'registration';
  contentTitle?: string;
  timestamp: string;
  details?: string;
}

interface RecentUserActivitiesTableProps {
  recentActivities: UserActivity[];
  engagementLoading: boolean;
  onViewAll?: () => void;
  limit?: number; // Default to 20
}

const Avatar: React.FC<{ name: string; size?: number; profilePictureUrl?: string }> = ({ name, size = 32, profilePictureUrl }) => {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs shrink-0"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
};

const RecentUserActivitiesTable: React.FC<RecentUserActivitiesTableProps> = ({
  recentActivities,
  engagementLoading,
  onViewAll,
  limit = 20,
}) => {
  const displayActivities = recentActivities.slice(0, limit);

  const getActivityIcon = (activityType: string, details?: string) => {
    const iconClass = "w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400";
    switch (activityType) {
      case 'view':
        return <span className="text-lg">👁</span>;
      case 'comment':
        return <span className="text-lg">💬</span>;
      case 'download':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        );
      case 'reaction':
        const isDislike = details?.toLowerCase().includes('dislike') || false;
        if (isDislike) {
          return (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.01.05.027.1.05.148.593 1.2.925 2.55.925 3.977 0 1.487-.36 2.89-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54" />
            </svg>
          );
        }
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
          </svg>
        );
      case 'login':
        const isLogout = details?.toLowerCase().includes('logout') || details?.toLowerCase().includes('logged out') || false;
        if (isLogout) {
          return (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
            </svg>
          );
        }
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
        );
      case 'registration':
        return <span className="text-lg">📝</span>;
      default:
        return <span className="text-lg">📄</span>;
    }
  };

  const getActivityLabel = (activityType: string, details?: string) => {
    switch (activityType) {
      case 'view':
        return 'Viewed';
      case 'comment':
        return 'Commented';
      case 'download':
        return 'Downloaded';
      case 'reaction':
        const isDislike = details?.toLowerCase().includes('dislike') || false;
        return isDislike ? 'Disliked' : 'Liked';
      case 'login':
        const isLogout = details?.toLowerCase().includes('logout') || details?.toLowerCase().includes('logged out') || false;
        return isLogout ? 'Logged out' : 'Logged in';
      case 'registration':
        return 'Registered';
      default:
        return 'Interacted';
    }
  };

  const formatRelativeTime = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200/80 dark:border-white/[0.04] rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
      <div className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-[0.08em]">Recent User Activities</h3>
          <p className="text-[8px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">From registered users (verified and unverified)</p>
        </div>
        {onViewAll && (
          <button 
            onClick={onViewAll}
            className="px-2 py-0.5 text-[8px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors uppercase tracking-wider"
          >
            View All
          </button>
        )}
      </div>
      <div className="overflow-x-auto flex-1 overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10">
            <tr className="bg-neutral-50 dark:bg-neutral-800/80 text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.1em]">
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Activity</th>
              <th className="px-3 py-2">Content</th>
              <th className="px-3 py-2 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100/80 dark:divide-neutral-800/50">
            {engagementLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-[9px] text-neutral-400 dark:text-neutral-500">Loading activities...</p>
                </td>
              </tr>
            ) : displayActivities.length > 0 ? (
              displayActivities.map((activity) => (
                <tr key={activity.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Avatar name={activity.userName} size={22} profilePictureUrl={undefined} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="text-[10px] font-bold text-neutral-900 dark:text-white truncate max-w-[80px]">{activity.userName}</p>
                          {activity.userStatus === 'verified' && (
                            <svg className="w-2.5 h-2.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                              <path d="m9 12 2 2 4-4"/>
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="flex items-center justify-center shrink-0">{getActivityIcon(activity.activityType, activity.details)}</span>
                      <span className="text-[10px] text-neutral-700 dark:text-neutral-300">{getActivityLabel(activity.activityType, activity.details)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {activity.contentTitle ? (
                      <span className="text-[10px] text-neutral-700 dark:text-neutral-300 truncate max-w-[100px] block" title={activity.contentTitle}>
                        {activity.contentTitle}
                      </span>
                    ) : (
                      <span className="text-[9px] text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-[9px] text-neutral-400 dark:text-neutral-500">{formatRelativeTime(activity.timestamp)}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                  No recent activities found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentUserActivitiesTable;

