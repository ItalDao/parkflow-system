/*
  Smoke test for API rate limiting.
  Usage:
    node check-rate-limit.js

  Optional env vars:
    BASE_URL=http://localhost:3000
    RL_TEST_EMAIL=ratelimit-test@parkingos.local
    RL_TEST_PASSWORD=invalid-password
    DASHBOARD_TOKEN=<jwt>
    DASHBOARD_TEST_EMAIL=<email para login>
    DASHBOARD_TEST_PASSWORD=<password para login>
    RL_SERVER_WAIT_MS=45000
    RL_SERVER_POLL_MS=1000
    RL_AUTOSTART_SERVER=false
    RL_FAIL_ON_SKIPPED=false
    RL_REPORT_FORMAT=text|json|junit
    RL_REPORT_FILE=./artifacts/rate-limit-report.json
*/

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const RL_TEST_EMAIL = process.env.RL_TEST_EMAIL || 'ratelimit-test@parkingos.local';
const RL_TEST_PASSWORD = process.env.RL_TEST_PASSWORD || 'invalid-password';
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || '';
const DASHBOARD_TEST_EMAIL = process.env.DASHBOARD_TEST_EMAIL || '';
const DASHBOARD_TEST_PASSWORD = process.env.DASHBOARD_TEST_PASSWORD || '';
const RL_SERVER_WAIT_MS = Number(process.env.RL_SERVER_WAIT_MS || 45_000);
const RL_SERVER_POLL_MS = Number(process.env.RL_SERVER_POLL_MS || 1_000);
const RL_AUTOSTART_SERVER = /^(1|true|yes)$/i.test(String(process.env.RL_AUTOSTART_SERVER || 'false'));
const RL_FAIL_ON_SKIPPED = /^(1|true|yes)$/i.test(String(process.env.RL_FAIL_ON_SKIPPED || 'false'));
const RL_REPORT_FORMAT = String(process.env.RL_REPORT_FORMAT || 'text').toLowerCase();
const RL_REPORT_FILE = process.env.RL_REPORT_FILE || '';

const results = [];
let managedDevServer = null;
let runtimeDashboardToken = DASHBOARD_TOKEN;

function nowMs() {
  return Date.now();
}

function xmlEscape(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function writeReport(content, reportPath) {
  const outPath = reportPath || defaultReportPath();
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`Report written to ${outPath}`);
}

function defaultReportPath() {
  if (RL_REPORT_FORMAT === 'json') return path.join('artifacts', 'rate-limit-report.json');
  if (RL_REPORT_FORMAT === 'junit') return path.join('artifacts', 'rate-limit-report.xml');
  return path.join('artifacts', 'rate-limit-report.txt');
}

function toJsonReport() {
  const total = results.length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  return JSON.stringify(
    {
      suite: 'rate-limit-smoke',
      baseUrl: BASE_URL,
      total,
      failed,
      skipped,
      passed: total - failed - skipped,
      timestamp: new Date().toISOString(),
      results,
    },
    null,
    2
  );
}

function toJunitReport() {
  const total = results.length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const totalSeconds = results.reduce((acc, item) => acc + item.durationMs, 0) / 1000;

  const testcases = results
    .map((r) => {
      const base = `  <testcase classname="rate-limit-smoke" name="${xmlEscape(r.name)}" time="${(r.durationMs / 1000).toFixed(3)}">`;
      if (r.status === 'failed') {
        return `${base}\n    <failure message="${xmlEscape(r.message)}"/>\n  </testcase>`;
      }
      if (r.status === 'skipped') {
        return `${base}\n    <skipped message="${xmlEscape(r.message)}"/>\n  </testcase>`;
      }
      return `${base}\n  </testcase>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="rate-limit-smoke" tests="${total}" failures="${failed}" skipped="${skipped}" time="${totalSeconds.toFixed(3)}">`,
    testcases,
    '</testsuite>',
    '',
  ].join('\n');
}

function printTextSummary() {
  const total = results.length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const passed = total - failed - skipped;

  console.log('== Summary ==');
  console.log(`passed=${passed} failed=${failed} skipped=${skipped} total=${total}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const started = nowMs();
  let attempts = 0;

  while (nowMs() - started <= RL_SERVER_WAIT_MS) {
    attempts += 1;
    try {
      const response = await fetch(`${BASE_URL}/`, { method: 'GET' });
      if (response.status >= 200 && response.status < 600) {
        console.log(`Server reachable at ${BASE_URL} after ${attempts} probe(s).`);
        return;
      }
    } catch {
      // keep polling until timeout
    }

    await sleep(RL_SERVER_POLL_MS);
  }

  throw new Error(
    `Server not reachable at ${BASE_URL} after ${RL_SERVER_WAIT_MS}ms. Start the app (npm run dev) or set BASE_URL.`
  );
}

function startDevServer() {
  if (managedDevServer) return;

  managedDevServer = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'ignore',
    detached: false,
  });

  managedDevServer.on('exit', () => {
    managedDevServer = null;
  });
}

function stopDevServer() {
  if (!managedDevServer || managedDevServer.killed) return;

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(managedDevServer.pid), '/t', '/f'], {
        shell: true,
        stdio: 'ignore',
      });
    } else {
      managedDevServer.kill('SIGTERM');
    }
  } catch {
    // best effort cleanup
  }
}

async function ensureServerReady() {
  try {
    await waitForServer();
    return;
  } catch (initialError) {
    if (!RL_AUTOSTART_SERVER) throw initialError;
  }

  console.log('Server unreachable. Starting local dev server automatically...');
  startDevServer();
  await sleep(1_500);
  await waitForServer();
}

async function postJson(pathname, payload, headers = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { response, json };
}

async function runCase(name, fn) {
  const started = nowMs();
  try {
    const maybeSkipMessage = await fn();
    const durationMs = nowMs() - started;
    if (typeof maybeSkipMessage === 'string' && maybeSkipMessage.startsWith('SKIP:')) {
      const message = maybeSkipMessage.slice(5).trim();
      results.push({ name, status: 'skipped', durationMs, message });
      console.log(`[skip] ${name}: ${message}`);
      return;
    }
    results.push({ name, status: 'passed', durationMs, message: 'ok' });
    console.log(`[pass] ${name}`);
  } catch (error) {
    const durationMs = nowMs() - started;
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'failed', durationMs, message });
    console.error(`[fail] ${name}: ${message}`);
  }
}

async function resolveDashboardToken() {
  if (runtimeDashboardToken) return runtimeDashboardToken;

  if (!DASHBOARD_TEST_EMAIL || !DASHBOARD_TEST_PASSWORD) {
    return null;
  }

  const { response, json } = await postJson('/api/auth', {
    action: 'login',
    email: DASHBOARD_TEST_EMAIL,
    password: DASHBOARD_TEST_PASSWORD,
  });

  if (response.status !== 200 || !json?.accessToken) {
    return null;
  }

  runtimeDashboardToken = json.accessToken;
  return runtimeDashboardToken;
}

async function testAuthRateLimit() {
  console.log('== Auth rate limit smoke ==');

  let got429 = false;
  let retryAfter = null;

  for (let i = 1; i <= 12; i += 1) {
    const { response, json } = await postJson('/api/auth', {
      action: 'login',
      email: RL_TEST_EMAIL,
      password: RL_TEST_PASSWORD,
    });

    const headerRetry = response.headers.get('retry-after');
    console.log(`[auth] attempt ${i}: status=${response.status} retry-after=${headerRetry || '-'} message=${json?.error || '-'}`);

    if (response.status === 429) {
      got429 = true;
      retryAfter = headerRetry;
      break;
    }
  }

  if (!got429) {
    throw new Error('Auth rate limit did not trigger 429 within 12 attempts.');
  }

  if (!retryAfter) {
    throw new Error('Auth 429 response did not include Retry-After header.');
  }
}

async function testDashboardRateLimit() {
  const token = await resolveDashboardToken();
  if (!token) {
    return 'SKIP: set DASHBOARD_TOKEN or DASHBOARD_TEST_EMAIL/DASHBOARD_TEST_PASSWORD to enable dashboard throttle validation';
  }

  console.log('== Dashboard rate limit smoke ==');

  let got429 = false;
  let retryAfter = null;

  for (let i = 1; i <= 6; i += 1) {
    const { response, json } = await postJson(
      '/api/dashboard',
      {
        resource: 'open-shift',
        initialCash: 0,
      },
      { Authorization: `Bearer ${token}` }
    );

    const headerRetry = response.headers.get('retry-after');
    console.log(`[dashboard] attempt ${i}: status=${response.status} retry-after=${headerRetry || '-'} message=${json?.error || '-'}`);

    if (response.status === 401) {
      throw new Error('Dashboard token is invalid or expired (401).');
    }

    if (response.status === 429) {
      got429 = true;
      retryAfter = headerRetry;
      break;
    }
  }

  if (!got429) {
    throw new Error('Dashboard rate limit did not trigger 429 within 6 attempts.');
  }

  if (!retryAfter) {
    throw new Error('Dashboard 429 response did not include Retry-After header.');
  }
}

function emitReport() {
  if (RL_REPORT_FORMAT === 'json') {
    writeReport(toJsonReport(), RL_REPORT_FILE);
    return;
  }
  if (RL_REPORT_FORMAT === 'junit') {
    writeReport(toJunitReport(), RL_REPORT_FILE);
    return;
  }
  if (RL_REPORT_FILE) {
    const text = results
      .map((r) => `${r.status.toUpperCase()} ${r.name} (${r.durationMs}ms) ${r.message}`)
      .join('\n');
    writeReport(text + '\n', RL_REPORT_FILE);
  }
}

async function main() {
  console.log(`Running against ${BASE_URL}`);

  await ensureServerReady();

  await runCase('auth: returns 429 with Retry-After', testAuthRateLimit);
  await runCase('dashboard: returns 429 with Retry-After', testDashboardRateLimit);

  printTextSummary();
  emitReport();

  const hasFailures = results.some((r) => r.status === 'failed');
  const hasSkipped = results.some((r) => r.status === 'skipped');
  if (hasFailures || (RL_FAIL_ON_SKIPPED && hasSkipped)) {
    if (!hasFailures && hasSkipped) {
      console.error('Strict mode enabled: skipped test(s) treated as failure.');
    }
    stopDevServer();
    process.exit(1);
  }

  stopDevServer();
}

main().catch((error) => {
  stopDevServer();
  console.error('Rate limit smoke failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
