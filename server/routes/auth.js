const express = require('express');

module.exports = function authRouter(state) {
  const router = express.Router();

  router.post('/change-password', (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!state.checkPassword(currentPassword || '')) {
      return res.status(401).json({ error: 'senha atual incorreta' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 4) {
      return res.status(400).json({ error: 'nova senha deve ter ao menos 4 caracteres' });
    }
    state.setPassword(newPassword);
    res.json({ ok: true });
  });

  return router;
};
