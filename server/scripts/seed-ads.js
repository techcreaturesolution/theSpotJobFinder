import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';
import { Ad } from '../src/models/Ad.js';

const samples = [
  {
    advertiser: 'Tech Creature Solution',
    title: 'Custom MERN & Flutter development',
    description: 'Web apps, mobile apps and AI agents built for your business.',
    imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=60',
    targetUrl: 'https://example.org/tech-creature',
    ctaText: 'Get a quote',
    placement: 'dashboard_banner',
    priority: 5,
  },
  {
    advertiser: 'CloudHost India',
    title: 'Hosting from ₹99/month',
    description: 'Fast SSD hosting with free SSL and daily backups.',
    targetUrl: 'https://example.org/cloudhost',
    ctaText: 'Start now',
    placement: 'sidebar',
    priority: 2,
  },
  {
    advertiser: 'ResumePro',
    title: 'Get your resume reviewed in 24 hours',
    description: 'ATS-friendly resumes written by recruiters for Indian job seekers.',
    targetUrl: 'https://example.org/resumepro',
    ctaText: 'Try free',
    placement: 'inline',
    priority: 1,
  },
];

await connectDb();
if ((await Ad.countDocuments()) === 0) {
  await Ad.insertMany(samples);
  console.log(`Seeded ${samples.length} ads`);
} else {
  console.log('Ads already exist, skipping seed');
}
await mongoose.disconnect();
