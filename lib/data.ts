// Business data + rules ported from the design handoff. All prices are PLACEHOLDERS until Matt supplies his list.
export type Vals = Record<string, any>;

export const CATALOG = [
  { sku: 'Z-1', name: 'Z-1 HE softener, 10 x 54', cost: 1150, msrp: 1995 },
  { sku: 'Z-2', name: 'Z-2 HE high-capacity softener, 13 x 54', cost: 1420, msrp: 2450 },
  { sku: 'Z-3', name: 'Z-3 softening + filtration combo, 13 x 54', cost: 1890, msrp: 3250 },
  { sku: 'SYM-2', name: 'Symphony 2 filter, 15 gpm, 5 micron', cost: 1240, msrp: 2150 },
  { sku: 'SYM-2A', name: 'Symphony 2A filter, 15 gpm, 0.2 micron', cost: 1480, msrp: 2550 },
  { sku: 'ZFPRO', name: 'ZFPRO FreshPoint under-sink RO', cost: 365, msrp: 695 },
  { sku: 'IRON', name: 'Iron filter (air or chemical)', cost: 1240, msrp: 2095 },
  { sku: 'NEUT', name: 'Acid neutralizer / pH adjuster', cost: 610, msrp: 1050 },
  { sku: 'SED', name: 'Sediment prefilter', cost: 145, msrp: 275 },
  { sku: 'BYP-1', name: 'Bypass valve kit, 1"', cost: 48, msrp: 95 },
  { sku: 'EXP-2', name: 'Expansion tank, 2 gal', cost: 62, msrp: 125 },
  { sku: 'KIT-INST', name: 'Install kit (fittings, drain line)', cost: 85, msrp: 165 },
  { sku: 'LABOR', name: 'Installation labor', cost: 300, msrp: 650 },
  { sku: 'FIT-1', name: '1" fitting kit', cost: 38, msrp: 75 },
  { sku: 'FIT-34', name: '3/4" fitting kit', cost: 32, msrp: 65 },
  { sku: 'PEX-AD', name: 'PEX adapter set', cost: 24, msrp: 48 },
  { sku: 'CU-AD', name: 'Copper sweat adapter set', cost: 28, msrp: 55 },
  { sku: 'DRAIN-25', name: 'Drain line, 25 ft', cost: 14, msrp: 30 },
  { sku: 'BRINE', name: 'Brine line + overflow kit', cost: 18, msrp: 38 },
  { sku: 'PUMP-D', name: 'Drain pump', cost: 120, msrp: 215 },
  { sku: 'OUT-EXT', name: 'Outlet extension kit', cost: 22, msrp: 45 },
];
export const CAT: Record<string, (typeof CATALOG)[number]> = Object.fromEntries(CATALOG.map((c) => [c.sku, c]));
export const MAINS = ['Z-1', 'Z-2', 'Z-3', 'SYM-2', 'SYM-2A', 'ZFPRO', 'IRON', 'NEUT', 'SED'];
export const KITS: Record<string, [string, number][]> = {
  'Z-1': [['BYP-1', 1], ['BRINE', 1], ['DRAIN-25', 1]],
  'Z-2': [['BYP-1', 1], ['BRINE', 1], ['DRAIN-25', 1]],
  'Z-3': [['BYP-1', 1], ['BRINE', 1], ['DRAIN-25', 1]],
  'SYM-2': [['BYP-1', 1]], 'SYM-2A': [['BYP-1', 1]], ZFPRO: [],
  IRON: [['BYP-1', 1], ['DRAIN-25', 1]], NEUT: [['BYP-1', 1], ['DRAIN-25', 1]], SED: [],
};
export const RULE_LABELS: Record<string, string> = {
  's6.main': 'Main line size', 's6.pipe': 'Pipe material', 's6.drain': 'Drain available',
  's6.outlet': 'Outlet nearby', 's6.exp': 'Expansion tank',
};
export const RULES = [
  { q: 's6.main', a: '1"', p: 'FIT-1', n: 1 }, { q: 's6.main', a: '3/4"', p: 'FIT-34', n: 1 },
  { q: 's6.pipe', a: 'PEX', p: 'PEX-AD', n: 1 }, { q: 's6.pipe', a: 'Copper', p: 'CU-AD', n: 1 },
  { q: 's6.drain', a: 'No', p: 'PUMP-D', n: 1 }, { q: 's6.outlet', a: 'No', p: 'OUT-EXT', n: 1 },
  { q: 's6.exp', a: 'No', p: 'EXP-2', n: 1 },
];
const nz = (s: any) => String(s ?? '').replace(/[\s”″]/g, '').replace(/''/g, '"').toLowerCase();
const ruleHit = (v: Vals, r: (typeof RULES)[number]) => {
  const x = v[r.q];
  return Array.isArray(x) ? x.includes(r.a) : nz(x) === nz(r.a);
};

export const JOBS = [
  { id: 'J-24117', time: '8:30 AM', name: 'Karen Whitfield', address: '1412 E Sprague Ave', city: 'Spokane Valley', state: 'WA', zip: '99216', phone: '(509) 555-0142', reason: 'Hard water, spots on dishes' },
  { id: 'J-24118', time: '11:00 AM', name: 'Tom & Lisa Brandt', address: '22 N Harvard Rd', city: 'Liberty Lake', state: 'WA', zip: '99019', phone: '(509) 555-0188', reason: 'Private well, iron staining' },
  { id: 'J-24119', time: '2:30 PM', name: 'Ray Okafor', address: '908 S Pines Rd', city: 'Spokane Valley', state: 'WA', zip: '99206', phone: '(509) 555-0107', reason: 'Existing softener not working' },
];

export const LEAD_OPTS = ['Friend or neighbor', 'Past customer', 'Online search', 'Radio', 'TV / streaming', 'Social media', 'Saw us around town', 'Mail / print', 'Plumber or builder', 'Review site'];
export const REACH_OPTS = ['Phone call', 'Web form', 'Booked online', 'Text message', 'In person', 'Other'];

// ---- Worksheet definition -------------------------------------------------
export type Field = {
  id: string; label: string; t: 'text' | 'area' | 'single' | 'multi' | 'yn' | 'head' | 'lead' | 'photo' | 'recs' | 'sig' | 'date';
  opts?: string[]; unit?: string; half?: boolean; im?: string; show?: (v: Vals) => boolean;
};
export type Section = { id: string; n: string; title: string; fields: Field[] };
const yn = (id: string, label: string): Field => ({ id, label, t: 'yn', opts: ['Yes', 'No'] });
const well = (v: Vals) => /Well/.test(v['s2.source'] || '');

export const SECS: Section[] = [
  { id: 's1', n: '01', title: 'Customer Information', fields: [
    { id: 'name', label: 'Name', t: 'text' }, { id: 'address', label: 'Address', t: 'text' }, { id: 'city', label: 'City', t: 'text' },
    { id: 'state', label: 'State', t: 'text', half: true }, { id: 'zip', label: 'Zip', t: 'text', half: true, im: 'numeric' },
    { id: 'phone', label: 'Phone', t: 'text', im: 'tel' }, { id: 'email', label: 'Email', t: 'text', im: 'email' },
    { id: 'occ', label: 'Occupants in home', t: 'text', half: true, im: 'numeric' }, { id: 'baths', label: 'Bathrooms', t: 'text', half: true, im: 'decimal' },
    { id: 'built', label: 'Year home built', t: 'text', im: 'numeric' },
    { id: 'lead', label: 'Before you contacted us, where did you first hear about Soft Water Specialists?', t: 'lead' }] },
  { id: 'sB', n: '1A', title: 'Before Photo', fields: [{ id: 'bp', label: 'Install area, before work starts', t: 'photo' }] },
  { id: 's2', n: '02', title: 'Water Source', fields: [
    { id: 'source', label: 'Source', t: 'single', opts: ['City Water', 'Private Well', 'Shared Well'] },
    { id: 'provider', label: 'Water provider', t: 'text', show: (v) => v['s2.source'] === 'City Water' },
    { id: 'depth', label: 'Well depth (ft)', t: 'text', half: true, im: 'numeric', show: well },
    { id: 'hp', label: 'Well pump HP', t: 'text', half: true, im: 'decimal', show: well },
    { id: 'tank', label: 'Pressure tank size', t: 'text', show: well },
    { id: 'issues', label: 'Known water issues', t: 'area' }] },
  { id: 's3', n: '03', title: 'Why Are They Calling?', fields: [
    { id: 'concerns', label: 'What concerns them most? (check all)', t: 'multi', opts: ['Hard Water', 'Scale Buildup', 'Spots on Dishes', "Soap Doesn't Lather", 'Chlorine Taste', 'Chlorine Smell', 'Iron Staining', 'Sulfur Smell', 'Manganese', 'PFAS Concerns', 'Nitrates', 'Cloudy Water', 'Dry Skin', 'Appliance Protection', 'Better Tasting Water', 'Reverse Osmosis', 'Existing Equipment Not Working'] },
    { id: 'happiest', label: '“If we could fix one thing today, what would make you happiest?”', t: 'area' }] },
  { id: 's4', n: '04', title: 'Existing Equipment', fields: [
    { id: 'equip', label: 'Tap each item you see on site', t: 'multi', opts: ['Softener', 'Carbon Filter', 'Iron Filter', 'RO System', 'UV System', 'Acid Neutralizer', 'Sediment Filter', 'Booster Pump', 'Pressure Tank', 'Whole House Filter'] },
    { id: 'notes', label: 'Age / condition notes', t: 'area' }] },
  { id: 's5', n: '05', title: 'Water Test Results', fields: [
    { id: 'hard', label: 'Hardness (gpg)', t: 'text', half: true, im: 'decimal' }, { id: 'iron', label: 'Iron (ppm)', t: 'text', half: true, im: 'decimal' },
    { id: 'cl', label: 'Chlorine (ppm)', t: 'text', half: true, im: 'decimal' }, { id: 'tds', label: 'TDS (ppm)', t: 'text', half: true, im: 'decimal' },
    { id: 'ph', label: 'pH', t: 'text', half: true, im: 'decimal' }, { id: 'no3', label: 'Nitrates (ppm)', t: 'text', half: true, im: 'decimal' },
    { id: 'gpm', label: 'Flow rate, if known (gpm)', t: 'text', im: 'decimal' },
    yn('taste', 'Taste or odor issues?'), yn('ro', 'Interested in drinking water (RO)?'),
    { id: 'health', label: 'Health concerns or other issues', t: 'area' },
    { id: 'recs', label: 'System recommendation', t: 'recs' }] },
  { id: 's6', n: '06', title: 'Plumbing Inspection', fields: [
    { id: 'main', label: 'Main water line size', t: 'single', opts: ['3/4"', '1"', '1-1/4"'] },
    { id: 'pipe', label: 'Pipe material (check all)', t: 'multi', opts: ['Copper', 'PEX', 'Galvanized', 'CPVC', 'Poly'] },
    yn('drain', 'Drain available?'), yn('outlet', 'Electrical outlet nearby?'), yn('bypass', 'Bypass installed?'), yn('exp', 'Expansion tank?'),
    { id: 'static', label: 'Static pressure (psi)', t: 'text', half: true, im: 'numeric' }, { id: 'flow', label: 'Flowing pressure (psi)', t: 'text', half: true, im: 'numeric' },
    { id: 'whtype', label: 'Water heater type', t: 'single', opts: ['Tank', 'Tankless', 'Hybrid'] },
    { id: 'notes', label: 'Notes / observations', t: 'area' }] },
  { id: 's7', n: '07', title: 'Installation Space', fields: [
    { id: 'h', label: 'Height available', t: 'text', half: true }, { id: 'w', label: 'Width available', t: 'text', half: true },
    { id: 'd', label: 'Depth available', t: 'text', half: true }, { id: 'door', label: 'Door width', t: 'text', half: true },
    { id: 'access', label: 'Access issues / restrictions', t: 'area' }] },
  { id: 's8', n: '08', title: 'Usage Information', fields: [
    { id: 'people', label: 'People in home', t: 'text', half: true, im: 'numeric' }, { id: 'gpd', label: 'Avg gallons/day', t: 'text', half: true, im: 'numeric' },
    yn('irr', 'Outside irrigation?'), yn('pool', 'Pool or spa?'), yn('tub', 'Large soaking tub?'), { id: 'other', label: 'Other notes', t: 'area' }] },
  { id: 's9', n: '09', title: 'Customer Goals', fields: [
    { id: 'rank', label: 'Top goals (pick up to 3)', t: 'multi', opts: ['Best Water Quality', 'Lowest Maintenance', 'Lowest Salt Usage', 'Lowest Operating Cost', 'Lowest Upfront Cost', 'Protect Plumbing', 'Better Drinking Water', 'Appliance Protection', 'Improve Skin / Hair', 'Longest Warranty'] },
    { id: 'notes', label: 'Additional goals / notes', t: 'area' }] },
  { id: 's10', n: '10', title: 'Technician Observations', fields: [
    { id: 'obs', label: 'Observed', t: 'multi', opts: ['Leaks', 'Corrosion', 'Improper Plumbing', 'Low Pressure', 'High Pressure', 'No Bypass', 'No Expansion Tank', 'Water Hammer'] },
    { id: 'notes', label: 'Notes / details', t: 'area' }] },
  { id: 's14', n: '14', title: 'Approval & Signature', fields: [
    { id: 'sig', label: 'Customer signature', t: 'sig' }, { id: 'printed', label: 'Printed name', t: 'text', half: true }, { id: 'date', label: 'Date', t: 'date', half: true },
    { id: 'next', label: 'Next steps / action items', t: 'area' }] },
  { id: 's16', n: '16', title: 'After Photo', fields: [{ id: 'ap', label: 'Finished install, after photo', t: 'photo' }] },
];
export const QUICK = ['s1', 'sB', 's2', 's3', 's4', 's5', 's6', 's7'];

// ---- Rules ----------------------------------------------------------------
const num = (x: any): number | null => { const n = parseFloat(x); return isNaN(n) ? null : n; };

export function recommend(v: Vals) {
  const out: Record<string, string[]> = {}, flags: string[] = [];
  const add = (s: string, w: string) => { (out[s] = out[s] || []).push(w); };
  const H = num(v['s5.hard']), Fe = num(v['s5.iron']), Cl = num(v['s5.cl']), T = num(v['s5.tds']), pH = num(v['s5.ph']), N = num(v['s5.no3']), Q = num(v['s5.gpm']);
  const conc: string[] = v['s3.concerns'] || [];
  const taste = v['s5.taste'] === 'Yes' || conc.some((c) => ['Chlorine Taste', 'Chlorine Smell', 'Sulfur Smell'].includes(c));
  const ppl = num(v['s8.people']) ?? num(v['s1.occ']) ?? 0, baths = num(v['s1.baths']) ?? 0;
  const isWell = /Well/.test(v['s2.source'] || '');
  const ironZ3 = Fe != null && Fe > 0.3 && Fe <= 1;
  const useZ3 = (H != null && H > 3 && taste) || ironZ3;
  if (H != null && H > 3) {
    if (useZ3) add('Z-3', `Hardness ${H} gpg${taste ? ' + taste/odor' : ''}`);
    else add(ppl > 3 || baths > 2 ? 'Z-2' : 'Z-1', `Hardness ${H} gpg (Z-1/Z-2 sizing rule pending from Matt)`);
  }
  if (Cl != null && Cl > 0.5) { if (useZ3) add('Z-3', `Chlorine ${Cl} ppm`); else add('SYM-2', `Chlorine ${Cl} ppm (alt: Z-3)`); }
  if (Fe != null && Fe > 0.3) {
    if (ironZ3) add('Z-3', `Iron ${Fe} ppm (≤ 1.0)`);
    else { add('IRON', `Iron ${Fe} ppm`); flags.push('Iron above 1 ppm: specialist consultation' + (Fe > 2 ? ' and custom sizing' : '')); }
  }
  if (T != null && T > 500) add('ZFPRO', `TDS ${T} ppm, drinking water (alt: Symphony 2 + softener)`);
  if (pH != null && (pH < 7 || pH > 8.5)) add('NEUT', `pH ${pH}`);
  if (N != null && N > 10) { add('ZFPRO', `Nitrates ${N} ppm`); flags.push('Nitrates above 10 ppm: specialist consultation'); }
  if (v['s5.ro'] === 'Yes') add('ZFPRO', 'Customer wants RO');
  if (isWell) add('SED', 'Well source');
  if (Q != null && Q > 15) flags.push('Flow above 15 gpm: custom sizing and pricing');
  if ((v['s5.health'] || '').trim()) flags.push('Health concern noted: specialist consultation');
  return { out, flags };
}

export type Item = { key: string; sku: string; name: string; qty: number; main: boolean; why: string };
// Auto-built parts: main products + install kits + admin rules.
export function suggest(v: Vals): Item[] {
  const { out } = recommend(v);
  const res: Record<string, { qty: number; why: string[] }> = {};
  const add = (s: string, w: string, n: number) => { const r = (res[s] = res[s] || { qty: 0, why: [] }); r.why.push(w); r.qty += n; };
  const mains = Object.keys(out);
  mains.forEach((m) => add(m, out[m].join(', '), 1));
  if (mains.length) {
    mains.forEach((m) => (KITS[m] || []).forEach(([p, n]) => add(p, 'Kit: ' + m, n)));
    RULES.forEach((r) => { if (ruleHit(v, r)) add(r.p, `${RULE_LABELS[r.q]}: ${r.a}`, r.n); });
  }
  return Object.entries(res).map(([sku, r]) => ({
    key: sku, sku, name: CAT[sku].name, main: MAINS.includes(sku), qty: MAINS.includes(sku) ? 1 : r.qty, why: r.why.join(' · '),
  }));
}

export const money = (n: number) => '$' + Math.round(n).toLocaleString();
export const monthly = (total: number, apr = 7.99, months = 60) => {
  const r = apr / 1200;
  return (total * r) / (1 - Math.pow(1 + r, -months));
};

// Better / Best / Premium from the recommendation (placeholder tiering logic).
export function tiers(v: Vals) {
  const { out } = recommend(v);
  const mains = Object.keys(out).filter((s) => CAT[s]);
  const base = (mains.length ? mains : ['Z-1']).slice();
  const sum = (skus: string[]) => skus.reduce((t, s) => t + (CAT[s]?.msrp || 0), 0);
  const install = CAT['KIT-INST'].msrp + (CAT['LABOR']?.msrp || 0);
  const better = base.filter((s) => ['Z-1', 'Z-2', 'IRON', 'NEUT', 'SYM-2'].includes(s));
  const betterSet = better.length ? better.slice(0, 1) : base.slice(0, 1);
  const bestSet = base;
  const premiumSet = Array.from(new Set([...base, ...(base.includes('ZFPRO') ? [] : ['ZFPRO']), ...(base.includes('SED') ? [] : ['SED'])]));
  return [
    { name: 'Better', sub: "Fix today's problem", skus: betterSet, total: sum(betterSet) + install },
    { name: 'Best', sub: 'Complete long-term solution', skus: bestSet, total: sum(bestSet) + install },
    { name: 'Premium', sub: 'Maximum protection', skus: premiumSet, total: sum(premiumSet) + install },
  ];
}
