import assert from 'node:assert';
import { runTest } from './test-harness';
import { runMonteCarloForecast } from '../src/services/monteCarlo';

export const run = async () => {
  await runTest('monte-carlo', async () => {
    const seed = 12345;
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const input = {
      remainingPoints: 100,
      weeklySamples: [10, 20, 30, 40],
      iterations: 500,
      pLevels: [0.5, 0.8, 0.9],
      endDate: '2026-02-01T00:00:00.000Z',
      seed,
      startDate
    };

    const forecastA = runMonteCarloForecast(input);
    const forecastB = runMonteCarloForecast(input);

    assert.ok(forecastA, 'Expected forecast output');
    assert.ok(forecastB, 'Expected deterministic output');
    assert.strictEqual(forecastA?.p50, forecastB?.p50, 'Expected deterministic p50');
    assert.strictEqual(forecastA?.p80, forecastB?.p80, 'Expected deterministic p80');
    assert.strictEqual(forecastA?.p90, forecastB?.p90, 'Expected deterministic p90');
    assert.ok(new Date(forecastA!.p50).getTime() <= new Date(forecastA!.p80).getTime(), 'Expected p50 <= p80');
    assert.ok(new Date(forecastA!.p80).getTime() <= new Date(forecastA!.p90).getTime(), 'Expected p80 <= p90');
    assert.ok(forecastA!.hitProbability >= 0 && forecastA!.hitProbability <= 1, 'Expected hit probability between 0 and 1');
  });

  console.log('monte carlo tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
