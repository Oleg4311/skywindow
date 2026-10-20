import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowUpRight, Camera, ChevronDown, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Compass, Droplets, ExternalLink, Eye, Globe2, LocateFixed, MapPin, Search, Sun, Sunrise, Sunset, Thermometer, Video, Wind } from 'lucide-react';
import './styles.css';
import { loadWeather, type City, type Weather } from './weather';

type Webcam = { id: string; title: string; preview: string | null; player: string | null; url: string | null; location: string };
type Cameras = { status: 'ok' | 'configuration_required' | 'provider_error'; cameras: Webcam[]; message: string | null };
const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
async function apiJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API}/api/${path}`, { signal: AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]) });
  if (!response.ok) throw new Error(`API: ${response.status}`);
  return response.json() as Promise<T>;
}
const initialCities: City[] = [
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
  { id: 'krakow', name: 'Краков', country: 'Польша', lat: 50.0647, lon: 19.945, timezone: 'Europe/Warsaw' },
  { id: 'warsaw', name: 'Варшава', country: 'Польша', lat: 52.2297, lon: 21.0122, timezone: 'Europe/Warsaw' },
  { id: 'paris', name: 'Париж', country: 'Франция', lat: 48.8566, lon: 2.3522, timezone: 'Europe/Paris' },
  { id: 'london', name: 'Лондон', country: 'Великобритания', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London' },
  { id: 'new-york', name: 'Нью-Йорк', country: 'США', lat: 40.7128, lon: -74.006, timezone: 'America/New_York' },
  { id: 'tokyo', name: 'Токио', country: 'Япония', lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo' },
  { id: 'rome', name: 'Рим', country: 'Италия', lat: 41.9028, lon: 12.4964, timezone: 'Europe/Rome' },
  { id: 'almaty', name: 'Алматы', country: 'Казахстан', lat: 43.2389, lon: 76.8897, timezone: 'Asia/Almaty' }
];
const weatherDesc = (code: number) => code === 0 ? 'Ясное небо' : code <= 3 ? 'Переменная облачность' : code <= 48 ? 'Туман' : code <= 57 ? 'Морось' : code <= 67 ? 'Дождь' : code <= 77 ? 'Снег' : code <= 82 ? 'Ливень' : code <= 86 ? 'Снегопад' : code >= 95 ? 'Гроза' : 'Облачно';
const WeatherIcon = ({ code, size = 28 }: { code: number; size?: number }) => {
  const Icon = code === 0 ? Sun : code <= 3 ? CloudSun : code <= 48 ? CloudFog : code <= 57 ? CloudDrizzle : code <= 67 ? CloudRain : code <= 77 ? CloudSnow : code <= 82 ? CloudRain : code <= 86 ? CloudSnow : code >= 95 ? CloudLightning : Cloud;
  return <Icon size={size} strokeWidth={1.6}/>;
};
const fmt = (n: number) => `${Math.round(n)}°`;
const time = (value: string) => value.split('T')[1] ?? '—';
function App() {
  const [cities, setCities] = useState(initialCities);
  const [cityId, setCityId] = useState('krakow');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [cameras, setCameras] = useState<Cameras | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [openCities, setOpenCities] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [retry, setRetry] = useState(0);
  const city = cities.find(c => c.id === cityId) ?? cities[0];
  const shownCities = useMemo(() => cities.filter(c => `${c.name} ${c.country}`.toLowerCase().includes(search.toLowerCase())), [cities, search]);
  const camera = cameras?.cameras.find(c => c.id === selectedCamera) ?? cameras?.cameras[0] ?? null;
  const localTime = new Intl.DateTimeFormat('ru-RU', { timeZone: city.timezone, hour: '2-digit', minute: '2-digit', weekday: 'long' }).format(now);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(timer); }, []);
  useEffect(() => { void apiJson<City[]>('cities').then(data => { if (data.length) setCities(data); }).catch(() => {}); }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setWeather(null); setCameras(null); setSelectedCamera(null);
    const fetchAll = async () => {
      setPending(true); setError('');
      const [weatherResult, cameraResult] = await Promise.allSettled([
        loadWeather(city, () => apiJson<Weather>(`weather/${cityId}`, controller.signal), controller.signal),
        apiJson<Cameras>(`cameras/${cityId}`, controller.signal)
      ]);
      if (!active) return;
      if (weatherResult.status === 'fulfilled') setWeather(weatherResult.value); else { setWeather(null); setError('Не удалось получить погоду ни через сервер, ни напрямую. Попробуйте ещё раз через минуту.'); }
      if (cameraResult.status === 'fulfilled') setCameras(cameraResult.value); else setCameras({ status: 'provider_error', cameras: [], message: 'Не удалось получить список камер.' });
      setPending(false);
    };
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), 5 * 60_000);
    return () => { active = false; controller.abort(); clearInterval(interval); };
  }, [cityId, retry]);
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Globe2 size={23}/></div><div><strong>skywindow<span>.</span></strong><small>ПОГОДА В РЕАЛЬНОМ ВРЕМЕНИ</small></div></div>
      <div className="side-label">ОБЗОР</div>
      <a href="#dashboard" className="nav-item active"><CloudSun size={19}/> Дашборд</a>
      <a href="#cameras" className="nav-item"><Video size={19}/> Городские камеры</a>
      <div className="side-label locations-label">ГОРОДА <span>{cities.length}</span></div>
      <div className="city-nav">{cities.map(c => <button key={c.id} className={`city-item ${cityId === c.id ? 'selected' : ''}`} onClick={() => setCityId(c.id)}><span className="city-dot"/><span>{c.name}</span>{cityId === c.id && <span className="active-mark"/>}</button>)}</div>
      <div className="sidebar-bottom"><div className="signal"><span className="pulse"/>{error ? 'API недоступен' : pending ? 'Обновление…' : 'Погода подключена'}</div><p>Данные о погоде: Open-Meteo<br/>Камеры: Windy Webcams</p></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">Обзор <span>/</span> <strong>Погодный дашборд</strong></div><div className="right-tools"><span className="live"><span className="pulse"/> LIVE DATA</span><div className="avatar">SW</div></div></header>
      <div className="content" id="dashboard">
        <div className="heading-line"><div><div className="eyebrow"><span/> YOUR WINDOW TO THE WORLD</div><h1>Погода <em>без границ.</em></h1><p className="subtitle">Проверьте погоду и загляните на улицы городов мира.</p></div><div className="date-box"><span>МЕСТНОЕ ВРЕМЯ</span><strong>{localTime}</strong></div></div>
        <div className="section-head"><div><h2>Выбранный город</h2><span>Текущие погодные условия</span></div><div className="city-select-wrap"><button className="select-city" onClick={() => setOpenCities(v => !v)}><MapPin size={17}/>{city.name}, {city.country}<ChevronDown size={15}/></button>{openCities && <div className="city-dropdown"><label><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Найти город..." autoFocus/></label>{shownCities.map(c => <button key={c.id} onClick={() => { setCityId(c.id); setOpenCities(false); setSearch(''); }}>{c.name}<span>{c.country}</span></button>)}</div>}</div></div>
        <div className="weather-grid">
          <section className="hero-card"><div className="hero-glow"/><div className="hero-top"><span><LocateFixed size={16}/> {city.name.toUpperCase()}, {city.country.toUpperCase()}</span><span className="current-chip"><span className="pulse"/> СЕЙЧАС</span></div><div className="hero-weather"><div className="big-icon"><WeatherIcon code={weather?.current.weather_code ?? 2} size={95}/></div><div className="temperature">{pending ? '—' : weather ? fmt(weather.current.temperature_2m) : '—'}</div><div className="conditions">{weather ? weatherDesc(weather.current.weather_code) : 'Ожидание данных'}</div><div className="feels">Ощущается как {weather ? fmt(weather.current.apparent_temperature) : '—'}</div></div><div className="hero-bottom"><span><Activity size={16}/> {weather ? 'Данные обновлены' : 'Нет данных'}</span><span>{weather?.current.time.replace('T', ' · ') ?? '—'}</span></div></section>
          <div className="stats-grid">
            <Stat icon={<Droplets size={23}/>} label="ВЛАЖНОСТЬ" value={weather ? `${weather.current.relative_humidity_2m}%` : '—'} hint="Относительная влажность"/>
            <Stat icon={<Wind size={23}/>} label="СКОРОСТЬ ВЕТРА" value={weather ? `${Math.round(weather.current.wind_speed_10m)}` : '—'} unit="км/ч" hint="На высоте 10 метров"/>
            <Stat icon={<Cloud size={23}/>} label="ОБЛАЧНОСТЬ" value={weather ? `${weather.current.cloud_cover}%` : '—'} hint="Покрытие неба"/>
            <Stat icon={<CloudRain size={23}/>} label="ОСАДКИ" value={weather ? `${weather.current.precipitation}` : '—'} unit="мм" hint="За последний интервал"/>
          </div>
        </div>
        {error && <div className="error" role="alert">{error} <button onClick={() => setRetry(v => v + 1)}>Повторить</button></div>}
        <div className="details-row"><div className="detail"><Compass size={16}/> Направление ветра <b>{weather ? `${weather.current.wind_direction_10m}°` : '—'}</b></div><div className="detail"><Sunrise size={16}/> Восход <b>{weather ? time(weather.daily.sunrise[0]) : '—'}</b></div><div className="detail"><Sunset size={16}/> Закат <b>{weather ? time(weather.daily.sunset[0]) : '—'}</b></div><div className="detail"><Thermometer size={16}/> Ощущается <b>{weather ? fmt(weather.current.apparent_temperature) : '—'}</b></div></div>
        <div className="section-head forecast-title"><div><h2>Прогноз на 5 дней</h2><span>Температура и вероятность осадков</span></div><span className="tiny-source">По данным Open-Meteo</span></div>
        <div className="forecast-grid">{Array.from({ length: 5 }, (_, index) => <div className="forecast-card" key={index}><span className="forecast-day">{index === 0 ? 'Сегодня' : weather ? new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(new Date(`${weather.daily.time[index]}T12:00:00`)) : '—'}</span><div className="forecast-icon"><WeatherIcon code={weather?.daily.weather_code[index] ?? 2} size={32}/></div><div className="forecast-temps"><b>{weather ? fmt(weather.daily.temperature_2m_max[index]) : '—'}</b><span>{weather ? fmt(weather.daily.temperature_2m_min[index]) : '—'}</span></div><div className="forecast-rain"><Droplets size={13}/>{weather ? `${weather.daily.precipitation_probability_max[index]}%` : '—'}</div></div>)}</div>
        <div className="section-head camera-title" id="cameras"><div><div className="camera-heading"><h2>Камеры города</h2><span className="live-camera-tag"><span className="pulse"/> ВЕБ-КАМЕРЫ</span></div><span>Смотрите, что происходит прямо сейчас</span></div><span className="camera-count">{cameras?.cameras.length ?? 0} камер доступно</span></div>
        <div className="cameras-layout"><section className="player-card"><div className="player-top"><span><Video size={17}/> {camera?.title ?? 'Трансляция города'}</span>{camera?.url && <a target="_blank" rel="noopener noreferrer" href={camera.url}>Открыть источник <ArrowUpRight size={15}/></a>}</div><div className="video-frame">{camera?.player ? <iframe key={camera.id} src={camera.player} title={camera.title} allow="fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy"/> : <div className="video-empty"><div className="empty-icon"><Camera size={36}/></div><strong>{cameras?.status === 'configuration_required' ? 'Подключите каталог камер' : cameras?.status === 'provider_error' ? 'Камеры временно недоступны' : 'Выберите камеру'}</strong><p>{cameras?.message ?? 'Трансляция появится здесь после выбора камеры справа.'}</p>{cameras?.status === 'configuration_required' && <a href="https://api4.windy.com/webcams" target="_blank" rel="noreferrer">Получить бесплатный ключ <ExternalLink size={14}/></a>}</div>}</div><div className="player-foot"><div><span className="player-status"/> {camera ? 'Источник: Windy Webcams' : 'Ожидание камеры'}</div><div>Просмотр доступен при поддержке провайдером</div></div></section>
        <section className="camera-list"><div className="list-top"><b>Доступные камеры</b><span>В радиусе 30 км</span></div><div className="camera-scroll">{(cameras?.cameras ?? []).length ? cameras!.cameras.map(c => <button key={c.id} className={`camera-option ${camera?.id === c.id ? 'camera-selected' : ''}`} onClick={() => setSelectedCamera(c.id)}><div className="camera-thumb">{c.preview ? <img src={c.preview} alt=""/> : <Camera size={20}/>}</div><div><strong>{c.title}</strong><small><MapPin size={12}/>{c.location}</small></div><ArrowUpRight size={15}/></button>) : <div className="camera-placeholder"><Eye size={24}/><p>{pending ? 'Поиск камер...' : cameras?.message ?? 'Камер пока нет'}</p></div>}</div><div className="list-foot">Камеры предоставлены <a href="https://www.windy.com/webcams" target="_blank" rel="noreferrer">Windy.com</a></div></section></div>
        <footer><span>© {new Date().getFullYear()} SkyWindow</span><span>Создано на React · NestJS · Open-Meteo · Windy</span></footer>
      </div>
    </main>
  </div>;
}
function Stat({ icon, label, value, unit, hint }: { icon: React.ReactNode; label: string; value: string; unit?: string; hint: string }) { return <div className="stat-card"><div className="stat-head"><span>{label}</span><div className="stat-icon">{icon}</div></div><div className="stat-value">{value} {unit && <small>{unit}</small>}</div><span className="stat-hint">{hint}</span></div>; }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
