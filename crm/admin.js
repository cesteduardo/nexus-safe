/* Nexus Safe · administração (perfil de quem oferece o serviço)
   Vê agências, contrato, uso e chamados. Não abre ficha nem resposta de saúde. */
(function () {
  'use strict';
  var C = window.Contas, N = window.Nexus, esc = C.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var vista = $('#vista'), painel = $('[data-painel]'), veu = $('[data-veu]');
  var filtroChamados = 'abertos';
  var NOME_SITUACAO = { ativa: 'Ativa', implantacao: 'Em implantação', teste: 'Teste grátis' };
  var COR_SITUACAO = { ativa: 'selo--verde', implantacao: 'selo--azul', teste: 'selo--ambar' };

  C.gravarPerfil({ tipo: 'admin' });

  function toast(msg) { var t = $('[data-toast]'); t.textContent = msg; t.classList.add('visivel'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('visivel'); }, 2600); }
  function abertos(agId) { return C.carregar().chamados.filter(function (k) { return k.situacao !== 'resolvido' && (!agId || k.agenciaId === agId); }); }

  function rota() {
    var h = location.hash.replace(/^#\/?/, '') || 'agencias', partes = h.split('/'), base = partes[0];
    document.querySelectorAll('[data-rota]').forEach(function (a) { if (a.dataset.rota === (base === 'a' ? 'agencias' : base)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (base === 'chamados') { fecharPainel(true); renderChamados(); }
    else { renderAgencias(); if (base === 'a' && partes[1]) abrirPainel(partes[1]); else fecharPainel(true); }
  }

  /* ---------- agências ---------- */
  function renderAgencias() {
    var d = C.carregar();
    var tot = { fichas: 0, asos: 0, mensagens: 0 };
    d.agencias.forEach(function (a) { var u = C.uso(a); tot.fichas += u.fichas; tot.asos += u.asos; tot.mensagens += u.mensagens; });
    var ab = abertos(), altas = ab.filter(function (k) { return k.prioridade === 'alta'; }).length;
    var ativas = d.agencias.filter(function (a) { return a.situacao === 'ativa'; }).length;
    var resumo = [
      [d.agencias.length, 'Agências clientes', ativas + (ativas === 1 ? ' ativa' : ' ativas') + ', as outras em implantação ou teste'],
      [ab.length, 'Chamados em aberto', altas ? altas + ' com prioridade alta' : 'Nenhum com prioridade alta'],
      [tot.fichas, 'Fichas recebidas no mês', tot.asos + ' ASOs emitidos'],
      [tot.mensagens, 'Mensagens de WhatsApp', 'Enviadas pelas automações no mês']
    ];
    var h = '<div class="cab"><div><h1>Agências clientes</h1><p>O que cada agência contratou, como está usando e o que está pendente no suporte.</p></div>' +
      '<div class="cab__acoes"><button class="botao" type="button" data-novo-chamado>+ Novo chamado</button></div></div>';
    h += '<div class="agora agora--fixa">' + resumo.map(function (r) { return '<div class="agora__item"><b>' + r[0] + '</b><span>' + esc(r[1]) + '<small>' + esc(r[2]) + '</small></span></div>'; }).join('') + '</div>';
    h += '<div class="rolagem"><table class="tabela"><thead><tr><th>Agência</th><th>Serviços</th><th>Situação</th><th>Uso no mês</th><th>Chamados</th></tr></thead><tbody>' +
      d.agencias.map(function (a) {
        var u = C.uso(a), k = abertos(a.id).length;
        return '<tr data-ir="#/a/' + a.id + '"><td><a class="agencia__nome" href="#/a/' + a.id + '">' + esc(a.nome) + '</a><small style="display:block;color:var(--apoio);font-size:13px">' + esc(a.cidade) + '</small></td>' +
          '<td><div class="chips">' + a.servicos.map(function (s) { return '<span class="selo">' + esc(C.SERVICOS[s]) + '</span>'; }).join('') + '</div></td>' +
          '<td><span class="selo ' + COR_SITUACAO[a.situacao] + '">' + NOME_SITUACAO[a.situacao] + '</span></td>' +
          '<td>' + u.fichas + ' fichas<br><span style="color:var(--apoio)">' + u.asos + ' ASOs · ' + u.mensagens + ' mensagens</span></td>' +
          '<td>' + (k ? '<span class="selo selo--ambar">' + k + ' em aberto</span>' : '<span style="color:var(--apoio)">Nenhum</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    h += '<p class="aviso-demo" style="margin-top:16px">A Nexus Safe opera a plataforma, mas não abre fichas nem respostas de saúde das agências. Os números acima são contagens. Na versão real, um acesso de suporte a uma ficha só acontece com autorização da agência e fica registrado.</p>';
    vista.innerHTML = h;
  }

  function abrirPainel(id) {
    var a = C.agencia(id); if (!a) { location.hash = '#/agencias'; return; }
    var u = C.uso(a), ks = C.carregar().chamados.filter(function (k) { return k.agenciaId === a.id; });
    var desde = new Date(a.desde).toLocaleDateString('pt-BR');
    var h = '<div class="painel__cab"><div class="painel__linha"><div><h2>' + esc(a.nome) + '</h2><p>' + esc(a.cidade) + ' · cliente desde ' + desde + '</p></div>' +
      '<button class="fechar" type="button" data-fechar aria-label="Fechar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
      '<div class="painel__linha" style="align-items:center"><span class="selo ' + COR_SITUACAO[a.situacao] + '">' + NOME_SITUACAO[a.situacao] + '</span></div></div><div class="painel__corpo">';
    h += '<div class="bloco"><h3>Contrato</h3><dl class="dl"><dt>Serviços</dt><dd>' + a.servicos.map(function (s) { return esc(C.SERVICOS[s]); }).join(', ') + '</dd><dt>Contato</dt><dd>' + esc(a.contato) + '<br><span style="color:var(--apoio)">' + esc(a.tel) + '</span></dd><dt>Usuários</dt><dd>' + a.usuarios + '</dd></dl></div>';
    h += '<div class="bloco"><h3>Uso no mês</h3><dl class="dl"><dt>Fichas recebidas</dt><dd>' + u.fichas + '</dd><dt>ASOs emitidos</dt><dd>' + u.asos + '</dd><dt>Mensagens de WhatsApp</dt><dd>' + u.mensagens + '</dd></dl>' + (a.aoVivo ? '<p style="margin-top:10px;font-size:13px">Números contados do quadro desta agência no modelo.</p>' : '') + '</div>';
    h += '<div class="bloco"><h3>Chamados <button class="botao botao--claro botao--pequeno" type="button" data-novo-chamado="' + a.id + '">+ Novo</button></h3><div class="msgs">' + (ks.length ? ks.map(function (k) { return C.chamadoHtml(k, true); }).join('') : '<p>Nenhum chamado.</p>') + '</div></div>';
    h += '<div class="bloco bloco--trava"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><b>Fichas e respostas de saúde ficam com a agência</b><p>A administração vê contrato, uso e suporte. Dado de saúde é da agência e do candidato (LGPD, art. 11).</p></div>';
    painel.innerHTML = h + '</div>';
    if (painel.hidden) {
      painel.hidden = false; veu.hidden = false;
      requestAnimationFrame(function () { painel.classList.add('aberto'); veu.classList.add('aberto'); });
      document.body.style.overflow = 'hidden';
      painel.setAttribute('tabindex', '-1'); setTimeout(function () { painel.focus(); }, 30);
    }
  }
  function fecharPainel(semHash) {
    if (painel.hidden) return;
    painel.classList.remove('aberto'); veu.classList.remove('aberto'); document.body.style.overflow = '';
    setTimeout(function () { painel.hidden = true; veu.hidden = true; }, 260);
    if (!semHash) location.hash = '#/agencias';
  }

  /* ---------- chamados ---------- */
  function renderChamados() {
    var d = C.carregar();
    var grupos = { abertos: function (k) { return k.situacao !== 'resolvido'; }, resolvidos: function (k) { return k.situacao === 'resolvido'; }, todos: function () { return true; } };
    var lista = d.chamados.filter(grupos[filtroChamados]);
    var h = '<div class="cab"><div><h1>Chamados de TI</h1><p>Impressora, rede, sistema, backup e WhatsApp de todas as agências.</p></div><div class="cab__acoes"><button class="botao" type="button" data-novo-chamado>+ Novo chamado</button></div></div>';
    h += '<div class="segmento" role="group" aria-label="Mostrar" style="margin-bottom:14px">' + [['abertos', 'Em aberto'], ['resolvidos', 'Resolvidos'], ['todos', 'Todos']].map(function (g) { return '<button type="button" data-filtro-chamado="' + g[0] + '" aria-pressed="' + (filtroChamados === g[0]) + '">' + g[1] + ' (' + d.chamados.filter(grupos[g[0]]).length + ')</button>'; }).join('') + '</div>';
    h += '<div class="msgs">' + (lista.length ? lista.map(function (k) { return C.chamadoHtml(k, true); }).join('') : '<p class="aviso-demo">Nenhum chamado aqui.</p>') + '</div>';
    vista.innerHTML = h;
  }

  function novoChamado(agId) {
    var d = C.carregar(), f = $('[data-form-chamado]');
    f.reset(); f.querySelectorAll('.campo__erro').forEach(function (x) { x.remove(); }); f.querySelectorAll('.faltando').forEach(function (x) { x.classList.remove('faltando'); });
    $('[data-sel-agencia]').innerHTML = d.agencias.map(function (a) { return '<option value="' + a.id + '"' + (a.id === agId ? ' selected' : '') + '>' + esc(a.nome) + '</option>'; }).join('');
    $('[data-sel-categoria]').innerHTML = C.CATEGORIAS.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    $('[data-modal-chamado]').showModal();
  }
  function redesenhar() { var id = (location.hash.match(/^#\/a\/(\w+)/) || [])[1]; rota(); if (id) abrirPainel(id); }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('button, a, tr[data-ir], [data-veu]'); if (!t) return;
    if (t.matches('tr[data-ir]') && !ev.target.closest('a')) location.hash = t.dataset.ir;
    else if (t.matches('[data-novo-chamado]')) novoChamado(t.dataset.novoChamado);
    else if (t.matches('[data-fechar], [data-veu]')) fecharPainel();
    else if (t.matches('[data-filtro-chamado]')) { filtroChamados = t.dataset.filtroChamado; renderChamados(); }
    else if (t.matches('[data-situacao]')) {
      var card = t.closest('[data-chamado]'), nota = card.querySelector('[data-nota]').value.trim();
      C.mudarSituacao(card.dataset.chamado, t.dataset.situacao, nota);
      toast(t.dataset.situacao === 'resolvido' ? 'Chamado resolvido' : 'Chamado em andamento');
      redesenhar();
    }
    else if (t.matches('[data-restaurar]')) { if (confirm('Voltar a demonstração ao estado inicial? O que você fez aqui será apagado.')) { C.restaurar(); N.restaurar(); location.hash = '#/agencias'; rota(); toast('Demonstração restaurada'); } }
  });

  $('[data-form-chamado]').addEventListener('submit', function (ev) {
    if (ev.submitter && ev.submitter.value === 'cancelar') return;
    if (window.Campos.validar(ev.target).length) { ev.preventDefault(); return; }
    var fd = new FormData(ev.target);
    C.abrirChamado({ agenciaId: fd.get('agenciaId'), assunto: fd.get('assunto').trim(), categoria: fd.get('categoria'), prioridade: fd.get('prioridade'), por: 'Nexus Safe' });
    toast('Chamado aberto'); redesenhar();
  });

  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !painel.hidden && !document.querySelector('dialog[open]')) fecharPainel(); });
  window.addEventListener('storage', function () { C.recarregar(); N.recarregar(); redesenhar(); });
  window.addEventListener('hashchange', rota);
  rota();
})();
