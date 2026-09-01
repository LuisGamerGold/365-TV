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
  li.innerHTML = `
    <span class="title">${item.title} ${item.type === 'image' ? `(${item.durationSeconds}s)` : ''}</span>
    <label><input type="checkbox" ${item.active ? 'checked' : ''} data-action="active" /> ativo</label>
    ${item.type === 'video' ? `<label><input type="checkbox" ${item.loop ? 'checked' : ''} data-action="loop" /> repetir</label>` : ''}
    <button data-action="up">↑</button>
    <button data-action="down">↓</button>
    <button data-action="delete" class="danger">Excluir</button>
  `;

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

// ---------- Promo ----------

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadPromo() {
  const promo = await api('/admin/api/promo');
  document.getElementById('promo-text').value = promo.text || '';
  document.getElementById('promo-active').checked = Boolean(promo.active);
  document.getElementById('promo-animation').value = promo.animation || 'none';
  document.getElementById('promo-start').value = toLocalInputValue(promo.startAt);
  document.getElementById('promo-end').value = toLocalInputValue(promo.endAt);
  document.getElementById('promo-position').value = promo.position || 'bottom';
}

document.getElementById('promo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const startVal = document.getElementById('promo-start').value;
  const endVal = document.getElementById('promo-end').value;
  await api('/admin/api/promo', {
    method: 'PUT',
    body: JSON.stringify({
      text: document.getElementById('promo-text').value,
      active: document.getElementById('promo-active').checked,
      animation: document.getElementById('promo-animation').value,
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
  document.getElementById('w-clock-position').value = widgets.clock.position || 'top-right';
  document.getElementById('w-weather-enabled').checked = widgets.weather.enabled;
  document.getElementById('w-weather-city').value = widgets.weather.city || '';
  document.getElementById('w-weather-apikey').value = widgets.weather.apiKey || '';
  document.getElementById('w-weather-position').value = widgets.weather.position || 'top-center';
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
        format: document.getElementById('w-clock-format').value,
        position: document.getElementById('w-clock-position').value
      },
      weather: {
        enabled: document.getElementById('w-weather-enabled').checked,
        city: document.getElementById('w-weather-city').value,
        apiKey: document.getElementById('w-weather-apikey').value,
        position: document.getElementById('w-weather-position').value
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

// ---------- Spotify / Musica ----------

async function loadMusic() {
  const music = await api('/admin/api/music');
  const statusEl = document.getElementById('spotify-status');
  document.getElementById('spotify-client-id').value = music.spotify.clientId || '';
  document.getElementById('music-volume').value = music.spotify.volume ?? 70;

  if (music.spotify.connected) {
    statusEl.textContent = `Conectado${music.spotify.deviceName ? ' — dispositivo: ' + music.spotify.deviceName : ' — nenhum dispositivo selecionado'}`;
    loadDevices();
  } else {
    statusEl.textContent = 'Spotify nao conectado';
    document.getElementById('spotify-devices').innerHTML = '';
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
loadPromo();
loadWidgets();
loadMusic();
