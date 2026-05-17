/**
 * Thin ffmpeg/ffprobe wrapper. The binaries are provisioned on PATH
 * by nixpacks (nixPkgs ffmpeg); we spawn them directly rather than
 * via fluent-ffmpeg to avoid CJS/ESM interop and keep full control
 * of the scene-detection filter.
 */
import { spawn } from 'node:child_process';

const KILL_MS = 10 * 60 * 1000; // a single video op should never exceed this

function run(
  bin: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      reject(new Error(`${bin} timed out after ${KILL_MS}ms`));
    }, KILL_MS);
    p.stdout.on('data', (d) => (stdout += d.toString()));
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin} exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

export type ProbeResult = {
  durationMs: number;
  width: number | null;
  height: number | null;
};

export async function ffprobeMeta(path: string): Promise<ProbeResult> {
  const { stdout } = await run('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    path,
  ]);
  const j = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; width?: number; height?: number }[];
  };
  const v = (j.streams ?? []).find((s) => s.codec_type === 'video');
  const durSec = parseFloat(j.format?.duration ?? '0');
  return {
    durationMs: Number.isFinite(durSec) ? Math.round(durSec * 1000) : 0,
    width: v?.width ?? null,
    height: v?.height ?? null,
  };
}

/** Scaled H.264 mp4 proxy — small, faststart, preview/scrub quality. */
export async function transcodeProxy(src: string, out: string): Promise<void> {
  await run('ffmpeg', [
    '-hide_banner', '-y',
    '-i', src,
    '-vf', "scale='min(1280,iw)':-2",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart',
    out,
  ]);
}

/** One webp still at `atSec` (fast pre-input seek; thumbnail accuracy). */
export async function extractFrame(
  src: string,
  out: string,
  atSec: number,
): Promise<void> {
  await run('ffmpeg', [
    '-hide_banner', '-y',
    '-ss', atSec.toFixed(3),
    '-i', src,
    '-frames:v', '1',
    '-vf', "scale='min(1280,iw)':-2",
    '-c:v', 'libwebp', '-quality', '80',
    out,
  ]);
}

/**
 * Seconds at which the picture changes significantly. ffmpeg's
 * scene filter scores each frame; metadata=print emits the pts_time
 * of frames that pass the threshold. Empty result = no hard cuts
 * (single-shot footage) — caller falls back to interval sampling.
 */
export async function detectSceneTimestamps(
  src: string,
  threshold = 0.3,
): Promise<number[]> {
  const { stdout, stderr } = await run('ffmpeg', [
    '-hide_banner',
    '-i', src,
    '-vf', `select='gt(scene,${threshold})',metadata=print:file=-`,
    '-an', '-f', 'null', '-',
  ]);
  const times: number[] = [];
  for (const line of (stdout + '\n' + stderr).split('\n')) {
    const m = line.match(/pts_time:([0-9.]+)/);
    if (m) {
      const t = parseFloat(m[1]);
      if (Number.isFinite(t)) times.push(t);
    }
  }
  return times;
}
