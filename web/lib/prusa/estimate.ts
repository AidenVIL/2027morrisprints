import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { parseGcode } from './parseGcode';

export type PrusaEstimate = { timeSeconds: number | null; grams: number | null; filamentMm?: number | null };

export async function estimate(filePath: string, opts?: { density?: number; timeoutMs?: number }): Promise<PrusaEstimate> {
  const density = opts?.density ?? 1.24;
  const timeoutMs = opts?.timeoutMs ?? 120000;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prusa-'));
  const outGcode = path.join(tmpDir, 'out.gcode');

  const bin = process.env.PRUSASLICER_BIN || '/usr/local/bin/prusa-slicer';

  return new Promise<PrusaEstimate>(async (resolve, reject) => {
    const args = ['--no-gui', '--export-gcode', '-o', outGcode, filePath];
    let finished = false;
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
        const parsed = parseGcode(outGcode, density);
        resolve(parsed as PrusaEstimate);
      } catch (e) {
        reject(e);
      } finally {
        // cleanup
        try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
      }
    });
  });
}
