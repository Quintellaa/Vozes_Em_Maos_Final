const GLOSS_WORDS = {
  MACA: 'maçã',
  AMERICA: 'América'
};

function glossToWord(gloss) {
  return GLOSS_WORDS[gloss] || String(gloss).toLowerCase();
}
