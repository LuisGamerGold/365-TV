// Tarjeta inferior/superior: faixa de mensagens rolando continuamente (estilo
// "letreiro"), com um icone fixo a esquerda. E' o unico card fixo nessa
// posicao da tela - fica sempre por cima (z-index 9), tanto no video quanto
// na oferta, entao nao existe mais um segundo card de mensagem so da oferta.
window.PromoBarModule = (function () {
  const bar = document.getElementById('promo-bar');
  const track = document.getElementById('ticker-track');
  const windowEl = document.querySelector('.ticker-window');
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
    track.appendChild(buildGroup(messages));

    // rAF duplo: garante que o "display:none -> flex" da tarjeta (feito no
    // render() logo antes desta chamada) ja' foi pintado antes de medir a
    // largura - um unico rAF as vezes roda antes do primeiro paint depois de
    // uma mudanca de display, o que mediria a largura errada e faria a 2a
    // copia do texto nao encostar certinho onde a 1a comecou. Mesma tecnica
    // do music-widget.js (endurecimento preventivo - nao reproduzi o gap com
    // rAF unico em teste headless ocioso, mas o cenario real tem o video
    // decodificando ao mesmo tempo, competindo pela main thread).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const width = track.children[0].getBoundingClientRect().width;

        // duplica o grupo pra o loop ficar continuo (quando o 1o sai da tela,
        // o 2o ja esta encostado nele) - mas com mensagens curtas, 2 copias
        // as vezes nao enchem a janela visivel da tarjeta (ex: mensagem de
        // 345px numa janela de 1020px = so' 690px de conteudo), deixando um
        // vao vazio depois da 2a copia antes do loop reiniciar. Repete o
        // quanto for preciso pra cobrir a janela inteira + 1 grupo de folga.
        const repeatCount = Math.max(2, Math.ceil(windowEl.clientWidth / width) + 1);
        for (let i = 1; i < repeatCount; i++) {
          track.appendChild(buildGroup(messages));
        }

        track.style.setProperty('--ticker-group-width', `${width}px`);
        const duration = Math.max(MIN_DURATION_SECONDS, width / PIXELS_PER_SECOND);
        track.style.animationDuration = `${duration}s`;
        // reinicia a animacao do zero para nao "pular" apos remontar o conteudo
        track.style.animationName = 'none';
        // eslint-disable-next-line no-unused-expressions
        track.offsetHeight;
        track.style.animationName = 'tickerScroll';
      });
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
