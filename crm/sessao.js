/* Nexus Safe · mostra quem entrou e faz o "Sair" em qualquer tela protegida. */
(function () {
  'use strict';
  var C = window.Contas, p = C && C.lerPerfil();
  document.querySelectorAll('[data-usuario]').forEach(function (el) { if (p) el.textContent = 'Conectado como ' + p.usuario; });
  document.addEventListener('click', function (ev) {
    if (!ev.target.closest('[data-sair]')) return;
    C.sair(); location.href = 'entrar.html';
  });
})();
