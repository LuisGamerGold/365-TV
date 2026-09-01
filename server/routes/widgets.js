const express = require('express');

module.exports = function widgetsRouter(state) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(state.get('widgets'));
  });

  router.put('/', (req, res) => {
    const { clock, weather, logo, music } = req.body || {};
    const updated = state.update('widgets', (current) => ({
      clock: { ...current.clock, ...clock },
      weather: { ...current.weather, ...weather },
      logo: { ...current.logo, ...logo },
      music: { ...current.music, ...music }
    }));
    res.json(updated);
  });

  return router;
};
