import type { DeliveryPlanArtifact, DeliveryPlanInput, DeliveryPlanMilestoneDraft } from '../types';

const getProjectSizeDefaults = (projectSize?: DeliveryPlanInput['projectSize']) => {
  switch (projectSize) {
    case 'SMALL':
      return { featuresPerMilestoneTarget: 2, storiesPerFeatureTarget: 3, tasksPerStoryTarget: 0 };
    case 'MEDIUM':
      return { featuresPerMilestoneTarget: 3, storiesPerFeatureTarget: 5, tasksPerStoryTarget: 1 };
    case 'LARGE':
      return { featuresPerMilestoneTarget: 4, storiesPerFeatureTarget: 8, tasksPerStoryTarget: 2 };
    case 'ENTERPRISE':
      return { featuresPerMilestoneTarget: 5, storiesPerFeatureTarget: 10, tasksPerStoryTarget: 2 };
    default:
      return null;
  }
};

const getShapeDefaults = (shape: DeliveryPlanInput['backlogShape']) => {
  if (shape === 'LIGHT') return { featuresPerEpic: 2, storiesPerFeature: 3 };
  if (shape === 'DETAILED') return { featuresPerEpic: 4, storiesPerFeature: 5 };
  return { featuresPerEpic: 3, storiesPerFeature: 4 };
};

const distributeCounts = (total: number, buckets: number) => {
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, i) => base + (i < remainder ? 1 : 0));
};

export const generateArtifacts = (milestones: DeliveryPlanMilestoneDraft[], input: DeliveryPlanInput) => {
  const artifacts: DeliveryPlanArtifact[] = [];
  const defaults = getShapeDefaults(input.backlogShape);
  const projectDefaults = getProjectSizeDefaults(input.projectSize);

  milestones.forEach((ms) => {
    const themes = ms.themes.length ? ms.themes : [`Milestone ${ms.index} Delivery`];
    const epicCount = themes.length;
    const totalFeatures = input.featuresPerMilestoneTarget
      ? Math.max(input.featuresPerMilestoneTarget, epicCount)
      : projectDefaults?.featuresPerMilestoneTarget
        ? Math.max(projectDefaults.featuresPerMilestoneTarget, epicCount)
        : epicCount * defaults.featuresPerEpic;
    const featuresByEpic = distributeCounts(totalFeatures, epicCount);
    const storiesPerFeature = input.storiesPerFeatureTarget
      ?? projectDefaults?.storiesPerFeatureTarget
      ?? defaults.storiesPerFeature;
    const createTasks = Boolean(input.createTasksUnderStories || input.backlogShape === 'DETAILED');
    const tasksPerStory = Math.max(
      0,
      input.tasksPerStoryTarget
        ?? projectDefaults?.tasksPerStoryTarget
        ?? 0
    );

    const epics = themes.map((theme, themeIdx) => {
      const featureCount = featuresByEpic[themeIdx] || defaults.featuresPerEpic;
      const features = Array.from({ length: featureCount }, (_, fi) => {
        const featureName = `M${ms.index} ${theme} Feature ${fi + 1}`;
        const stories = Array.from({ length: storiesPerFeature }, (_, si) => {
          const storyName = `M${ms.index} ${theme} Story ${fi + 1}.${si + 1}`;
          const tasks = createTasks
            ? Array.from({ length: tasksPerStory }, (_, ti) => `Task ${ti + 1} - ${storyName}`)
            : [];
          return { name: storyName, tasks };
        });
        return { name: featureName, stories };
      });
      return { name: `M${ms.index} ${theme}`, features };
    });

    const featureCount = epics.reduce((sum, e) => sum + e.features.length, 0);
    const storyCount = epics.reduce((sum, e) => sum + e.features.reduce((acc, f) => acc + f.stories.length, 0), 0);
    const taskCount = epics.reduce(
      (sum, e) =>
        sum +
        e.features.reduce((acc, f) => acc + f.stories.reduce((sAcc, s) => sAcc + s.tasks.length, 0), 0),
      0
    );

    artifacts.push({
      milestoneIndex: ms.index,
      epicCount,
      featureCount,
      storyCount,
      taskCount,
      epics
    });
  });

  return artifacts;
};
