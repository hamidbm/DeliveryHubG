import { runBaselineBootstrap, runSampleBootstrap } from './seed';

let bootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;

const isBuildPhase = () => process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-export';

export const runBootstrap = async () => {
  if (bootstrapped) return;
  if (isBuildPhase()) return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const autoBaseline = process.env.AUTO_BOOTSTRAP_BASELINE;
    const installSample = process.env.INSTALL_SAMPLE_DATA;

    if (autoBaseline !== 'false') {
      await runBaselineBootstrap('system');
    }

    if (installSample === 'true') {
      await runSampleBootstrap('system');
    }
  })()
    .catch((error) => {
      console.error('Bootstrap failed', error);
    })
    .finally(() => {
      bootstrapped = true;
    });

  return bootstrapPromise;
};
