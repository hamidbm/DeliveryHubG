import { runBaselineBootstrap } from '../src/lib/bootstrap/seed';

runBaselineBootstrap('cli')
  .then((result: any) => {
    if (result?.skipped) {
      console.log(`Baseline bootstrap skipped (${result.reason || 'unknown'}).`);
      return;
    }
    console.log('Baseline bootstrap completed.');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
