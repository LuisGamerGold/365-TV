const express = require('express');

module.exports = function promoRouter(state) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(state.get('promo'));
  });

  router.put('/', (req, res) => {
    const { text, highlight, animation, active, position, startAt, endAt } = req.body || {};
    const updated = state.update('promo', (current) => ({
      ...current,
      ...(text !== undefined && { text }),
      ...(highlight !== undefined && { highlight }),
      ...(animation !== undefined && { animation }),
      ...(active !== undefined && { active }),
      ...(position !== undefined && { position }),
      ...(startAt !== undefined && { startAt }),
      ...(endAt !== undefined && { endAt })
    }));
    res.json(updated);
  });

  return router;
};
