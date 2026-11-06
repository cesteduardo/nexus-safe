/* Nexus Safe · mostra quem entrou e faz o "Sair" em qualquer tela protegida. */
(function () {
  'use strict';
  var C = window.Contas, p = C && C.lerPerfil();
  document.querySelectorAll('[data-usuario]').forEach(function (el) { if (p) el.textContent = 'Conectado como ' + p.usuario; });
  /* Trocar senha: botão ao lado do Sair e uma janela com o formulário. */
  var sair = document.querySelector('[data-sair]');
  if (sair) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.setAttribute('data-trocar-senha', ''); btn.textContent = 'Trocar senha';
    sair.parentNode.insertBefore(btn, sair);
    var dlg = document.createElement('dialog');
    dlg.className = 'modal'; dlg.setAttribute('data-modal-senha', '');
    dlg.innerHTML = '<form method="dialog" novalidate><h2>Trocar senha</h2>' +
      (window.NEXUS_SERVIDOR ? '' : '<p class="aviso-demo">Na demonstração a troca não vale: a senha continua 123. Ela só funciona no servidor.</p>') +
      '<label class="campo">Senha atual<input class="entrada" type="password" name="atual" autocomplete="current-password" required></label>' +
      '<label class="campo">Senha nova (mínimo 12 caracteres)<input class="entrada" type="password" name="nova" autocomplete="new-password" minlength="12" required></label>' +
      '<label class="campo">Repita a senha nova<input class="entrada" type="password" name="repete" autocomplete="new-password" required></label>' +
      '<p data-erro-senha role="alert" style="color:#b3261e;font-size:14px;margin:0"></p>' +
      '<div class="modal__acoes"><button class="botao botao--claro" value="cancelar" formnovalidate>Cancelar</button><button class="botao" value="salvar">Trocar senha</button></div></form>';
    document.body.appendChild(dlg);
    var form = dlg.querySelector('form'), msg = dlg.querySelector('[data-erro-senha]');
    btn.addEventListener('click', function () { form.reset(); msg.textContent = ''; msg.style.color = '#b3261e'; dlg.showModal(); });
    form.addEventListener('submit', function (ev) {
      if (ev.submitter && ev.submitter.value === 'cancelar') return;
      ev.preventDefault();
      var a = form.atual.value, n = form.nova.value;
      if (!a || !n) { msg.textContent = 'Preencha a senha atual e a nova.'; return; }
      if (n.length < 12) { msg.textContent = 'A senha nova precisa ter pelo menos 12 caracteres.'; return; }
      if (n !== form.repete.value) { msg.textContent = 'As duas senhas novas não são iguais.'; return; }
      if (!window.NEXUS_SERVIDOR) { msg.textContent = 'Na demonstração a troca não vale. Ela só funciona no servidor.'; return; }
      fetch('/api/senha', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ atual: a, nova: n }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (r) {
          if (r.ok) { msg.style.color = ''; msg.textContent = 'Senha trocada. Suas outras sessões foram encerradas.'; form.reset(); }
          else msg.textContent = r.j.erro || 'Não foi possível trocar a senha.';
        }, function () { msg.textContent = 'Sem conexão. Tente de novo.'; });
    });
  }
  document.addEventListener('click', function (ev) {
    if (!ev.target.closest('[data-sair]')) return;
    var ir = function () { C.sair(); location.href = 'entrar.html'; };
    /* No servidor, apaga a sessão lá também (o cookie é HttpOnly, só o servidor mexe nele). */
    if (window.NEXUS_SERVIDOR) fetch('/api/sair', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }).then(ir, ir);
    else ir();
  });
})();
