/*
  Business flow smoke test (API-level).
  Validates: RBAC + shift lifecycle + ticket entry/exit.

  Optional env vars:
    BASE_URL=http://localhost:3000
    BF_OPERATOR_EMAIL=matias.operator@acuario.com
    BF_OPERATOR_PASSWORD=Matias@Admin123
    BF_ADMIN_EMAIL=matias.admin@acuario.com
    BF_ADMIN_PASSWORD=Matias@Admin123
    BF_FLOW_EMAIL=matias.superadmin@acuario.com
    BF_FLOW_PASSWORD=Matias@Admin123
    BF_AUTOSTART_SERVER=false
    BF_SERVER_WAIT_MS=45000
    BF_SERVER_POLL_MS=1000
    BF_REPORT_FORMAT=text|json|junit
    BF_REPORT_FILE=./artifacts/business-flow-report.xml
*/

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BF_OPERATOR_EMAIL = process.env.BF_OPERATOR_EMAIL || 'matias.operator@acuario.com';
const BF_OPERATOR_PASSWORD = process.env.BF_OPERATOR_PASSWORD || 'Matias@Admin123';
const BF_ADMIN_EMAIL = process.env.BF_ADMIN_EMAIL || 'matias.admin@acuario.com';
const BF_ADMIN_PASSWORD = process.env.BF_ADMIN_PASSWORD || 'Matias@Admin123';
const BF_FLOW_EMAIL = process.env.BF_FLOW_EMAIL || 'matias.superadmin@acuario.com';
const BF_FLOW_PASSWORD = process.env.BF_FLOW_PASSWORD || 'Matias@Admin123';
const BF_AUTOSTART_SERVER = /^(1|true|yes)$/i.test(String(process.env.BF_AUTOSTART_SERVER || 'false'));
const BF_SERVER_WAIT_MS = Number(process.env.BF_SERVER_WAIT_MS || 45_000);
const BF_SERVER_POLL_MS = Number(process.env.BF_SERVER_POLL_MS || 1_000);
const BF_REPORT_FORMAT = String(process.env.BF_REPORT_FORMAT || 'junit').toLowerCase();
const BF_REPORT_FILE = process.env.BF_REPORT_FILE || '';

const results = [];
let managedDevServer = null;

function nowMs() {
  return Date.now();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function xmlEscape(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function defaultReportPath() {
  if (BF_REPORT_FORMAT === 'json') return path.join('artifacts', 'business-flow-report.json');
  if (BF_REPORT_FORMAT === 'junit') return path.join('artifacts', 'business-flow-report.xml');
  return path.join('artifacts', 'business-flow-report.txt');
}

function writeReport(content) {
  const outPath = BF_REPORT_FILE || defaultReportPath();
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`Report written to ${outPath}`);
}

function emitReport() {
  if (BF_REPORT_FORMAT === 'json') {
    const total = results.length;
    const failed = results.filter((r) => r.status === 'failed').length;
    writeReport(
      JSON.stringify(
        {
          suite: 'business-flow-smoke',
          baseUrl: BASE_URL,
          total,
          failed,
          passed: total - failed,
          timestamp: new Date().toISOString(),
          results,
        },
        null,
        2
      )
    );
    return;
  }

  if (BF_REPORT_FORMAT === 'junit') {
    const total = results.length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const totalSeconds = results.reduce((acc, r) => acc + r.durationMs, 0) / 1000;
    const testcases = results
      .map((r) => {
        const base = `  <testcase classname="business-flow-smoke" name="${xmlEscape(r.name)}" time="${(r.durationMs / 1000).toFixed(3)}">`;
        if (r.status === 'failed') return `${base}\n    <failure message="${xmlEscape(r.message)}"/>\n  </testcase>`;
        return `${base}\n  </testcase>`;
      })
      .join('\n');

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<testsuite name="business-flow-smoke" tests="${total}" failures="${failed}" time="${totalSeconds.toFixed(3)}">`,
      testcases,
      '</testsuite>',
      '',
    ].join('\n');

    writeReport(xml);
    return;
  }

  const text = results.map((r) => `${r.status.toUpperCase()} ${r.name} (${r.durationMs}ms) ${r.message}`).join('\n');
  writeReport(text + '\n');
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

async function waitForServer() {
  const started = nowMs();
  while (nowMs() - started <= BF_SERVER_WAIT_MS) {
    try {
      const response = await fetch(`${BASE_URL}/`, { method: 'GET' });
      if (response.status >= 200 && response.status < 600) {
        console.log(`Server reachable at ${BASE_URL}.`);
        return;
      }
    } catch {
      // continue polling
    }
    await sleep(BF_SERVER_POLL_MS);
  }
  throw new Error(`Server not reachable at ${BASE_URL} after ${BF_SERVER_WAIT_MS}ms.`);
}

async function ensureServerReady() {
  try {
    await waitForServer();
    return;
  } catch (error) {
    if (!BF_AUTOSTART_SERVER) throw error;
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

async function getJson(pathname, headers = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: 'GET',
    headers,
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
    await fn();
    const durationMs = nowMs() - started;
    results.push({ name, status: 'passed', durationMs, message: 'ok' });
    console.log(`[pass] ${name}`);
  } catch (error) {
    const durationMs = nowMs() - started;
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'failed', durationMs, message });
    console.error(`[fail] ${name}: ${message}`);
  }
}

async function login(email, password) {
  const { response, json } = await postJson('/api/auth', {
    action: 'login',
    email,
    password,
  });

  if (response.status !== 200 || !json?.accessToken) {
    throw new Error(`Login failed for ${email}. status=${response.status} message=${json?.error || '-'}`);
  }

  return json.accessToken;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function seedSystem() {
  const { response, json } = await postJson('/api/seed', {});
  if (response.status !== 200) {
    throw new Error(`Seed failed. status=${response.status} message=${json?.error || '-'}`);
  }
}

async function fetchAvailableSpaceId(operatorToken) {
  const { response, json } = await getJson('/api/dashboard?resource=zones', authHeader(operatorToken));
  if (response.status !== 200 || !Array.isArray(json)) {
    throw new Error(`Cannot read zones. status=${response.status}`);
  }

  for (const zone of json) {
    if (!Array.isArray(zone.spaces)) continue;
    const free = zone.spaces.find((s) => s.status === 'AVAILABLE' || s.status === 'RESERVED');
    if (free) return free.id;
  }

  throw new Error('No available/reserved space found for entry test.');
}

async function main() {
  const randomPlate = `SMK-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  let operatorToken = '';
  let adminToken = '';
  let flowToken = '';
  let createdTicketId = '';

  console.log(`Running business smoke against ${BASE_URL}`);
  await ensureServerReady();

  await runCase('seed: initializes core data', async () => {
    await seedSystem();
  });

  await runCase('auth: operator login', async () => {
    operatorToken = await login(BF_OPERATOR_EMAIL, BF_OPERATOR_PASSWORD);
  });

  await runCase('auth: admin login', async () => {
    adminToken = await login(BF_ADMIN_EMAIL, BF_ADMIN_PASSWORD);
  });

  await runCase('auth: flow user login', async () => {
    flowToken = await login(BF_FLOW_EMAIL, BF_FLOW_PASSWORD);
  });

  await runCase('rbac: operator cannot list users', async () => {
    const { response } = await getJson('/api/dashboard?resource=users', authHeader(operatorToken));
    if (response.status !== 403) {
      throw new Error(`Expected 403 for operator users list, got ${response.status}`);
    }
  });

  await runCase('rbac: admin can list users', async () => {
    const { response, json } = await getJson('/api/dashboard?resource=users', authHeader(adminToken));
    if (response.status !== 200 || !Array.isArray(json)) {
      throw new Error(`Expected 200 users list for admin, got ${response.status}`);
    }
  });

  await runCase('shift: flow user can open shift', async () => {
    const closeAttempt = await postJson('/api/dashboard', { resource: 'close-shift', actualTotal: 0 }, authHeader(flowToken));
    if (![200, 400].includes(closeAttempt.response.status)) {
      throw new Error(`Unexpected close pre-step status ${closeAttempt.response.status}`);
    }

    const open = await postJson('/api/dashboard', { resource: 'open-shift', initialCash: 0 }, authHeader(flowToken));
    if (open.response.status !== 200) {
      throw new Error(`Open shift failed. status=${open.response.status} message=${open.json?.error || '-'}`);
    }
  });

  await runCase('tickets: flow user entry and exit flow', async () => {
    const spaceId = await fetchAvailableSpaceId(flowToken);

    const entry = await postJson('/api/dashboard', {
      resource: 'entry',
      plate: randomPlate,
      vehicleType: 'CAR',
      spaceId,
    }, authHeader(flowToken));

    if (entry.response.status !== 200 || !entry.json?.id) {
      throw new Error(`Entry failed. status=${entry.response.status} message=${entry.json?.error || '-'}`);
    }

    createdTicketId = entry.json.id;

    const exit = await postJson('/api/dashboard', {
      resource: 'exit',
      ticketId: createdTicketId,
      paymentMethod: 'CASH',
      cashReceived: 50000,
    }, authHeader(flowToken));

    if (exit.response.status !== 200) {
      throw new Error(`Exit failed. status=${exit.response.status} message=${exit.json?.error || '-'}`);
    }
  });

  await runCase('shift: flow user can close shift', async () => {
    const close = await postJson('/api/dashboard', { resource: 'close-shift', actualTotal: 0 }, authHeader(flowToken));
    if (close.response.status !== 200) {
      throw new Error(`Close shift failed. status=${close.response.status} message=${close.json?.error || '-'}`);
    }
  });

  const failed = results.filter((r) => r.status === 'failed').length;
  const passed = results.length - failed;
  console.log(`Summary: passed=${passed} failed=${failed} total=${results.length}`);

  emitReport();
  stopDevServer();

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  stopDevServer();
  console.error('Business flow smoke failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
