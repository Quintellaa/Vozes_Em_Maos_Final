const SEGMENT_END_SILENCE_MS = 700;
const MIN_SEGMENT_DETECTED = 6;
const MIN_SEGMENT_HINT = 3;
const MAX_SEGMENT_FRAMES = 450;
const COORD_DECIMALS = 4;
const DETECT_FPS = 20;
const MIN_SHOULDER_RATIO = 0.6;
const MAX_SHOULDER_Y_USE = 0.85;

const HAND_BONES = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17]
];

const Recognizer = {
  _stream: null,
  _stopped: false,
  _overlayCtx: null,
  _buffer: [],
  _lastHandAt: 0,
  _requestInFlight: false,

  async start(videoEl, { onPhrase, onError, onStatus, onSegment, onFrame, overlayEl } = {}) {
    if (!navigator.mediaDevices) {
      onError?.('Câmera não suportada neste navegador.');
      return;
    }

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      videoEl.srcObject = this._stream;
      await videoEl.play();
    } catch (err) {
      onError?.('Não foi possível acessar a câmera. Libere a permissão nas configurações do navegador.');
      return;
    }

    try {
      await HandTracking.init();
    } catch (err) {
      console.error('[Recognizer] Falha ao inicializar o HandTracking:', err);
      onError?.('Não foi possível carregar o reconhecimento de mãos. Verifique sua conexão com a internet.');
      return;
    }

    if (overlayEl) {
      overlayEl.hidden = false;
      this._overlayCtx = overlayEl.getContext('2d');
    }

    this._stopped = false;
    this._buffer = [];
    this._lastHandAt = 0;
    this._runLoop(videoEl, { onPhrase, onError, onStatus, onSegment, onFrame });
  },

  stop() {
    this._stopped = true;
    this._stream?.getTracks().forEach(track => track.stop());
    this._stream = null;
    this._buffer = [];
  },

  _runLoop(videoEl, callbacks) {
    let lastDetectAt = 0;
    const tick = () => {
      if (this._stopped) return;

      const now = performance.now();
      if (videoEl.readyState >= 2 && now - lastDetectAt >= 1000 / DETECT_FPS) {
        lastDetectAt = now;
        if (videoEl.videoWidth && videoEl.videoHeight) this._aspect = videoEl.videoWidth / videoEl.videoHeight;
        const detection = HandTracking.detect(videoEl, performance.now());
        this._drawOverlay(videoEl, detection);
        callbacks.onFrame?.(detection);
        this._collect(detection, callbacks);
      }

      requestAnimationFrame(tick);
    };
    tick();
  },

  _collect({ hands, pose }, callbacks, now = performance.now()) {
    const aspect = this._aspect || 1;
    const round = points => points && points.map(p => ({
      x: +(p.x * aspect).toFixed(COORD_DECIMALS),
      y: +p.y.toFixed(COORD_DECIMALS),
      z: +p.z.toFixed(COORD_DECIMALS)
    }));
    const hasHand = Boolean(hands.left || hands.right);

    if (hasHand) {
      this._lastHandAt = now;
      this._buffer.push({
        pose: round(pose) || null,
        hands: { left: round(hands.left) || null, right: round(hands.right) || null }
      });
    } else if (this._buffer.length) {
      this._buffer.push({ pose: round(pose) || null, hands: { left: null, right: null } });
    }

    const detectedCount = this._buffer.filter(f => f.hands.left || f.hands.right).length;
    const silenceMs = now - this._lastHandAt;
    const ended = this._lastHandAt > 0 && silenceMs >= SEGMENT_END_SILENCE_MS;
    const tooLong = this._buffer.length >= MAX_SEGMENT_FRAMES;

    if (!ended && !tooLong) return;

    const segment = this._buffer;
    this._buffer = [];
    this._lastHandAt = 0;

    if (detectedCount < MIN_SEGMENT_DETECTED) {
      if (detectedCount >= MIN_SEGMENT_HINT) {
        callbacks.onStatus?.('Vi sua mão por pouco tempo. Faça o sinal um pouco mais devagar e com a mão bem visível.');
      }
      return;
    }

    const inFrame = p => p && p.x > 0 && p.x < aspect && p.y > 0 && p.y < 1;
    const withShoulders = segment.filter(f => f.pose && inFrame(f.pose[11]) && inFrame(f.pose[12])).length;
    const withPose = segment.filter(f => f.pose);
    const shoulderY = withPose.length
      ? withPose.reduce((sum, f) => sum + (f.pose[11].y + f.pose[12].y) / 2, 0) / withPose.length
      : 1;
    if (withShoulders / segment.length < MIN_SHOULDER_RATIO || shoulderY > MAX_SHOULDER_Y_USE) {
      callbacks.onStatus?.('Afaste-se: ombros e mãos precisam aparecer.');
      return;
    }

    if (callbacks.onSegment) callbacks.onSegment(segment);
    else this._predict(segment, callbacks);
  },

  async _predict(frames, { onPhrase, onError, onStatus }) {
    if (this._requestInFlight) return;
    this._requestInFlight = true;
    onStatus?.('Reconhecendo...');

    try {
      const result = await Api.predictSign(frames);
      if (result.gloss) {
        onPhrase?.(result.gloss, result.confidence, result.alternatives, result.word || glossToWord(result.gloss));
      } else {
        const guesses = (result.alternatives || [])
          .map(a => `${a.word || glossToWord(a.gloss)} ${Math.round(a.confidence * 100)}%`).join(', ');
        onStatus?.(guesses ? `Não tive certeza. Palpites: ${guesses}` : 'Não reconheci esse sinal. Tente de novo.');
      }
    } catch (err) {
      if (err.status === 503) {
        onError?.('O modelo de reconhecimento não está disponível no servidor.');
      } else if (err.status === 422) {
        onStatus?.('Não consegui ver sua mão direito. Tente de novo.');
      } else {
        onError?.(err.message || 'Falha ao reconhecer o sinal.');
      }
    } finally {
      this._requestInFlight = false;
    }
  },

  _drawOverlay(videoEl, { hands, pose }) {
    const ctx = this._overlayCtx;
    if (!ctx) return;
    const canvas = ctx.canvas;

    if (videoEl.videoWidth && canvas.width !== videoEl.videoWidth) {
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const unit = canvas.width / 110;

    const dots = (points, color, radius) => {
      if (!points) return;
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(15,23,42,.55)';
      ctx.lineWidth = Math.max(1, unit * 0.22);
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    };

    const line = (points, color) => {
      if (!points) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = unit * 0.45;
      ctx.lineCap = 'round';
      for (const [a, b] of HAND_BONES) {
        ctx.beginPath();
        ctx.moveTo(points[a].x * canvas.width, points[a].y * canvas.height);
        ctx.lineTo(points[b].x * canvas.width, points[b].y * canvas.height);
        ctx.stroke();
      }
    };

    if (pose) dots([pose[11], pose[12]].filter(Boolean), '#f59e0b', unit * 1.5);
    line(hands.right, 'rgba(34,197,94,.85)');
    line(hands.left, 'rgba(37,99,235,.85)');
    dots(hands.right, '#22c55e', unit);
    dots(hands.left, '#2563eb', unit);
  }
};
