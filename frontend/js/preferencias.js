const PREFS_KEY = 'prefs';

const PREFS_PADRAO = {
  altoContraste: false,
  tamanhoTexto: 'normal',
  reduzirAnimacoes: false,
  falarSinais: true,
  velocidadeVoz: 1,
  somSinal: false,
  vibrarSinal: false,
  lembrete: false,
  lembreteHora: '19:00'
};

const Prefs = {
  todas() {
    return { ...PREFS_PADRAO, ...(Storage.get(PREFS_KEY, {}) || {}) };
  },

  get(chave) {
    return this.todas()[chave];
  },

  set(chave, valor) {
    const prefs = { ...this.todas(), [chave]: valor };
    const ok = Storage.set(PREFS_KEY, prefs);
    this.aplicar(prefs);
    if (chave.startsWith('lembrete')) this.agendarLembrete();
    return ok;
  },

  aplicar(prefs = this.todas()) {
    const html = document.documentElement;
    html.toggleAttribute('data-alto-contraste', !!prefs.altoContraste);
    html.toggleAttribute('data-reduzir-animacoes', !!prefs.reduzirAnimacoes);
    if (prefs.tamanhoTexto && prefs.tamanhoTexto !== 'normal') html.dataset.texto = prefs.tamanhoTexto;
    else delete html.dataset.texto;
  },

  avisarSinal() {
    const prefs = this.todas();
    if (prefs.somSinal) this.bip();
    if (prefs.vibrarSinal) this.vibrar();
  },

  vibrar() {
    if (navigator.vibrate) return navigator.vibrate(80);
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    label.remove();
    return true;
  },

  _audio: null,

  _audioPronto() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback'; } catch (err) {  }
    }
    this._audio = this._audio || new Ctx();
    if (this._audio.state !== 'running') this._audio.resume().catch(() => {});
    return this._audio;
  },

  bip() {
    try {
      const ctx = this._audioPronto();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (err) {
      console.warn('[Prefs] Não foi possível tocar o som:', err);
    }
  },

  notificacoesSuportadas: 'Notification' in window,

  statusNotificacao() {
    return this.notificacoesSuportadas ? Notification.permission : 'unsupported';
  },

  async pedirPermissaoNotificacao() {
    if (!this.notificacoesSuportadas) return 'unsupported';
    try { return await Notification.requestPermission(); } catch (err) { return Notification.permission; }
  },

  notificar(titulo, corpo) {
    if (this.statusNotificacao() !== 'granted') return false;
    try {
      new Notification(titulo, { body: corpo, lang: 'pt-BR', tag: 'sinaliza' });
      return true;
    } catch (err) {
      return false;
    }
  },

  _timerLembrete: null,
  agendarLembrete() {
    clearTimeout(this._timerLembrete);
    const prefs = this.todas();
    if (!prefs.lembrete || this.statusNotificacao() !== 'granted') return;

    const [h, m] = String(prefs.lembreteHora || '19:00').split(':').map(Number);
    const agora = new Date();
    const alvo = new Date(agora);
    alvo.setHours(h || 0, m || 0, 0, 0);
    const hoje = agora.toDateString();
    if (alvo <= agora) {
      const atrasoMs = agora - alvo;
      if (atrasoMs < 3 * 3600e3 && Storage.get('lembreteUltimo') !== hoje) return this._dispararLembrete();
      alvo.setDate(alvo.getDate() + 1);
    }
    this._timerLembrete = setTimeout(() => this._dispararLembrete(), alvo - agora);
  },

  _dispararLembrete() {
    Storage.set('lembreteUltimo', new Date().toDateString());
    this.notificar('Hora de praticar Libras ✋', 'Que tal treinar alguns sinais no Vozes em Mãos hoje?');
    this.agendarLembrete();
  }
};

Prefs.aplicar();
Prefs.agendarLembrete();

function destravarAudio() {
  if (!Prefs.get('somSinal')) return;
  Prefs._audioPronto();
  ['touchend', 'click'].forEach(ev => document.removeEventListener(ev, destravarAudio, true));
}
['touchend', 'click'].forEach(ev => document.addEventListener(ev, destravarAudio, true));
