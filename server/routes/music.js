const express = require('express');
const SpotifyProvider = require('../music/spotify-provider');

// O Spotify so aceita redirect_uri https:// OU o endereco de loopback
// 127.0.0.1 — um IP de rede local (ex: 192.168.x.x) e' recusado como
// "inseguro". Por isso o valor e' sempre fixo em 127.0.0.1: a etapa de
// autorizar o Spotify precisa ser feita com um navegador aberto no proprio
// PC da TV (unica vez), mesmo que o resto do painel seja usado remotamente.
function redirectUriFor(req) {
  const port = req.socket.localPort;
  return `http://127.0.0.1:${port}/spotify/callback`;
}

module.exports = function musicRouter(state) {
  const router = express.Router();
  const provider = new SpotifyProvider(state);

  router.get('/', async (req, res) => {
    const connected = await provider.isConnected().catch(() => false);
    res.json({ ...state.get('music'), spotify: { ...state.get('music').spotify, connected } });
  });

  router.post('/config', (req, res) => {
    const { clientId } = req.body || {};
    if (typeof clientId !== 'string' || !clientId) {
      return res.status(400).json({ error: 'clientId obrigatorio' });
    }
    const updated = state.update('music', (current) => ({
      ...current,
      spotify: { ...current.spotify, clientId }
    }));
    res.json({ ...updated, redirectUri: redirectUriFor(req) });
  });

  router.get('/spotify/connect', (req, res) => {
    if (!provider.clientId) {
      return res.status(400).json({ error: 'configure o clientId do Spotify antes de conectar' });
    }
    const url = provider.buildAuthUrl(redirectUriFor(req));
    res.redirect(url);
  });

  router.post('/spotify/disconnect', async (req, res) => {
    await provider.disconnect();
    res.json({ ok: true });
  });

  router.get('/spotify/devices', async (req, res) => {
    try {
      res.json(await provider.listDevices());
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/spotify/devices/:id/select', async (req, res) => {
    try {
      await provider.selectDevice(req.params.id);
      res.json(state.get('music'));
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/play', async (req, res) => {
    try {
      await provider.play(req.body?.contextUri);
      res.json({ ok: true });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/pause', async (req, res) => {
    try {
      await provider.pause();
      res.json({ ok: true });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/next', async (req, res) => {
    try {
      await provider.next();
      res.json({ ok: true });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/previous', async (req, res) => {
    try {
      await provider.previous();
      res.json({ ok: true });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.put('/volume', async (req, res) => {
    try {
      await provider.setVolume(Number(req.body?.percent) || 0);
      res.json({ ok: true });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.get('/now-playing', async (req, res) => {
    try {
      res.json(await provider.getNowPlaying());
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.__provider = provider;
  return router;
};
