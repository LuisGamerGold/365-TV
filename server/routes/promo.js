const express = require('express');

module.exports = function promoRouter(state) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(state.get('promo'));
  });

  router.put('/', (req, res) => {
    const { messages, active, position, startAt, endAt } = req.body || {};
    const updated = state.update('promo', (current) => ({
      ...current,
      ...(Array.isArray(messages) && { messages: messages.map(String).filter((m) => m.trim()) }),
      ...(active !== undefined && { active }),
      ...(position !== undefined && { position }),
      ...(startAt !== undefined && { startAt }),
      ...(endAt !== undefined && { endAt })
    }));
    res.json(updated);
  });

  return router;
};
