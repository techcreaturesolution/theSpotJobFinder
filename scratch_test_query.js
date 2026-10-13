import { planJobQuery } from '../server/src/services/jobs/aggregator.js';
import { googleJobsQueries } from '../server/src/services/jobs/providers.js';

const input = {
  prompt: 'ui/ux design',
  level: 'fresher',
  category: 'it_software',
  education: 'be_btech',
  state: 'Gujarat',
  city: 'Ahmedabad',
  postedWithin: 30,
  verifiedOnly: false,
};

const plan = await planJobQuery(input);
console.log('PLAN:', JSON.stringify(plan, null, 2));
console.log('QUERIES:', googleJobsQueries(plan));
