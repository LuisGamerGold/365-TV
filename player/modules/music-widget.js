window.MusicWidgetModule = (function () {
  const el = document.getElementById('music-widget');
  const coverEl = document.getElementById('music-cover');
  const placeholderEl = document.getElementById('music-placeholder');
  const marqueeEl = document.getElementById('music-marquee');
  const trackEl = document.getElementById('music-track');
  const titleEl = document.getElementById('music-title');

  let enabled = true;
  let position = 'bottom-right';
  let lastTrack = null;

  function renderMarquee() {
    // rAF duplo: garante que o "display:flex" (e o layout resultante) ja'
    // foi pintado antes de medir scrollWidth/clientWidth - um unico rAF as
    // vezes roda antes do primeiro paint depois de uma mudanca de display.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const overflow = Math.max(0, titleEl.scrollWidth - marqueeEl.clientWidth + 6);

        trackEl.style.transform = '';

        if (overflow > 4) {
          trackEl.style.setProperty('--music-shift', `${-overflow}px`);
          trackEl.style.setProperty('--music-duration', `${Math.max(6, overflow / 20)}s`);
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
      return;
    }

    titleEl.textContent = [lastTrack.artist, lastTrack.title].filter(Boolean).join(' — ');

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
    renderMarquee();
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
