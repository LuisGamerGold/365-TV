window.VideoPlayerModule = (function () {
  const videoEl = document.getElementById('video-el');
  const imageEl = document.getElementById('image-el');
  const emptyState = document.getElementById('empty-state');

  let queue = [];
  let currentIndex = 0;
  let imageTimer = null;

  function mediaUrl(item) {
    return `/media/videos/${item.filename}`;
  }

  function clearImageTimer() {
    if (imageTimer) clearTimeout(imageTimer);
    imageTimer = null;
  }

  function advance() {
    if (queue.length === 0) return;
    currentIndex = (currentIndex + 1) % queue.length;
    loadCurrent();
  }

  function loadCurrent() {
    clearImageTimer();
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.style.display = 'none';
    imageEl.style.display = 'none';

    if (queue.length === 0) {
      emptyState.style.display = '';
      return;
    }
    emptyState.style.display = 'none';

    const item = queue[currentIndex];
    if (item.type === 'image') {
      imageEl.src = mediaUrl(item);
      imageEl.style.display = '';
      imageTimer = setTimeout(advance, (item.durationSeconds || 10) * 1000);
    } else {
      videoEl.src = mediaUrl(item);
      videoEl.loop = Boolean(item.loop);
      videoEl.style.display = '';
      videoEl.play().catch(() => {});
    }
  }

  videoEl.addEventListener('ended', () => {
    if (!videoEl.loop) advance();
  });

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
