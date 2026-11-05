/* Nexus Safe · mostra quem entrou e faz o "Sair" em qualquer tela protegida. */
(function () {
  'use strict';
  var C = window.Contas, p = C && C.lerPerfil();
  document.querySelectorAll('[data-usuario]').forEach(function (el) { if (p) el.textContent = 'Conectado como ' + p.usuario; });
  document.addEventListener('click', function (ev) {
    if (!ev.target.closest('[data-sair]')) return;
    var ir = function () { C.sair(); location.href = 'entrar.html'; };
    /* No servidor, apaga a sessão lá também (o cookie é HttpOnly, só o servidor mexe nele). */
    if (window.NEXUS_SERVIDOR) fetch('/api/sair', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }).then(ir, ir);
    else ir();
  });
})();
