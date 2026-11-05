/* Nexus Safe · administração (perfil de quem oferece o serviço)
   Vê agências, contrato, uso e chamados. Não abre ficha nem resposta de saúde. */
(function () {
  'use strict';
  var C = window.Contas, N = window.Nexus, esc = C.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var vista = $('#vista'), painel = $('[data-painel]'), veu = $('[data-veu]');
  var filtroChamados = 'abertos';
  /* o relógio dos prazos anda: redesenha a cada minuto se nada estiver sendo digitado */
  setInterval(function () { var a = document.activeElement; if (!a || !a.matches('textarea, input, select')) { if (/chamados/.test(location.hash)) renderChamados(); } }, 60000);
  var NOME_SITUACAO = { ativa: 'Ativa', implantacao: 'Em implantação', teste: 'Teste grátis' };
  var COR_SITUACAO = { ativa: 'selo--verde', implantacao: 'selo--azul', teste: 'selo--ambar' };

  var sessao = C.exigir('admin'); if (!sessao) return;

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
    var ind = C.indicadores(d.chamados);
    var ativas = d.agencias.filter(function (a) { return a.situacao === 'ativa'; }).length;
    var resumo = [
      [d.agencias.length, 'Agências clientes', ativas + (ativas === 1 ? ' ativa' : ' ativas') + ', as outras em implantação ou teste'],
      [ind.abertos, 'Chamados em aberto', ind.fora ? ind.fora + ' fora do prazo' : 'Todos dentro do prazo'],
      [tot.fichas, 'Fichas recebidas no mês', tot.asos + ' ASOs emitidos'],
      [tot.mensagens, 'Mensagens de WhatsApp', 'Enviadas pelas automações no mês']
    ];
    var h = '<div class="cab"><div><h1>Agências clientes</h1><p>O que cada agência contratou, como está usando e o que está pendente no suporte.</p></div>' +
      '<div class="cab__acoes"><button class="botao" type="button" data-novo-chamado>+ Novo chamado</button></div></div>';
    h += '<div class="agora agora--fixa">' + resumo.map(function (r) { return '<div class="agora__item"><b>' + r[0] + '</b><span>' + esc(r[1]) + '<small>' + esc(r[2]) + '</small></span></div>'; }).join('') + '</div>';
    h += '<div class="rolagem rolagem--cartoes"><table class="tabela tabela--cartoes"><thead><tr><th>Agência</th><th>Serviços</th><th>Situação</th><th>Uso no mês</th><th>Chamados</th></tr></thead><tbody>' +
      d.agencias.map(function (a) {
        var u = C.uso(a), k = abertos(a.id).length;
        return '<tr data-ir="#/a/' + a.id + '"><td><a class="agencia__nome" href="#/a/' + a.id + '">' + esc(a.nome) + '</a><small style="display:block;color:var(--apoio);font-size:13px">' + esc(a.cidade) + '</small></td>' +
          '<td data-rotulo="Serviços"><div class="chips">' + a.servicos.map(function (s) { return '<span class="selo">' + esc(C.SERVICOS[s]) + '</span>'; }).join('') + '</div></td>' +
          '<td data-rotulo="Situação"><span class="selo ' + COR_SITUACAO[a.situacao] + '">' + NOME_SITUACAO[a.situacao] + '</span></td>' +
          '<td data-rotulo="Uso no mês">' + u.fichas + ' fichas<br><span style="color:var(--apoio)">' + u.asos + ' ASOs · ' + u.mensagens + ' mensagens</span></td>' +
          '<td data-rotulo="Chamados">' + (k ? '<span class="selo selo--ambar">' + k + ' em aberto</span>' : '<span style="color:var(--apoio)">Nenhum</span>') + '</td></tr>';
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
    h += '<div class="bloco"><h3>Chamados <button class="botao botao--claro botao--pequeno" type="button" data-novo-chamado="' + a.id + '">+ Novo</button></h3><div class="msgs">' + (ks.length ? ks.map(function (k) { return C.chamadoHtml(k, 'nexus'); }).join('') : '<p>Nenhum chamado.</p>') + '</div></div>';
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
    setTimeout(function () { painel.hidden = true; veu.hidden = true; }, 330);
    if (!semHash) location.hash = '#/agencias';
  }

  /* ---------- chamados ---------- */
  var filtroAgencia = '';
  function renderChamados() {
    var d = C.carregar();
    var grupos = {
      abertos: function (k) { return k.situacao !== 'resolvido'; },
      fora: function (k) { return k.situacao !== 'resolvido' && C.prazo(k).fora; },
      aguardando: function (k) { return k.situacao === 'aguardando'; },
      resolvidos: function (k) { return k.situacao === 'resolvido'; },
      todos: function () { return true; }
    };
    var daAgencia = d.chamados.filter(function (k) { return !filtroAgencia || k.agenciaId === filtroAgencia; });
    /* fila: fora do prazo primeiro, depois urgente, depois o mais antigo */
    var peso = { urgente: 0, normal: 1, baixa: 2 };
    var lista = daAgencia.filter(grupos[filtroChamados]).sort(function (a, b) {
      var fa = C.prazo(a).fora && a.situacao !== 'resolvido' ? 0 : 1, fb = C.prazo(b).fora && b.situacao !== 'resolvido' ? 0 : 1;
      if (filtroChamados === 'resolvidos' || filtroChamados === 'todos') return new Date(b.abertoEm) - new Date(a.abertoEm);
      return fa - fb || peso[a.prioridade] - peso[b.prioridade] || new Date(a.abertoEm) - new Date(b.abertoEm);
    });
    var ind = C.indicadores(daAgencia);
    var h = '<div class="cab"><div><h1>Chamados de TI</h1><p>A fila já vem na ordem: fora do prazo, urgente e o mais antigo primeiro.</p></div><div class="cab__acoes"><button class="botao" type="button" data-novo-chamado>+ Novo chamado</button></div></div>';
    h += '<div class="agora agora--fixa">' + [
      [ind.abertos, 'Em aberto', (ind.urgentes ? ind.urgentes + (ind.urgentes > 1 ? ' urgentes' : ' urgente') : 'Nenhum urgente') + (ind.escalonados ? ' · ' + ind.escalonados + ' no nível 2' : '')],
      [ind.fora, 'Fora do prazo', ind.fora ? 'Atender primeiro' : 'Tudo dentro da meta'],
      [ind.respostaMedia, 'Primeira resposta', 'Tempo médio até alguém responder'],
      [ind.avaliados ? ind.boas + '/' + ind.avaliados : 'sem dados', 'Avaliação', 'Chamados que a clínica disse que resolveu']
    ].map(function (r) { return '<div class="agora__item"><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '<small>' + esc(r[2]) + '</small></span></div>'; }).join('') + '</div>';
    h += '<div class="filtros-chamados"><div class="segmento" role="group" aria-label="Mostrar chamados">' + [['abertos', 'Em aberto'], ['fora', 'Fora do prazo'], ['aguardando', 'Aguardando a clínica'], ['resolvidos', 'Resolvidos'], ['todos', 'Todos']].map(function (g) { return '<button type="button" data-filtro-chamado="' + g[0] + '" aria-pressed="' + (filtroChamados === g[0]) + '">' + g[1] + ' (' + daAgencia.filter(grupos[g[0]]).length + ')</button>'; }).join('') + '</div>' +
      '<select class="entrada" data-filtro-agencia aria-label="Agência"><option value="">Todas as agências</option>' + d.agencias.map(function (a) { return '<option value="' + a.id + '"' + (filtroAgencia === a.id ? ' selected' : '') + '>' + esc(a.nome) + '</option>'; }).join('') + '</select></div>';
    h += '<div class="msgs">' + (lista.length ? lista.map(function (k) { return C.chamadoHtml(k, 'nexus'); }).join('') : '<p class="aviso-demo">Nenhum chamado aqui.</p>') + '</div>';
    h += '<details class="bloco" style="margin-top:16px"><summary style="cursor:pointer;font-weight:600;color:var(--tinta)">Metas de atendimento</summary><p style="margin:8px 0 10px">Valores de exemplo para o plano mensal. O relógio começa quando o chamado é aberto e para enquanto ele aguarda a clínica. O que o primeiro atendimento não resolve sobe para o nível 2 com o motivo escrito.</p><ul class="metas">' +
      Object.keys(C.PRIORIDADES).map(function (p) { var x = C.PRIORIDADES[p]; return '<li><b>' + esc(x.nome) + '</b>Responder em ' + C.duracao(x.resposta) + '<br>Resolver em ' + C.duracao(x.solucao) + '</li>'; }).join('') + '</ul></details>';
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
    else if (t.matches('[data-acao]')) {
      var card = t.closest('[data-chamado]'), txt = card.querySelector('[data-resposta]').value.trim(), quem = card.querySelector('[data-responsavel]').value, acao = t.dataset.acao;
      if (!txt) { var r = card.querySelector('[data-resposta]'); r.focus(); r.placeholder = acao === 'resolver' ? 'Escreva o que foi feito para resolver' : acao === 'escalonar' ? 'Escreva por que precisa do nível 2' : 'Escreva a mensagem para a clínica'; r.classList.add('entrada--falta'); return; }
      if (acao === 'escalonar') { C.escalonar(card.dataset.chamado, quem, txt); toast('Chamado passado para o nível 2'); redesenhar(); return; }
      C.atribuir(card.dataset.chamado, quem);
      C.registrar(card.dataset.chamado, 'nexus', quem, txt, acao);
      toast(acao === 'resolver' ? 'Chamado resolvido' : acao === 'pedir' ? 'Pedido enviado à clínica. Prazo pausado.' : 'Resposta enviada');
      redesenhar();
    }
    else if (t.matches('[data-restaurar]') && !N.SERVIDOR) { if (confirm('Voltar a demonstração ao estado inicial? O que você fez aqui será apagado.')) { C.restaurar(); N.restaurar(); location.hash = '#/agencias'; rota(); toast('Demonstração restaurada'); } }
  });

  document.addEventListener('change', function (ev) {
    if (ev.target.matches('[data-filtro-agencia]')) { filtroAgencia = ev.target.value; renderChamados(); }
  });

  $('[data-form-chamado]').addEventListener('submit', function (ev) {
    if (ev.submitter && ev.submitter.value === 'cancelar') return;
    if (window.Campos.validar(ev.target).length) { ev.preventDefault(); return; }
    var fd = new FormData(ev.target);
    C.abrirChamado({ agenciaId: fd.get('agenciaId'), assunto: fd.get('assunto').trim(), descricao: fd.get('descricao').trim(), categoria: fd.get('categoria'), prioridade: fd.get('prioridade'), canal: fd.get('canal'), por: 'Aberto pela Nexus Safe' });
    toast('Chamado aberto'); redesenhar();
  });

  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !painel.hidden && !document.querySelector('dialog[open]')) fecharPainel(); });
  window.addEventListener('storage', function () { C.recarregar(); N.recarregar(); redesenhar(); });
  window.addEventListener('hashchange', rota);
  window.addEventListener('nexus:atualizado', redesenhar);
  window.addEventListener('nexus:erro', function (e) { toast(e.detail || 'Não foi possível concluir.'); });
  N.pronto(rota);
})();
