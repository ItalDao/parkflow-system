/*
  Smoke test for realtime notifications SSE auth flow.

  Usage:
    node check-realtime-sse.js

  Optional env vars:
    BASE_URL=http://localhost:3000
    SSE_TEST_EMAIL=matias.superadmin@acuario.com
    SSE_TEST_PASSWORD=Matias@Admin123
    SSE_AUTOSTART_SERVER=false
    SSE_SERVER_WAIT_MS=45000
    SSE_SERVER_POLL_MS=1000
*/

const { spawn } = require('child_process');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SSE_TEST_EMAIL = process.env.SSE_TEST_EMAIL || 'matias.superadmin@acuario.com';
const SSE_TEST_PASSWORD = process.env.SSE_TEST_PASSWORD || 'Matias@Admin123';
const SSE_AUTOSTART_SERVER = /^(1|true|yes)$/i.test(String(process.env.SSE_AUTOSTART_SERVER || 'false'));
const SSE_SERVER_WAIT_MS = Number(process.env.SSE_SERVER_WAIT_MS || 45_000);
const SSE_SERVER_POLL_MS = Number(process.env.SSE_SERVER_POLL_MS || 1_000);

let managedDevServer = null;
let failures = 0;

function nowMs() {
  return Date.now();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pass(name) {
  console.log(`[pass] ${name}`);
}

function fail(name, message) {
  failures += 1;
  console.error(`[fail] ${name}: ${message}`);
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
      spawn('taskkill', ['/pid', String(managedDevServer.pid), '/t', '/f'], { shell: true, stdio: 'ignore' });
    } else {
      managedDevServer.kill('SIGTERM');
    }
  } catch {
    // best effort
  }
}

async function waitForServer() {
  const started = nowMs();
  while (nowMs() - started <= SSE_SERVER_WAIT_MS) {
    try {
      const response = await fetch(`${BASE_URL}/`, { method: 'GET' });
      if (response.status >= 200 && response.status < 600) {
        console.log(`Server reachable at ${BASE_URL}.`);
        return;
      }
    } catch {
      // continue polling
    }

    await sleep(SSE_SERVER_POLL_MS);
  }

  throw new Error(`Server not reachable at ${BASE_URL} after ${SSE_SERVER_WAIT_MS}ms.`);
}

async function ensureServerReady() {
  try {
    await waitForServer();
    return;
  } catch (error) {
    if (!SSE_AUTOSTART_SERVER) throw error;
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

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function login() {
  const { response, json } = await postJson('/api/auth', {
    action: 'login',
    email: SSE_TEST_EMAIL,
    password: SSE_TEST_PASSWORD,
  });

  if (response.status !== 200 || !json?.accessToken) {
    throw new Error(`Login failed. status=${response.status} message=${json?.error || '-'}`);
  }

  return json.accessToken;
}

async function requestStreamToken(accessToken) {
  const { response, json } = await postJson('/api/auth/stream-token', {}, authHeader(accessToken));
  if (response.status !== 200 || !json?.streamToken) {
    throw new Error(`Cannot mint stream token. status=${response.status} message=${json?.error || '-'}`);
  }

  return json.streamToken;
}

async function waitForSseEvent(response, eventName, timeoutMs) {
  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed. status=${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let buffer = '';
  let currentEvent = 'message';

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const timedRead = Promise.race([
      reader.read(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout waiting SSE frame')), Math.max(1, remaining))),
    ]);

    const { done, value } = await timedRead;
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let frameEnd = buffer.indexOf('\n\n');
    while (frameEnd >= 0) {
      const frame = buffer.slice(0, frameEnd);
      buffer = buffer.slice(frameEnd + 2);

      const lines = frame.split('\n');
      currentEvent = 'message';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice('event:'.length).trim();
        }
      }

      if (currentEvent === eventName) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        return;
      }

      frameEnd = buffer.indexOf('\n\n');
    }
  }

  try {
    await reader.cancel();
  } catch {
    // ignore
  }
  throw new Error(`Did not receive SSE event '${eventName}' within ${timeoutMs}ms`);
}

async function run() {
  try {
    await ensureServerReady();
  } catch (error) {
    fail('server reachable', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  let accessToken = '';
  let streamToken = '';

  try {
    accessToken = await login();
    pass('login');
  } catch (error) {
    fail('login', error instanceof Error ? error.message : String(error));
  }

  if (accessToken) {
    try {
      streamToken = await requestStreamToken(accessToken);
      pass('mint stream token');
    } catch (error) {
      fail('mint stream token', error instanceof Error ? error.message : String(error));
    }
  }

  if (streamToken) {
    try {
      const sseResponse = await fetch(`${BASE_URL}/api/notifications/stream?st=${encodeURIComponent(streamToken)}`, {
        headers: { Accept: 'text/event-stream' },
      });
      await waitForSseEvent(sseResponse, 'connected', 12_000);
      pass('connect SSE with stream token');
    } catch (error) {
      fail('connect SSE with stream token', error instanceof Error ? error.message : String(error));
    }
  }

  try {
    const invalid = await fetch(`${BASE_URL}/api/notifications/stream?st=invalid.token.value`, {
      headers: { Accept: 'text/event-stream' },
    });
    if (invalid.status === 401) {
      pass('reject invalid stream token');
    } else {
      fail('reject invalid stream token', `Expected 401, received ${invalid.status}`);
    }
  } catch (error) {
    fail('reject invalid stream token', error instanceof Error ? error.message : String(error));
  }

  if (!failures) {
    console.log('SSE smoke passed.');
  } else {
    console.error(`SSE smoke failed with ${failures} case(s).`);
  }

  if (managedDevServer) {
    stopDevServer();
  }

  process.exit(failures ? 1 : 0);
}

run().catch((error) => {
  console.error('Unexpected failure:', error);
  if (managedDevServer) {
    stopDevServer();
  }
  process.exit(1);
});
