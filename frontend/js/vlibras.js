const VLIBRAS_APP_URL = 'https://vlibras.gov.br/app';
const VLIBRAS_LOAD_TIMEOUT_MS = 30000;
const VLIBRAS_PLAYER_MARGIN = 8;

const VLIBRAS_PASS_FLAG = '__vlibrasSyntheticClick';

const VLIBRAS_WELCOME_DELAY_MS = 1200;

const EMBED_CSS = `
  #vlibras-app {
    top: var(--sz-top) !important; left: var(--sz-left) !important;
    right: auto !important; bottom: auto !important;
    transform: none !important; translate: none !important;
    animation: none !important; transition: opacity .2s !important;
    visibility: var(--sz-vis, visible) !important;
  }
  #vlibras-app-panel { border-radius: 16px !important; box-shadow: none !important; outline: none !important; }
  #vlibras-app-content div:has(#header-actions):not(:has(iframe)),
  #vlibras-app-content div:has(#main-action-speed-options):not(:has(iframe)) { display: none !important; }
`;

const LibrasPlayer = {
  _started: false,
  _stage: null,
  _readyAt: 0,
  _styled: false,
  _lastRect: '',

  embedIn(stageEl) {
    this._stage = stageEl;
  },

  _protectClicks() {
    const scope = this._stage?.closest('.app') || document.body;
    document.addEventListener('click', event => {
      if (scope.contains(event.target)) {
        Object.defineProperty(event, VLIBRAS_PASS_FLAG, { value: true });
      }
    }, true);
  },

  available() {
    return Boolean(window.VLibras && window.VLibras.Widget);
  },

  start() {
    if (this._started || !this.available()) return;
    this._protectClicks();
    new window.VLibras.Widget(VLIBRAS_APP_URL);
    this._started = true;
    if (this._stage) this._follow();
  },

  _host() {
    return document.getElementById('vlibras-app-root');
  },

  _follow() {
    const tick = () => {
      const host = this._host();
      if (host && host.shadowRoot) {
        if (!this._styled) {
          const style = document.createElement('style');
          style.textContent = EMBED_CSS;
          host.shadowRoot.appendChild(style);
          this._styled = true;
        }
        const r = this._stage.getBoundingClientRect();
        const key = [r.left, r.top, r.width, r.height].map(Math.round).join('|');
        if (key !== this._lastRect) {
          this._lastRect = key;
          const visible = r.width > 2 && r.height > 2;
          host.style.setProperty('--sz-vis', visible ? 'visible' : 'hidden');
          host.style.setProperty('--sz-left', visible ? `${r.left}px` : '-9999px');
          host.style.setProperty('--sz-top', `${r.top}px`);
          host.style.setProperty('--widget-width', `${r.width}px`);
          host.style.setProperty('--player-height', `${Math.max(0, r.height - VLIBRAS_PLAYER_MARGIN)}px`);
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  },

  ready() {
    const isReady = Boolean(this._translateFn());
    if (isReady && !this._readyAt) this._readyAt = Date.now();
    return isReady;
  },

  _translateFn() {
    if (typeof window.vlibras?.translateAndPlay === 'function') return window.vlibras.translateAndPlay;
    if (typeof window.plugin?.translate === 'function') return window.plugin.translate;
    return null;
  },

  _open() {
    if (typeof window.VLibrasWidget?.open === 'function') {
      window.VLibrasWidget.open();
    } else {
      (document.getElementById('vlibras-button') || document.querySelector('[vw-access-button]'))?.click();
    }
  },

  async sign(text) {
    if (!this.available()) {
      throw new Error('VLibras indisponível. Verifique a conexão com a internet.');
    }
    this.start();
    this._open();

    const startedAt = Date.now();
    let translate = this._translateFn();
    while (!translate) {
      if (Date.now() - startedAt > VLIBRAS_LOAD_TIMEOUT_MS) {
        throw new Error('O avatar do VLibras demorou demais para carregar. Verifique a internet.');
      }
      await new Promise(r => setTimeout(r, 300));
      translate = this._translateFn();
    }

    this.ready();
    await this._skipWelcome();
    await translate(text);
  },

  async _skipWelcome() {
    const state = () => window.vlibras || {};
    if (state().isWelcomeFinished) return;

    const waitMs = VLIBRAS_WELCOME_DELAY_MS - (Date.now() - this._readyAt);
    if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));

    if (state().isPlayingWelcome && typeof state().stop === 'function') {
      state().stop();
      await new Promise(r => setTimeout(r, 300));
    }
  }
};
