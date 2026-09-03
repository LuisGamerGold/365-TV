const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const { DATA_DIR } = require('../paths');

const MEDIA_DIR = path.join(DATA_DIR, 'media', 'oferta');
const MAX_PHOTOS = 5;

module.exports = function ofertaRouter(state) {
  const router = express.Router();

  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

  function assignId(req, res, next) {
    req.ofertaId = crypto.randomUUID();
    next();
  }

  function useExistingId(req, res, next) {
    const item = state.get('oferta').items.find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'oferta nao encontrada' });
    req.ofertaId = req.params.id;
    next();
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(MEDIA_DIR, req.ofertaId);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
    }
  });
  const upload = multer({ storage });

  function handleUploadErrors(err, req, res, next) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `maximo de ${MAX_PHOTOS} fotos por oferta` });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  }

  router.get('/', (req, res) => {
    res.json(state.get('oferta'));
  });

  router.put('/config', (req, res) => {
    const { enabled, chance, secondsPerPhoto } = req.body || {};
    const updated = state.update('oferta', (current) => ({
      ...current,
      ...(enabled !== undefined && { enabled }),
      ...(chance !== undefined && { chance: Number(chance) }),
      ...(secondsPerPhoto !== undefined && { secondsPerPhoto: Number(secondsPerPhoto) })
    }));
    res.json(updated);
  });

  router.post('/', assignId, upload.array('photos', MAX_PHOTOS), handleUploadErrors, async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'ao menos uma foto e obrigatoria' });
    }

    const id = req.ofertaId;
    const dir = path.join(MEDIA_DIR, id);

    let qrFilename = null;
    if (req.body.qrUrl) {
      qrFilename = 'qr.png';
      await QRCode.toFile(path.join(dir, qrFilename), req.body.qrUrl, { margin: 1, width: 400 });
    }

    const item = {
      id,
      model: req.body.model || '',
      year: req.body.year ? Number(req.body.year) : null,
      km: req.body.km ? Number(req.body.km) : null,
      price: req.body.price ? Number(req.body.price) : null,
      financingNote: req.body.financingNote || '',
      tagText: req.body.tagText || 'Oportunidade de compra',
      qrUrl: req.body.qrUrl || '',
      qrFilename,
      photos: req.files.map((f) => f.filename),
      active: true
    };

    const updated = state.update('oferta', (current) => ({
      ...current,
      items: [...current.items, item]
    }));
    res.status(201).json(updated);
  });

  router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const item = state.get('oferta').items.find((i) => i.id === id);
    if (!item) return res.status(404).json({ error: 'oferta nao encontrada' });

    const allowed = ['model', 'year', 'km', 'price', 'financingNote', 'tagText', 'active'];

    let qrFilename;
    if ('qrUrl' in req.body && req.body.qrUrl !== item.qrUrl) {
      if (req.body.qrUrl) {
        qrFilename = 'qr.png';
        const dir = path.join(MEDIA_DIR, id);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        await QRCode.toFile(path.join(dir, qrFilename), req.body.qrUrl, { margin: 1, width: 400 });
      } else {
        qrFilename = null;
      }
    }

    const updated = state.update('oferta', (current) => ({
      ...current,
      items: current.items.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it };
        for (const key of allowed) {
          if (!(key in req.body)) continue;
          if (['year', 'km', 'price'].includes(key)) {
            next[key] = req.body[key] === '' || req.body[key] === null ? null : Number(req.body[key]);
          } else {
            next[key] = req.body[key];
          }
        }
        if ('qrUrl' in req.body) next.qrUrl = req.body.qrUrl;
        if (qrFilename !== undefined) next.qrFilename = qrFilename;
        return next;
      })
    }));
    res.json(updated);
  });

  // Adiciona fotos a uma oferta existente, respeitando o limite de MAX_PHOTOS no total.
  router.post('/:id/photos', useExistingId, upload.array('photos', MAX_PHOTOS), handleUploadErrors, (req, res) => {
    const { id } = req.params;
    const item = state.get('oferta').items.find((i) => i.id === id);
    const newFiles = req.files || [];

    if (item.photos.length + newFiles.length > MAX_PHOTOS) {
      newFiles.forEach((f) => fs.unlink(f.path, () => {}));
      return res.status(400).json({ error: `maximo de ${MAX_PHOTOS} fotos por oferta` });
    }

    const updated = state.update('oferta', (current) => ({
      ...current,
      items: current.items.map((it) => {
        if (it.id !== id) return it;
        return { ...it, photos: [...it.photos, ...newFiles.map((f) => f.filename)] };
      })
    }));
    res.status(201).json(updated);
  });

  // Reordena as fotos de uma oferta (define a ordem de exibicao no player).
  router.patch('/:id/photos/order', (req, res) => {
    const { id } = req.params;
    const { order } = req.body || {};
    const item = state.get('oferta').items.find((i) => i.id === id);
    if (!item) return res.status(404).json({ error: 'oferta nao encontrada' });
    if (!Array.isArray(order) || order.length !== item.photos.length || !order.every((f) => item.photos.includes(f))) {
      return res.status(400).json({ error: 'order deve conter exatamente as fotos existentes da oferta' });
    }

    const updated = state.update('oferta', (current) => ({
      ...current,
      items: current.items.map((it) => (it.id === id ? { ...it, photos: order } : it))
    }));
    res.json(updated);
  });

  // Remove uma unica foto da oferta (mantendo as demais e sua ordem).
  router.delete('/:id/photos/:filename', (req, res) => {
    const { id, filename } = req.params;
    const item = state.get('oferta').items.find((i) => i.id === id);
    if (!item) return res.status(404).json({ error: 'oferta nao encontrada' });
    if (!item.photos.includes(filename)) return res.status(404).json({ error: 'foto nao encontrada' });
    if (item.photos.length <= 1) {
      return res.status(400).json({ error: 'a oferta precisa de ao menos uma foto' });
    }

    const updated = state.update('oferta', (current) => ({
      ...current,
      items: current.items.map((it) => {
        if (it.id !== id) return it;
        return { ...it, photos: it.photos.filter((p) => p !== filename) };
      })
    }));
    fs.unlink(path.join(MEDIA_DIR, id, filename), () => {});
    res.json(updated);
  });

  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const updated = state.update('oferta', (current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id)
    }));
    fs.rm(path.join(MEDIA_DIR, id), { recursive: true, force: true }, () => {});
    res.json(updated);
  });

  return router;
};
