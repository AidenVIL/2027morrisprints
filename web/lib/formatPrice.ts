export function parsePriceToPence(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const s = String(v).trim().toLowerCase();

  const numeric = s.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  const num = numeric ? Number(numeric[0]) : NaN;
  if (Number.isNaN(num)) return 0;

  if (s.includes('pound') || s.includes('£') || s.includes('gbp')) {
    return Math.round(num * 100);
  }

  if (/\bp(?:ence)?\b/.test(s) || /p$/.test(s)) {
    return Math.round(num);
  }

  if (s.includes('c') || s.includes('cent')) {
    return Math.round(num);
  }

  if (num <= 10000) return Math.round(num * 100);
  return Math.round(num);
}

export function formatPoundsFromPence(pence: number) {
  return `£${((Number(pence) || 0) / 100).toFixed(2)}`;
}

export default parsePriceToPence;
