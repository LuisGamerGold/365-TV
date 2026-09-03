// Tela cheia de previsao do tempo: exibida aleatoriamente entre um video e
// outro (mesmo mecanismo de player/modules/oferta-player.js). Busca dados
// reais na OpenWeatherMap (mesma cidade/API key da pilula de clima) e
// mantem um cache local para exibir instantaneamente quando chamada.
window.WeatherScreenModule = (function () {
  const area = document.getElementById('wx-area');
  const screenEl = document.getElementById('screen');
  const subtitleEl = document.getElementById('wx-subtitle');
  const labelEl = document.getElementById('wx-today-label');
  const dateEl = document.getElementById('wx-today-date');
  const iconEl = document.getElementById('wx-today-icon');
  const conditionEl = document.getElementById('wx-today-condition');
  const maxEl = document.getElementById('wx-today-max');
  const minEl = document.getElementById('wx-today-min');
  const rainEl = document.getElementById('wx-today-rain');
  const humidityEl = document.getElementById('wx-today-humidity');
  const windEl = document.getElementById('wx-today-wind');
  const sunriseEl = document.getElementById('wx-today-sunrise');
  const sunsetEl = document.getElementById('wx-today-sunset');
  const hourlyEl = document.getElementById('wx-hourly');
  const tomorrowEl = document.getElementById('wx-tomorrow-card');
  const afterEl = document.getElementById('wx-after-card');

  const CACHE_KEY = '365tv-weather-screen-cache';
  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const ICON_SYMBOL = { rain: 'wx-icon-rain', cloud: 'wx-icon-cloud', partly: 'wx-icon-partly', sun: 'wx-icon-sun' };
  const EMPTY_DAY = { title: '', date: '', condition: '', icon: 'cloud', max: '', min: '', rain: '', sunrise: '', sunset: '' };

  let weatherConfig = { city: '', apiKey: '' };
  let screenConfig = { enabled: false, chance: 0.2, durationSeconds: 25 };
  let cachedData = null;
  let fetchTimer = null;
  let screenTimer = null;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function dateKey(d) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  function dateLabel(d) {
    return `${DAYS[d.getUTCDay()]} ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
  }

  function iconSvg(type, cls) {
    return `<svg class="${cls || ''}"><use href="#${ICON_SYMBOL[type] || ICON_SYMBOL.cloud}"/></svg>`;
  }

  function iconTypeFromOwm(icon) {
    const code = (icon || '').slice(0, 2);
    if (code === '01') return 'sun';
    if (code === '02') return 'partly';
    if (code === '03' || code === '04' || code === '50') return 'cloud';
    if (code === '09' || code === '10' || code === '11' || code === '13') return 'rain';
    return 'cloud';
  }

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY));
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  }

  function groupByDate(list, tzOffset) {
    const groups = {};
    list.forEach((entry) => {
      const d = new Date((entry.dt + tzOffset) * 1000);
      const key = dateKey(d);
      (groups[key] = groups[key] || []).push(entry);
    });
    return groups;
  }

  function buildState(current, forecast) {
    const tz = current.timezone || 0;
    const toLocal = (unixSec) => new Date((unixSec + tz) * 1000);
    const timeStr = (unixSec) => `${pad(toLocal(unixSec).getUTCHours())}:${pad(toLocal(unixSec).getUTCMinutes())}`;

    const todayKey = dateKey(toLocal(current.dt));
    const todaysBlocks = (forecast.list || []).filter((e) => dateKey(toLocal(e.dt)) === todayKey);
    const todayPop = todaysBlocks.reduce((max, e) => Math.max(max, e.pop || 0), 0);

    const today = {
      label: 'Hoje',
      date: dateLabel(toLocal(current.dt)),
      condition: capitalize(current.weather?.[0]?.description || ''),
      icon: iconTypeFromOwm(current.weather?.[0]?.icon),
      max: `${Math.round(current.main.temp_max)}°C`,
      min: `${Math.round(current.main.temp_min)}°C`,
      rain: `${Math.round(todayPop * 100)}%`,
      humidity: `${Math.round(current.main.humidity)}%`,
      wind: `${Math.round((current.wind?.speed || 0) * 3.6)}km/h`,
      sunrise: timeStr(current.sys.sunrise),
      sunset: timeStr(current.sys.sunset)
    };

    const hourly = (forecast.list || []).slice(0, 4).map((h) => ({
      time: `${pad(toLocal(h.dt).getUTCHours())}h`,
      temp: `${Math.round(h.main.temp)}°C`,
      icon: iconTypeFromOwm(h.weather?.[0]?.icon)
    }));

    const groups = groupByDate(forecast.list || [], tz);
    const futureKeys = Object.keys(groups).filter((k) => k !== todayKey).sort().slice(0, 2);

    const forecastDays = futureKeys.map((key, i) => {
      const entries = groups[key];
      const temps = entries.map((e) => e.main.temp);
      const pop = entries.reduce((max, e) => Math.max(max, e.pop || 0), 0);
      const mid = entries[Math.min(Math.floor(entries.length / 2), entries.length - 1)];
      const d = new Date(`${key}T00:00:00Z`);
      return {
        title: i === 0 ? 'Amanhã' : dateLabel(d),
        date: i === 0 ? dateLabel(d) : '',
        condition: capitalize(mid.weather?.[0]?.description || ''),
        icon: iconTypeFromOwm(mid.weather?.[0]?.icon),
        max: `${Math.round(Math.max(...temps))}°C`,
        min: `${Math.round(Math.min(...temps))}°C`,
        rain: `${Math.round(pop * 100)}%`,
        // OWM free tier nao da nascer/por do sol por dia futuro: reaproveita o de hoje.
        sunrise: today.sunrise,
        sunset: today.sunset
      };
    });

    return {
      location: current.name || weatherConfig.city,
      updated: 'Atualizado agora há pouco',
      today,
      hourly,
      forecast: forecastDays
    };
  }

  async function fetchForecast() {
    if (!weatherConfig.city || !weatherConfig.apiKey) return;
    try {
      const q = encodeURIComponent(weatherConfig.city);
      const base = `units=metric&lang=pt_br&appid=${weatherConfig.apiKey}`;
      const [curRes, fcRes] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?q=${q}&${base}`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${q}&${base}`)
      ]);
      if (!curRes.ok || !fcRes.ok) throw new Error('resposta invalida');
      const current = await curRes.json();
      const forecast = await fcRes.json();
      const data = buildState(current, forecast);
      writeCache(data);
      cachedData = data;
    } catch (err) {
      // sem internet ou erro na API: mantem o ultimo valor conhecido em cache
      if (!cachedData) cachedData = readCache();
    }
  }

  function renderToday() {
    const d = cachedData.today;
    subtitleEl.textContent = `${cachedData.location} - ${cachedData.updated}`;
    labelEl.textContent = d.label;
    dateEl.textContent = d.date;
    conditionEl.textContent = d.condition;
    iconEl.innerHTML = `<use href="#${ICON_SYMBOL[d.icon] || ICON_SYMBOL.cloud}"/>`;
    maxEl.textContent = d.max;
    minEl.textContent = d.min;
    rainEl.textContent = d.rain;
    humidityEl.textContent = d.humidity;
    windEl.textContent = d.wind;
    sunriseEl.textContent = d.sunrise;
    sunsetEl.textContent = d.sunset;
  }

  function renderHourly() {
    hourlyEl.innerHTML = cachedData.hourly
      .map((h) => `<div class="wx-hour"><div class="wx-hour-time">${h.time}</div>${iconSvg(h.icon)}<div class="wx-hour-temp">${h.temp}</div></div>`)
      .join('');
  }

  function dayCard(d) {
    return `<div class="wx-next-title">${d.title}</div><div class="wx-next-date">${d.date || '&nbsp;'}</div>` +
      `<div class="wx-next-icon-wrap">${iconSvg(d.icon)}</div><div class="wx-small-separator"></div>` +
      `<div class="wx-next-condition">${d.condition}</div><div class="wx-next-temps">` +
      `<div class="wx-small-temp"><svg class="wx-thermo-icon"><use href="#wx-icon-thermo-red"/></svg><div><div class="wx-temp-label">Máx</div><div class="wx-temp-value">${d.max}</div></div></div>` +
      `<div class="wx-small-temp"><svg class="wx-thermo-icon"><use href="#wx-icon-thermo-blue"/></svg><div><div class="wx-temp-label">Min</div><div class="wx-temp-value">${d.min}</div></div></div>` +
      `</div><div class="wx-next-rain">${iconSvg('rain')}<div><div class="wx-next-rain-label">Chuva</div><div class="wx-next-rain-value">${d.rain}</div></div></div>` +
      `<div class="wx-next-sun"><div class="wx-sun-item"><svg><use href="#wx-icon-sunrise"/></svg><div class="wx-sun-time">${d.sunrise}</div></div>` +
      `<div class="wx-sun-item"><svg><use href="#wx-icon-sunset"/></svg><div class="wx-sun-time">${d.sunset}</div></div></div>`;
  }

  function renderForecast() {
    tomorrowEl.innerHTML = dayCard(cachedData.forecast[0] || EMPTY_DAY);
    afterEl.innerHTML = dayCard(cachedData.forecast[1] || EMPTY_DAY);
  }

  function render() {
    if (!cachedData) return;
    renderToday();
    renderHourly();
    renderForecast();
  }

  function finish(onDone) {
    clearTimeout(screenTimer);
    screenTimer = null;
    area.classList.remove('active');
    screenEl.classList.remove('wx-active');
    if (onDone) onDone();
  }

  function play(onDone) {
    render();
    area.classList.add('active');
    screenEl.classList.add('wx-active');
    const secs = Math.max(5, Number(screenConfig.durationSeconds) || 25);
    clearTimeout(screenTimer);
    screenTimer = setTimeout(() => finish(onDone), secs * 1000);
  }

  function shouldTrigger() {
    if (!screenConfig.enabled) return false;
    if (!cachedData) return false;
    return Math.random() < (screenConfig.chance || 0);
  }

  // Tenta exibir a previsao entre um video e outro; se exibir, o proximo
  // item da playlist so carrega quando a tela terminar (via onDone).
  function maybeShow(onDone) {
    if (!shouldTrigger()) return false;
    play(onDone);
    return true;
  }

  function applyState(newConfig) {
    if (newConfig) screenConfig = newConfig;
  }

  function applyWeatherConfig(newWeatherConfig) {
    const city = newWeatherConfig?.city || '';
    const apiKey = newWeatherConfig?.apiKey || '';
    const changed = city !== weatherConfig.city || apiKey !== weatherConfig.apiKey;
    weatherConfig = { city, apiKey };

    if (!cachedData) cachedData = readCache();
    if (!weatherConfig.city || !weatherConfig.apiKey) return;

    if (changed) fetchForecast();
    if (!fetchTimer) fetchTimer = setInterval(fetchForecast, 15 * 60 * 1000);
  }

  return { applyState, applyWeatherConfig, maybeShow };
})();
