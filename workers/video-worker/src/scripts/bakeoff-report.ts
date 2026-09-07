/**
 * Render a bakeoff run as a self-contained HTML comparison.
 *
 * Images are inlined as data URIs rather than signed Supabase URLs:
 * the point of this page is to be looked at over days and shared with
 * people who do not have credentials, and a signed URL expires in an
 * hour. The 768px renders are ~36 KB each, so a 59 image run lands
 * around 2 MB.
 *
 *   npx tsx src/scripts/bakeoff-report.ts --run ID --out page.html
 */
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from '../db.js';

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = class {
    constructor() {
      throw new Error('realtime is not used by this script');
    }
  };
}

const TAG_PX = Number(process.env.TAG_PX ?? 768);

function arg(n: string): string | undefined {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type Row = {
  asset_id: string;
  model_key: string;
  summary: string | null;
  aesthetic_score: number | null;
  tags: { category: string; tag: string; confidence: number; in_vocabulary: boolean }[] | null;
  detections: { label: string; kind: string; role: string; bbox: number[] }[] | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cached_tokens: number | null;
  micro_cents: number | null;
  latency_ms: number | null;
  error: string | null;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function main() {
  const runId = arg('run');
  if (!runId) throw new Error('--run <run_id> required');
  const out = arg('out') ?? 'bakeoff.html';
  const cacheDir = process.env.BAKEOFF_CACHE ?? '.bakeoff-cache';

  const sb = db();
  const { data, error } = await sb
    .from('video_model_bakeoff')
    .select('asset_id, model_key, summary, aesthetic_score, tags, detections, input_tokens, output_tokens, cached_tokens, micro_cents, latency_ms, error')
    .eq('run_id', runId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) throw new Error('no rows for that run');

  const assetIds = [...new Set(rows.map((r) => r.asset_id))];
  const { data: assets } = await sb
    .from('video_assets')
    .select('id, file_name, drive_path')
    .in('id', assetIds);
  const meta = new Map(
    ((assets ?? []) as { id: string; file_name: string; drive_path: string | null }[])
      .map((a) => [a.id, a]),
  );

  const models = [...new Set(rows.map((r) => r.model_key))].sort();
  const byAsset = new Map<string, Map<string, Row>>();
  for (const r of rows) {
    if (!byAsset.has(r.asset_id)) byAsset.set(r.asset_id, new Map());
    byAsset.get(r.asset_id)!.set(r.model_key, r);
  }

  // Per-model rollup.
  const stats = models.map((m) => {
    const rs = rows.filter((r) => r.model_key === m);
    const ok = rs.filter((r) => !r.error);
    const micro = ok.reduce((a, r) => a + (r.micro_cents ?? 0), 0);
    const usdEach = ok.length ? micro / 10_000 / 100 / ok.length : 0;
    return {
      model: m,
      n: rs.length,
      ok: ok.length,
      failed: rs.length - ok.length,
      per20k: usdEach * 20_000,
      avgMs: ok.length ? Math.round(ok.reduce((a, r) => a + (r.latency_ms ?? 0), 0) / ok.length) : 0,
      avgTags: ok.length ? (ok.reduce((a, r) => a + (r.tags?.length ?? 0), 0) / ok.length) : 0,
      avgDets: ok.length ? (ok.reduce((a, r) => a + (r.detections?.length ?? 0), 0) / ok.length) : 0,
      avgScore: ok.length ? (ok.reduce((a, r) => a + (r.aesthetic_score ?? 0), 0) / ok.length) : 0,
      cached: ok.some((r) => (r.cached_tokens ?? 0) > 0),
      avgIn: ok.length ? Math.round(ok.reduce((a, r) => a + (r.input_tokens ?? 0), 0) / ok.length) : 0,
      avgOut: ok.length ? Math.round(ok.reduce((a, r) => a + (r.output_tokens ?? 0), 0) / ok.length) : 0,
    };
  });

  const images = new Map<string, string>();
  for (const id of assetIds) {
    try {
      const b = await readFile(join(cacheDir, `${id}-${TAG_PX}.webp`));
      images.set(id, `data:image/webp;base64,${b.toString('base64')}`);
    } catch {
      /* missing render - card shows a placeholder */
    }
  }

  const cheapest = [...stats].filter((s) => s.ok > 0).sort((a, b) => a.per20k - b.per20k)[0];

  const cards = assetIds
    .filter((id) => byAsset.has(id))
    .map((id, i) => {
      const m = meta.get(id);
      const img = images.get(id) ?? '';
      const cols = models
        .map((mk) => {
          const r = byAsset.get(id)!.get(mk);
          if (!r) return `<div class="cell empty"><div class="mk">${esc(mk)}</div><p class="none">not run</p></div>`;
          if (r.error) {
            return `<div class="cell err"><div class="mk">${esc(mk)}</div><p class="none">${esc(r.error.slice(0, 120))}</p></div>`;
          }
          const boxes = (r.detections ?? [])
            .filter((d) => Array.isArray(d.bbox) && d.bbox.length === 4)
            .map((d) => {
              const [x, y, w, h] = d.bbox;
              const cls = d.kind === 'face' ? 'face' : 'obj';
              return `<div class="bx ${cls}" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%;width:${(w * 100).toFixed(2)}%;height:${(h * 100).toFixed(2)}%"><span>${esc(d.label)}</span></div>`;
            })
            .join('');
          const tags = (r.tags ?? [])
            .map((t) => `<span class="tg${t.in_vocabulary ? '' : ' off'}">${esc(t.tag)}</span>`)
            .join('');
          return `<div class="cell">
  <div class="mk">${esc(mk)}<b>${r.aesthetic_score?.toFixed(1) ?? '-'}</b></div>
  <div class="shot">${img ? `<img loading="lazy" src="${img}" alt="">` : ''}${boxes}</div>
  <p class="sum">${esc(r.summary ?? '')}</p>
  <div class="tags">${tags}</div>
  <div class="foot">${r.detections?.length ?? 0} boxes / ${r.tags?.length ?? 0} tags / ${r.latency_ms ?? 0}ms</div>
</div>`;
        })
        .join('');
      return `<section class="row"${i > 11 ? ' data-extra="1"' : ''}>
  <h3>${esc(m?.file_name ?? id)}<span>${esc(m?.drive_path ?? '')}</span></h3>
  <div class="grid" style="grid-template-columns:repeat(${models.length},minmax(0,1fr))">${cols}</div>
</section>`;
    })
    .join('\n');

  const statRows = stats
    .map(
      (s) => `<tr${s.model === cheapest?.model ? ' class="best"' : ''}>
  <td><code>${esc(s.model)}</code></td>
  <td class="n">$${s.per20k.toFixed(0)}</td>
  <td class="n">${s.avgIn}/${s.avgOut}</td>
  <td class="n">${s.cached ? 'yes' : '<span class="warn">no</span>'}</td>
  <td class="n">${(s.avgMs / 1000).toFixed(1)}s</td>
  <td class="n">${s.avgTags.toFixed(1)}</td>
  <td class="n">${s.avgDets.toFixed(1)}</td>
  <td class="n">${s.avgScore.toFixed(1)}</td>
  <td class="n">${s.failed > 0 ? `<span class="warn">${s.failed}</span>` : '0'}</td>
</tr>`,
    )
    .join('');

  // replaceAll, not replace: {{N}} appears in both the header and
  // the show-all button, and replace() only takes the first.
  const html = TEMPLATE
    .replaceAll('{{STATS}}', statRows)
    .replaceAll('{{CARDS}}', cards)
    .replaceAll('{{RUN}}', esc(runId))
    .replaceAll('{{N}}', String(assetIds.length))
    .replaceAll('{{MODELS}}', String(models.length))
    .replaceAll('{{PX}}', String(TAG_PX));

  await writeFile(out, html);
  console.log(`wrote ${out} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
  for (const s of stats) {
    console.log(
      `  ${s.model.padEnd(24)} $${s.per20k.toFixed(0).padStart(4)}/20k  ${(s.avgMs / 1000).toFixed(1)}s  ` +
      `tags=${s.avgTags.toFixed(1)} boxes=${s.avgDets.toFixed(1)} score=${s.avgScore.toFixed(1)} failed=${s.failed}`,
    );
  }
}

const TEMPLATE = `<title>Which Model Tags Anamaya</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Newsreader:opsz,wght@6..72,300;6..72,400&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root{
  --paper:#FBF9F4;--surface:#FFF;--sunk:#F3EFE6;--ink:#211A17;--body:#3B302B;
  --muted:#6E625A;--faint:#8C7F76;--rule:#E3DCD1;--rule-soft:#EDE7DC;
  --terra:#A35B4E;--terra-deep:#7E4238;--terra-wash:#F6EAE6;
  --leaf:#6F8C31;--leaf-wash:#EEF2E0;--teal:#6E918C;
  --display:'Archivo',ui-sans-serif,system-ui,sans-serif;
  --text:'Newsreader',Georgia,serif;--mono:'JetBrains Mono',ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#16110E;--surface:#1E1815;--sunk:#241D19;--ink:#F4EDE5;--body:#DCD2C8;
  --muted:#A2948A;--faint:#87796F;--rule:#332A24;--rule-soft:#282018;
  --terra:#D08E7E;--terra-deep:#E5B0A2;--terra-wash:#2C1F1B;
  --leaf:#A6C25B;--leaf-wash:#20260F;--teal:#8FB3AD;
}}
:root[data-theme="dark"]{
  --paper:#16110E;--surface:#1E1815;--sunk:#241D19;--ink:#F4EDE5;--body:#DCD2C8;
  --muted:#A2948A;--faint:#87796F;--rule:#332A24;--rule-soft:#282018;
  --terra:#D08E7E;--terra-deep:#E5B0A2;--terra-wash:#2C1F1B;
  --leaf:#A6C25B;--leaf-wash:#20260F;--teal:#8FB3AD;
}
*{box-sizing:border-box}
body{background:var(--paper);color:var(--body);font-family:var(--text);font-size:17px;line-height:1.6;font-weight:300}
.wrap{max-width:1500px;margin:0 auto;padding:0 24px 80px}
header{padding:56px 0 0}
.kick{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--terra)}
h1{font-family:var(--display);font-weight:700;color:var(--ink);font-size:clamp(2.2rem,5vw,3.6rem);line-height:1;letter-spacing:-.03em;margin:.25em 0 .3em}
.lede{color:var(--muted);max-width:62ch;font-size:1.08rem}
.tscroll{overflow-x:auto;margin:34px 0 8px}
table{border-collapse:collapse;width:100%;min-width:720px;font-size:.92rem}
th{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);text-align:left;padding:0 14px 8px 0;border-bottom:1.5px solid var(--rule);white-space:nowrap}
td{padding:11px 14px 11px 0;border-bottom:1px solid var(--rule-soft)}
td.n{font-family:var(--mono);font-size:.85rem;font-variant-numeric:tabular-nums;white-space:nowrap}
tr.best td{background:var(--leaf-wash)}
tr.best td:first-child{box-shadow:inset 3px 0 0 var(--leaf)}
.warn{color:var(--terra-deep);font-weight:500}
code{font-family:var(--mono);font-size:.84em}
.legend{display:flex;gap:18px;flex-wrap:wrap;font-family:var(--mono);font-size:11px;color:var(--faint);margin:18px 0 0;padding-top:14px;border-top:1px solid var(--rule-soft)}
.legend b{font-weight:600}
.sw{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px;margin-right:5px}
.row{margin-top:44px;border-top:1px solid var(--rule);padding-top:20px}
.row h3{font-family:var(--display);font-weight:600;font-size:1.02rem;color:var(--ink);margin:0 0 14px;display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}
.row h3 span{font-family:var(--mono);font-size:10.5px;font-weight:400;color:var(--faint);letter-spacing:.03em}
.grid{display:grid;gap:14px}
@media(max-width:1100px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:620px){.grid{grid-template-columns:1fr!important}}
.cell{background:var(--surface);border:1px solid var(--rule-soft);border-radius:4px;padding:12px;display:flex;flex-direction:column;gap:9px}
.cell.err{background:var(--terra-wash)}
.mk{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.05em;color:var(--muted);display:flex;justify-content:space-between;gap:8px}
.mk b{color:var(--leaf);font-size:12px}
.shot{position:relative;line-height:0;border-radius:3px;overflow:hidden;background:var(--sunk);max-width:560px;width:100%}
.shot img{width:100%;height:auto;display:block}
.bx{position:absolute;border:2px solid var(--leaf);border-radius:2px;pointer-events:none}
.bx.face{border-color:var(--terra)}
.bx span{position:absolute;top:-15px;left:-2px;font-family:var(--mono);font-size:8.5px;line-height:1.4;padding:1px 3px;background:var(--leaf);color:#fff;white-space:nowrap;border-radius:2px}
.bx.face span{background:var(--terra)}
.sum{margin:0;font-size:.85rem;line-height:1.45;color:var(--body)}
.none{margin:0;font-size:.8rem;color:var(--faint);font-family:var(--mono)}
.tags{display:flex;flex-wrap:wrap;gap:3px}
.tg{font-family:var(--mono);font-size:9.5px;padding:2px 5px;border-radius:2px;background:var(--sunk);color:var(--muted)}
.tg.off{background:var(--terra-wash);color:var(--terra-deep)}
.foot{font-family:var(--mono);font-size:9.5px;color:var(--faint);margin-top:auto;padding-top:4px}
#more{font-family:var(--display);font-weight:600;font-size:.9rem;margin:34px auto 0;display:block;padding:11px 24px;border:1px solid var(--rule);background:var(--surface);color:var(--ink);border-radius:4px;cursor:pointer}
#more:hover{background:var(--sunk)}
[data-extra]{display:none}
body.all [data-extra]{display:block}
body.all #more{display:none}
:focus-visible{outline:2px solid var(--terra);outline-offset:3px}
</style>
<div class="wrap">
<header>
  <div class="kick">AnamayOS / Vision model bakeoff / {{N}} photos x {{MODELS}} models</div>
  <h1>Which model<br>tags Anamaya.</h1>
  <p class="lede">The same {{N}} photos, tagged at {{PX}}px by every candidate, with each model's own bounding boxes drawn on its own copy. Cost is extrapolated from measured tokens to a full 20,000 image library.</p>
</header>
<div class="tscroll"><table>
<thead><tr><th>Model</th><th>20k images</th><th>Tokens in/out</th><th>Prompt cached</th><th>Latency</th><th>Tags</th><th>Boxes</th><th>Avg score</th><th>Failed</th></tr></thead>
<tbody>{{STATS}}</tbody>
</table></div>
<div class="legend">
  <span><i class="sw" style="background:var(--terra)"></i><b>face</b> detection</span>
  <span><i class="sw" style="background:var(--leaf)"></i><b>object</b> detection</span>
  <span><i class="sw" style="background:var(--terra-wash);border:1px solid var(--terra)"></i>tag <b>outside</b> the controlled vocabulary</span>
  <span>run {{RUN}}</span>
</div>
{{CARDS}}
<button id="more" onclick="document.body.classList.add('all')">Show all {{N}} photos</button>
</div>
`;

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
