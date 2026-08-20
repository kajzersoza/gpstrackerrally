export const DEFAULT_RALLY_PRESETS: string[] = [
  'Start pont',
  'Cél pont',
  'Figyelmeztetés',
  'Jobb bekötőút',
  'Bal bekötőút',
  'Elágazás',
  'Lassító',
  'Rádiós pont',
  'Szalagkorlát',
  'Híd',
  'Útpadka elem',
  'Ház',
];

export const getPresetIcon = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('start')) return '🏁';
  if (lower.includes('cél') || lower.includes('cel') || lower.includes('stop')) return '🛑';
  if (lower.includes('figyelmeztet') || lower.includes('veszély') || lower.includes('danger') || lower.includes('caution')) return '⚠️';
  if (lower.includes('jobb') || lower.includes('right')) return '↗️';
  if (lower.includes('bal') || lower.includes('left')) return '↖️';
  if (lower.includes('elágazás') || lower.includes('keresztez') || lower.includes('junction')) return '🔀';
  if (lower.includes('lassító') || lower.includes('lassito') || lower.includes('chican')) return '⛔';
  if (lower.includes('rádió') || lower.includes('radio')) return '📻';
  if (lower.includes('szalagkorlát') || lower.includes('korlát') || lower.includes('guardrail')) return '🚧';
  if (lower.includes('híd') || lower.includes('hid') || lower.includes('bridge')) return '🌉';
  if (lower.includes('padka') || lower.includes('útpadka') || lower.includes('kerb')) return '🧱';
  if (lower.includes('ház') || lower.includes('haz') || lower.includes('house')) return '🏠';
  return '📍';
};
