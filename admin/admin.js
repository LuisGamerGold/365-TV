async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (res.status === 401) {
    window.location.href = '/admin/login.html';
    throw new Error('nao autenticado');
  }
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---------- Abas ----------

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.toggle('active', pane.id === `pane-${tab}`));
  localStorage.setItem('365tv-admin-tab', tab);
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

const savedTab = localStorage.getItem('365tv-admin-tab');
if (savedTab && document.getElementById(`pane-${savedTab}`)) switchTab(savedTab);

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/admin/api/logout', { method: 'POST' });
  window.location.href = '/admin/login.html';
});

async function refreshStatus() {
  const badge = document.getElementById('status-badge');
  try {
    await fetch('/api/status');
    badge.textContent = 'TV online';
    badge.className = 'badge online';
  } catch {
    badge.textContent = 'TV offline';
    badge.className = 'badge offline';
  }
}
refreshStatus();
setInterval(refreshStatus, 15000);

// ---------- Videos ----------

function videoListItem(item) {
  const li = document.createElement('li');
  const mediaUrl = `/media/videos/${item.filename}`;
  const thumb = item.type === 'image'
    ? `<img class="thumb-small" src="${mediaUrl}" alt="${item.title}" />`
    : `<video class="thumb-small" src="${mediaUrl}" muted preload="metadata"></video>`;
  const fullPreview = item.type === 'image'
    ? `<img class="video-preview" src="${mediaUrl}" alt="${item.title}" />`
    : `<video class="video-preview" src="${mediaUrl}" controls preload="metadata"></video>`;

  li.innerHTML = `
    <div class="video-item-controls">
      ${thumb}
      <span class="title">${item.title} ${item.type === 'image' ? `(${item.durationSeconds}s)` : ''}</span>
      <label><input type="checkbox" ${item.active ? 'checked' : ''} data-action="active" /> ativo</label>
      ${item.type === 'video' ? `<label><input type="checkbox" ${item.loop ? 'checked' : ''} data-action="loop" /> repetir</label>` : ''}
      <button type="button" data-action="view">Visualizar</button>
      <button data-action="up">↑</button>
      <button data-action="down">↓</button>
      <button data-action="delete" class="danger">Excluir</button>
    </div>
    <div class="expand-section" hidden></div>
  `;

  const expandSection = li.querySelector('.expand-section');
  li.querySelector('[data-action="view"]').addEventListener('click', (e) => {
    expandSection.hidden = !expandSection.hidden;
    if (!expandSection.hidden && !expandSection.innerHTML) expandSection.innerHTML = fullPreview;
    e.target.textContent = expandSection.hidden ? 'Visualizar' : 'Ocultar';
  });

  li.querySelector('[data-action="active"]').addEventListener('change', (e) => {
    api(`/admin/api/videos/${item.id}`, { method: 'PATCH', body: JSON.stringify({ active: e.target.checked }) });
  });
  const loopCheckbox = li.querySelector('[data-action="loop"]');
  if (loopCheckbox) {
    loopCheckbox.addEventListener('change', (e) => {
      api(`/admin/api/videos/${item.id}`, { method: 'PATCH', body: JSON.stringify({ loop: e.target.checked }) });
    });
  }
  li.querySelector('[data-action="delete"]').addEventListener('click', () => {
    api(`/admin/api/videos/${item.id}`, { method: 'DELETE' }).then(loadVideos);
  });
  li.querySelector('[data-action="up"]').addEventListener('click', () => moveVideo(item.id, -1));
  li.querySelector('[data-action="down"]').addEventListener('click', () => moveVideo(item.id, 1));

  return li;
}

let currentVideos = [];

async function loadVideos() {
  const data = await api('/admin/api/videos');
  currentVideos = data.playlist;
  const list = document.getElementById('video-list');
  list.innerHTML = '';
  currentVideos.forEach((item) => list.appendChild(videoListItem(item)));
}

function moveVideo(id, direction) {
  const ids = currentVideos.map((v) => v.id);
  const index = ids.indexOf(id);
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= ids.length) return;
  [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
  api('/admin/api/videos/reorder', { method: 'POST', body: JSON.stringify({ order: ids }) }).then(loadVideos);
}

document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = document.getElementById('upload-file').files[0];
  const title = document.getElementById('upload-title').value;
  const durationSeconds = document.getElementById('upload-duration').value;
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  if (durationSeconds) formData.append('durationSeconds', durationSeconds);

  const res = await fetch('/admin/api/videos', { method: 'POST', body: formData });
  if (res.ok) {
    e.target.reset();
    loadVideos();
  } else {
    alert('Falha ao enviar arquivo: ' + (await res.text()));
  }
});

// ---------- Oferta ----------

const OFERTA_MAX_PHOTOS = 5;

function ofertaPhotoUrl(item, filename) {
  return `/media/oferta/${item.id}/${filename}`;
}

// Arrastar para reordenar fotos (mouse, touch e caneta - Pointer Events cobre
// os tres, ao contrario do HTML5 drag-and-drop nativo que nao dispara em
// telas touch). Generico: funciona tanto na grade das ofertas ja salvas
// quanto na previa do formulario "Adicionar oferta" - o chamador so' precisa
// mutar seus proprios dados e re-renderizar a grade dentro de onSwap.
function attachOfertaPhotoDrag(gridEl, onSwap) {
  let drag = null;

  function resetStyles(el) {
    el.classList.remove('dragging');
    el.style.position = '';
    el.style.zIndex = '';
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
    el.style.height = '';
    el.style.pointerEvents = '';
  }

  gridEl.querySelectorAll('.oferta-photo').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('button')) return; // deixa o botao de remover funcionar normalmente
      const rect = el.getBoundingClientRect();
      drag = {
        el,
        pointerId: e.pointerId,
        idx: Number(el.dataset.idx),
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        w: rect.width,
        h: rect.height,
        moved: false
      };
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (!drag || drag.pointerId !== e.pointerId) return;
      if (!drag.moved) {
        drag.moved = true;
        drag.el.classList.add('dragging');
        drag.el.style.position = 'fixed';
        drag.el.style.zIndex = '999';
        drag.el.style.width = drag.w + 'px';
        drag.el.style.height = drag.h + 'px';
        drag.el.style.pointerEvents = 'none';
      }
      drag.el.style.left = `${e.clientX - drag.offsetX}px`;
      drag.el.style.top = `${e.clientY - drag.offsetY}px`;

      drag.el.style.visibility = 'hidden';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      drag.el.style.visibility = '';
      gridEl.querySelectorAll('.oferta-photo').forEach((s) => s.classList.remove('drag-over'));
      const target = under && under.closest('.oferta-photo');
      if (target && target !== drag.el) target.classList.add('drag-over');
    });

    const finish = (e) => {
      if (!drag || drag.pointerId !== e.pointerId) return;
      const d = drag;
      drag = null;

      if (!d.moved) return;

      d.el.style.visibility = 'hidden';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      d.el.style.visibility = '';
      gridEl.querySelectorAll('.oferta-photo').forEach((s) => s.classList.remove('drag-over'));

      const target = under && under.closest('.oferta-photo');
      const targetIdx = target ? Number(target.dataset.idx) : d.idx;
      if (target && targetIdx !== d.idx) {
        onSwap(d.idx, targetIdx); // espera-se que isso re-renderize a grade, o que ja reseta os estilos
      } else {
        resetStyles(d.el);
      }
    };
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
  });
}

function ofertaPhotosBlock(item) {
  const wrap = document.createElement('div');
  wrap.className = 'oferta-photos';

  item.photos.forEach((filename, index) => {
    const box = document.createElement('div');
    box.className = 'oferta-photo';
    box.dataset.idx = index;
    box.innerHTML = `
      <img src="${ofertaPhotoUrl(item, filename)}" alt="Foto ${index + 1}" draggable="false" />
      <span class="oferta-photo-order">${index + 1}</span>
      <button type="button" class="oferta-photo-remove" title="Remover">✕</button>
    `;
    box.querySelector('.oferta-photo-remove').addEventListener('click', () => removeOfertaPhoto(item, filename));
    wrap.appendChild(box);
  });

  if (item.photos.length < OFERTA_MAX_PHOTOS) {
    const addLabel = document.createElement('label');
    addLabel.className = 'oferta-photo-add';
    addLabel.title = `Adicionar foto (${item.photos.length}/${OFERTA_MAX_PHOTOS})`;
    addLabel.innerHTML = '+<input type="file" accept="image/*" multiple hidden />';
    addLabel.querySelector('input').addEventListener('change', (e) => addOfertaPhotos(item, e.target.files));
    wrap.appendChild(addLabel);
  }

  attachOfertaPhotoDrag(wrap, (fromIdx, toIdx) => reorderOfertaPhoto(item, fromIdx, toIdx));

  return wrap;
}

async function reorderOfertaPhoto(item, fromIndex, toIndex) {
  const order = item.photos.slice();
  [order[fromIndex], order[toIndex]] = [order[toIndex], order[fromIndex]];
  await api(`/admin/api/oferta/${item.id}/photos/order`, { method: 'PATCH', body: JSON.stringify({ order }) });
  loadOferta();
}

async function removeOfertaPhoto(item, filename) {
  if (item.photos.length <= 1) {
    alert('A oferta precisa de ao menos uma foto.');
    return;
  }
  await api(`/admin/api/oferta/${item.id}/photos/${filename}`, { method: 'DELETE' });
  loadOferta();
}

async function addOfertaPhotos(item, files) {
  if (!files.length) return;
  if (item.photos.length + files.length > OFERTA_MAX_PHOTOS) {
    alert(`Máximo de ${OFERTA_MAX_PHOTOS} fotos por oferta (essa já tem ${item.photos.length}).`);
    return;
  }
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append('photos', file));
  const res = await fetch(`/admin/api/oferta/${item.id}/photos`, { method: 'POST', body: formData });
  if (res.ok) {
    loadOferta();
  } else {
    alert('Falha ao adicionar fotos: ' + (await res.text()));
  }
}

function ofertaEditForm(item) {
  const form = document.createElement('div');
  form.className = 'oferta-edit-form';
  form.innerHTML = `
    <label>Modelo <input type="text" data-field="model" value="${item.model || ''}" /></label>
    <label>Ano <input type="number" data-field="year" value="${item.year ?? ''}" /></label>
    <label>Km <input type="number" data-field="km" value="${item.km ?? ''}" /></label>
    <label>Preço (R$) <input type="number" step="0.01" data-field="price" value="${item.price ?? ''}" /></label>
    <label>Condições de financiamento <input type="text" data-field="financingNote" value="${item.financingNote || ''}" /></label>
    <label>Link do anúncio (QR code) <input type="url" data-field="qrUrl" value="${item.qrUrl || ''}" /></label>
    <div class="button-row">
      <button type="button" data-action="save">Salvar dados</button>
    </div>
  `;

  form.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const body = {};
    form.querySelectorAll('[data-field]').forEach((input) => { body[input.dataset.field] = input.value; });
    await api(`/admin/api/oferta/${item.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    loadOferta();
  });

  return form;
}

function ofertaListItem(item) {
  const li = document.createElement('li');
  const priceLabel = item.price ? `R$ ${Number(item.price).toLocaleString('pt-BR')}` : 'sem preço';
  const coverPhoto = item.photos[0];

  const header = document.createElement('div');
  header.className = 'oferta-item-header';
  header.innerHTML = `
    ${coverPhoto ? `<img class="thumb-small" src="${ofertaPhotoUrl(item, coverPhoto)}" alt="${item.model || ''}" />` : '<div class="thumb-small"></div>'}
    <span class="title">${item.model || '(sem modelo)'} — ${priceLabel}</span>
    <label><input type="checkbox" ${item.active ? 'checked' : ''} data-action="active" /> ativa</label>
    <button type="button" data-action="view">Visualizar</button>
    <button type="button" data-action="delete" class="danger">Excluir</button>
  `;

  const expandSection = document.createElement('div');
  expandSection.className = 'expand-section';
  expandSection.hidden = true;

  const viewBtn = header.querySelector('[data-action="view"]');
  viewBtn.addEventListener('click', () => {
    expandSection.hidden = !expandSection.hidden;
    if (!expandSection.hidden && !expandSection.childElementCount) {
      expandSection.appendChild(ofertaEditForm(item));
      const photosLabel = document.createElement('p');
      photosLabel.className = 'subtitle';
      photosLabel.style.margin = '8px 0 4px';
      photosLabel.textContent = 'Fotos (arraste para reordenar)';
      expandSection.appendChild(photosLabel);
      expandSection.appendChild(ofertaPhotosBlock(item));
    }
    viewBtn.textContent = expandSection.hidden ? 'Visualizar' : 'Ocultar';
  });

  header.querySelector('[data-action="active"]').addEventListener('change', (e) => {
    api(`/admin/api/oferta/${item.id}`, { method: 'PATCH', body: JSON.stringify({ active: e.target.checked }) });
  });
  header.querySelector('[data-action="delete"]').addEventListener('click', () => {
    api(`/admin/api/oferta/${item.id}`, { method: 'DELETE' }).then(loadOferta);
  });

  li.appendChild(header);
  li.appendChild(expandSection);

  return li;
}

async function loadOferta() {
  const data = await api('/admin/api/oferta');
  document.getElementById('oferta-enabled').checked = Boolean(data.enabled);
  document.getElementById('oferta-chance').value = Math.round((data.chance || 0) * 100);
  document.getElementById('oferta-seconds').value = data.secondsPerPhoto || 5;

  const list = document.getElementById('oferta-list');
  list.innerHTML = '';
  (data.items || []).forEach((item) => list.appendChild(ofertaListItem(item)));
}

document.getElementById('oferta-config-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await api('/admin/api/oferta/config', {
    method: 'PUT',
    body: JSON.stringify({
      enabled: document.getElementById('oferta-enabled').checked,
      chance: Number(document.getElementById('oferta-chance').value) / 100,
      secondsPerPhoto: Number(document.getElementById('oferta-seconds').value)
    })
  });
  alert('Configuração de oferta salva!');
});

// ---------- Previa de fotos do formulario "Adicionar oferta" ----------
// Guarda os Files fora do <input> (que virou so' um "+" dentro da propria
// grade, igual ao das ofertas ja salvas) pra poder reordenar/remover antes
// do envio.
let novaOfertaFiles = [];
let novaOfertaPreviewUrls = [];

function renderNovaOfertaPhotos() {
  const wrap = document.getElementById('oferta-photos-preview');
  wrap.innerHTML = '';

  novaOfertaFiles.forEach((file, index) => {
    const box = document.createElement('div');
    box.className = 'oferta-photo';
    box.dataset.idx = index;
    box.innerHTML = `
      <img src="${novaOfertaPreviewUrls[index]}" alt="Foto ${index + 1}" draggable="false" />
      <span class="oferta-photo-order">${index + 1}</span>
      <button type="button" class="oferta-photo-remove" title="Remover">✕</button>
    `;
    box.querySelector('.oferta-photo-remove').addEventListener('click', () => {
      URL.revokeObjectURL(novaOfertaPreviewUrls[index]);
      novaOfertaFiles.splice(index, 1);
      novaOfertaPreviewUrls.splice(index, 1);
      renderNovaOfertaPhotos();
    });
    wrap.appendChild(box);
  });

  if (novaOfertaFiles.length < OFERTA_MAX_PHOTOS) {
    const addLabel = document.createElement('label');
    addLabel.className = 'oferta-photo-add';
    addLabel.title = `Adicionar foto (${novaOfertaFiles.length}/${OFERTA_MAX_PHOTOS})`;
    addLabel.innerHTML = '+<input type="file" accept="image/*" multiple hidden />';
    addLabel.querySelector('input').addEventListener('change', (e) => {
      const remaining = OFERTA_MAX_PHOTOS - novaOfertaFiles.length;
      if (e.target.files.length > remaining) {
        alert(`Máximo de ${OFERTA_MAX_PHOTOS} fotos por oferta.`);
      }
      Array.from(e.target.files).slice(0, remaining).forEach((file) => {
        novaOfertaFiles.push(file);
        novaOfertaPreviewUrls.push(URL.createObjectURL(file));
      });
      renderNovaOfertaPhotos();
    });
    wrap.appendChild(addLabel);
  }

  attachOfertaPhotoDrag(wrap, (fromIdx, toIdx) => {
    [novaOfertaFiles[fromIdx], novaOfertaFiles[toIdx]] = [novaOfertaFiles[toIdx], novaOfertaFiles[fromIdx]];
    [novaOfertaPreviewUrls[fromIdx], novaOfertaPreviewUrls[toIdx]] = [novaOfertaPreviewUrls[toIdx], novaOfertaPreviewUrls[fromIdx]];
    renderNovaOfertaPhotos();
  });
}
renderNovaOfertaPhotos();

document.getElementById('oferta-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!novaOfertaFiles.length) {
    alert('Adicione ao menos uma foto.');
    return;
  }

  const formData = new FormData();
  formData.append('model', document.getElementById('oferta-model').value);
  formData.append('year', document.getElementById('oferta-year').value);
  formData.append('km', document.getElementById('oferta-km').value);
  formData.append('price', document.getElementById('oferta-price').value);
  formData.append('financingNote', document.getElementById('oferta-financing').value);
  formData.append('qrUrl', document.getElementById('oferta-qrurl').value);
  novaOfertaFiles.forEach((file) => formData.append('photos', file));

  const res = await fetch('/admin/api/oferta', { method: 'POST', body: formData });
  if (res.ok) {
    e.target.reset();
    novaOfertaPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    novaOfertaFiles = [];
    novaOfertaPreviewUrls = [];
    renderNovaOfertaPhotos();
    loadOferta();
  } else {
    alert('Falha ao adicionar oferta: ' + (await res.text()));
  }
});

// ---------- Promo ----------

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadPromo() {
  const promo = await api('/admin/api/promo');
  document.getElementById('promo-text').value = (promo.messages || []).join('\n');
  document.getElementById('promo-active').checked = Boolean(promo.active);
  document.getElementById('promo-start').value = toLocalInputValue(promo.startAt);
  document.getElementById('promo-end').value = toLocalInputValue(promo.endAt);
  document.getElementById('promo-position').value = promo.position || 'bottom';
}

document.getElementById('promo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const startVal = document.getElementById('promo-start').value;
  const endVal = document.getElementById('promo-end').value;
  const messages = document.getElementById('promo-text').value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  await api('/admin/api/promo', {
    method: 'PUT',
    body: JSON.stringify({
      messages,
      active: document.getElementById('promo-active').checked,
      position: document.getElementById('promo-position').value,
      startAt: startVal ? new Date(startVal).toISOString() : null,
      endAt: endVal ? new Date(endVal).toISOString() : null
    })
  });
  alert('Promoção salva!');
});

// ---------- Widgets ----------

async function loadWidgets() {
  const widgets = await api('/admin/api/widgets');
  document.getElementById('w-clock-enabled').checked = widgets.clock.enabled;
  document.getElementById('w-clock-format').value = widgets.clock.format;
  document.getElementById('w-weather-enabled').checked = widgets.weather.enabled;
  document.getElementById('w-weather-city').value = widgets.weather.city || '';
  document.getElementById('w-weather-apikey').value = widgets.weather.apiKey || '';
  document.getElementById('w-infopill-position').value = widgets.infoPill.position || 'top-left';
  document.getElementById('w-infopill-cycle').value = widgets.infoPill.cycleSeconds || 8;
  document.getElementById('w-logo-enabled').checked = widgets.logo.enabled;
  document.getElementById('w-logo-position').value = widgets.logo.position || 'top-left';
  document.getElementById('w-logo-size').value = widgets.logo.size || 'medium';
  document.getElementById('w-music-enabled').checked = widgets.music.enabled;
  document.getElementById('w-music-position').value = widgets.music.position || 'bottom-right';
}

document.getElementById('widgets-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await api('/admin/api/widgets', {
    method: 'PUT',
    body: JSON.stringify({
      clock: {
        enabled: document.getElementById('w-clock-enabled').checked,
        format: document.getElementById('w-clock-format').value
      },
      weather: {
        enabled: document.getElementById('w-weather-enabled').checked,
        city: document.getElementById('w-weather-city').value,
        apiKey: document.getElementById('w-weather-apikey').value
      },
      infoPill: {
        position: document.getElementById('w-infopill-position').value,
        cycleSeconds: Number(document.getElementById('w-infopill-cycle').value)
      },
      logo: {
        enabled: document.getElementById('w-logo-enabled').checked,
        position: document.getElementById('w-logo-position').value,
        size: document.getElementById('w-logo-size').value
      },
      music: {
        enabled: document.getElementById('w-music-enabled').checked,
        position: document.getElementById('w-music-position').value
      }
    })
  });
  alert('Widgets salvos!');
});

// ---------- Tela cheia de previsão do tempo ----------

async function loadWeatherScreen() {
  const data = await api('/admin/api/weather-screen');
  document.getElementById('ws-enabled').checked = Boolean(data.enabled);
  document.getElementById('ws-chance').value = Math.round((data.chance || 0) * 100);
  document.getElementById('ws-duration').value = data.durationSeconds || 25;
}

document.getElementById('weather-screen-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await api('/admin/api/weather-screen', {
    method: 'PUT',
    body: JSON.stringify({
      enabled: document.getElementById('ws-enabled').checked,
      chance: Number(document.getElementById('ws-chance').value) / 100,
      durationSeconds: Number(document.getElementById('ws-duration').value)
    })
  });
  alert('Configuração salva!');
});

// ---------- Spotify / Musica ----------

async function loadMusic() {
  const music = await api('/admin/api/music');
  const statusEl = document.getElementById('spotify-status');
  document.getElementById('spotify-client-id').value = music.spotify.clientId || '';
  document.getElementById('music-volume').value = music.spotify.volume ?? 70;

  if (music.spotify.connected) {
    statusEl.textContent = `Conectado${music.spotify.deviceName ? ' — dispositivo: ' + music.spotify.deviceName : ' — nenhum dispositivo selecionado'}`;
    loadDevices();
    loadPlaylists();
    startNowPlayingPolling();
  } else {
    statusEl.textContent = 'Spotify nao conectado';
    document.getElementById('spotify-devices').innerHTML = '';
    document.getElementById('spotify-playlist-select').innerHTML = '';
    stopNowPlayingPolling();
  }
}

// ---------- Now playing ----------

let nowPlayingTimer = null;
let nowPlayingTrackId = null; // evita "piscar" a barra reiniciando a cada poll na mesma faixa
let nowPlayingLocalProgress = 0;
let nowPlayingLocalUpdatedAt = 0;

function formatMs(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function renderNowPlaying(track) {
  const box = document.getElementById('now-playing');
  if (!track) {
    box.hidden = true;
    nowPlayingTrackId = null;
    return;
  }

  box.hidden = false;
  document.getElementById('np-title').textContent = track.title;
  document.getElementById('np-artist').textContent = track.artist;
  const cover = document.getElementById('np-cover');
  if (track.albumArt) cover.src = track.albumArt; else cover.removeAttribute('src');

  nowPlayingTrackId = `${track.title}::${track.artist}`;
  nowPlayingLocalProgress = track.progressMs || 0;
  nowPlayingLocalUpdatedAt = Date.now();

  const duration = track.durationMs || 0;
  document.getElementById('np-duration').textContent = formatMs(duration);
  updateNowPlayingFill(nowPlayingLocalProgress, duration, track.isPlaying);
}

function updateNowPlayingFill(progressMs, durationMs, isPlaying) {
  document.getElementById('np-elapsed').textContent = formatMs(progressMs);
  const pct = durationMs > 0 ? Math.min(100, (progressMs / durationMs) * 100) : 0;
  document.getElementById('np-progress-fill').style.width = `${pct}%`;
  document.getElementById('np-progress-bar').dataset.duration = durationMs;
  document.getElementById('np-progress-bar').dataset.playing = isPlaying ? '1' : '0';
}

async function refreshNowPlaying() {
  try {
    const track = await api('/admin/api/music/now-playing');
    renderNowPlaying(track);
  } catch {
    renderNowPlaying(null);
  }
}

function startNowPlayingPolling() {
  if (nowPlayingTimer) return;
  refreshNowPlaying();
  nowPlayingTimer = setInterval(refreshNowPlaying, 3000);
}

function stopNowPlayingPolling() {
  clearInterval(nowPlayingTimer);
  nowPlayingTimer = null;
  renderNowPlaying(null);
}

// avanca a barra localmente entre um poll e outro, sem esperar o Spotify
setInterval(() => {
  const bar = document.getElementById('np-progress-bar');
  if (!nowPlayingTrackId || bar.dataset.playing !== '1') return;
  const duration = Number(bar.dataset.duration) || 0;
  const elapsed = nowPlayingLocalProgress + (Date.now() - nowPlayingLocalUpdatedAt);
  updateNowPlayingFill(Math.min(elapsed, duration), duration, true);
}, 500);

document.getElementById('np-progress-bar').addEventListener('click', async (e) => {
  const bar = e.currentTarget;
  const duration = Number(bar.dataset.duration) || 0;
  if (!duration) return;
  const rect = bar.getBoundingClientRect();
  const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const positionMs = Math.round(fraction * duration);
  updateNowPlayingFill(positionMs, duration, bar.dataset.playing === '1');
  nowPlayingLocalProgress = positionMs;
  nowPlayingLocalUpdatedAt = Date.now();
  await api('/admin/api/music/seek', { method: 'PUT', body: JSON.stringify({ positionMs }) });
});

async function loadPlaylists() {
  const select = document.getElementById('spotify-playlist-select');
  try {
    const playlists = await api('/admin/api/music/spotify/playlists');
    select.innerHTML = '';
    playlists.forEach((p) => {
      const option = document.createElement('option');
      option.value = p.uri;
      option.textContent = `${p.name}${p.tracks !== null ? ` (${p.tracks} músicas)` : ''}`;
      select.appendChild(option);
    });
  } catch (err) {
    select.innerHTML = `<option>Erro ao carregar playlists</option>`;
  }
}

async function loadDevices() {
  const container = document.getElementById('spotify-devices');
  try {
    const devices = await api('/admin/api/music/spotify/devices');
    container.innerHTML = '<h3>Dispositivos</h3>';
    devices.forEach((d) => {
      const div = document.createElement('div');
      div.className = 'device-item';
      div.innerHTML = `<span>${d.name} ${d.is_active ? '(ativo)' : ''}</span>`;
      const btn = document.createElement('button');
      btn.textContent = 'Selecionar';
      btn.addEventListener('click', async () => {
        await api(`/admin/api/music/spotify/devices/${d.id}/select`, { method: 'POST' });
        loadMusic();
      });
      div.appendChild(btn);
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = `<p class="error">Nao foi possivel listar dispositivos: ${err.message}</p>`;
  }
}

document.getElementById('spotify-config-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await api('/admin/api/music/config', {
    method: 'POST',
    body: JSON.stringify({ clientId: document.getElementById('spotify-client-id').value })
  });
  alert('Client ID salvo!');
});

document.getElementById('spotify-connect-btn').addEventListener('click', () => {
  window.open('/admin/api/music/spotify/connect', '_blank');
});

document.getElementById('spotify-disconnect-btn').addEventListener('click', async () => {
  await api('/admin/api/music/spotify/disconnect', { method: 'POST' });
  loadMusic();
});

document.getElementById('spotify-playlist-play').addEventListener('click', () => {
  const uri = document.getElementById('spotify-playlist-select').value;
  if (!uri) return;
  api('/admin/api/music/play', { method: 'POST', body: JSON.stringify({ contextUri: uri }) });
});

document.getElementById('music-play').addEventListener('click', () => api('/admin/api/music/play', { method: 'POST' }));
document.getElementById('music-pause').addEventListener('click', () => api('/admin/api/music/pause', { method: 'POST' }));
document.getElementById('music-next').addEventListener('click', () => api('/admin/api/music/next', { method: 'POST' }));
document.getElementById('music-prev').addEventListener('click', () => api('/admin/api/music/previous', { method: 'POST' }));
document.getElementById('music-volume').addEventListener('change', (e) => {
  api('/admin/api/music/volume', { method: 'PUT', body: JSON.stringify({ percent: Number(e.target.value) }) });
});

// ---------- Senha ----------

document.getElementById('password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('password-message');
  try {
    await api('/admin/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: document.getElementById('current-password').value,
        newPassword: document.getElementById('new-password').value
      })
    });
    msg.textContent = 'Senha alterada com sucesso!';
    msg.className = '';
    e.target.reset();
  } catch (err) {
    msg.textContent = 'Erro ao trocar senha: ' + err.message;
    msg.className = 'error';
  }
});

// ---------- Init ----------

loadVideos();
loadOferta();
loadPromo();
loadWidgets();
loadWeatherScreen();
loadMusic();
