export const JOB_CATEGORIES = [
  { key: 'it_software', label: 'IT & Software', query: 'software developer', keywords: ['software', 'developer', 'programmer', 'engineer', 'java', 'python', 'react', 'node', 'php', 'full stack', 'frontend', 'backend', 'devops', 'cloud', 'data', 'qa', 'tester', 'android', 'ios', 'flutter', 'web', 'it '] },
  { key: 'sales_bd', label: 'Sales & Business Development', query: 'sales executive', keywords: ['sales', 'business development', 'bde', 'bdm', 'field sales', 'relationship manager', 'channel', 'key account'] },
  { key: 'marketing', label: 'Marketing & Digital Marketing', query: 'digital marketing executive', keywords: ['marketing', 'seo', 'social media', 'content', 'brand', 'digital', 'ads', 'performance marketing'] },
  { key: 'hr', label: 'HR & Recruitment', query: 'hr executive', keywords: ['hr ', 'human resource', 'recruiter', 'recruitment', 'talent acquisition', 'payroll'] },
  { key: 'finance', label: 'Accounts & Finance', query: 'accountant', keywords: ['account', 'finance', 'tally', 'gst', 'audit', 'ca ', 'chartered', 'tax', 'bookkeep'] },
  { key: 'banking', label: 'Banking & Insurance', query: 'bank jobs', keywords: ['bank', 'insurance', 'loan', 'credit', 'nbfc', 'relationship officer'] },
  { key: 'bpo', label: 'Customer Support / BPO / Telecaller', query: 'customer support executive', keywords: ['customer', 'support', 'call center', 'call centre', 'bpo', 'telecaller', 'tele caller', 'voice process', 'chat process', 'kpo'] },
  { key: 'back_office', label: 'Back Office & Data Entry', query: 'back office data entry', keywords: ['back office', 'data entry', 'office assistant', 'admin', 'receptionist', 'front office', 'computer operator'] },
  { key: 'healthcare', label: 'Healthcare & Pharma', query: 'pharma healthcare', keywords: ['nurse', 'doctor', 'pharma', 'medical', 'hospital', 'lab', 'pharmacist', 'clinical', 'healthcare', 'mr ', 'medical representative'] },
  { key: 'education', label: 'Teaching & Education', query: 'teacher', keywords: ['teacher', 'tutor', 'faculty', 'lecturer', 'professor', 'trainer', 'education', 'school', 'counsellor'] },
  { key: 'engineering', label: 'Engineering & Manufacturing', query: 'mechanical engineer', keywords: ['mechanical', 'electrical', 'civil', 'production', 'manufacturing', 'quality', 'maintenance', 'plant', 'cnc', 'machine operator'] },
  { key: 'construction', label: 'Construction & Real Estate', query: 'site engineer', keywords: ['construction', 'site engineer', 'real estate', 'property', 'architect', 'interior', 'supervisor'] },
  { key: 'technician', label: 'Technician / Electrician / ITI', query: 'technician iti', keywords: ['technician', 'electrician', 'plumber', 'fitter', 'welder', 'iti', 'ac technician', 'mechanic'] },
  { key: 'delivery', label: 'Delivery, Driver & Logistics', query: 'delivery boy', keywords: ['delivery', 'driver', 'rider', 'logistics', 'warehouse', 'courier', 'picker', 'packer', 'supply chain'] },
  { key: 'retail', label: 'Retail & Store', query: 'store sales associate', keywords: ['retail', 'store', 'cashier', 'shop', 'showroom', 'merchandiser'] },
  { key: 'hospitality', label: 'Hotel, Restaurant & Hospitality', query: 'hotel jobs', keywords: ['hotel', 'restaurant', 'chef', 'cook', 'waiter', 'steward', 'housekeeping', 'hospitality', 'barista'] },
  { key: 'design', label: 'Design & Creative', query: 'graphic designer', keywords: ['designer', 'graphic', 'ui', 'ux', 'video editor', 'animator', 'photographer', 'creative'] },
  { key: 'legal', label: 'Legal', query: 'legal associate', keywords: ['legal', 'lawyer', 'advocate', 'law', 'compliance', 'company secretary'] },
  { key: 'security', label: 'Security Guard & Facility', query: 'security guard', keywords: ['security guard', 'guard', 'bouncer', 'facility', 'housekeeping staff'] },
  { key: 'government', label: 'Government Jobs', query: 'government jobs recruitment', keywords: ['government', 'govt', 'sarkari', 'psc', 'ssc', 'railway', 'police', 'upsc', 'bank po'] },
  { key: 'part_time', label: 'Part-time & Work from Home', query: 'part time work from home', keywords: ['part time', 'part-time', 'work from home', 'wfh', 'remote', 'freelance'] },
  { key: 'internship', label: 'Internship', query: 'internship', keywords: ['intern', 'internship', 'trainee', 'apprentice'] },
];

export const CATEGORY_KEYS = JOB_CATEGORIES.map((c) => c.key);

export const categoryByKey = (key) => JOB_CATEGORIES.find((c) => c.key === key) || null;

export function detectCategory(text) {
  const t = ` ${String(text || '').toLowerCase()} `;
  let best = null;
  let bestScore = 0;
  for (const c of JOB_CATEGORIES) {
    const score = c.keywords.reduce((n, k) => n + (t.includes(k) ? k.length : 0), 0);
    if (score > bestScore) {
      best = c.key;
      bestScore = score;
    }
  }
  return best;
}
