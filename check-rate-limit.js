/*
  Smoke test for API rate limiting.
  Usage:
    node check-rate-limit.js

  Optional env vars:
    BASE_URL=http://localhost:3000
    RL_TEST_EMAIL=ratelimit-test@parkingos.local
    RL_TEST_PASSWORD=invalid-password
    DASHBOARD_TOKEN=<jwt>
*/

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const RL_TEST_EMAIL = process.env.RL_TEST_EMAIL || 'ratelimit-test@parkingos.local';
const RL_TEST_PASSWORD = process.env.RL_TEST_PASSWORD || 'invalid-password';
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || '';

async function postJson(path, payload, headers = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
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

  console.log('Auth rate limit OK');
}

async function testDashboardRateLimit() {
  if (!DASHBOARD_TOKEN) {
    console.log('== Dashboard rate limit smoke skipped (set DASHBOARD_TOKEN to enable) ==');
    return;
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
      { Authorization: `Bearer ${DASHBOARD_TOKEN}` }
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

  console.log('Dashboard rate limit OK');
}

async function main() {
  console.log(`Running against ${BASE_URL}`);
  await testAuthRateLimit();
  await testDashboardRateLimit();
  console.log('Rate limit smoke completed successfully.');
}

main().catch((error) => {
  console.error('Rate limit smoke failed:', error.message);
  process.exit(1);
});
