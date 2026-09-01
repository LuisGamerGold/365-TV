const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cookieSession = require('cookie-session');
const { Server } = require('socket.io');

const state = require('./state');
const { DATA_DIR } = require('./paths');

const PLAYER_DIR = path.join(__dirname, '..', 'player');
const ADMIN_DIR = path.join(__dirname, '..', 'admin');
const MEDIA_DIR = path.join(DATA_DIR, 'media');

const PORT = process.env.PORT_365TV || 3450;
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.originalUrl.startsWith('/admin/api')) {
    return res.status(401).json({ error: 'nao autenticado' });
  }
  return res.redirect('/admin/login.html');
}

function createServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer);

  app.use(express.json());
  app.use(
    cookieSession({
      name: '365tv-session',
      secret: SESSION_SECRET,
      maxAge: 12 * 60 * 60 * 1000
    })
  );

  app.get('/', (req, res) => res.redirect('/player'));

  // Player: acesso publico na rede local, e' apenas um espelho de exibicao.
  app.use('/player', express.static(PLAYER_DIR));
  app.use('/media', express.static(MEDIA_DIR));

  // Login do painel admin (publico) precisa vir antes do middleware protegido.
  app.get('/admin/login.html', (req, res) => {
    res.sendFile(path.join(ADMIN_DIR, 'login.html'));
  });
  app.post('/admin/api/login', (req, res) => {
    const { password } = req.body || {};
    if (typeof password === 'string' && state.checkPassword(password)) {
      req.session.authenticated = true;
      return res.json({ ok: true });
    }
    return res.status(401).json({ error: 'senha incorreta' });
  });
  app.post('/admin/api/logout', requireAuth, (req, res) => {
    req.session = null;
    res.json({ ok: true });
  });

  app.use('/spotify', require('./routes/spotify-callback')(state));

  app.use('/admin/api/auth', requireAuth, require('./routes/auth')(state));
  app.use('/admin/api/videos', requireAuth, require('./routes/videos')(state));
  app.use('/admin/api/promo', requireAuth, require('./routes/promo')(state));
  app.use('/admin/api/widgets', requireAuth, require('./routes/widgets')(state));
  const musicRouter = require('./routes/music')(state);
  app.use('/admin/api/music', requireAuth, musicRouter);
  app.use('/admin', requireAuth, express.static(ADMIN_DIR));

  app.get('/api/status', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

  // Repassa mudancas de estado para a tela da TV em tempo real.
  for (const section of ['videos', 'promo', 'widgets', 'music']) {
    state.on(section, (payload) => io.emit(`${section}:updated`, payload));
  }

  io.on('connection', (socket) => {
    socket.emit('videos:updated', state.get('videos'));
    socket.emit('promo:updated', state.get('promo'));
    socket.emit('widgets:updated', state.get('widgets'));
    socket.emit('music:updated', state.get('music'));
  });

  // Polling do "now playing" fica no servidor (dono do token do Spotify);
  // o player publico so recebe o resultado ja pronto via socket.
  setInterval(async () => {
    const music = state.get('music');
    if (!music.spotify.connected) return;
    try {
      const nowPlaying = await musicRouter.__provider.getNowPlaying();
      io.emit('music:nowplaying', nowPlaying);
    } catch (err) {
      io.emit('music:nowplaying', null);
    }
  }, 10000);

  return { app, httpServer, io };
}

function start() {
  const { httpServer } = createServer();
  return new Promise((resolve) => {
    httpServer.listen(PORT, () => {
      console.log(`365 TV server rodando em http://localhost:${PORT}`);
      resolve({ port: PORT });
    });
  });
}

module.exports = { start };
