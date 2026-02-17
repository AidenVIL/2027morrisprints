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

export interface ParseResult {
  timeSeconds: number | null;
  grams: number | null;
  filamentMm?: number | null;
  rawMatches?: Record<string, string>;
  gcodeHeaderSnippet?: string;
  usedProfileName?: string | null;
}

export function parseGcode(gcodePath: string, density = 1.24): ParseResult {
  const content = fs.readFileSync(gcodePath, 'utf8');
  const lines = content.split(/\r?\n/);

  let timeSeconds: number | null = null;
  let grams: number | null = null;
  let filamentMm: number | null = null;
  const rawMatches: Record<string, string> = {};

  // capture first ~200 lines as header snippet for debugging
  const headerSnippet = lines.slice(0, 200).join('\n');

  for (const raw of lines.slice(0, 200)) {
    const line = raw.trim();
    // PrusaSlicer style: ; estimated printing time (s): 12345
    let m = line.match(/estimated printing time \(s\):\s*(\d+)/i);
    if (m) { timeSeconds = Number(m[1]); rawMatches['time_s'] = m[1]; continue; }

    m = line.match(/estimated printing time:\s*(.+)$/i);
    if (m && !timeSeconds) {
      const parsed = parseTimeString(m[1]);
      if (parsed !== null) { timeSeconds = parsed; rawMatches['time_pretty'] = m[1]; }
      continue;
    }

    // filament used [mm]: 12345
    m = line.match(/filament used \[mm\]:\s*(\d+(?:\.\d+)?)/i);
    if (m) { filamentMm = Number(m[1]); rawMatches['filament_mm_brackets'] = m[1]; continue; }

    // filament used (m): 12.34
    m = line.match(/filament used \(m\):\s*(\d+(?:\.\d+)?)/i);
    if (m) { filamentMm = Math.round(Number(m[1]) * 1000); rawMatches['filament_m_paren'] = m[1]; continue; }

    // filament used (mm): 12345 (alternative)
    m = line.match(/filament used \(mm\):\s*(\d+(?:\.\d+)?)/i);
    if (m) { filamentMm = Number(m[1]); rawMatches['filament_mm_paren'] = m[1]; continue; }

    // filament used: 12.34m or 12345mm or 12.34g
    m = line.match(/filament used:\s*(\d+(?:\.\d+)?)(m|mm|g)\b/i);
    if (m) {
      const val = Number(m[1]);
      const unit = m[2].toLowerCase();
      rawMatches['filament_used_line'] = m[0];
      if (unit === 'g') { grams = val; }
      else if (unit === 'm') { filamentMm = Math.round(val * 1000); }
      else if (unit === 'mm') { filamentMm = val; }
      continue;
    }

    // Some slicers print grams explicitly: ; filament weight (g) = 12.34
    m = line.match(/filament weight .*\(g\).*=?\s*(\d+(?:\.\d+)?)/i);
    if (m) { grams = Number(m[1]); rawMatches['filament_weight_g'] = m[1]; continue; }

    // Another pattern: ; filament: 12.34 g
    m = line.match(/filament:\s*(\d+(?:\.\d+)?)\s*g\b/i);
    if (m) { grams = Number(m[1]); rawMatches['filament_colon_g'] = m[1]; continue; }

    // attempt to capture used profile name
    m = line.match(/;\s*profile:\s*(.+)$/i);
    if (m) { rawMatches['profile'] = m[1]; }

    m = line.match(/Using profile\s*:\s*(.+)$/i);
    if (m) { rawMatches['using_profile'] = m[1]; }
  }

  // If we have filament length, convert to grams (1.75mm default)
  if ((grams === null || isNaN(grams)) && filamentMm !== null) {
    const filamentDiaMm = 1.75;
    const radiusCm = (filamentDiaMm / 10) / 2; // mm->cm
    const lengthCm = filamentMm / 10; // mm->cm
    const volumeCm3 = Math.PI * radiusCm * radiusCm * lengthCm;
    grams = volumeCm3 * density;
    rawMatches['converted_from_mm'] = String(filamentMm);
  }

  return {
    timeSeconds,
    grams: grams ?? null,
    filamentMm: filamentMm ?? null,
    rawMatches: Object.keys(rawMatches).length ? rawMatches : undefined,
    gcodeHeaderSnippet: headerSnippet,
    usedProfileName: rawMatches['profile'] ?? rawMatches['using_profile'] ?? null,
  };
}
