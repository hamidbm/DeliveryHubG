import { resetSampleData } from '../src/lib/bootstrap/seed';

resetSampleData('cli')
  .then(() => {
    console.log('Sample data reset completed.');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
