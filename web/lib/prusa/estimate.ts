import { spawn, spawnSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { parseGcode, ParseResult } from './parseGcode';
import { readStlBounds, dimsToMm } from './readStlBounds';

export type PrusaEstimate = {
  timeSeconds: number;
  grams: number;
  filamentMm?: number | null;
  warnings?: string[];
  gcodeHeaderSnippet?: string | null;
  usedProfileName?: string | null;
  modelDimensionsMm?: { x: number; y: number; z: number } | null;
};

export async function estimate(filePath: string, opts?: { density?: number; timeoutMs?: number; overrides?: Record<string, any>; debug?: boolean }): Promise<PrusaEstimate & { cmd?: string[] }> {
  const density = opts?.density ?? 1.24;
  const timeoutMs = opts?.timeoutMs ?? 120000;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prusa-'));
  const outGcode = path.join(tmpDir, 'out.gcode');

  // Discover prusa-slicer binary: prefer env PRUSA_SLICER_PATH, then PATH, then /usr/local/bin
  let bin = process.env.PRUSA_SLICER_PATH || process.env.PRUSASLICER_BIN || '';
  const tried: string[] = [];
  if (bin) tried.push(bin);

  return new Promise<PrusaEstimate>(async (resolve, reject) => {
    const warnings: string[] = [];
    // pre-slice: if STL, try to read bounding box to detect unit/scale issues
    let modelDimensionsMm: { x: number; y: number; z: number } | null = null;
    try {
      if (filePath.toLowerCase().endsWith('.stl')) {
        const dims = readStlBounds(filePath);
        if (!dims) {
          warnings.push('Could not read model bounds from STL');
        } else {
          const mm = dimsToMm(dims);
          modelDimensionsMm = { x: mm.x, y: mm.y, z: mm.z };
          // sanity checks
          const max = Math.max(mm.x, mm.y, mm.z);
          const min = Math.min(mm.x, mm.y, mm.z);
          if (max > 10000) warnings.push('Model dimensions exceed 10,000 mm — check model units');
          if (min <= 0) warnings.push('Model has zero or negative extent — invalid STL');
          if (max < 1) warnings.push('Model dimensions very small (<1 mm) — check model units/scale');
        }
      }
    } catch (e) {
      warnings.push('Failed to read STL bounds');
    }

    // Discover binary if not already set
    try {
      if (!bin) {
        // Try running `prusa-slicer --version` to see if it's on PATH
        try {
          const ok = spawnSync('prusa-slicer', ['--version'], { stdio: 'ignore' });
          if (ok && ok.status === 0) {
            bin = 'prusa-slicer';
            tried.push('prusa-slicer (PATH)');
          }
        } catch (e) {
          // ignore
        }
      }

      // If still not set, check default location
      if (!bin) {
        const defaultPath = '/usr/local/bin/prusa-slicer';
        tried.push(defaultPath);
        const st = await fs.stat(defaultPath).then(() => true).catch(() => false);
        if (st) bin = defaultPath;
      }

      // If we still don't have a binary, return structured error listing attempted paths
      if (!bin) {
        return reject(new Error('PRUSASLICER_NOT_FOUND: ' + JSON.stringify({ tried })));
      }
    } catch (err) {
      return reject(new Error('PRUSASLICER_NOT_FOUND: ' + JSON.stringify({ tried })));
    }

    // build prusa-slicer args and include overrides via --set
    const baseArgs = ['--no-gui', '--export-gcode', '-o', outGcode, filePath];
    const cmdArgs: string[] = [...baseArgs];
    if (opts?.overrides) {
      for (const [k, v] of Object.entries(opts.overrides)) {
        let val: any = v;
        if (typeof v === 'boolean') val = v ? '1' : '0';
        cmdArgs.push('--set', `${k}=${val}`);
      }
    }
    const args = cmdArgs;
    let finished = false;
    console.log('prusa-slicer command:', bin, args.join(' '));
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    const killTimer = setTimeout(() => {
      if (!finished) {
        child.kill('SIGKILL');
        finished = true;
        reject(new Error('PrusaSlicer timeout'));
      }
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(killTimer);
      if (!finished) { finished = true; reject(err); }
    });

    child.on('exit', async (code) => {
      clearTimeout(killTimer);
      if (finished) return;
      finished = true;
      try {
        // Ensure gcode exists
        const exists = await fs.stat(outGcode).then(() => true).catch(() => false);
        if (!exists) return reject(new Error('G-code not produced'));
        const parsed = parseGcode(outGcode, density) as ParseResult;

        // attach header snippet and profile name
        const gcodeHeaderSnippet = parsed.gcodeHeaderSnippet ?? null;
        const usedProfileName = parsed.usedProfileName ?? null;

        // post-slice sanity checks
        if (parsed.grams !== null && parsed.grams > 20000) warnings.push('Estimated filament grams unusually large (>20kg)');
        if (parsed.timeSeconds !== null && parsed.timeSeconds > 60 * 60 * 24) warnings.push('Estimated print time exceeds 24 hours');

        const maybeGrams = parsed.grams;
        const maybeTime = parsed.timeSeconds;

        const grams = Number(maybeGrams ?? NaN);
        const timeSeconds = Number(maybeTime ?? NaN);

        const debugInfo = { rawMatches: parsed.rawMatches, gcodeHeaderSnippet, usedProfileName };

        if (!Number.isFinite(grams) || grams <= 0) {
          const details = { reason: 'MISSING_OR_INVALID_GRAMS', debug: debugInfo };
          throw new Error('ESTIMATE_PARSE_ERROR: ' + JSON.stringify(details));
        }
        if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) {
          const details = { reason: 'MISSING_OR_INVALID_TIME', debug: debugInfo };
          throw new Error('ESTIMATE_PARSE_ERROR: ' + JSON.stringify(details));
        }

        resolve({
          timeSeconds: timeSeconds,
          grams: grams,
          filamentMm: parsed.filamentMm,
          warnings: warnings.length ? warnings : undefined,
          gcodeHeaderSnippet,
          usedProfileName,
          modelDimensionsMm,
          cmd: opts?.debug ? [bin, ...args] : undefined,
        } as PrusaEstimate & { cmd?: string[] });
      } catch (e) {
        reject(e);
      } finally {
        // cleanup
        try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
      }
    });
  });
}
