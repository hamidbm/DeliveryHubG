import React, { useMemo } from 'react';
import { useRouter } from '../App';
import { Bundle } from '../types';
import Activities from './Activities';
import ReviewsDashboard from './ReviewsDashboard';
import ReviewDetails from './ReviewDetails';
import WorkItemsActivity from './WorkItemsActivity';

interface ActivitiesContainerProps {
  bundles: Bundle[];
}

const ActivitiesContainer: React.FC<ActivitiesContainerProps> = ({ bundles }) => {
  const router = useRouter();
  const pathname = router ? window.location.pathname : '/activities';

  const tabs = useMemo(() => ([
    { id: 'feed', label: 'Feed', path: '/activities/feed' },
    { id: 'reviews', label: 'Reviews', path: '/activities/reviews' },
    { id: 'comments', label: 'Comments', path: '/activities/comments' },
    { id: 'work-items', label: 'Work Items', path: '/activities/work-items' },
    { id: 'architecture', label: 'Architecture', path: '/activities/architecture' }
  ]), []);

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  const renderContent = () => {
    if (pathname === '/activities' || pathname === '/activities/feed') {
      return <Activities />;
    }
    if (pathname.startsWith('/activities/reviews')) {
      const parts = pathname.split('/').filter(Boolean);
      const reviewId = parts.length > 2 ? parts[2] : null;
      return reviewId ? <ReviewDetails reviewId={reviewId} bundles={bundles} /> : <ReviewsDashboard bundles={bundles} />;
    }
    if (pathname === '/activities/comments') {
      return (
        <div className="p-12 text-slate-500">
          Comments tab coming soon.
        </div>
      );
    }
    if (pathname === '/activities/work-items') {
      return <WorkItemsActivity />;
    }
    if (pathname === '/activities/architecture') {
      return (
        <div className="p-12 text-slate-500">
          Architecture activity coming soon.
        </div>
      );
    }
    return <Activities />;
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="h-14 px-6 flex items-center gap-4 overflow-x-auto no-scrollbar flex-nowrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className={`px-3 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${
                isActive(tab.path)
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0">
        {renderContent()}
      </div>
    </div>
  );
};

export default ActivitiesContainer;
