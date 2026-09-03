// Move um widget para dentro do slot fixo correspondente a posicao configurada
// (ex: 'top-right'). Os slots (#anchor-top-left, etc.) sao containers flex
// posicionados uma vez no CSS; varios widgets no mesmo slot ficam lado a lado
// em vez de se sobrepor. Compartilhado entre logo, relogio/clima e musica.
window.setAnchorPosition = function setAnchorPosition(el, position) {
  const POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  const pos = POSITIONS.includes(position) ? position : 'top-right';
  const slot = document.getElementById(`anchor-${pos}`);
  if (slot && el.parentElement !== slot) slot.appendChild(el);
};
