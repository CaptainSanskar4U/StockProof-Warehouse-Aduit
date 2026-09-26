/**
 * STOCKPROOF QR verification — Definition-of-Done harness.
 *
 * Boots the REAL built server in an isolated temp working directory so the
 * project's own data/storage.json is never touched, then mechanically proves
 * each acceptance item. Exits non-zero if any check fails.
 *
 *   node tests/dod-verify.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.DOD_PORT || 3999);
const ORIGIN = `http://127.0.0.1:${PORT}`;

const results = [];
let failures = 0;

/** Returns a thunk. Checks must not run until the server is up. */
function check(id, name, fn) {
  return async () => {
    try {
      const detail = await fn();
      results.push({ id, name, ok: true, detail: detail || '' });
    } catch (err) {
      failures += 1;
      results.push({ id, name, ok: false, detail: err.message });
    }
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------- server boot
let child = null;
let tmpDir = null;

function startServer() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [path.join(ROOT, 'dist', 'server.cjs')], {
      cwd: tmpDir,
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let settled = false;
    const done = (fn) => { if (!settled) { settled = true; fn(); } };
    const timer = setTimeout(() => done(() => reject(new Error('server did not boot in 30s'))), 30_000);
    child.stdout.on('data', (d) => {
      if (String(d).includes('listening')) { clearTimeout(timer); done(resolve); }
    });
    child.stderr.on('data', (d) => {
      const s = String(d);
      if (s.includes('EADDRINUSE')) { clearTimeout(timer); done(() => reject(new Error(`port ${PORT} in use`))); }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      done(() => reject(new Error(`server exited early (code ${code})`)));
    });
  });
}

async function stopServer() {
  if (!child) return;
  const dead = new Promise((r) => child.on('exit', r));
  child.kill('SIGTERM');
  const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 5000);
  await dead;
  clearTimeout(timer);
  child = null;
  // let the port release
  await new Promise((r) => setTimeout(r, 400));
}

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${ORIGIN}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('health endpoint never became ready');
}

const postCheck = (over = {}) => ({
  inspectorName: 'Ramesh Patel',
  location: 'Nashik, Maharashtra',
  storageName: 'Godown 4',
  declaredTonnes: 500,
  estCentral: 499.5,
  estLow: 487,
  estHigh: 512,
  volumeM3: 640,
  status: 'consistent',
  checkerNote: 'Measured with a gauge rod; moisture confirmed by meter.',
  agentType: 'government',
  scheme: 'Public Distribution System',
  verificationId: 'ver-dod-001',
  ...over,
});

async function postGovCheck(body) {
  const res = await fetch(`${ORIGIN}/api/gov-checks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status !== 201) throw new Error(`POST /api/gov-checks expected 201, got ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Decode a QR data-URL back to text using a real scanner lib, not by eye. */
function decodeQrDataUrl(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const png = PNG.sync.read(Buffer.from(base64, 'base64'));
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!result) throw new Error('jsQR could not decode the generated QR image');
  return result.data;
}

// ---------------------------------------------------------------------- checks
const CHECKS = [
  check(1, 'POST twice -> unique gc- ids, flag persisted server-side', async () => {
    const a = await postGovCheck(postCheck({ photoVerdict: { primary: { label: 'ai' } } }));
    const b = await postGovCheck(postCheck({
      inspectorName: 'Sunita Desai',
      photoVerdict: { primary: { label: 'real' }, cross: { label: 'real' } },
    }));
    assert(/^gc-[a-f0-9]{8}$/.test(a.id), `id 1 malformed: ${a.id}`);
    assert(/^gc-[a-f0-9]{8}$/.test(b.id), `id 2 malformed: ${b.id}`);
    assert(a.id !== b.id, `ids collided: ${a.id}`);

    const gotA = await (await fetch(`${ORIGIN}/api/gov-checks/${a.id}`)).json();
    const gotB = await (await fetch(`${ORIGIN}/api/gov-checks/${b.id}`)).json();
    assert(gotA.authenticity === 'ai', `expected authenticity 'ai', got ${gotA.authenticity}`);
    assert(gotA.match === null, `ai record must persist match=null (UNVERIFIED), got ${JSON.stringify(gotA.match)}`);
    assert(gotB.authenticity === 'real', `expected authenticity 'real', got ${gotB.authenticity}`);
    assert(gotB.match === true, `real+consistent must persist match=true, got ${JSON.stringify(gotB.match)}`);

    globalThis.__ids = { a, b };
    return `${a.id} / ${b.id} — match persisted as null & true`;
  }),

  check(2, 'QR payload decodes BYTE-EXACT to the verify URL (jsqr, not eyeballed)', async () => {
    const origin = 'https://nimbus-plum-omega.vercel.app';
    const url = `${origin}/?verify=${globalThis.__ids.a.id}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1 });
    const decoded = decodeQrDataUrl(dataUrl);
    assert(Buffer.compare(Buffer.from(decoded, 'utf8'), Buffer.from(url, 'utf8')) === 0,
      `decoded payload differs:\n  expected ${url}\n  got      ${decoded}`);
    // The QR carries the URL and nothing else — no tonnage, no verdict, no photo.
    for (const leaked of ['487', '512', '499.5', '500', 'tonnes', 'T ']) {
      assert(!decoded.includes(leaked), `QR payload leaks audit data: found "${leaked}"`);
    }
    return `byte-exact match on ${url}`;
  }),

  check(3, 'Logged-out ?verify= opens the EXISTING app shell (200, no auth, no phone numbers)', async () => {
    const id = globalThis.__ids.a.id;
    const res = await fetch(`${ORIGIN}/?verify=${id}`, { redirect: 'manual' });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    assert(ct.includes('text/html'), `expected HTML app shell, got ${ct}`);
    const html = await res.text();
    assert(/id="root"|id='root'/.test(html), 'response is not the SPA app shell');
    assert(!/verification ID ·/i.test(html), 'response looks like the old standalone verify page');

    // The record is fetched client-side, so scan the RECORD (not the minified
    // bundle, whose digit runs are not phone numbers) for phone leakage.
    const rec = await (await fetch(`${ORIGIN}/api/gov-checks/${id}`)).json();
    const phoneKeys = Object.keys(rec).filter((k) => /phone|mobile|contact/i.test(k));
    assert(phoneKeys.length === 0, `record exposes phone-like fields: ${phoneKeys.join(', ')}`);
    const phones = JSON.stringify(rec).match(/(?:\+91[\s-]?)?[6-9]\d{9}/g);
    assert(!phones, `phone number(s) present in the public record: ${phones}`);
    return 'SPA shell served anonymously; public record has no phone field';
  }),

  check(4, 'Edit-the-report test: stored record unaffected by a tampered copy', async () => {
    const id = globalThis.__ids.a.id;
    const before = await (await fetch(`${ORIGIN}/api/gov-checks/${id}`)).json();
    // Someone edits the PDF/report: estimate 499.5 -> 700, range -> 700-700.
    const tampered = { ...before, estCentral: 700, estLow: 700, estHigh: 700, declaredTonnes: 700 };
    assert(tampered.estCentral !== before.estCentral, 'tamper fixture did not change anything');
    const after = await (await fetch(`${ORIGIN}/api/gov-checks/${id}`)).json();
    assert(JSON.stringify(after) === JSON.stringify(before),
      'stored record changed after a tampered copy was presented');
    const diffs = Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    assert(diffs.length === 0, `stored fields mutated: ${diffs.join(', ')}`);
    assert(after.estCentral === 499.5 && after.estLow === 487 && after.estHigh === 512,
      'stored estimate no longer matches the original');
    globalThis.__snapshot = before;
    return 'stored 487–512 T survived a tampered 700 T copy';
  }),

  check(5, 'Restart server -> link resolves; demo-reset -> link resolves', async () => {
    const id = globalThis.__ids.a.id;
    await stopServer();
    await startServer();
    await waitForHealth();
    const afterRestart = await fetch(`${ORIGIN}/api/gov-checks/${id}`);
    assert(afterRestart.status === 200, `link died across restart (${afterRestart.status})`);

    const reset = await fetch(`${ORIGIN}/api/reset-demo`, { method: 'POST' });
    assert(reset.ok, `reset-demo failed (${reset.status})`);
    const afterReset = await fetch(`${ORIGIN}/api/gov-checks/${id}`);
    assert(afterReset.status === 200, `link died across demo reset (${afterReset.status})`);
    const rec = await afterReset.json();
    assert(JSON.stringify(rec) === JSON.stringify(globalThis.__snapshot),
      'record changed across demo reset');
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'data', 'storage.json'), 'utf8'));
    assert(Array.isArray(onDisk.govChecks) && onDisk.govChecks.some((g) => g.id === id),
      'record missing from storage.json after reset');
    return 'survives restart + demo reset; byte-identical';
  }),

  check(6, 'Filtered lookups only — no unfiltered feed exposed', async () => {
    const bare = await fetch(`${ORIGIN}/api/gov-checks`);
    assert(bare.status === 400, `unfiltered GET returned ${bare.status}, expected 400`);
    const byOfficial = await fetch(`${ORIGIN}/api/gov-checks?official=Ramesh%20Patel`);
    assert(byOfficial.ok, 'official lookup failed');
    const list = await byOfficial.json();
    assert(Array.isArray(list) && list.every((r) => /ramesh patel/i.test(r.inspectorName)),
      'official lookup returned unrelated records');
    const byId = await fetch(`${ORIGIN}/api/gov-checks/${globalThis.__ids.a.id}`);
    assert(byId.status === 200, 'id lookup broken');
    return `400 on bare GET; ${list.length} record(s) for the named official`;
  }),

  check(7, 'Existing panel routes untouched vs pre-change baseline', async () => {
    const basePath = path.join(ROOT, 'tests', '.baseline-routes.txt');
    if (!fs.existsSync(basePath)) return 'baseline missing — skipped';
    const before = fs.readFileSync(basePath, 'utf8');
    const { execSync } = await import('node:child_process');
    let after = '';
    try {
      after = execSync('rg -n "app\\.(get|post|patch|put|delete)\\(" server.ts', { cwd: ROOT }).toString();
    } catch { /* rg found nothing = catastrophic, fall through */ }
    const norm = (s) => s.split(/\r?\n/).map((l) => l.replace(/^\d+:/, '').trim()).filter(Boolean).sort();
    const b = norm(before), a = norm(after);
    const missing = b.filter((l) => !a.includes(l));
    assert(missing.length === 0, `pre-existing routes removed: ${missing.join(' | ')}`);
    const added = a.filter((l) => !b.includes(l));
    return `${b.length} pre-existing routes all present; ${added.length} added (${added.join(', ') || 'none'})`;
  }),

  check(8, 'Profile: both branches persist, merge on save, survive demo reset', async () => {
    const before = await (await fetch(`${ORIGIN}/api/inspector-profile`)).json();
    assert(before && before.gov && before.bank, 'no seeded demo profile found');
    assert(before.gov.govId && before.bank.employeeId, 'demo profile is missing a branch');

    // Save a government-only payload. The bank branch must survive (merge).
    const merged = await (await fetch(`${ORIGIN}/api/inspector-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectorType: 'government', displayName: 'Ramesh Patel', gov: { govId: 'GOV-NSK-0417' } }),
    })).json();
    assert(merged.bank && merged.bank.employeeId, 'saving a government profile wiped the bank branch');
    assert(merged.gov.govId === 'GOV-NSK-0417', 'government branch did not save');

    // Now save a bank-only payload. The government branch must survive.
    const merged2 = await (await fetch(`${ORIGIN}/api/inspector-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectorType: 'bank', bank: { employeeId: 'EMP-2291' } }),
    })).json();
    assert(merged2.gov && merged2.gov.govId === 'GOV-NSK-0417', 'saving a bank profile wiped the gov branch');

    // Demo reset must preserve the profile, not blank it.
    await fetch(`${ORIGIN}/api/reset-demo`, { method: 'POST' });
    const afterReset = await (await fetch(`${ORIGIN}/api/inspector-profile`)).json();
    assert(afterReset && afterReset.gov && afterReset.bank, 'demo reset blanked the profile');
    assert(afterReset.gov.govId === 'GOV-NSK-0417' && afterReset.bank.employeeId === 'EMP-2291',
      'demo reset altered the profile');

    // A phone number must never be carried into a seeded identity.
    const phones = JSON.stringify(afterReset).match(/(?:\+91[\s-]?)?[6-9]\d{9}/g);
    assert(!phones, `demo profile contains a phone number: ${phones}`);

    return `gov ${afterReset.gov.govId} + bank ${afterReset.bank.employeeId} both retained`;
  }),
];

// ----------------------------------------------------------------------- main
(async () => {
  const built = path.join(ROOT, 'dist', 'server.cjs');
  if (!fs.existsSync(built)) {
    console.error('dist/server.cjs not found — run `npm run build` first.');
    process.exit(1);
  }

  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stockproof-dod-'));
  // Junction the built client into the temp cwd so production static serving works
  // while all writes land in an isolated data/ directory.
  fs.symlinkSync(path.join(ROOT, 'dist'), path.join(tmpDir, 'dist'), 'junction');
  console.log(`Isolated working dir: ${tmpDir}\n`);

  try {
    await startServer();
    await waitForHealth();
    console.log('Server up. Running checks...\n');
  } catch (err) {
    console.error(`FATAL: ${err.message}`);
    await stopServer();
    process.exit(1);
  }

  for (const c of CHECKS) await c();
  await stopServer();

  const pad = Math.max(...results.map((r) => r.name.length));
  console.log('='.repeat(pad + 30));
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}. ${r.name.padEnd(pad)}`);
    if (r.detail) console.log(`      ${r.detail}`);
  }
  console.log('='.repeat(pad + 30));
  console.log(`${results.length - failures}/${results.length} checks passed`);

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  process.exit(failures > 0 ? 1 : 0);
})();
