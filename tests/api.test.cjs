const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
let server;
let output = '';
const base = 'http://127.0.0.1:3099';
before(async () => {
  server = spawn(process.execPath, ['--require', './tests/upstream.cjs', 'apps/api/dist/main.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: '3099', WINDY_WEBCAMS_API_KEY: process.env.TEST_CAMERAS ? 'integration-test' : '', WEB_ORIGIN: 'https://oleg4311.github.io' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    if (server.exitCode !== null) throw new Error(output);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`API failed to start: ${output}`);
});
after(() => server?.kill());
test('health, city catalog and explicit dependency injection', async () => {
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true });
  const cities = await (await fetch(`${base}/api/cities`)).json();
  assert.equal(cities.length, 8);
  assert.equal(cities[0].name, 'Краков');
  const cameras = await (await fetch(`${base}/api/cameras/krakow`)).json();
  if (process.env.TEST_CAMERAS) {
    assert.equal(cameras.status, 'ok');
    assert.equal(cameras.cameras[0].id, '123');
    assert.equal(cameras.cameras[0].player, 'https://example.com/player');
    assert.equal(cameras.cameras[0].preview, 'https://example.com/image.jpg');
  } else {
    assert.equal(cameras.status, 'configuration_required');
    assert.deepEqual(cameras.cameras, []);
  }
});
test('weather response and upstream failure', async () => {
  const response = await fetch(`${base}/api/weather/krakow`);
  assert.equal(response.status, 200);
  const weather = await response.json();
  assert.equal(weather.city.id, 'krakow');
  assert.equal(weather.current.temperature_2m, 12);
  assert.ok(weather.updatedAt);
  assert.equal((await fetch(`${base}/api/weather/warsaw`)).status, 503);
});
test('unknown cities return 404', async () => {
  for (const resource of ['weather', 'cameras']) {
    assert.equal((await fetch(`${base}/api/${resource}/unknown`)).status, 404);
  }
});
test('production serves the built frontend and allows the Pages origin', async () => {
  const response = await fetch(base, { headers: { Origin: 'https://oleg4311.github.io' } });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /SkyWindow/);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://oleg4311.github.io');
});
