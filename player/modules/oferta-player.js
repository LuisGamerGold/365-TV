window.OfertaPlayerModule = (function () {
  const area = document.getElementById('oferta-area');
  const hero = document.getElementById('oferta-hero');
  const dots = document.getElementById('oferta-dots');
  const modelEl = document.getElementById('oferta-model');
  const yearEl = document.getElementById('oferta-year');
  const kmEl = document.getElementById('oferta-km');
  const priceEl = document.getElementById('oferta-price');
  const financingEl = document.getElementById('oferta-financing');
  const qrEl = document.getElementById('oferta-qr');
  const qrRowEl = document.getElementById('oferta-qr-row');
  const panelEl = document.getElementById('oferta-panel');

  let config = { enabled: false, chance: 0, secondsPerPhoto: 5, items: [] };
  let photoTimer = null;

  function applyState(oferta) {
    if (oferta) config = oferta;
  }

  function activeItems() {
    return (config.items || []).filter((item) => item.active && item.photos && item.photos.length > 0);
  }

  function shouldTrigger() {
    if (!config.enabled) return false;
    if (activeItems().length === 0) return false;
    return Math.random() < (config.chance || 0);
  }

  // Tenta exibir uma oferta entre um video e outro; se exibir, o proximo
  // item da playlist so carrega quando a oferta terminar (via onDone).
  function maybeShow(onDone) {
    if (!shouldTrigger()) return false;
    play(onDone);
    return true;
  }

  function formatKm(km) {
    return km ? `${Number(km).toLocaleString('pt-BR')} Km` : '';
  }

  function formatPrice(price) {
    return price ? `R$ ${Number(price).toLocaleString('pt-BR')}` : '';
  }

  function photoUrl(item, filename) {
    return `/media/oferta/${item.id}/${filename}`;
  }

  function play(onDone) {
    const items = activeItems();
    const item = items[Math.floor(Math.random() * items.length)];

    modelEl.textContent = item.model || '';
    yearEl.textContent = item.year ? `Ano ${item.year}` : '';
    kmEl.textContent = formatKm(item.km);
    priceEl.textContent = formatPrice(item.price);
    financingEl.textContent = item.financingNote || '';

    if (item.qrFilename) {
      qrEl.src = photoUrl(item, item.qrFilename);
      qrRowEl.style.display = '';
      panelEl.classList.remove('no-qr');
    } else {
      qrRowEl.style.display = 'none';
      panelEl.classList.add('no-qr');
    }

    // Uma <img> por foto, empilhadas dentro de .hero: trocar de foto so
    // alterna a classe "active" (opacity via CSS), gerando o crossfade da
    // referencia em vez de um corte seco trocando o src de uma unica <img>.
    hero.innerHTML = '';
    dots.innerHTML = '';
    item.photos.forEach((filename, i) => {
      const img = document.createElement('img');
      img.src = photoUrl(item, filename);
      img.alt = `Foto da moto ${i + 1}`;
      hero.appendChild(img);

      const dot = document.createElement('span');
      dots.appendChild(dot);
    });

    let photoIndex = 0;
    const showPhoto = () => {
      Array.from(hero.children).forEach((img, i) => img.classList.toggle('active', i === photoIndex));
      Array.from(dots.children).forEach((dot, i) => dot.classList.toggle('active', i === photoIndex));
    };
    showPhoto();

    area.classList.add('active');

    const secs = Math.max(2, Number(config.secondsPerPhoto) || 5);
    let shownCount = 1;
    clearInterval(photoTimer);
    photoTimer = setInterval(() => {
      photoIndex = (photoIndex + 1) % item.photos.length;
      showPhoto();
      shownCount += 1;
      if (shownCount > item.photos.length) {
        finish(onDone);
      }
    }, secs * 1000);
  }

  function finish(onDone) {
    clearInterval(photoTimer);
    photoTimer = null;
    area.classList.remove('active');
    if (onDone) onDone();
  }

  return { applyState, maybeShow };
})();
