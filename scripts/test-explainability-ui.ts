import React from 'react';
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import { EXPLAINABILITY_REGISTRY } from '../src/lib/explainabilityRegistry';
import ExplainableMetric from '../src/components/explainability/ExplainableMetric';
import ExplainabilityPopover from '../src/components/explainability/ExplainabilityPopover';

export const run = async () => {
  assert.ok(EXPLAINABILITY_REGISTRY.on_time_probability);
  assert.ok(EXPLAINABILITY_REGISTRY.capacity_utilization);

  const metricHtml = renderToStaticMarkup(
    React.createElement(ExplainableMetric, { label: 'On-Time', value: '62%', explainabilityKey: 'on_time_probability' })
  );
  assert.ok(metricHtml.includes('On-Time'));

  const missingHtml = renderToStaticMarkup(
    React.createElement(ExplainableMetric, { label: 'Missing', value: '—', explainabilityKey: 'does_not_exist' })
  );
  assert.ok(missingHtml.includes('Missing'));

  const popoverHtml = renderToStaticMarkup(
    React.createElement(ExplainabilityPopover, { content: EXPLAINABILITY_REGISTRY.on_time_probability, onClose: () => null })
  );
  assert.ok(popoverHtml.includes('On-Time Probability'));

  console.log('explainability ui tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
