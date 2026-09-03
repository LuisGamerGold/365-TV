const express = require('express');

module.exports = function weatherScreenRouter(state) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(state.get('weatherScreen'));
  });

  router.put('/', (req, res) => {
    const { enabled, chance, durationSeconds } = req.body || {};
    const updated = state.update('weatherScreen', (current) => ({
      ...current,
      ...(enabled !== undefined && { enabled }),
      ...(chance !== undefined && { chance: Number(chance) }),
      ...(durationSeconds !== undefined && { durationSeconds: Number(durationSeconds) })
    }));
    res.json(updated);
  });

  return router;
};
