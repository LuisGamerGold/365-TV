const express = require('express');
const SpotifyProvider = require('../music/spotify-provider');

// Rota publica: e' o navegador retornando de accounts.spotify.com apos o login,
// nao uma chamada autenticada do painel. A protecao aqui e' o parametro
// "state" (CSRF) validado dentro de handleCallback.
module.exports = function spotifyCallbackRouter(state) {
  const router = express.Router();
  const provider = new SpotifyProvider(state);

  router.get('/callback', async (req, res) => {
    const { code, state: csrfState, error } = req.query;
    if (error) return res.status(400).send(`Spotify retornou um erro: ${error}`);
    try {
      const redirectUri = `http://127.0.0.1:${req.socket.localPort}/spotify/callback`;
      await provider.handleCallback({ code, state: csrfState }, redirectUri);
      res.send('Spotify conectado com sucesso! Pode fechar esta aba e voltar ao painel 365 TV.');
    } catch (err) {
      res.status(400).send(`Falha ao conectar Spotify: ${err.message}`);
    }
  });

  return router;
};
