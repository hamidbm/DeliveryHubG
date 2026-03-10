import React from 'react';
import type { MilestoneForecast, MilestoneProbabilisticForecast, PlanningEnvironmentEntry } from '../../types';
import type { RoadmapMilestoneVM, RoadmapDependencyEdge, MilestoneIntelligence } from './roadmapViewModels';
import AdvancedTimelineView from './AdvancedTimelineView';

const RoadmapTimelineView: React.FC<{
  milestones: RoadmapMilestoneVM[];
  dependencies: RoadmapDependencyEdge[];
  intelligenceByMilestone?: Record<string, MilestoneIntelligence>;
  forecastByMilestone?: Record<string, MilestoneForecast>;
  probabilisticForecastByMilestone?: Record<string, MilestoneProbabilisticForecast>;
  environments?: PlanningEnvironmentEntry[];
  goLiveDate?: string | null;
}> = ({
  milestones,
  dependencies,
  intelligenceByMilestone = {},
  forecastByMilestone = {},
  probabilisticForecastByMilestone = {},
  environments = [],
  goLiveDate
}) => {
  return (
    <AdvancedTimelineView
      milestones={milestones}
      dependencies={dependencies}
      intelligenceByMilestone={intelligenceByMilestone}
      forecastByMilestone={forecastByMilestone}
      probabilisticForecastByMilestone={probabilisticForecastByMilestone}
      environments={environments}
      goLiveDate={goLiveDate}
    />
  );
};

export default RoadmapTimelineView;
