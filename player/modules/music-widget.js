window.MusicWidgetModule = (function () {
  const el = document.getElementById('music-widget');
  const coverEl = document.getElementById('music-cover');
  const placeholderEl = document.getElementById('music-placeholder');
  const marqueeEl = document.getElementById('music-marquee');
  const trackEl = document.getElementById('music-track');

  let enabled = true;
  let position = 'bottom-right';
  let lastTrack = null;
  let lastRenderedText = null;

  function buildTitle(text) {
    const span = document.createElement('span');
    span.className = 'music-title';
    span.textContent = text;
    return span;
  }

  function buildSeparator() {
    // ponto (sem texto) igual ao separador da tarjeta de promocao
    // (.ticker-dot), pra manter o mesmo estilo visual entre os dois letreiros
    const span = document.createElement('span');
    span.className = 'music-dot';
    return span;
  }

  function renderMarquee(text) {
    trackEl.innerHTML = '';
    trackEl.appendChild(buildTitle(text));

    // rAF duplo: garante que o "display:flex" (e o layout resultante) ja'
    // foi pintado antes de medir scrollWidth/clientWidth - um unico rAF as
    // vezes roda antes do primeiro paint depois de uma mudanca de display.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const single = trackEl.children[0];
        const overflow = single.scrollWidth - marqueeEl.clientWidth;

        if (overflow > 4) {
          // repete "titulo + separador" como uma unidade (igual aos pontos
          // da tarjeta de promocao, so' que com travessao): quando a 1a
          // unidade sai da tela pela esquerda, a 2a (identica) ja esta
          // encostada nela, entao le-se "titulo — titulo — titulo — ..." em
          // loop continuo, sem vao mudo nem reset visivel. O deslocamento
          // tem que ser exatamente a largura de UMA unidade (titulo+
          // separador) pra 2a unidade encostar onde a 1a comecou.
          trackEl.appendChild(buildSeparator());
          const unitWidth = trackEl.scrollWidth;
          trackEl.appendChild(buildTitle(text));
          trackEl.appendChild(buildSeparator());
          trackEl.style.setProperty('--music-shift', `${-unitWidth}px`);
          trackEl.style.setProperty('--music-duration', `${Math.max(6, unitWidth / 20)}s`);
        } else {
          trackEl.style.setProperty('--music-shift', '0px');
        }

        // Forca a animacao a reiniciar do zero: trocar so o valor de
        // --music-shift as vezes nao e' suficiente porque o navegador pode
        // ja ter "congelado" os valores da animacao anterior. Tirar e por
        // de volta o animation-name (com um reflow no meio) faz ela
        // recalcular os keyframes com os valores novos.
        trackEl.style.animationName = 'none';
        // eslint-disable-next-line no-unused-expressions
        trackEl.offsetHeight;
        trackEl.style.animationName = 'musicMove';
        trackEl.style.animationPlayState = overflow > 4 ? 'running' : 'paused';
      });
    });
  }

  function render() {
    if (!enabled || !lastTrack) {
      el.style.display = 'none';
      lastRenderedText = null;
      return;
    }

    const text = [lastTrack.artist, lastTrack.title].filter(Boolean).join(' — ');

    if (lastTrack.albumArt) {
      coverEl.src = lastTrack.albumArt;
      coverEl.style.display = 'block';
      placeholderEl.style.display = 'none';
    } else {
      coverEl.removeAttribute('src');
      coverEl.style.display = 'none';
      placeholderEl.style.display = '';
    }

    setAnchorPosition(el, position);
    el.style.display = 'flex';

    // so remonta a faixa (e reinicia o loop) quando a musica realmente
    // mudou - o servidor reemite "now playing" a cada poll (10s) mesmo
    // tocando a mesma faixa, e reconstruir toda hora fazia o letreiro
    // "resetar" no meio do loop em vez de rodar continuo pra frente
    if (text !== lastRenderedText) {
      lastRenderedText = text;
      renderMarquee(text);
    }
  }

  function applyConfig(config) {
    enabled = config.enabled;
    if (config.position) position = config.position;
    render();
  }

  function applyNowPlaying(track) {
    lastTrack = track;
    render();
  }

  return { applyConfig, applyNowPlaying };
})();
