export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const lc = (s) => String(s || '').toLowerCase().trim();

export function splitLocation(location) {
  const parts = String(location || '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^india$/i.test(p));
  const state = INDIAN_STATES.find((s) => parts.some((p) => lc(p) === lc(s))) || INDIAN_STATES.find((s) => lc(location).includes(lc(s))) || '';
  const city = parts.find((p) => lc(p) !== lc(state) && !/\d{6}/.test(p) && !/remote|anywhere/i.test(p)) || '';
  return { city, state };
}
