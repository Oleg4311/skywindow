import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadWeather, type City, type Weather } from '../apps/web/src/weather';

const city: City = { id: 'krakow', name: 'Краков', country: 'Польша', lat: 50.0647, lon: 19.945, timezone: 'Europe/Warsaw' };
test('server weather is used without contacting the public endpoint', async () => {
  const weather = { city } as Weather;
  assert.equal(await loadWeather(city, async () => weather, new AbortController().signal), weather);
});
test('server failure falls back to a complete five-day forecast for the selected city', async t => {
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input);
    assert.equal(url.hostname, 'api.open-meteo.com');
    assert.equal(url.searchParams.get('latitude'), String(city.lat));
    assert.equal(url.searchParams.get('timezone'), city.timezone);
    assert.equal(url.searchParams.get('forecast_days'), '5');
    return Response.json({ current: { temperature_2m: 14 }, daily: { time: Array(5).fill('2026-10-20') } });
  });
  const weather = await loadWeather(city, async () => { throw new Error('503'); }, new AbortController().signal);
  assert.equal(weather.city.id, city.id);
  assert.equal(weather.current.temperature_2m, 14);
  assert.equal(weather.daily.time.length, 5);
  assert.ok(weather.updatedAt);
});
test('changing city cancels the request without starting a fallback', async t => {
  const controller = new AbortController();
  controller.abort();
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request'); });
  await assert.rejects(loadWeather(city, async () => { throw new Error('aborted'); }, controller.signal));
  assert.equal(fetchMock.mock.callCount(), 0);
});
test('fallback rejects provider errors and incomplete data', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 429 }));
  const fail = async (): Promise<Weather> => { throw new Error('503'); };
  await assert.rejects(loadWeather(city, fail, new AbortController().signal), /429/);
  mock.mock.mockImplementation(async () => Response.json({ current: {}, daily: { time: [] } }));
  await assert.rejects(loadWeather(city, fail, new AbortController().signal), /Incomplete/);
});
