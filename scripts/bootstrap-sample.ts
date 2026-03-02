import { runSampleBootstrap } from '../src/lib/bootstrap/seed';

runSampleBootstrap('cli')
  .then((result: any) => {
    if (result?.skipped) {
      console.log(`Sample bootstrap skipped (${result.reason || 'unknown'}).`);
      return;
    }
    console.log('Sample bootstrap completed.');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
