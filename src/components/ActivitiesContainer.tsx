import React from 'react';
import { Bundle } from '../types';
import Activities from './Activities';
import ReviewsDashboard from './ReviewsDashboard';
import ReviewDetails from './ReviewDetails';
import WorkItemsActivity from './WorkItemsActivity';
import ArchitectureActivity from './ArchitectureActivity';
import CommentsActivity from './CommentsActivity';

interface ActivitiesContainerProps {
  bundles: Bundle[];
}

const ActivitiesContainer: React.FC<ActivitiesContainerProps> = ({ bundles }) => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/activities';

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
      return <CommentsActivity />;
    }
    if (pathname === '/activities/work-items') {
      return <WorkItemsActivity />;
    }
    if (pathname === '/activities/architecture') {
      return <ArchitectureActivity bundles={bundles} />;
    }
    return <Activities />;
  };

  return (
    <div className="min-h-0">
      {renderContent()}
    </div>
  );
};

export default ActivitiesContainer;
