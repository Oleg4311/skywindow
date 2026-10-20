import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { Controller, Get, Module, Param, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

config({ path: resolve(__dirname, '../.env') });

const cities = [
  { id: 'moscow', name: 'Москва', country: 'Россия', lat: 55.7558, lon: 37.6173, timezone: 'Europe/Moscow' },
  { id: 'saint-petersburg', name: 'Санкт-Петербург', country: 'Россия', lat: 59.9343, lon: 30.3351, timezone: 'Europe/Moscow' },
  { id: 'kazan', name: 'Казань', country: 'Россия', lat: 55.7961, lon: 49.1064, timezone: 'Europe/Moscow' },
  { id: 'sochi', name: 'Сочи', country: 'Россия', lat: 43.6028, lon: 39.7342, timezone: 'Europe/Moscow' },
  { id: 'yekaterinburg', name: 'Екатеринбург', country: 'Россия', lat: 56.8389, lon: 60.6057, timezone: 'Asia/Yekaterinburg' },
  { id: 'novosibirsk', name: 'Новосибирск', country: 'Россия', lat: 55.0084, lon: 82.9357, timezone: 'Asia/Novosibirsk' },
  { id: 'brussels', name: 'Брюссель', country: 'Бельгия', lat: 50.8503, lon: 4.3517, timezone: 'Europe/Brussels' },
  { id: 'antwerp', name: 'Антверпен', country: 'Бельгия', lat: 51.2194, lon: 4.4025, timezone: 'Europe/Brussels' },
  { id: 'ghent', name: 'Гент', country: 'Бельгия', lat: 51.0543, lon: 3.7174, timezone: 'Europe/Brussels' },
  { id: 'bruges', name: 'Брюгге', country: 'Бельгия', lat: 51.2093, lon: 3.2247, timezone: 'Europe/Brussels' },
  { id: 'liege', name: 'Льеж', country: 'Бельгия', lat: 50.6326, lon: 5.5797, timezone: 'Europe/Brussels' },
  { id: 'krakow', name: 'Краков', country: 'Польша', lat: 50.0647, lon: 19.9450, timezone: 'Europe/Warsaw' },
  { id: 'warsaw', name: 'Варшава', country: 'Польша', lat: 52.2297, lon: 21.0122, timezone: 'Europe/Warsaw' },
  { id: 'paris', name: 'Париж', country: 'Франция', lat: 48.8566, lon: 2.3522, timezone: 'Europe/Paris' },
  { id: 'london', name: 'Лондон', country: 'Великобритания', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London' },
  { id: 'new-york', name: 'Нью-Йорк', country: 'США', lat: 40.7128, lon: -74.0060, timezone: 'America/New_York' },
  { id: 'tokyo', name: 'Токио', country: 'Япония', lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo' },
  { id: 'rome', name: 'Рим', country: 'Италия', lat: 41.9028, lon: 12.4964, timezone: 'Europe/Rome' },
  { id: 'almaty', name: 'Алматы', country: 'Казахстан', lat: 43.2389, lon: 76.8897, timezone: 'Asia/Almaty' },
] as const;

type City = typeof cities[number];
const cache = new Map<string, { expires: number; data: unknown }>();
async function memo<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const value = cache.get(key);
  if (value && value.expires > Date.now()) return value.data as T;
  const data = await loader();
  cache.set(key, { expires: Date.now() + ttl, data });
  return data;
}
function cityById(id: string): City {
  const city = cities.find(c => c.id === id);
  if (!city) throw new NotFoundException('Город не найден');
  return city;
}
async function getJson(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return await response.json() as any;
  } finally { clearTimeout(timeout); }
}

@Injectable()
class DashboardService {
  async weather(city: City) {
    return memo(`weather:${city.id}`, 5 * 60_000, async () => {
      const params = new URLSearchParams({
        latitude: String(city.lat), longitude: String(city.lon), timezone: city.timezone,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,is_day',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max',
        forecast_days: '5', wind_speed_unit: 'kmh'
      });
      try {
        const data = await getJson(`https://api.open-meteo.com/v1/forecast?${params}`);
        return { city, current: data.current, daily: data.daily, units: data.current_units, updatedAt: new Date().toISOString() };
      } catch (error) {
        console.error(`Weather request failed for ${city.id}:`, error instanceof Error ? error.message : 'Unknown upstream error');
        throw new ServiceUnavailableException('Сервис погоды временно недоступен');
      }
    });
  }

  async cameras(city: City) {
    const key = process.env.WINDY_WEBCAMS_API_KEY;
    if (!key) return { status: 'configuration_required', cameras: [], message: 'Для поиска камер добавьте WINDY_WEBCAMS_API_KEY в apps/api/.env' };
    return memo(`cameras:${city.id}`, 60_000, async () => {
      // Windy Webcams v3 exposes nearby geographic filtering. Locations are sourced live, never fabricated.
      const params = new URLSearchParams({ nearby: `${city.lat},${city.lon},30`, limit: '50', include: 'location,images,player,urls' });
      try {
        const data = await getJson(`https://api.windy.com/webcams/api/v3/webcams?${params}`, { 'x-windy-api-key': key });
        const list: any[] = Array.isArray(data.webcams) ? data.webcams : Array.isArray(data.result?.webcams) ? data.result.webcams : [];
        const cameras = list.map((cam: any) => {
          const id = String(cam.webcamId ?? cam.id ?? '');
          const title = String(cam.title ?? cam.name ?? 'Камера');
          const preview = cam.images?.current?.preview ?? cam.images?.current?.thumbnail ?? cam.images?.current?.icon ?? null;
          const player = cam.player?.day ?? cam.player?.month ?? cam.player?.lifetime ?? null;
          const url = cam.urls?.detail ?? cam.urls?.webcam ?? (id ? `https://www.windy.com/webcams/${encodeURIComponent(id)}` : null);
          return { id, title, preview, player, url, location: cam.location?.city ?? city.name };
        }).filter((cam: any) => cam.id && (cam.player || cam.url));
        return { status: 'ok', cameras, message: cameras.length ? null : 'Камеры поблизости не найдены' };
      } catch {
        return { status: 'provider_error', cameras: [], message: 'Windy API недоступен. Проверьте ключ и лимиты.' };
      }
    });
  }
}
@Controller('api')
class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}
  @Get('cities') cities() { return cities; }
  @Get('weather/:id') weather(@Param('id') id: string) { return this.dashboard.weather(cityById(id)); }
  @Get('cameras/:id') cameras(@Param('id') id: string) { return this.dashboard.cameras(cityById(id)); }
  @Get('health') health() { return { ok: true }; }
}
@Module({ controllers: [DashboardController], providers: [DashboardService] })
class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN?.split(',') ?? ['http://localhost:5173'] });
  const webRoot = resolve(__dirname, '../../web/dist');
  if (existsSync(webRoot)) app.useStaticAssets(webRoot);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
  console.log(`API listening at http://localhost:${process.env.PORT ?? 3001}`);
}
void bootstrap().catch(error => { console.error(error); process.exitCode = 1; });
