// Pilula unica no topo que alterna entre o relogio/data e o clima, no
// mesmo lugar da tela. Se so um dos dois estiver ativo, fica fixo nele
// (sem alternar); se os dois estiverem ativos, alterna a cada cycleSeconds.
window.InfoPillModule = (function () {
  const pill = document.getElementById('info-pill');
  const clockFace = document.getElementById('clock-cluster');
  const weatherFace = document.getElementById('weather');

  let timer = null;
  let activeFace = 'clock';

  function showFace(face) {
    activeFace = face;
    clockFace.classList.toggle('active', face === 'clock');
    weatherFace.classList.toggle('active', face === 'weather');
  }

  function applyConfig(config) {
    const { position, cycleSeconds, clockEnabled, weatherEnabled } = config || {};

    clearInterval(timer);
    timer = null;

    if (!clockEnabled && !weatherEnabled) {
      pill.style.display = 'none';
      return;
    }

    pill.style.display = '';
    setAnchorPosition(pill, position);

    if (clockEnabled && weatherEnabled) {
      showFace(activeFace);
      const secs = Math.max(3, Number(cycleSeconds) || 8);
      timer = setInterval(() => showFace(activeFace === 'clock' ? 'weather' : 'clock'), secs * 1000);
    } else {
      showFace(clockEnabled ? 'clock' : 'weather');
    }
  }

  return { applyConfig };
})();
