const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { DATA_DIR } = require('./paths');

const STATE_FILE = path.join(DATA_DIR, 'state.json');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

function defaultState() {
  return {
    auth: {
      passwordHash: hashPassword('365motos')
    },
    videos: {
      playlist: []
    },
    promo: {
      messages: [],
      active: false,
      position: 'bottom',
      startAt: null,
      endAt: null
    },
    widgets: {
      clock: { enabled: true, format: '24h' },
      weather: { enabled: true, city: 'Sarandi,BR', apiKey: '', lastKnown: null },
      infoPill: { position: 'top-left', cycleSeconds: 8 },
      logo: { enabled: true, position: 'top-right', size: 'medium', opacity: 1 },
      music: { enabled: true, position: 'top-left' }
    },
    music: {
      provider: 'spotify',
      spotify: {
        clientId: '',
        connected: false,
        deviceId: null,
        deviceName: null,
        volume: 70
      }
    },
    oferta: {
      enabled: true,
      chance: 0.3,
      secondsPerPhoto: 5,
      items: []
    },
    weatherScreen: {
      enabled: false,
      chance: 0.2,
      durationSeconds: 25
    }
  };
}

class StateStore extends EventEmitter {
  constructor() {
    super();
    this.state = this._load();
  }

  _load() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(STATE_FILE)) {
      const initial = defaultState();
      fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    try {
      const loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      const defaults = defaultState();
      let missingSection = false;
      for (const key of Object.keys(defaults)) {
        if (!(key in loaded)) {
          loaded[key] = defaults[key];
          missingSection = true;
        }
      }
      // migracao: instalacoes antigas tem widgets.clock/weather mas nao tem
      // widgets.infoPill (pilula unica que alterna horario/clima)
      if (loaded.widgets && !loaded.widgets.infoPill) {
        loaded.widgets.infoPill = defaults.widgets.infoPill;
        missingSection = true;
      }
      // migracao: promo.text (mensagem unica) virou promo.messages (varias,
      // rolando continuamente na tarjeta)
      if (loaded.promo && !Array.isArray(loaded.promo.messages)) {
        loaded.promo.messages = loaded.promo.text ? [loaded.promo.text] : [];
        delete loaded.promo.text;
        delete loaded.promo.highlight;
        delete loaded.promo.animation;
        missingSection = true;
      }
      if (missingSection) fs.writeFileSync(STATE_FILE, JSON.stringify(loaded, null, 2));
      return loaded;
    } catch (err) {
      console.error('Falha ao ler state.json, recriando com valores padrao:', err);
      const initial = defaultState();
      fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
  }

  _persist() {
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  get(section) {
    return section ? this.state[section] : this.state;
  }

  update(section, updater) {
    const current = this.state[section];
    const next = typeof updater === 'function' ? updater(current) : updater;
    this.state[section] = next;
    this._persist();
    this.emit(section, next);
    return next;
  }

  checkPassword(password) {
    return verifyPassword(password, this.state.auth.passwordHash);
  }

  setPassword(password) {
    this.state.auth.passwordHash = hashPassword(password);
    this._persist();
  }
}

module.exports = new StateStore();
