window.MusicWidgetModule = (function () {
  const el = document.getElementById('music-widget');
  let enabled = true;
  let position = 'bottom-right';
  let lastTrack = null;

  function render() {
    if (!enabled || !lastTrack) {
      el.style.display = 'none';
      return;
    }
    el.textContent = `🎵 ${lastTrack.title} — ${lastTrack.artist}`;
    setAnchorPosition(el, position);
    el.style.display = 'block';
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
