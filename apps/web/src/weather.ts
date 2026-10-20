export type City = { id: string; name: string; country: string; lat: number; lon: number; timezone: string };
export type Weather = { city: City; current: { temperature_2m: number; relative_humidity_2m: number; apparent_temperature: number; precipitation: number; weather_code: number; cloud_cover: number; wind_speed_10m: number; wind_direction_10m: number; is_day: number; time: string }; daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; sunrise: string[]; sunset: string[]; precipitation_probability_max: number[] }; updatedAt: string };

// Server-side requests can fail on shared hosting IPs. The public, keyless
// endpoint is also accessible from the browser; camera credentials stay server-side.
export async function loadWeather(city: City, serverRequest: () => Promise<Weather>, signal: AbortSignal): Promise<Weather> {
  try {
    return await serverRequest();
  } catch (error) {
    if (signal.aborted) throw error;
  }
  const params = new URLSearchParams({
    latitude: String(city.lat), longitude: String(city.lon), timezone: city.timezone,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max',
    forecast_days: '5', wind_speed_unit: 'kmh',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
  });
  if (!response.ok) throw new Error(`Open-Meteo: ${response.status}`);
  const data = await response.json();
  if (!data.current || !Array.isArray(data.daily?.time) || data.daily.time.length < 5) throw new Error('Incomplete weather response');
  return { city, current: data.current, daily: data.daily, updatedAt: new Date().toISOString() };
}
