/* Nexus Safe · pílula das abas (a mesma do GR Vagas)
   Em cada .segmento, uma pílula branca desliza até o botão com aria-pressed="true".
   As telas redesenham o HTML a cada clique, então a posição anterior fica guardada
   pelo aria-label do grupo: a pílula nova nasce onde a velha estava e desliza. */
(function () {
  'use strict';
  var ultimo = {};
  var pedido = 0;

  function aplicar(p, r) {
    p.style.width = r.w + 'px';
    p.style.height = r.h + 'px';
    p.style.transform = 'translate(' + r.x + 'px,' + r.y + 'px)';
  }

  function arrumar(seg) {
    var ativo = seg.querySelector('button[aria-pressed="true"]');
    var p = seg.querySelector(':scope > .segmento__pilula');
    if (!p) { p = document.createElement('span'); p.className = 'segmento__pilula'; p.setAttribute('aria-hidden', 'true'); seg.insertBefore(p, seg.firstChild); }
    if (!ativo || !ativo.offsetWidth) { p.style.opacity = '0'; return; }
    p.style.opacity = '';
    var r = { x: ativo.offsetLeft, y: ativo.offsetTop, w: ativo.offsetWidth, h: ativo.offsetHeight };
    var chave = seg.getAttribute('aria-label') || '';
    var antes = ultimo[chave];
    ultimo[chave] = r;
    if (seg.dataset.pronta) { aplicar(p, r); return; }
    aplicar(p, antes || r);
    void p.offsetWidth;
    seg.dataset.pronta = '1';
    if (antes && (antes.x !== r.x || antes.w !== r.w)) requestAnimationFrame(function () { aplicar(p, r); });
  }

  function tudo() { pedido = 0; document.querySelectorAll('.segmento').forEach(arrumar); }
  function agendar() { if (!pedido) pedido = requestAnimationFrame(tudo); }

  new MutationObserver(agendar).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'hidden', 'class'] });
  window.addEventListener('resize', function () { document.querySelectorAll('.segmento').forEach(function (s) { delete s.dataset.pronta; }); agendar(); });
  agendar();
})();
