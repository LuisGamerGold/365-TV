// Transicao de ondas (azul + branca) usada entre video/video, video/oferta
// e video/previsao do tempo. API pensada em duas fases pra nunca revelar o
// conteudo novo antes da hora, mesmo quando o "preparo" do que vem a seguir
// demora (ex: video ainda carregando):
//
//   cover(onCovered)  - varre as ondas ate cobrir a tela inteira, so' entao
//                        chama onCovered (momento seguro pra trocar o
//                        conteudo por baixo, escondido).
//   reveal()           - continua a varredura, descobrindo o conteudo novo.
//   play(onSwap)        - atalho pro caso comum: cobre, troca, revela.
//
// cover() e' reentrante: se chamada enquanto ja' esta' coberto (um modulo
// encadeando pra outro, ex. oferta terminando e devolvendo pro video), so'
// dispara o callback na hora, sem reiniciar a animacao - o resultado e' uma
// unica onda cobrindo a troca inteira em vez de duas em sequencia.
window.TransitionModule = (function () {
  const overlay = document.getElementById('wave-transition');
  const pair = document.getElementById('wave-pair');

  const COVER_MS = 500;
  const REVEAL_MS = 500;
  const START_X = -2560; // par inteiro fora da tela, a esquerda
  const MID_X = -315;    // par cobrindo os 1920px inteiros (com folga pra ondulacao)
  const END_X = 1930;    // par inteiro fora da tela, a direita

  let covered = false;

  function setTransform(x, durationMs) {
    pair.style.transition = durationMs ? `transform ${durationMs}ms cubic-bezier(.4,0,.2,1)` : 'none';
    pair.style.transform = `translateX(${x}px)`;
  }

  function cover(onCovered) {
    if (covered) {
      if (onCovered) onCovered();
      return;
    }
    covered = true;
    overlay.style.display = 'block';
    setTransform(START_X, 0);
    // forca reflow antes de iniciar a transicao CSS, senao o navegador
    // "funde" os dois estados e a onda nao anima
    // eslint-disable-next-line no-unused-expressions
    pair.offsetHeight;
    setTransform(MID_X, COVER_MS);
    setTimeout(() => {
      if (onCovered) onCovered();
    }, COVER_MS);
  }

  function reveal() {
    if (!covered) return;
    setTransform(END_X, REVEAL_MS);
    setTimeout(() => {
      overlay.style.display = 'none';
      covered = false;
    }, REVEAL_MS + 30);
  }

  function play(onSwap) {
    cover(() => {
      if (onSwap) onSwap();
      reveal();
    });
  }

  return { cover, reveal, play };
})();
