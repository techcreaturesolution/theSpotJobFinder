import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';
import { JobPosting } from '../src/models/JobPosting.js';
import { identityKey } from '../src/services/jobs/dedupe.js';

const days = (n) => new Date(Date.now() - n * 86400_000);

const samples = [
  { education: ['be_btech', 'bca', 'mca'], title: 'Junior React Developer (Fresher)', companyName: 'Sample Softech Pvt Ltd', category: 'it_software', level: 'fresher', experienceText: 'Fresher (0-1 years)', city: 'Ahmedabad', state: 'Gujarat', address: '501, Sample Business Hub, SG Highway, Ahmedabad, Gujarat 380054', salary: '₹15,000 - ₹25,000 / month', employmentType: 'Full-time', emails: ['hr@example.org'], phones: ['+91 98765 43210'], applyUrl: 'https://example.org/careers/react-fresher', description: 'We are hiring freshers for React.js development.\n• B.E./B.Tech/BCA/MCA 2024-2026 pass-outs\n• Basic HTML, CSS, JavaScript, React\n• 6 month training with stipend, then full-time role', postedAt: days(1) },
  { education: ['graduate'], title: 'Node.js Backend Developer', companyName: 'Sample Softech Pvt Ltd', category: 'it_software', level: 'experienced', experienceText: '2-4 years', city: 'Ahmedabad', state: 'Gujarat', address: '501, Sample Business Hub, SG Highway, Ahmedabad, Gujarat 380054', salary: '₹6 - ₹9 LPA', employmentType: 'Full-time', emails: ['careers@example.org'], phones: ['+91 98765 43210'], applyUrl: 'https://example.org/careers/node-backend', description: '2-4 years of experience with Node.js, Express and MongoDB. REST APIs, AWS basics.', postedAt: days(2) },
  { education: ['12th'], title: 'Telecaller (Hindi / Gujarati)', companyName: 'Demo Finserv', category: 'bpo', level: 'fresher', experienceText: 'Fresher', city: 'Surat', state: 'Gujarat', address: 'Ring Road, Surat, Gujarat 395002', salary: '₹12,000 - ₹18,000 / month + incentives', employmentType: 'Full-time', emails: ['jobs@example.org'], phones: ['+91 91234 56789'], applyUrl: '', description: '12th pass / graduate freshers. Good communication in Hindi or Gujarati. Walk-in interview Mon-Sat 11am-4pm.', postedAt: days(0) },
  { education: ['graduate'], title: 'Field Sales Executive', companyName: 'Demo Consumer Goods', category: 'sales_bd', level: 'experienced', experienceText: '1-3 years', city: 'Pune', state: 'Maharashtra', address: 'Baner Road, Pune, Maharashtra 411045', salary: '₹20,000 - ₹30,000 / month', employmentType: 'Full-time', emails: ['hr.pune@example.org'], phones: ['+91 99887 76655'], applyUrl: 'https://example.org/jobs/field-sales-pune', description: '1-3 years of FMCG field sales experience. Two-wheeler with licence required.', postedAt: days(3) },
  { education: ['nursing'], title: 'Staff Nurse', companyName: 'Sample Multispeciality Hospital', category: 'healthcare', level: 'experienced', experienceText: '1+ years', city: 'Jaipur', state: 'Rajasthan', address: 'Tonk Road, Jaipur, Rajasthan 302015', salary: '₹22,000 - ₹32,000 / month', employmentType: 'Full-time', emails: ['recruitment@example.org'], phones: ['+91 94140 12345'], applyUrl: '', description: 'GNM / B.Sc Nursing with 1+ years of experience in ICU or ward. Rotational shifts.', postedAt: days(5) },
  { education: ['10th'], title: 'Delivery Partner', companyName: 'Demo Quick Commerce', category: 'delivery', level: 'fresher', experienceText: 'Fresher', city: 'Bengaluru', state: 'Karnataka', address: 'HSR Layout, Bengaluru, Karnataka 560102', salary: 'Up to ₹35,000 / month', employmentType: 'Full-time / Part-time', emails: [], phones: ['+91 80000 11122'], applyUrl: 'https://example.org/riders', description: 'No experience needed. Own bike, driving licence and smartphone required. Weekly payouts.', postedAt: days(1) },
  { education: ['graduate'], title: 'Primary School Teacher (English)', companyName: 'Sample Public School', category: 'education', level: 'experienced', experienceText: '2+ years', city: 'Lucknow', state: 'Uttar Pradesh', address: 'Gomti Nagar, Lucknow, Uttar Pradesh 226010', salary: '₹25,000 - ₹35,000 / month', employmentType: 'Full-time', emails: ['principal@example.org'], phones: ['+91 94150 67890'], applyUrl: '', description: 'B.Ed with 2+ years of teaching experience. Fluent spoken English.', postedAt: days(6) },
  { education: ['bcom'], title: 'Accounts Assistant (Tally, GST)', companyName: 'Demo Traders', category: 'finance', level: 'fresher', experienceText: 'Fresher (0-1 years)', city: 'Vadodara', state: 'Gujarat', address: 'Alkapuri, Vadodara, Gujarat 390007', salary: '₹14,000 - ₹20,000 / month', employmentType: 'Full-time', emails: ['accounts@example.org'], phones: ['+91 97250 11223'], applyUrl: '', description: 'B.Com freshers with knowledge of Tally Prime and GST returns.', postedAt: days(2) },
  { education: ['graduate'], title: 'Digital Marketing Intern', companyName: 'Sample Media Labs', category: 'internship', level: 'fresher', experienceText: 'Fresher', city: 'Noida', state: 'Uttar Pradesh', address: 'Sector 62, Noida, Uttar Pradesh 201309', salary: '₹8,000 / month stipend', employmentType: 'Internship', emails: ['internships@example.org'], phones: [], applyUrl: 'https://example.org/internships/digital-marketing', description: '3-month internship: social media, SEO basics, Canva. PPO for top performers.', postedAt: days(4) },
  { education: ['be_btech', 'diploma'], title: 'Site Engineer (Civil)', companyName: 'Demo Infra Projects', category: 'construction', level: 'experienced', experienceText: '3-5 years', city: 'Hyderabad', state: 'Telangana', address: 'Gachibowli, Hyderabad, Telangana 500032', salary: '₹4.5 - ₹6 LPA', employmentType: 'Full-time', emails: ['hr@example.org'], phones: ['+91 90000 44556'], applyUrl: 'https://example.org/careers/site-engineer', description: 'B.E. Civil with 3-5 years of experience on residential high-rise projects.', postedAt: days(8) },
];

await connectDb();
if ((await JobPosting.countDocuments({ origin: 'portal' })) === 0) {
  await JobPosting.insertMany(
    samples.map((j, i) => ({
      ...j,
      key: `portal:sample-${i}`,
      dedupeKey: identityKey(j),
      origin: 'portal',
      location: `${j.city}, ${j.state}, India`,
      platform: 'This portal',
      via: 'This portal',
      applyOptions: j.applyUrl ? [{ title: j.companyName, link: j.applyUrl }] : [],
      verification: { status: 'verified', method: 'portal', checkedAt: new Date() },
    })),
  );
  console.log(`Seeded ${samples.length} sample portal jobs`);
} else {
  console.log('Portal jobs already exist, skipping seed');
}
await mongoose.disconnect();
