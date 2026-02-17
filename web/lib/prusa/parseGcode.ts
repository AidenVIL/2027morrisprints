import fs from 'fs';

function parseTimeString(s: string): number | null {
  // examples: "1h 2m 3s", "2m 30s", "3600s", "1:02:03"
  s = s.trim();
  // ISO like 1:02:03
  if (/^\d+:\d{2}:\d{2}$/.test(s)) {
    const parts = s.split(':').map(Number);
    return parts[0]*3600 + parts[1]*60 + parts[2];
  }
  let hours = 0, minutes = 0, seconds = 0;
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  const sec = s.match(/(\d+)\s*s/);
  if (h) hours = Number(h[1]);
  if (m) minutes = Number(m[1]);
  if (sec) seconds = Number(sec[1]);
  if (hours || minutes || seconds) return hours*3600 + minutes*60 + seconds;
  // fallback: plain seconds
  const onlyNum = s.match(/^(\d+)$/);
  if (onlyNum) return Number(onlyNum[1]);
  return null;
}

export function parseGcode(gcodePath: string, density = 1.24): { timeSeconds: number|null, grams: number|null, filamentMm?: number|null } {
  const content = fs.readFileSync(gcodePath, 'utf8');
  const lines = content.split(/\r?\n/);

  let timeSeconds: number | null = null;
  let grams: number | null = null;
  let filamentMm: number | null = null;

  for (const raw of lines.slice(0, 200)) {
    const line = raw.trim();
    // PrusaSlicer style: ; estimated printing time (s): 12345
    let m = line.match(/estimated printing time \(s\):\s*(\d+)/i);
    if (m) { timeSeconds = Number(m[1]); continue; }

    m = line.match(/estimated printing time:\s*(.+)$/i);
    if (m && !timeSeconds) {
      const parsed = parseTimeString(m[1]);
      if (parsed !== null) timeSeconds = parsed;
      continue;
    }

    // filament used [mm]: 12345
    m = line.match(/filament used \[mm\]:\s*(\d+(?:\.\d+)?)/i);
    if (m) { filamentMm = Number(m[1]); continue; }

    // filament used \(m\): 12.34
    m = line.match(/filament used \(m\):\s*(\d+(?:\.\d+)?)/i);
    if (m) { filamentMm = Math.round(Number(m[1]) * 1000); continue; }

    // filament used \(mm\): 12345 (alternative)
    m = line.match(/filament used \(mm\):\s*(\d+(?:\.\d+)?)/i);
    if (m) { filamentMm = Number(m[1]); continue; }

    // filament used: 12.34m or 12345mm or 12.34g
    m = line.match(/filament used:\s*(\d+(?:\.\d+)?)(m|mm|g)/i);
    if (m) {
      const val = Number(m[1]);
      const unit = m[2].toLowerCase();
      if (unit === 'g') { grams = val; }
      else if (unit === 'm') { filamentMm = Math.round(val * 1000); }
      else if (unit === 'mm') { filamentMm = val; }
      continue;
    }
  }

  // If we have filament length, convert to grams (1.75mm default)
  if ((grams === null || isNaN(grams)) && filamentMm !== null) {
    const filamentDiaMm = 1.75;
    const radiusCm = (filamentDiaMm / 10) / 2; // mm->cm
    const lengthCm = filamentMm / 10; // mm->cm
    const volumeCm3 = Math.PI * radiusCm * radiusCm * lengthCm;
    grams = volumeCm3 * density;
  }

  return { timeSeconds, grams: grams ?? null, filamentMm: filamentMm ?? null };
}
