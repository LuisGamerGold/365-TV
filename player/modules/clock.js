window.ClockModule = (function () {
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');

  const DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  let config = { enabled: true, format: '24h' };

  function tick() {
    if (!config.enabled) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');

    if (config.format === '12h') {
      const suffix = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      clockEl.textContent = `${hours}:${minutes} ${suffix}`;
    } else {
      clockEl.textContent = `${String(hours).padStart(2, '0')}:${minutes}`;
    }

    dateEl.textContent = `${DAYS[now.getDay()]} • ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  }

  function applyConfig(newConfig) {
    config = { ...config, ...newConfig };
    tick();
  }

  function start() {
    tick();
    setInterval(tick, 1000);
  }

  return { start, applyConfig };
})();
