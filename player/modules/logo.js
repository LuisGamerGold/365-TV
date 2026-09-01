window.LogoModule = (function () {
  const el = document.getElementById('logo');
  const SIZES = ['small', 'medium', 'large'];

  function applyConfig(config) {
    el.style.display = config.enabled ? '' : 'none';
    el.style.opacity = config.opacity ?? 1;
    setAnchorPosition(el, config.position);
    SIZES.forEach((s) => el.classList.remove(`size-${s}`));
    el.classList.add(`size-${SIZES.includes(config.size) ? config.size : 'medium'}`);
  }

  return { applyConfig };
})();
