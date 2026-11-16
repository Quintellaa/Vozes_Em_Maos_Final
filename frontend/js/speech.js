const Speech = {
  supported: 'speechSynthesis' in window,

  _voice() {
    const voices = speechSynthesis.getVoices();
    return voices.find(v => v.lang === 'pt-BR') || voices.find(v => v.lang.startsWith('pt')) || null;
  },

  speak(text) {
    if (!this.supported || !text) return false;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = (typeof Prefs !== 'undefined' && Prefs.get('velocidadeVoz')) || 1;
    const voice = this._voice();
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
    return true;
  }
};
