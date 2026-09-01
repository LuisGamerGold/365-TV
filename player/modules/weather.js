window.WeatherModule = (function () {
  const el = document.getElementById('weather');
  const CACHE_KEY = '365tv-weather-cache';
  let config = { enabled: true, city: '', apiKey: '', position: 'top-right' };
  let timer = null;

  function render(data) {
    if (!data) {
      el.textContent = '';
      return;
    }
    el.textContent = `${Math.round(data.temp)}°C • ${data.city}`;
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
      const data = { temp: json.main.temp, city: json.name };
      writeCache(data);
      render(data);
    } catch (err) {
      // sem internet ou erro na API: mantem o ultimo valor conhecido em cache
      render(readCache());
    }
  }

  function applyConfig(newConfig) {
    config = { ...config, ...newConfig };
    el.style.display = config.enabled ? '' : 'none';
    setAnchorPosition(el, config.position);
    if (!config.enabled) return;
    render(readCache());
    fetchWeather();
    if (timer) clearInterval(timer);
    timer = setInterval(fetchWeather, 10 * 60 * 1000);
  }

  return { applyConfig };
})();
