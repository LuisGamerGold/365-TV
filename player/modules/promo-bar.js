// Tarjeta inferior/superior: faixa de mensagens rolando continuamente (estilo
// "letreiro"), com um icone fixo a esquerda. E' o unico card fixo nessa
// posicao da tela - fica sempre por cima (z-index 9), tanto no video quanto
// na oferta, entao nao existe mais um segundo card de mensagem so da oferta.
window.PromoBarModule = (function () {
  const bar = document.getElementById('promo-bar');
  const track = document.getElementById('ticker-track');
  const PIXELS_PER_SECOND = 55;
  const MIN_DURATION_SECONDS = 10;

  let promo = null;
  let renderedKey = null;

  function isWithinWindow(p) {
    const now = Date.now();
    if (p.startAt && now < new Date(p.startAt).getTime()) return false;
    if (p.endAt && now > new Date(p.endAt).getTime()) return false;
    return true;
  }

  function buildGroup(messages) {
    const group = document.createElement('div');
    group.className = 'ticker-group';
    messages.forEach((message) => {
      const span = document.createElement('span');
      span.textContent = message;
      group.appendChild(span);

      const dot = document.createElement('span');
      dot.className = 'ticker-dot';
      group.appendChild(dot);
    });
    return group;
  }

  function renderTrack(messages) {
    track.innerHTML = '';
    // duplica o grupo para o loop ficar continuo (quando o primeiro sai da
    // tela, o segundo ja esta encostado nele)
    track.appendChild(buildGroup(messages));
    track.appendChild(buildGroup(messages));

    requestAnimationFrame(() => {
      const width = track.children[0].getBoundingClientRect().width;
      track.style.setProperty('--ticker-group-width', `${width}px`);
      const duration = Math.max(MIN_DURATION_SECONDS, width / PIXELS_PER_SECOND);
      track.style.animationDuration = `${duration}s`;
      // reinicia a animacao do zero para nao "pular" apos remontar o conteudo
      track.style.animationName = 'none';
      // eslint-disable-next-line no-unused-expressions
      track.offsetHeight;
      track.style.animationName = 'tickerScroll';
    });
  }

  function render() {
    const messages = promo && Array.isArray(promo.messages) ? promo.messages : [];
    if (!promo || !promo.active || messages.length === 0 || !isWithinWindow(promo)) {
      bar.style.display = 'none';
      renderedKey = null;
      return;
    }
    bar.classList.toggle('pos-top', promo.position === 'top');
    bar.classList.toggle('pos-bottom', promo.position !== 'top');
    bar.style.display = 'flex';

    // so remonta a faixa (e reinicia o loop) quando as mensagens realmente
    // mudam - essa funcao roda de novo a cada 30s so pra reavaliar a janela
    // de data/hora, e reconstruir toda hora fazia o letreiro "resetar" no
    // meio do loop em vez de rodar continuo pra frente
    const key = JSON.stringify(messages) + '|' + promo.position;
    if (key !== renderedKey) {
      renderedKey = key;
      renderTrack(messages);
    }
  }

  function applyState(newPromo) {
    promo = newPromo;
    render();
  }

  // reavalia a janela de data/hora periodicamente, sem depender de novo evento do servidor
  setInterval(render, 30 * 1000);

  return { applyState };
})();
