// Dois elementos <video> alternados (double buffer): enquanto um esta' em
// tela, o outro fica "de folga" e e' usado pra pre-carregar o proximo item
// da playlist em segundo plano, assim que o video atual comeca a tocar. Na
// hora de trocar, se o proximo ja' estiver pronto (evento "canplay"), a troca
// e' instantanea; senao, espera ficar pronto antes de exibir - em nenhum dos
// dois casos a tela fica preta, porque o video antigo so' e' escondido depois
// que o novo ja' tem o primeiro frame decodificado.
window.VideoPlayerModule = (function () {
  const videoEls = [document.getElementById('video-el'), document.getElementById('video-el-2')];
  const imageEl = document.getElementById('image-el');
  const emptyState = document.getElementById('empty-state');

  const READY_FALLBACK_MS = 4000;
  const STALL_CHECK_MS = 3000;
  const STALL_TIMEOUT_MS = 8000;

  let queue = [];
  let currentIndex = 0;
  let imageTimer = null;
  let activeVideo = 0;
  let consecutiveErrors = 0;
  let stallWatch = { time: -1, since: Date.now() };

  function mediaUrl(item) {
    return `/media/videos/${item.filename}`;
  }

  function clearImageTimer() {
    if (imageTimer) clearTimeout(imageTimer);
    imageTimer = null;
  }

  function resetVideo(el) {
    el.pause();
    el.removeAttribute('src');
    el.load();
    el.style.display = 'none';
    delete el.dataset.preloadedSrc;
  }

  function idleEl() {
    return videoEls[1 - activeVideo];
  }

  function showImage(item) {
    videoEls.forEach(resetVideo);
    imageEl.src = mediaUrl(item);
    imageEl.style.display = '';
    imageTimer = setTimeout(advance, (item.durationSeconds || 10) * 1000);
  }

  // Revela um video que ja' esta' pronto (canplay ja' disparou ou o
  // fallback expirou): esconde o antigo so' agora, sem gerar frame preto.
  function revealVideo(el, item) {
    consecutiveErrors = 0;
    imageEl.style.display = 'none';
    emptyState.style.display = 'none';
    resetVideo(videoEls[1 - videoEls.indexOf(el)]);
    el.loop = Boolean(item.loop);
    el.style.display = '';
    el.play().catch(() => {});
    activeVideo = videoEls.indexOf(el);
    preloadNext();
  }

  function loadVideoInto(el, item, onReady) {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('canplay', finish);
      el.removeEventListener('error', onError);
      clearTimeout(fallback);
      onReady();
    };
    const onError = () => {
      // arquivo corrompido/ilegivel: nao trava a playlist, pula pro proximo
      if (done) return;
      done = true;
      el.removeEventListener('canplay', finish);
      el.removeEventListener('error', onError);
      clearTimeout(fallback);
      consecutiveErrors += 1;
      if (consecutiveErrors >= queue.length) {
        // nenhum item da playlist atual carregou: em vez de deixar a onda
        // presa cobrindo a tela pra sempre, descobre, mostra o aviso de
        // playlist vazia e tenta de novo depois de um tempo
        consecutiveErrors = 0;
        window.TransitionModule.reveal();
        emptyState.style.display = '';
        setTimeout(advance, 5000);
        return;
      }
      advance();
    };
    el.addEventListener('canplay', finish, { once: true });
    el.addEventListener('error', onError, { once: true });
    // se "canplay" nunca disparar (video muito grande/lento), exibe mesmo
    // assim apos um tempo em vez de deixar a tela presa no video anterior
    const fallback = setTimeout(finish, READY_FALLBACK_MS);
    delete el.dataset.preloadedSrc;
    el.loop = Boolean(item.loop);
    el.src = mediaUrl(item);
    el.load();
  }

  function advance() {
    if (queue.length === 0) return;
    currentIndex = (currentIndex + 1) % queue.length;
    if (window.OfertaPlayerModule && window.OfertaPlayerModule.maybeShow(loadCurrent)) return;
    if (window.WeatherScreenModule && window.WeatherScreenModule.maybeShow(loadCurrent)) return;
    loadCurrent();
  }

  function loadCurrent() {
    clearImageTimer();

    if (queue.length === 0) {
      videoEls.forEach(resetVideo);
      imageEl.style.display = 'none';
      emptyState.style.display = '';
      return;
    }

    const item = queue[currentIndex];
    if (item.type === 'image') {
      window.TransitionModule.play(() => showImage(item));
      return;
    }

    // A onda so' revela o novo video depois que ele ja' esta pronto: se ja'
    // foi pre-carregado, a troca acontece assim que a tela fica coberta; se
    // nao, a onda fica cobrindo ate' o video terminar de carregar.
    const target = idleEl();
    if (target.dataset.preloadedSrc === mediaUrl(item)) {
      window.TransitionModule.play(() => revealVideo(target, item));
    } else {
      window.TransitionModule.cover(() => {
        loadVideoInto(target, item, () => {
          revealVideo(target, item);
          window.TransitionModule.reveal();
        });
      });
    }
  }

  // Assim que um video entra em tela, ja' comeca a carregar o proximo item
  // (se for video) no elemento ocioso, pra troca seguinte ser instantanea.
  function preloadNext() {
    if (queue.length < 2) return;
    const nextItem = queue[(currentIndex + 1) % queue.length];
    if (!nextItem || nextItem.type === 'image') return;
    const target = idleEl();
    const url = mediaUrl(nextItem);
    if (target.dataset.preloadedSrc === url) return;
    target.dataset.preloadedSrc = url;
    target.loop = Boolean(nextItem.loop);
    target.src = url;
    target.load();
  }

  videoEls.forEach((el) => {
    el.addEventListener('ended', () => {
      if (videoEls.indexOf(el) === activeVideo && !el.loop) advance();
    });
  });

  function overlayActive() {
    const oferta = document.getElementById('oferta-area');
    const wx = document.getElementById('wx-area');
    return Boolean((oferta && oferta.classList.contains('active')) || (wx && wx.classList.contains('active')));
  }

  // Se o video em tela travar (decoder engasgado, arquivo com problema no
  // meio, etc.) o "ended" nunca dispara e a playlist inteira fica presa -
  // oferta e tela de clima tambem param, ja que so' entram entre um video e
  // outro. Aqui a gente detecta a falta de progresso e forca o avanco.
  setInterval(() => {
    if (queue.length === 0 || overlayActive()) return;
    const item = queue[currentIndex];
    if (!item || item.type !== 'video') return;

    const el = videoEls[activeVideo];
    if (el.style.display === 'none' || el.paused || el.ended) {
      stallWatch = { time: el.currentTime, since: Date.now() };
      return;
    }

    if (el.currentTime !== stallWatch.time) {
      stallWatch = { time: el.currentTime, since: Date.now() };
      return;
    }

    if (Date.now() - stallWatch.since >= STALL_TIMEOUT_MS) {
      stallWatch = { time: el.currentTime, since: Date.now() };
      advance();
    }
  }, STALL_CHECK_MS);

  function applyPlaylist(videosState) {
    const currentId = queue[currentIndex] && queue[currentIndex].id;

    queue = (videosState.playlist || []).filter((item) => item.active);

    if (queue.length === 0) {
      loadCurrent();
      return;
    }

    const keepIndex = queue.findIndex((item) => item.id === currentId);
    if (keepIndex >= 0) {
      currentIndex = keepIndex;
      // mesma midia atual: nao reinicia a reproducao
      return;
    }

    currentIndex = 0;
    loadCurrent();
  }

  return { applyPlaylist };
})();
