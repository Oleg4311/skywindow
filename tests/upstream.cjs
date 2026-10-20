// Loaded only by integration tests. No external services or real keys are used.
const originalFetch = global.fetch;
global.fetch = async (input, options) => {
  const url = new URL(input);
  if (url.hostname === 'api.open-meteo.com') {
    if (url.searchParams.get('longitude') === '21.0122') return new Response('{}', { status: 503 });
    return Response.json({
      current: { temperature_2m: 12, weather_code: 3 },
      daily: { time: ['2026-10-20'], temperature_2m_max: [15] },
      current_units: { temperature_2m: '°C' },
    });
  }
  if (url.hostname === 'api.windy.com') {
    if (options.headers['x-windy-api-key'] !== 'integration-test') return new Response('{}', { status: 401 });
    if (url.searchParams.get('nearby') !== '50.0647,19.945,30') return new Response('{}', { status: 400 });
    return Response.json({ webcams: [{ webcamId: 123, title: 'Test camera', location: { city: 'Krakow' },
      images: { current: { preview: 'https://example.com/image.jpg' } },
      player: { day: 'https://example.com/player' }, urls: { detail: 'https://example.com/camera' } }] });
  }
  return originalFetch(input, options);
};
