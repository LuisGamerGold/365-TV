window.PromoBarModule = (function () {
  const bar = document.getElementById('promo-bar');
  const textEl = document.getElementById('promo-text');
  let promo = null;

  function isWithinWindow(p) {
    const now = Date.now();
    if (p.startAt && now < new Date(p.startAt).getTime()) return false;
    if (p.endAt && now > new Date(p.endAt).getTime()) return false;
    return true;
  }

  function render() {
    if (!promo || !promo.active || !promo.text || !isWithinWindow(promo)) {
      bar.style.display = 'none';
      return;
    }
    textEl.textContent = promo.text;
    bar.classList.toggle('animate-slide', promo.animation === 'slide');
    bar.classList.toggle('pos-top', promo.position === 'top');
    bar.classList.toggle('pos-bottom', promo.position !== 'top');
    bar.style.display = 'flex';
  }

  function applyState(newPromo) {
    promo = newPromo;
    render();
  }

  // reavalia a janela de data/hora periodicamente, sem depender de novo evento do servidor
  setInterval(render, 30 * 1000);

  return { applyState };
})();
