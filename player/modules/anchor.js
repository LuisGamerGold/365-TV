// Aplica a posicao configurada (ex: 'top-right') a um elemento com classe .anchor,
// trocando a classe pos-* correspondente. Compartilhado entre logo, relogio,
// clima e widget de musica.
window.setAnchorPosition = function setAnchorPosition(el, position) {
  const POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  POSITIONS.forEach((p) => el.classList.remove(`pos-${p}`));
  el.classList.add(`pos-${POSITIONS.includes(position) ? position : 'top-right'}`);
};
