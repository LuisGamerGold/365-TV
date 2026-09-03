window.WeatherModule = (function () {
  const cityEl = document.getElementById('weather-city');
  const tempEl = document.getElementById('weather-temp');
  const descEl = document.getElementById('weather-desc');
  const CACHE_KEY = '365tv-weather-cache';
  let config = { enabled: true, city: '', apiKey: '' };
  let timer = null;

  function render(data) {
    if (!data) {
      cityEl.textContent = '';
      tempEl.textContent = '';
      descEl.textContent = '';
      return;
    }
    cityEl.textContent = data.city;
    tempEl.textContent = `${Math.round(data.temp)}°C`;
    descEl.textContent = data.description || '';
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

  async function fetchWeather() {
    if (!config.enabled || !config.city || !config.apiKey) return;
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        config.city
      )}&units=metric&lang=pt_br&appid=${config.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('resposta invalida');
      const json = await res.json();
      const data = {
        temp: json.main.temp,
        city: json.name,
        description: json.weather?.[0]?.description || ''
      };
      writeCache(data);
      render(data);
    } catch (err) {
      // sem internet ou erro na API: mantem o ultimo valor conhecido em cache
      render(readCache());
    }
  }

  function applyConfig(newConfig) {
    config = { ...config, ...newConfig };
    if (!config.enabled) return;
    render(readCache());
    fetchWeather();
    if (timer) clearInterval(timer);
    timer = setInterval(fetchWeather, 10 * 60 * 1000);
  }

  return { applyConfig };
})();
