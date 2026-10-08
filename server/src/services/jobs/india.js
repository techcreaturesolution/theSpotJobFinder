export const CITIES_BY_STATE = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati', 'Kakinada', 'Kurnool'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat'],
  Assam: ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Tezpur'],
  Bihar: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia'],
  Chhattisgarh: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg'],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Bhavnagar', 'Jamnagar', 'Anand', 'Mehsana', 'Vapi', 'Bharuch', 'Junagadh'],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Hisar', 'Rohtak', 'Sonipat'],
  'Himachal Pradesh': ['Shimla', 'Solan', 'Dharamshala', 'Mandi', 'Baddi'],
  Jharkhand: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Kalaburagi', 'Davanagere'],
  Kerala: ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Navi Mumbai', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur', 'Amravati'],
  Manipur: ['Imphal'],
  Meghalaya: ['Shillong'],
  Mizoram: ['Aizawl'],
  Nagaland: ['Kohima', 'Dimapur'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur', 'Berhampur'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Mohali', 'Patiala', 'Bathinda'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Alwar', 'Bhilwara'],
  Sikkim: ['Gangtok'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tiruppur', 'Vellore', 'Hosur'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
  Tripura: ['Agartala'],
  'Uttar Pradesh': ['Lucknow', 'Noida', 'Greater Noida', 'Ghaziabad', 'Kanpur', 'Agra', 'Varanasi', 'Prayagraj', 'Meerut', 'Bareilly', 'Gorakhpur', 'Aligarh'],
  Uttarakhand: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Kharagpur'],
  'Andaman and Nicobar Islands': ['Port Blair'],
  Chandigarh: ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Silvassa', 'Daman', 'Diu'],
  Delhi: ['New Delhi', 'Delhi'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu'],
  Ladakh: ['Leh', 'Kargil'],
  Lakshadweep: ['Kavaratti'],
  Puducherry: ['Puducherry', 'Karaikal'],
};

export const ALL_CITIES = [...new Set(Object.values(CITIES_BY_STATE).flat())].sort();

export const stateOfCity = (city) => {
  const c = String(city || '').trim().toLowerCase();
  if (!c) return '';
  return Object.keys(CITIES_BY_STATE).find((s) => CITIES_BY_STATE[s].some((x) => x.toLowerCase() === c)) || '';
};

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
  let state = INDIAN_STATES.find((s) => parts.some((p) => lc(p) === lc(s))) || INDIAN_STATES.find((s) => lc(location).includes(lc(s))) || '';
  let city = parts.find((p) => lc(p) !== lc(state) && !/\d{6}/.test(p) && !/remote|anywhere/i.test(p)) || '';
  if (!city && location) {
    const foundCity = ALL_CITIES.find((c) => lc(location).includes(lc(c)));
    if (foundCity) city = foundCity;
  }
  if (!state && city) {
    state = stateOfCity(city);
  }
  return { city, state };
}

export function matchesLocation(job, plan) {
  if (!plan?.city && !plan?.state) return true;
  if (job.workFromHome) return true;

  const fullLoc = `${job.city || ''} ${job.state || ''} ${job.location || ''} ${job.address || ''}`.toLowerCase();
  if (/\b(?:remote|work from home|wfh|anywhere in india)\b/i.test(fullLoc)) return true;

  if (plan.city) {
    const targetCity = plan.city.toLowerCase().trim();
    if (fullLoc.includes(targetCity)) return true;
    if (job.city && job.city.toLowerCase().trim() === targetCity) return true;
    return false;
  }

  if (plan.state) {
    const targetState = plan.state.toLowerCase().trim();
    if (fullLoc.includes(targetState)) return true;
    if (job.state && job.state.toLowerCase().trim() === targetState) return true;
    const cityState = stateOfCity(job.city);
    if (cityState && cityState.toLowerCase() === targetState) return true;
    return false;
  }

  return true;
}
