const crypto = require('crypto');
const MusicProvider = require('./music-provider');
const secrets = require('../secrets');

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative'
].join(' ');

function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Fluxo de conexao (Authorization Code + PKCE): guardado apenas em memoria,
// e' descartado assim que o callback e' processado ou expira.
const pendingAuth = new Map();

class SpotifyProvider extends MusicProvider {
  constructor(state) {
    super();
    this.state = state;
  }

  get clientId() {
    return this.state.get('music').spotify.clientId || '';
  }

  buildAuthUrl(redirectUri) {
    const verifier = base64url(crypto.randomBytes(64));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    const csrfState = base64url(crypto.randomBytes(16));

    pendingAuth.set(csrfState, { verifier, createdAt: Date.now() });
    // limpa entradas antigas (> 10 min)
    for (const [key, value] of pendingAuth) {
      if (Date.now() - value.createdAt > 10 * 60 * 1000) pendingAuth.delete(key);
    }

    const url = new URL(AUTH_URL);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('state', csrfState);
    return url.toString();
  }

  async handleCallback({ code, state: csrfState }, redirectUri) {
    const pending = pendingAuth.get(csrfState);
    if (!pending) throw new Error('estado de autenticacao invalido ou expirado');
    pendingAuth.delete(csrfState);

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.clientId,
      code_verifier: pending.verifier
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) throw new Error(`falha ao trocar code por token: ${res.status} ${await res.text()}`);
    const tokens = await res.json();
    this._storeTokens(tokens);

    this.state.update('music', (current) => ({
      ...current,
      spotify: { ...current.spotify, connected: true }
    }));
  }

  _storeTokens(tokens) {
    const existing = secrets.get('spotify_tokens') || {};
    secrets.set('spotify_tokens', {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || existing.refresh_token,
      expires_at: Date.now() + (tokens.expires_in - 60) * 1000
    });
  }

  async _ensureToken() {
    const tokens = secrets.get('spotify_tokens');
    if (!tokens) throw new Error('Spotify nao conectado');
    if (Date.now() < tokens.expires_at) return tokens.access_token;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: this.clientId
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) throw new Error(`falha ao renovar token: ${res.status}`);
    const refreshed = await res.json();
    this._storeTokens(refreshed);
    return refreshed.access_token;
  }

  async _api(method, urlPath, { query, body } = {}) {
    const token = await this._ensureToken();
    const url = new URL(API_BASE + urlPath);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, value);
      }
    }
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 204 || res.status === 202) return null;
    if (!res.ok) throw new Error(`Spotify API ${method} ${urlPath}: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async isConnected() {
    return Boolean(secrets.get('spotify_tokens'));
  }

  async disconnect() {
    secrets.remove('spotify_tokens');
    this.state.update('music', (current) => ({
      ...current,
      spotify: { ...current.spotify, connected: false, deviceId: null, deviceName: null }
    }));
  }

  async listDevices() {
    const data = await this._api('GET', '/me/player/devices');
    return data ? data.devices : [];
  }

  async selectDevice(deviceId) {
    await this._api('PUT', '/me/player', { body: { device_ids: [deviceId], play: false } });
    const devices = await this.listDevices();
    const device = devices.find((d) => d.id === deviceId);
    this.state.update('music', (current) => ({
      ...current,
      spotify: { ...current.spotify, deviceId, deviceName: device ? device.name : null }
    }));
  }

  _deviceId() {
    return this.state.get('music').spotify.deviceId;
  }

  async listPlaylists() {
    const data = await this._api('GET', '/me/playlists', { query: { limit: 50 } });
    if (!data) return [];
    return data.items.map((p) => ({
      id: p.id,
      name: p.name,
      uri: p.uri,
      image: p.images?.[0]?.url || null,
      tracks: p.tracks?.total ?? null
    }));
  }

  async play(contextUri) {
    const body = contextUri ? { context_uri: contextUri } : undefined;
    await this._api('PUT', '/me/player/play', { query: { device_id: this._deviceId() }, body });
  }

  async pause() {
    await this._api('PUT', '/me/player/pause', { query: { device_id: this._deviceId() } });
  }

  async next() {
    await this._api('POST', '/me/player/next', { query: { device_id: this._deviceId() } });
  }

  async previous() {
    await this._api('POST', '/me/player/previous', { query: { device_id: this._deviceId() } });
  }

  async setVolume(percent) {
    await this._api('PUT', '/me/player/volume', {
      query: { volume_percent: Math.round(percent), device_id: this._deviceId() }
    });
    this.state.update('music', (current) => ({
      ...current,
      spotify: { ...current.spotify, volume: percent }
    }));
  }

  async getNowPlaying() {
    const data = await this._api('GET', '/me/player/currently-playing');
    if (!data || !data.item) return null;
    return {
      title: data.item.name,
      artist: data.item.artists.map((a) => a.name).join(', '),
      albumArt: data.item.album?.images?.[0]?.url || null,
      isPlaying: data.is_playing,
      progressMs: data.progress_ms ?? 0,
      durationMs: data.item.duration_ms ?? 0
    };
  }

  async seek(positionMs) {
    await this._api('PUT', '/me/player/seek', {
      query: { position_ms: Math.round(positionMs), device_id: this._deviceId() }
    });
  }
}

module.exports = SpotifyProvider;
