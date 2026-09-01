const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { DATA_DIR } = require('../paths');

const MEDIA_DIR = path.join(DATA_DIR, 'media', 'videos');

module.exports = function videosRouter(state) {
  const router = express.Router();

  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

  const storage = multer.diskStorage({
    destination: MEDIA_DIR,
    filename: (req, file, cb) => {
      const id = crypto.randomUUID();
      const ext = path.extname(file.originalname);
      cb(null, `${id}${ext}`);
    }
  });
  const upload = multer({ storage });

  router.get('/', (req, res) => {
    res.json(state.get('videos'));
  });

  router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'arquivo obrigatorio' });

    const isImage = req.file.mimetype.startsWith('image/');
    const item = {
      id: crypto.randomUUID(),
      title: req.body.title || req.file.originalname,
      filename: req.file.filename,
      type: isImage ? 'image' : 'video',
      active: true,
      loop: false,
      durationSeconds: isImage ? Number(req.body.durationSeconds) || 10 : null
    };

    const updated = state.update('videos', (current) => ({
      playlist: [...current.playlist, item]
    }));
    res.status(201).json(updated);
  });

  router.patch('/:id', (req, res) => {
    const { id } = req.params;
    const allowed = ['title', 'active', 'loop', 'durationSeconds'];
    const updated = state.update('videos', (current) => ({
      playlist: current.playlist.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item };
        for (const key of allowed) {
          if (key in req.body) next[key] = req.body[key];
        }
        return next;
      })
    }));
    res.json(updated);
  });

  router.post('/reorder', (req, res) => {
    const { order } = req.body || {};
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order deve ser um array de ids' });

    const updated = state.update('videos', (current) => {
      const byId = new Map(current.playlist.map((item) => [item.id, item]));
      const reordered = order.map((id) => byId.get(id)).filter(Boolean);
      for (const item of current.playlist) {
        if (!order.includes(item.id)) reordered.push(item);
      }
      return { playlist: reordered };
    });
    res.json(updated);
  });

  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    let removed = null;
    const updated = state.update('videos', (current) => {
      removed = current.playlist.find((item) => item.id === id) || null;
      return { playlist: current.playlist.filter((item) => item.id !== id) };
    });
    if (removed) {
      const filePath = path.join(MEDIA_DIR, removed.filename);
      fs.unlink(filePath, () => {});
    }
    res.json(updated);
  });

  return router;
};
