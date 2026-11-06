(function () {
  'use strict';
  var N = window.Nexus;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var vista = $('#vista');
  var painel = $('[data-painel]');
  var veu = $('[data-veu]');
  var filtro = { empresa: '', busca: '', tarefa: '', etapa: '', tipo: '' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function data(iso, comHora) {
    if (!iso) return '';
    var d = new Date(iso);
    var t = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (comHora) t += ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return t;
  }
  function ha(iso) {
    var dias = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    return 'há ' + dias + ' dias';
  }
  function toast(msg) {
    var t = $('[data-toast]');
    t.textContent = msg; t.classList.add('visivel');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('visivel'); }, 2600);
  }
  function linkFicha(c) { return new URL('ficha.html?t=' + c.token, location.href).href; }
  function waLink(c, texto) { var n = String(c.celular || '').replace(/\D/g, ''); if (n.length <= 11) n = '55' + n; return 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto); }
  function textoLink(c) { var d = N.carregar(); return 'Oi, ' + N.primeiroNome(c.nome) + '! Aqui é da ' + d.clinica + '. Antes do seu exame ' + N.nomeTipo(c.tipoExame).toLowerCase() + ', preencha a ficha neste link (leva uns 10 minutos): ' + linkFicha(c); }
  /* Toda mudança passa por N.acao (regras.js): na demonstração grava no navegador, no servidor vai à API. */
  function falhou(e) { toast(e && e.message ? e.message : 'Não foi possível concluir.'); }
  function fazer(nome, id, dados, msg, depois, quieto) {
    return N.acao(nome, id, dados).then(function () {
      if (!quieto) redesenhar();
      if (msg) toast(msg);
      if (depois) depois();
    }, falhou);
  }
  function redesenhar() {
    var id = (location.hash.match(/^#\/c\/(\w+)/) || [])[1];
    rota();
    var c = id && candidato(id); if (c && !painel.hidden) renderPainel(c);
  }
  function ehMedico() { return !!(sessao && sessao.papel === 'medico'); }
  function etapaNome(id) { for (var i = 0; i < N.ETAPAS.length; i++) if (N.ETAPAS[i].id === id) return N.ETAPAS[i].nome; return id; }

  /* ---------- rotas ---------- */
  function rota() {
    var h = location.hash.replace(/^#\/?/, '') || 'quadro';
    var partes = h.split('/');
    var base = partes[0];
    document.querySelectorAll('[data-rota]').forEach(function (a) { if (a.dataset.rota === (base === 'c' ? 'quadro' : base)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (base === 'cadastros') { fecharPainel(true); renderCadastros(); }
    else if (base === 'automacoes') { fecharPainel(true); renderAutomacoes(); }
    else if (base === 'suporte') { fecharPainel(true); renderSuporte(); }
    else if (base === 'periodicos') { fecharPainel(true); renderPeriodicos(); }
    else if (base === 'agenda') { fecharPainel(true); renderAgenda(); }
    else {
      renderQuadro();
      if (base === 'c' && partes[1]) abrirPainel(partes[1]); else fecharPainel(true);
    }
  }

  /* ---------- quadro ---------- */
  /* O que a recepção precisa fazer agora. Cada tarefa é um filtro do quadro. */
  var TAREFAS = [
    { id: 'cobrar', nome: 'Cobrar a ficha', dica: 'Link enviado antes de hoje', teste: function (c) { var hoje = new Date(); hoje.setHours(0, 0, 0, 0); return (c.etapa === 'enviado' || c.etapa === 'preenchendo') && new Date(c.criadoEm) < hoje; } },
    { id: 'agendar', nome: 'Agendar exame', dica: 'Ficha recebida, sem horário', teste: function (c) { return c.etapa === 'recebida'; } },
    { id: 'proximos', nome: 'Exames até amanhã', dica: 'Confirmar presença e preparo', teste: function (c) { if (c.etapa !== 'agendado' || !c.agendadoPara) return false; var fim = new Date(); fim.setDate(fim.getDate() + 1); fim.setHours(23, 59, 59, 999); return new Date(c.agendadoPara) <= fim; } },
    { id: 'aso', nome: 'Emitir ASO', dica: 'Atendido, falta o atestado', teste: function (c) { return c.etapa === 'atendido'; } },
    { id: 'esocial', nome: 'Enviar S-2220', dica: 'ASO emitido, falta o eSocial', teste: function (c) { return c.etapa === 'aso' && c.esocial && c.esocial.status === 'pendente'; } },
    { id: 'admissao', nome: 'Admissão em risco', dica: 'Admite em até 2 dias sem ASO', teste: function (c) { return admissaoRisco(c) !== ''; } }
  ];
  /* A empresa só admite com o ASO na mão: perto da data sem ASO é risco; passou da data é atraso. */
  function admissaoRisco(c) {
    if (!c.admissaoEm || c.tipoExame !== 'admissional' || c.etapa === 'aso') return '';
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var dias = Math.round((new Date(new Date(c.admissaoEm).setHours(0, 0, 0, 0)) - hoje) / 864e5);
    if (dias < 0) return 'atrasada';
    return dias <= 2 ? 'perto' : '';
  }
  function tarefa(id) { for (var i = 0; i < TAREFAS.length; i++) if (TAREFAS[i].id === id) return TAREFAS[i]; return null; }

  function renderQuadro() {
    var d = N.carregar();
    var daEmpresa = d.candidatos.filter(function (c) { return !filtro.empresa || c.empresaId === filtro.empresa; });
    var ativa = tarefa(filtro.tarefa);
    var lista = daEmpresa.filter(function (c) {
      if (ativa && !ativa.teste(c)) return false;
      if (filtro.tipo && c.tipoExame !== filtro.tipo) return false;
      if (filtro.busca) { var b = filtro.busca.toLowerCase(); if ((c.nome + ' ' + c.cpf).toLowerCase().indexOf(b) < 0) return false; }
      return true;
    });
    var agora = '<div class="agora" role="group" aria-label="Para fazer agora">' + TAREFAS.map(function (t) {
      var n = daEmpresa.filter(t.teste).length;
      return '<button type="button" class="agora__item" data-tarefa="' + t.id + '" aria-pressed="' + (filtro.tarefa === t.id) + '"' + (n || filtro.tarefa === t.id ? '' : ' disabled') + '>' +
        '<b>' + n + '</b><span>' + esc(t.nome) + '<small>' + esc(n ? t.dica : 'Nada pendente') + '</small></span></button>';
    }).join('') + '</div>';
    var opts = '<option value="">Todas as empresas</option>' + d.empresas.map(function (e) { return '<option value="' + e.id + '"' + (filtro.empresa === e.id ? ' selected' : '') + '>' + esc(e.nome) + '</option>'; }).join('');
    var optsTipo = '<option value="">Todos os tipos de exame</option>' + N.TIPOS_EXAME.map(function (t) { return '<option value="' + t[0] + '"' + (filtro.tipo === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>'; }).join('');
    var etapaAtiva = filtro.etapa;
    if (!N.ETAPAS.some(function (et) { return et.id === etapaAtiva; })) {
      var prim = N.ETAPAS.filter(function (et) { return lista.some(function (c) { return c.etapa === et.id; }); })[0];
      etapaAtiva = (prim || N.ETAPAS[0]).id;
    }
    var abas = '<div class="abas-etapa" role="group" aria-label="Etapa">' + N.ETAPAS.map(function (et) {
      var n = lista.filter(function (c) { return c.etapa === et.id; }).length;
      return '<button type="button" class="abas-etapa__item" data-etapa="' + et.id + '" aria-pressed="' + (et.id === etapaAtiva) + '">' + esc(et.nome) + '<span>' + n + '</span></button>';
    }).join('') + '</div>';
    var colunas = N.ETAPAS.map(function (et) {
      var itens = lista.filter(function (c) { return c.etapa === et.id; });
      return '<section class="coluna' + (et.id === etapaAtiva ? ' coluna--ativa' : '') + '" aria-label="' + esc(et.nome) + '"><div class="coluna__cab">' + esc(et.nome) + '<span>' + itens.length + '</span></div>' +
        (itens.length ? itens.map(cardHtml).join('') : '<p class="coluna__vazia">Nenhum candidato</p>') + '</section>';
    }).join('');
    vista.innerHTML =
      '<div class="cab"><div><h1>Atendimentos</h1><p>Do link da ficha até o ASO. Clique num cartão para abrir.</p></div>' +
      '<div class="cab__acoes"><button class="botao" type="button" data-novo>+ Novo atendimento</button></div></div>' +
      agora +
      (ativa ? '<p class="agora__filtro">Mostrando só: <b>' + esc(ativa.nome) + '</b> <button type="button" class="link" data-tarefa="">Ver todos</button></p>' : '') +
      '<div class="filtros"><select class="entrada" data-filtro-empresa aria-label="Filtrar por empresa">' + opts + '</select>' +
      '<select class="entrada" data-filtro-tipo aria-label="Filtrar por tipo de exame">' + optsTipo + '</select>' +
      '<input class="entrada" type="search" placeholder="Buscar por nome ou CPF" value="' + esc(filtro.busca) + '" data-filtro-busca aria-label="Buscar"></div>' +
      abas + '<div class="quadro">' + colunas + '</div>';
  }

  function cardHtml(c) {
    var f = N.funcao(c.funcaoId), e = N.empresa(c.empresaId);
    var al = N.alertas(c.ficha, f);
    var meta = [];
    if (c.tipoExame && c.tipoExame !== 'admissional') meta.push('<span class="selo selo--azul">' + esc(N.nomeTipo(c.tipoExame)) + '</span>');
    var parado = c.etapa !== 'aso' && c.etapaDesde ? Math.floor((Date.now() - new Date(c.etapaDesde).getTime()) / 864e5) : 0;
    if (parado > 2) meta.push('<span class="selo selo--ambar" data-parado>Parado há ' + parado + ' dias</span>');
    if (c.etapa === 'enviado') meta.push('<span class="selo">Enviado ' + ha(c.criadoEm) + '</span>');
    if (c.etapa === 'preenchendo') meta.push('<span class="selo selo--azul">Rascunho salvo</span>');
    if (c.etapa === 'agendado' && c.agendadoPara) meta.push('<span class="selo selo--azul">' + data(c.agendadoPara, true) + '</span>');
    if (c.etapa === 'aso' && c.aso) meta.push('<span class="selo ' + (c.aso.resultado === 'Inapto' ? 'selo--vermelho' : 'selo--verde') + '">' + esc(c.aso.resultado) + '</span>');
    if (c.etapa === 'aso' && c.esocial && c.esocial.status === 'pendente') meta.push('<span class="selo selo--ambar">S-2220 até ' + data(c.esocial.prazo) + '</span>');
    var ar = admissaoRisco(c);
    if (ar) meta.push('<span class="selo ' + (ar === 'atrasada' ? 'selo--vermelho' : 'selo--ambar') + '">' + (ar === 'atrasada' ? 'Admissão atrasada' : 'Admite ' + data(c.admissaoEm)) + '</span>');
    if (c.ficha && c.etapa !== 'aso' && ehMedico()) {
      if (al.fortes.length) meta.push('<span class="selo selo--vermelho">' + al.fortes.length + (al.fortes.length > 1 ? ' pontos' : ' ponto') + ' de atenção</span>');
      else if (al.leves.length) meta.push('<span class="selo selo--ambar">' + al.leves.length + (al.leves.length > 1 ? ' respostas' : ' resposta') + ' "sim"</span>');
    }
    var cobrar = TAREFAS[0].teste(c) ? '<button class="botao botao--claro botao--pequeno card__cobrar" type="button" data-cobrar="' + c.id + '">Cobrar no WhatsApp</button>' : '';
    return '<div class="card-caixa"><a class="card" href="#/c/' + c.id + '"><b>' + esc(c.nome) + '</b><div class="card__sub">' + esc(f ? f.nome : '') + ' · ' + esc(e ? e.nome.replace(/ \(fict[íi]ci[ao]\)/, '') : '') + '</div>' +
      (meta.length ? '<div class="card__meta">' + meta.join('') + '</div>' : '') + '</a>' + cobrar + '</div>';
  }

  /* ---------- painel do candidato ---------- */
  function candidato(id) { var d = N.carregar(); for (var i = 0; i < d.candidatos.length; i++) if (d.candidatos[i].id === id) return d.candidatos[i]; return null; }

  var painelOrigem = null;
  function abrirPainel(id) {
    var c = candidato(id);
    if (!c) { location.hash = '#/quadro'; return; }
    if (painel.hidden && ehMedico() && c.ficha) fazer('abrirFicha', c.id, {}, '', null, true);
    renderPainel(c);
    if (painel.hidden) {
      painel.hidden = false; veu.hidden = false;
      requestAnimationFrame(function () { painel.classList.add('aberto'); veu.classList.add('aberto'); });
      document.body.style.overflow = 'hidden';
      painel.setAttribute('tabindex', '-1');
      painel.setAttribute('role', 'dialog'); painel.setAttribute('aria-modal', 'true');
      painelOrigem = id;
      setTimeout(function () { painel.focus(); }, 30);
    }
  }
  function fecharPainel(semHash) {
    if (painel.hidden) return;
    painel.classList.remove('aberto'); veu.classList.remove('aberto');
    document.body.style.overflow = '';
    setTimeout(function () { painel.hidden = true; veu.hidden = true; }, 330);
    if (!semHash) location.hash = '#/quadro';
    var volta = painelOrigem; painelOrigem = null;
    if (!volta) return;
    setTimeout(function () {
      var cartao = document.querySelector('a.card[href="#/c/' + volta + '"]');
      if (cartao) cartao.focus(); else { var v = $('#vista'); if (v) v.focus(); }
    }, 60);
  }
  /* Tab fica dentro do painel enquanto ele está aberto */
  function focaveis() {
    return Array.prototype.filter.call(painel.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])'), function (n) { return !n.disabled && n.offsetParent !== null; });
  }
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Tab' || painel.hidden || document.querySelector('dialog[open]')) return;
    var l = focaveis(); if (!l.length) { ev.preventDefault(); painel.focus(); return; }
    var a = document.activeElement, dentro = painel.contains(a) && a !== painel;
    if (!dentro) { ev.preventDefault(); (ev.shiftKey ? l[l.length - 1] : l[0]).focus(); }
    else if (ev.shiftKey && a === l[0]) { ev.preventDefault(); l[l.length - 1].focus(); }
    else if (!ev.shiftKey && a === l[l.length - 1]) { ev.preventDefault(); l[0].focus(); }
  });

  function renderPainel(c) {
    var f = N.funcao(c.funcaoId), e = N.empresa(c.empresaId);
    var medico = ehMedico();
    var h = '';
    h += '<div class="painel__cab"><div class="painel__linha"><div><h2>' + esc(c.nome) + '</h2><p>' + esc(N.nomeTipo(c.tipoExame)) + ' · ' + esc(f.nome) + ' · ' + esc(e.nome) + '</p></div>' +
      '<button class="fechar" type="button" data-fechar aria-label="Fechar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
      '<div class="painel__linha" style="align-items:center;flex-wrap:wrap"><span class="selo selo--verde">' + esc(etapaNome(c.etapa)) + '</span>' +
      '<span class="selo">' + (medico ? 'Visão da equipe médica' : 'Visão da recepção, sem dados de saúde') + '</span></div></div>';

    h += '<div class="painel__corpo">';

    h += acoesHtml(c, f, medico);

    h += '<div class="bloco"><h3>Cadastro</h3><dl class="dl"><dt>CPF</dt><dd>' + esc(c.cpf) + '</dd><dt>Celular</dt><dd>' + esc(c.celular) + '</dd><dt>Empresa</dt><dd>' + esc(e.nome) + '</dd><dt>Função</dt><dd>' + esc(f.nome) + ' (' + esc(f.setor) + ')</dd>' +
      (c.admissaoEm ? '<dt>Admissão prevista</dt><dd>' + new Date(c.admissaoEm).toLocaleDateString('pt-BR') + (admissaoRisco(c) === 'atrasada' ? ' <span class="selo selo--vermelho">atrasada</span>' : '') + '</dd>' : '') +
      (c.agendadoPara ? '<dt>Exame</dt><dd>' + quandoExame(c) + '</dd>' : '') + '</dl>' +
      (c.etapa !== 'aso' ? '<div class="acoes-linha" style="margin-top:12px"><button class="botao botao--claro botao--pequeno" type="button" data-guia>Guia de encaminhamento</button></div>' : '') + '</div>' + retornoHtml(c) + demissionalHtml(c) + esocialHtml(c);

    var pc = N.carregar().pcmso, prep = N.preparos(f);
    h += '<div class="bloco"><h3>Riscos e protocolo do PCMSO</h3><p class="sub">Riscos da função (PGR)</p><div class="chips">' + f.riscos.map(function (r) { return '<span class="selo selo--ambar">' + esc(N.RISCO_GRUPO[r]) + ': ' + esc(N.RISCOS[r]) + '</span>'; }).join('') + '</div>' +
      '<p class="sub">Exames do protocolo · ' + esc(N.nomeTipo(c.tipoExame).toLowerCase()) + '</p><div class="chips">' + f.exames.map(function (x) { return '<span class="selo"><b style="font-weight:700">' + esc(N.CATALOGO[x].codigo) + '</b> ' + esc(N.EXAMES[x]) + '</span>'; }).join('') + '</div>' +
      (prep.length ? '<p class="sub">Preparo (vai na confirmação)</p><p style="font-size:14px">' + esc(prep.join('; ').replace(/^./, function (x) { return x.toUpperCase(); })) + '.</p>' : '') +
      '<p style="font-size:13px;margin-top:12px">Protocolo aprovado por ' + esc(pc.coordenador) + ', médico coordenador do PCMSO, em ' + new Date(pc.aprovadoEm).toLocaleDateString('pt-BR') + '. Periódico a cada ' + f.periodicidade + ' meses.</p></div>';

    if (medico) {
      if (c.ficha) {
        var al = N.alertas(c.ficha, f);
        h += '<div class="bloco"><h3>Pontos de atenção</h3>' + (al.fortes.length + al.leves.length ? '<ul class="atencao">' + al.fortes.map(function (t) { return '<li class="forte">' + esc(t) + '</li>'; }).join('') + al.leves.map(function (t) { return '<li class="leve">' + esc(t) + '</li>'; }).join('') + '</ul>' : '<p>Nenhuma resposta "sim" na ficha.</p>') + '</div>';
        h += fichaHtml(c.ficha, f, c.fichaAssinatura).replace(/<\/div>$/, '<div class="acoes-linha" style="margin-top:12px"><button class="botao botao--claro botao--pequeno" type="button" data-imprimir-ficha>Imprimir ficha</button></div></div>');
      } else {
        h += '<div class="bloco"><h3>Ficha</h3><p>' + (c.etapa === 'preenchendo' ? 'O candidato está preenchendo. O rascunho fica salvo no celular dele até o envio.' : 'A ficha ainda não foi preenchida.') + '</p></div>';
      }
    } else {
      h += '<div class="bloco bloco--trava"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><b>A ficha de saúde fica só com a equipe médica</b><p>Dado de saúde é dado sensível (LGPD, art. 11). A recepção cuida do cadastro, da agenda e das etapas; a empresa recebe só o ASO, sem diagnóstico.</p></div>';
    }

    h += '<div class="bloco"><h3>Histórico</h3><ol class="linha-tempo">' + c.historico.slice().reverse().map(function (x) { return '<li><time>' + data(x.em, true) + '</time><span>' + esc(x.txt) + '</span></li>'; }).join('') + '</ol></div>';
    h += '</div>';
    painel.innerHTML = h;
  }

  function quandoExame(c) { return c.agendadoModo === 'chegada' ? new Date(c.agendadoPara).toLocaleDateString('pt-BR') + ', por ordem de chegada (7h às 11h)' : data(c.agendadoPara, true); }

  /* NR-7: o exame de retorno é obrigatório depois de 30 dias ou mais de afastamento por doença ou acidente. */
  function retornoHtml(c) {
    if (c.tipoExame !== 'retorno_trabalho' || !c.afastadoDesde || c.etapa === 'aso') return '';
    var dias = Math.floor((Date.now() - new Date(c.afastadoDesde)) / 864e5), precisa = dias >= 30;
    return '<div class="bloco"><h3>Retorno ao trabalho ' + (precisa ? '<span class="selo selo--azul">Exame obrigatório</span>' : '<span class="selo selo--verde">Pode não precisar</span>') + '</h3><p>Afastado desde ' + new Date(c.afastadoDesde).toLocaleDateString('pt-BR') + ', há ' + dias + ' dias. ' +
      (precisa ? 'Com 30 dias ou mais de afastamento, a NR-7 pede o exame antes de a pessoa voltar à função.' : 'Com menos de 30 dias, a NR-7 não exige o exame de retorno. Confirme com o médico coordenador.') + '</p></div>';
  }

  /* NR-7: demissional dispensável se o último ASO da pessoa é recente para o grau de risco da empresa. */
  function demissionalHtml(c) {
    if (c.tipoExame !== 'demissional' || c.etapa === 'aso') return '';
    var e = N.empresa(c.empresaId), limite = N.limiteDispensa(e.grauRisco || 3);
    var ant = N.carregar().candidatos.filter(function (x) { return x.id !== c.id && x.cpf === c.cpf && x.aso; }).sort(function (a, b) { return new Date(b.aso.data) - new Date(a.aso.data); })[0];
    if (!ant) return '<div class="bloco"><h3>Demissional</h3><p>Nenhum ASO anterior desta pessoa no sistema. O exame demissional é necessário.</p></div>';
    var dias = Math.floor((Date.now() - new Date(ant.aso.data)) / 864e5), pode = dias < limite;
    return '<div class="bloco"><h3>Demissional ' + (pode ? '<span class="selo selo--verde">Pode ser dispensado</span>' : '<span class="selo">Exame necessário</span>') + '</h3><p>Último ASO em ' + new Date(ant.aso.data).toLocaleDateString('pt-BR') + ' (' + esc(N.nomeTipo(ant.tipoExame).toLowerCase()) + '), há ' + dias + ' dias. A empresa é grau de risco ' + (e.grauRisco || 3) + ': a NR-7 permite dispensar o demissional se o último exame tiver menos de ' + limite + ' dias.' + (pode ? ' Confirme com o médico coordenador antes de dispensar.' : '') + '</p></div>';
  }

  function esocialHtml(c) {
    if (!c.esocial) return '';
    var ok = c.esocial.status === 'enviado';
    return '<div class="bloco"><h3>eSocial S-2220 <span class="selo ' + (ok ? 'selo--verde' : 'selo--ambar') + '">' + (ok ? 'Enviado' : 'Pendente') + '</span></h3><p>' +
      (ok ? 'Enviado em ' + new Date(c.esocial.enviadoEm).toLocaleDateString('pt-BR') + (c.esocial.recibo ? '. Recibo ' + esc(c.esocial.recibo) : '') + '.' : 'O evento de monitoramento da saúde do trabalhador precisa ir ao eSocial até ' + new Date(c.esocial.prazo).toLocaleDateString('pt-BR') + ' (dia 15 do mês seguinte ao ASO).') + '</p>' +
      '<div class="acoes-linha" style="margin-top:10px">' + (ok ? '' : '<button class="botao botao--pequeno" type="button" data-esocial>Marcar como enviado</button>') + '<button class="botao botao--claro botao--pequeno" type="button" data-xml>Baixar XML do S-2220</button></div>' +
      '<p style="font-size:13px;margin-top:8px">O XML sai pronto com empresa, trabalhador, tipo de exame, resultado, médico e coordenador do PCMSO. É um exemplo para conferir: falta o código de cada exame na Tabela 27 e a matrícula, e a transmissão fica com o sistema da clínica ou da empresa.</p></div>';
  }

  function confirmarHtml(c, f) {
    var fim = new Date(); fim.setDate(fim.getDate() + 1); fim.setHours(23, 59, 59, 999);
    if (!c.agendadoPara || new Date(c.agendadoPara) > fim) return '';
    var prep = N.preparos(f);
    return '<div class="bloco-confirmar" style="margin-bottom:12px"><p style="font-size:14px">Exame ' + (c.agendadoModo === 'chegada' ? 'por ordem de chegada' : 'às ' + new Date(c.agendadoPara).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })) + '.' + (prep.length ? ' Preparo: ' + esc(prep.join('; ')) + '.' : '') + (c.confirmadoEm ? ' Presença já confirmada em ' + data(c.confirmadoEm, true) + '.' : '') + '</p>' +
      '<div class="acoes-linha" style="margin-top:8px"><button class="botao botao--claro botao--pequeno" type="button" data-confirmar>Confirmar presença no WhatsApp</button></div></div>';
  }

  function acoesHtml(c, f, medico) {
    var h = '<div class="bloco"><h3>Próximo passo</h3>';
    if ((c.etapa === 'enviado' || c.etapa === 'preenchendo') && window.NexusRegras.linkExpirado(c)) {
      h += '<p data-link-expirado style="margin-bottom:10px">O link da ficha venceu em ' + new Date(c.expiraEm).toLocaleDateString('pt-BR') + '. Gere um novo: o anterior deixa de valer.</p>' +
        '<div class="acoes-linha"><button class="botao" type="button" data-novo-link>Gerar novo link</button></div>';
    } else if (c.etapa === 'enviado' || c.etapa === 'preenchendo') {
      h += '<div class="link-ficha"><input class="entrada" readonly value="' + esc(linkFicha(c)) + '" aria-label="Link da ficha"><button class="botao botao--claro botao--pequeno" type="button" data-copiar>Copiar</button></div>' +
        '<div class="acoes-linha"><a class="botao botao--pequeno" target="_blank" rel="noopener" href="' + esc(waLink(c, textoLink(c))) + '">Mandar no WhatsApp</a>' +
        '<a class="botao botao--claro botao--pequeno" target="_blank" rel="noopener" href="' + esc(linkFicha(c)) + '">Abrir a ficha como o candidato</a></div>' +
        '<div class="acoes-linha" style="margin-top:8px"><button class="botao botao--claro botao--pequeno" type="button" data-novo-link>Gerar novo link</button></div>' +
        '<p style="margin-top:10px;font-size:13.5px">O link vale até ' + new Date(c.expiraEm).toLocaleDateString('pt-BR') + '. Dica: abra a ficha, preencha no lugar do candidato e volte aqui. O cartão muda de coluna sozinho.</p>';
    } else if (c.etapa === 'recebida') {
      var sug = new Date(); sug.setDate(sug.getDate() + 1); sug.setHours(8, 0, 0, 0);
      var v = new Date(sug.getTime() - sug.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
      h += '<p style="margin-bottom:10px">Ficha recebida. Marque o exame: a confirmação sai pelo WhatsApp com as orientações da função.</p><div class="acoes-linha"><label class="campo">Como atende<select class="entrada" data-agenda-modo><option value="hora">Horário marcado</option><option value="chegada">Ordem de chegada (7h às 11h)</option></select></label><label class="campo">Data e hora<input class="entrada" type="datetime-local" value="' + v + '" data-agenda></label><button class="botao" type="button" data-agendar>Agendar exame</button></div>';
    } else if (c.etapa === 'agendado') {
      h += '<p style="margin-bottom:10px">Exame em ' + quandoExame(c) + '. Quando o candidato for atendido, marque aqui.</p>' + confirmarHtml(c, f) + '<div class="acoes-linha"><button class="botao" type="button" data-atendido>Marcar como atendido</button></div>';
    } else if (c.etapa === 'atendido' && !medico) {
      h += '<p>Atendido. O ASO é emitido pela equipe médica; quando sair, aparece aqui e o RH é avisado.</p>';
    } else if (c.etapa === 'atendido') {
      h += '<p style="margin-bottom:10px">Emitir o ASO. O RH da empresa recebe só a aptidão, sem diagnóstico.</p>' +
        '<div class="acoes-linha"><label class="campo">Aptidão<select class="entrada" data-aso-resultado><option>Apto</option><option>Apto com restrição</option><option>Inapto</option></select></label>' +
        '<label class="campo">Médico(a) examinador(a)<input class="entrada" value="Dra. Camila Rocha" data-aso-medico></label></div>' +
        '<label class="campo" style="margin-top:10px">Restrições <small>Só se for apto com restrição</small><input class="entrada" data-aso-restricoes placeholder="Ex.: não trabalhar em altura por 90 dias"></label>' +
        '<label class="campo" style="margin-top:10px">Observação pública (sai no ASO)<input class="entrada" data-aso-obs placeholder="Opcional"></label>' +
        '<div class="acoes-linha" style="margin-top:12px"><button class="botao" type="button" data-emitir>Emitir ASO</button></div>';
    } else if (c.etapa === 'aso') {
      h += '<p style="margin-bottom:10px">ASO emitido em ' + data(c.aso.data) + ': <b style="color:var(--tinta)">' + esc(c.aso.resultado) + '</b>.' + (c.aso.validade ? ' Próximo periódico até ' + new Date(c.aso.validade).toLocaleDateString('pt-BR') + '.' : '') + '</p><div class="acoes-linha"><button class="botao" type="button" data-ver-aso>Ver ASO</button></div>';
    }
    return h + '</div>';
  }

  function simNao(o) { return o && o.sim ? '<dd class="sim">Sim' + (o.detalhe ? ': ' + esc(o.detalhe) : '') + '</dd>' : '<dd>Não</dd>'; }

  /* ass: no servidor, a hora do envio vem do relógio do servidor e o IP de quem assinou */
  function fichaHtml(fi, f, ass) {
    var p = fi.pessoais || {};
    var h = '<div class="bloco"><h3>Ficha preenchida <span class="selo">enviada ' + data(ass && ass.em || fi.enviadoEm, true) + (ass && ass.ip ? ' · IP ' + esc(ass.ip) : '') + '</span></h3>';
    h += '<p class="sub">Dados pessoais</p><dl class="dl">' +
      (p.nome_social ? '<dt>Nome social</dt><dd>' + esc(p.nome_social) + '</dd>' : '') +
      '<dt>Nascimento</dt><dd>' + esc(p.nascimento ? p.nascimento.split('-').reverse().join('/') : '') + '</dd><dt>Sexo</dt><dd>' + esc(p.sexo) + '</dd><dt>Estado civil</dt><dd>' + esc(p.estado_civil) + '</dd><dt>Escolaridade</dt><dd>' + esc(p.escolaridade) + '</dd><dt>Endereço</dt><dd>' + esc(p.endereco) + '</dd><dt>Emergência</dt><dd>' + esc(p.emergencia_nome) + (p.emergencia_parentesco ? ' (' + esc(p.emergencia_parentesco.toLowerCase()) + ')' : '') + ' ' + esc(p.emergencia_tel) + '</dd><dt>PcD</dt>' + simNao(p.pcd) + '</dl>';
    h += '<p class="sub">Trabalhos anteriores</p>';
    if (fi.trabalhos && fi.trabalhos.length) h += fi.trabalhos.map(function (t) { return '<dl class="dl" style="margin-bottom:8px"><dt>' + esc(t.empresa) + '</dt><dd>' + esc(t.funcao) + ', ' + esc(t.tempo) + (t.exposicoes && t.exposicoes.length ? '<br><span style="color:var(--apoio)">Exposto a: ' + esc(t.exposicoes.join(', ')) + '</span>' : '') + '<br><span style="color:var(--apoio)">Usava EPI: ' + (t.epi === 'sim' ? 'sim' : t.epi === 'nao' ? 'não' : 'às vezes') + '</span></dd></dl>'; }).join('');
    else h += '<p>Primeiro emprego.</p>';
    var a = fi.acidentes || {};
    h += '<dl class="dl"><dt>Acidente de trabalho</dt>' + simNao(a.acidente) + '<dt>Afastamento INSS</dt>' + simNao(a.inss) + '<dt>Doença ocupacional</dt>' + simNao(a.ocupacional) + '</dl>';
    h += '<p class="sub">Saúde</p><dl class="dl">' + N.SAUDE.map(function (s) { return '<dt>' + esc(s[1]) + '</dt>' + simNao((fi.saude || {})[s[0]]); }).join('') +
      '<dt>Cirurgias</dt><dd>' + esc(fi.cirurgias || 'Nenhuma') + '</dd><dt>Remédios</dt><dd>' + esc(fi.remedios || 'Nenhum') + '</dd><dt>Alergias</dt><dd>' + esc(fi.alergias || 'Nenhuma') + '</dd><dt>Usa óculos ou lente</dt><dd>' + (fi.oculos === 'sim' ? 'Sim' : 'Não') + '</dd></dl>';
    var hb = fi.habitos || {};
    h += '<p class="sub">Hábitos e família</p><dl class="dl"><dt>Fuma</dt><dd>' + (hb.fuma === 'sim' ? 'Sim' + (hb.fuma_detalhe ? ': ' + esc(hb.fuma_detalhe) : '') : hb.fuma === 'parou' ? 'Parou' : 'Não') + '</dd><dt>Álcool</dt><dd>' + esc(hb.alcool) + '</dd><dt>Atividade física</dt><dd>' + (hb.atividade === 'sim' ? 'Sim' : 'Não') + '</dd><dt>Família</dt><dd>' + esc((fi.familia || []).join(', ') || 'Nada informado') + '</dd></dl>';
    var esp = fi.especificas || {};
    var chaves = [];
    f.riscos.forEach(function (r) { (N.ESPECIFICAS[r] || []).forEach(function (q) { if (chaves.indexOf(q[0]) < 0) chaves.push(q[0]); }); });
    if (chaves.length) h += '<p class="sub">Sobre a função</p><dl class="dl">' + chaves.map(function (k) { return '<dt>' + esc(N.nomeEspecifica(k)) + '</dt>' + simNao(esp[k]); }).join('') + '</dl>';
    h += '<p class="sub">Declaração</p><p>Declarou que as informações são verdadeiras e aceitou o tratamento dos dados de saúde pela clínica.</p>';
    if (fi.assinatura) h += '<img class="assinatura" src="' + esc(fi.assinatura) + '" alt="Assinatura do candidato">';
    return h + '</div>';
  }

  /* ---------- ASO ---------- */
  function asoHtml(c) { return N.asoHtml(c); }
  function abrirAso(c) { $('[data-aso-conteudo]').innerHTML = asoHtml(c); $('[data-modal-aso]').showModal(); }

  /* ---------- cadastros ---------- */
  function renderCadastros() {
    var d = N.carregar();
    var h = '<div class="cab"><div><h1>Empresas e funções</h1><p>Cada função diz quais riscos tem e quais exames pede. É isso que monta a ficha e o ASO.</p></div><div class="cab__acoes"><button class="botao botao--claro" type="button" data-nova-empresa>+ Empresa</button>' + (ehMedico() ? '<button class="botao" type="button" data-nova-funcao>+ Função</button>' : '') + '</div></div>';
    h += '<div class="rolagem"><table class="tabela"><thead><tr><th>Empresa cliente</th><th>CNPJ</th><th>Contato</th><th>Candidatos</th></tr></thead><tbody>' +
      d.empresas.map(function (e) { var n = d.candidatos.filter(function (c) { return c.empresaId === e.id; }).length; return '<tr><td><b>' + esc(e.nome) + '</b></td><td>' + esc(e.cnpj) + '</td><td>' + esc(e.contato) + '<br><span style="color:var(--apoio)">' + esc(e.tel) + '</span></td><td>' + n + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<h2 class="titulo-secao">Funções</h2><div class="rolagem"><table class="tabela"><thead><tr><th>Função</th><th>Empresa</th><th>Riscos (PGR)</th><th>Protocolo do PCMSO</th></tr></thead><tbody>' +
      d.funcoes.map(function (f) { var e = N.empresa(f.empresaId); return '<tr><td><b>' + esc(f.nome) + '</b><br><span style="color:var(--apoio)">' + esc(f.setor) + '</span></td><td>' + esc(e.nome) + '</td><td><div class="chips">' + f.riscos.map(function (r) { return '<span class="selo selo--ambar">' + esc(N.RISCO_GRUPO[r]) + ': ' + esc(N.RISCOS[r]) + '</span>'; }).join('') + '</div></td><td><div class="chips">' + f.exames.map(function (x) { return '<span class="selo">' + esc(N.EXAMES[x]) + '</span>'; }).join('') + '</div><span style="font-size:13px;color:var(--apoio)">Periódico a cada ' + f.periodicidade + ' meses</span></td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<p class="aviso-demo" style="margin-top:16px">Como no SST: o exame não sai direto do risco. Ele vem do protocolo do PCMSO, aprovado pelo médico coordenador (' + esc(d.pcmso.coordenador) + '). No modelo, o que você cadastra aqui fica só neste navegador. A recepção cadastra empresas; as funções, com riscos e protocolo, são da equipe médica.</p>';
    vista.innerHTML = h;
  }

  /* cadastro de empresa e função (no modelo, só neste navegador) */
  function abrirForm(sel, erro) { var f = $(sel); f.reset(); f.querySelectorAll('.campo__erro').forEach(function (x) { x.remove(); }); f.querySelector(erro).textContent = ''; return f; }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-nova-empresa], [data-nova-funcao]'); if (!t) return;
    if (t.matches('[data-nova-empresa]')) { abrirForm('[data-form-empresa]', '[data-erro-empresa]'); $('[data-modal-empresa]').showModal(); return; }
    var f = abrirForm('[data-form-funcao]', '[data-erro-funcao]'), d = N.carregar();
    f.querySelector('[data-sel-empresa-funcao]').innerHTML = d.empresas.map(function (e) { return '<option value="' + e.id + '">' + esc(e.nome) + '</option>'; }).join('');
    f.querySelector('[data-riscos-opcoes]').innerHTML = Object.keys(N.RISCOS).map(function (k) { return '<label><input type="checkbox" name="riscos" value="' + k + '"> ' + esc(N.RISCO_GRUPO[k]) + ': ' + esc(N.RISCOS[k]) + '</label>'; }).join('');
    f.querySelector('[data-exames-opcoes]').innerHTML = Object.keys(N.EXAMES).map(function (k) { return '<label><input type="checkbox" name="exames" value="' + k + '"' + (k === 'clinico' ? ' checked' : '') + '> ' + esc(N.EXAMES[k]) + '</label>'; }).join('');
    $('[data-modal-funcao]').showModal();
  });
  document.addEventListener('input', function (ev) { if (ev.target.matches('[data-form-empresa] [name=cnpj]')) { var v = ev.target.value.replace(/\D/g, '').slice(0, 14); ev.target.value = v.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2'); } });
  document.addEventListener('submit', function (ev) {
    var f = ev.target, ehE = f.matches('[data-form-empresa]'), ehF = f.matches('[data-form-funcao]');
    if (!ehE && !ehF) return;
    if (ev.submitter && ev.submitter.value === 'cancelar') return;
    var erro = f.querySelector(ehE ? '[data-erro-empresa]' : '[data-erro-funcao]');
    if (window.Campos.validar(f).length) { ev.preventDefault(); erro.textContent = ''; return; }
    var fd = new FormData(f), dados = ehE ? { nome: fd.get('nome'), cnpj: fd.get('cnpj'), contato: fd.get('contato'), tel: fd.get('tel'), grauRisco: fd.get('grauRisco') }
      : { empresaId: fd.get('empresaId'), nome: fd.get('nome'), setor: fd.get('setor'), riscos: fd.getAll('riscos'), exames: fd.getAll('exames'), periodicidade: fd.get('periodicidade') };
    ev.preventDefault();
    N.cadastrar(ehE ? 'criarEmpresa' : 'criarFuncao', dados).then(function () { f.closest('dialog').close(); renderCadastros(); toast(ehE ? 'Empresa cadastrada' : 'Função cadastrada'); }, function (e) { erro.textContent = e && e.message ? e.message : 'Não foi possível cadastrar.'; });
  });

  /* ---------- automações ---------- */
  /* Quem tem exame amanhã (sem lembrete) e quem tem ASO vencendo em até 30 dias (sem aviso ao RH nem convocação). */
  function pendentesAutomacao() {
    var d = N.carregar(), hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
    var vesperas = d.candidatos.filter(function (c) {
      if (c.etapa !== 'agendado' || !c.agendadoPara || c.confirmadoEm) return false;
      var dia = new Date(c.agendadoPara); dia.setHours(0, 0, 0, 0);
      return dia.getTime() === amanha.getTime();
    });
    var periodicos = d.candidatos.filter(function (c) {
      if (!c.aso || !c.aso.validade || c.avisoRhEm || c.convocadoEm) return false;
      var dias = Math.round((new Date(c.aso.validade) - hoje) / 864e5);
      return dias >= 0 && dias <= 30;
    });
    return { vesperas: vesperas, periodicos: periodicos };
  }
  function rodarAutomacoes() {
    var p = pendentesAutomacao(), tarefas = [];
    p.vesperas.forEach(function (c) { tarefas.push(['confirmar', c.id]); });
    p.periodicos.forEach(function (c) { tarefas.push(['avisarRh', c.id]); });
    if (!tarefas.length) { toast('Nada a gerar agora'); return; }
    var seq = Promise.resolve();
    tarefas.forEach(function (t) { seq = seq.then(function () { return N.acao(t[0], t[1], {}); }); });
    seq.then(function () { redesenhar(); toast(tarefas.length + ' mensagem(ns) na fila'); }, falhou);
  }
  function renderAutomacoes() {
    var d = N.carregar();
    var h = '<div class="cab"><div><h1>Automações</h1><p>Mensagens que saem sozinhas quando algo acontece no quadro.</p></div></div>';
    h += '<p class="aviso-demo">No modelo, nada é enviado de verdade: as mensagens caem na fila ao lado para você ver o que sairia. Na versão real, elas vão pela API oficial do WhatsApp.</p>';
    var pend = pendentesAutomacao();
    h += '<div class="acoes-linha" style="margin:12px 0"><button class="botao" type="button" data-rodar-autos>Rodar automações agora</button><span data-rodar-resumo>' + (pend.vesperas.length + pend.periodicos.length ? pend.vesperas.length + ' lembrete(s) da véspera e ' + pend.periodicos.length + ' aviso(s) de periódico a gerar.' : 'Nada a gerar agora.') + '</span></div>';
    h += '<div class="duas-col"><div><div class="lista-autos">' + d.automacoes.map(function (a) {
      return '<div class="auto"><div><b>' + esc(a.nome) + '</b><span>' + esc(a.quando) + ' · para ' + esc(a.para) + '</span></div><label class="chave"><input type="checkbox" data-auto="' + a.id + '"' + (a.ativo ? ' checked' : '') + ' aria-label="Ativar ' + esc(a.nome) + '"><span></span></label></div>';
    }).join('') + '</div></div>';
    h += '<div><h2 class="titulo-secao" style="margin-top:0">Fila de mensagens</h2><div class="msgs">' + (d.mensagens.length ? d.mensagens.map(function (m) {
      var a = d.automacoes.filter(function (x) { return x.id === m.automacao; })[0];
      return '<div class="msg"><div class="msg__cab"><span>Para <b>' + esc(m.para) + '</b></span><span>' + data(m.em, true) + '</span></div><p>' + esc(m.texto) + '</p><div style="margin-top:8px"><span class="selo">' + esc(a ? a.nome : m.automacao) + '</span></div></div>';
    }).join('') : '<p class="aviso-demo">Nenhuma mensagem ainda.</p>') + '</div></div></div>';
    vista.innerHTML = h;
  }

  /* ---------- agenda: exames agendados por dia e horário, com o preparo ---------- */
  function renderAgenda() {
    var d = N.carregar(), hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var lista = d.candidatos.filter(function (c) { return c.etapa === 'agendado' && c.agendadoPara; })
      .sort(function (a, b) { return new Date(a.agendadoPara) - new Date(b.agendadoPara); });
    var h = '<div class="cab"><div><h1>Agenda</h1><p>Exames agendados por dia e horário, com o preparo que cada pessoa precisa seguir.</p></div></div>';
    if (!lista.length) { vista.innerHTML = h + '<p class="aviso-demo" data-agenda-vazia>Nenhum exame agendado.</p>'; return; }
    var dias = [];
    lista.forEach(function (c) {
      var k = new Date(c.agendadoPara); k.setHours(0, 0, 0, 0);
      var g = dias.filter(function (x) { return x.k.getTime() === k.getTime(); })[0];
      if (!g) { g = { k: k, itens: [] }; dias.push(g); }
      g.itens.push(c);
    });
    dias.forEach(function (g) {
      var diff = Math.round((g.k - hoje) / 864e5);
      var rot = diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : diff < 0 ? 'Atrasado' : g.k.toLocaleDateString('pt-BR', { weekday: 'long' });
      h += '<h2 class="titulo-secao" data-agenda-dia>' + rot + ', ' + g.k.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + '</h2>';
      h += '<div class="rolagem"><table class="tabela"><thead><tr><th>Horário</th><th>Pessoa</th><th>Exame</th><th>Preparo</th></tr></thead><tbody>' + g.itens.map(function (c) {
        var f = N.funcao(c.funcaoId), e = N.empresa(c.empresaId), prep = f ? N.preparos(f) : [];
        var hora = c.agendadoModo === 'chegada' ? 'Ordem de chegada<br><span style="color:var(--apoio)">7h às 11h</span>' : new Date(c.agendadoPara).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return '<tr data-agenda-linha><td><b>' + hora + '</b></td><td><a href="#/c/' + c.id + '"><b>' + esc(c.nome) + '</b></a><br><span style="color:var(--apoio)">' + esc(e ? e.nome : '') + '</span></td><td>' + esc(N.nomeTipo(c.tipoExame)) + '</td><td>' + (prep.length ? esc(prep.join('; ')) : '<span style="color:var(--apoio)">Sem preparo</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    });
    vista.innerHTML = h;
  }

  /* ---------- periódicos: a clínica avisa antes de vencer ---------- */
  function renderPeriodicos() {
    var d = N.carregar(), hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var lista = d.candidatos.filter(function (c) { return c.aso && c.aso.validade; }).map(function (c) { return { c: c, dias: Math.round((new Date(c.aso.validade) - hoje) / 864e5) }; })
      .filter(function (x) { return x.dias <= 90; }).sort(function (a, b) { return a.dias - b.dias; });
    var vencidos = lista.filter(function (x) { return x.dias < 0; }).length, em30 = lista.filter(function (x) { return x.dias >= 0 && x.dias <= 30; }).length;
    var h = '<div class="cab"><div><h1>Periódicos</h1><p>ASOs que vencem nos próximos 90 dias. A clínica avisa a empresa antes, em vez de esperar o RH lembrar.</p></div></div>';
    h += '<div class="agora agora--fixa">' + [[vencidos, 'Vencidos', 'Trabalhador sem ASO válido'], [em30, 'Vencem em 30 dias', 'Avisar o RH e convocar'], [lista.length - vencidos - em30, 'Vencem em 31 a 90 dias', 'Para planejar a agenda']].map(function (r) { return '<div class="agora__item"><b>' + r[0] + '</b><span>' + esc(r[1]) + '<small>' + esc(r[2]) + '</small></span></div>'; }).join('') + '</div>';
    if (!lista.length) h += '<p class="aviso-demo">Nenhum ASO vencendo nos próximos 90 dias.</p>';
    else h += '<div class="rolagem"><table class="tabela"><thead><tr><th>Funcionário</th><th>Empresa</th><th>Vence</th><th>Próximo passo</th></tr></thead><tbody>' + lista.map(function (x) {
      var c = x.c, f = N.funcao(c.funcaoId), e = N.empresa(c.empresaId);
      var cor = x.dias < 0 ? 'selo--vermelho' : x.dias <= 30 ? 'selo--ambar' : 'selo';
      var quando = x.dias < 0 ? 'Venceu há ' + (-x.dias) + (x.dias === -1 ? ' dia' : ' dias') : x.dias === 0 ? 'Vence hoje' : 'Em ' + x.dias + (x.dias === 1 ? ' dia' : ' dias');
      var acoes = c.convocadoEm ? '<span style="color:var(--apoio)">Periódico convocado em ' + data(c.convocadoEm) + '</span>' :
        '<div class="acoes-linha">' + (c.avisoRhEm ? '<span class="selo selo--verde">RH avisado em ' + data(c.avisoRhEm) + '</span>' : '<button class="botao botao--claro botao--pequeno" type="button" data-avisar-rh="' + c.id + '">Avisar o RH</button>') + '<button class="botao botao--pequeno" type="button" data-convocar="' + c.id + '">Convocar periódico</button></div>';
      return '<tr><td><span class="agencia__nome">' + esc(c.nome) + '<small>' + esc(f.nome) + ' · ASO de ' + new Date(c.aso.data).toLocaleDateString('pt-BR') + '</small></span></td><td>' + esc(e.nome.replace(/ \(fict[íi]ci[ao]\)/, '')) + '</td><td><span class="selo ' + cor + '">' + quando + '</span><br><span style="font-size:13px;color:var(--apoio)">' + new Date(c.aso.validade).toLocaleDateString('pt-BR') + '</span></td><td>' + acoes + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    h += '<p class="aviso-demo" style="margin-top:16px">A periodicidade vem do protocolo do PCMSO de cada função. Com a automação "Periódico vencendo" ligada, o aviso ao RH sai sozinho 30 dias antes.</p>';
    vista.innerHTML = h;
  }

  /* ---------- suporte de TI (a clínica abre, a Nexus Safe atende) ---------- */
  var AGENCIA = 'a1';
  function renderSuporte() {
    var C = window.Contas, ks = C.carregar().chamados.filter(function (k) { return k.agenciaId === AGENCIA; });
    var abertos = ks.filter(function (k) { return k.situacao !== 'resolvido'; }), resolvidos = ks.filter(function (k) { return k.situacao === 'resolvido'; });
    var esperando = abertos.filter(function (k) { return k.situacao === 'aguardando'; }).length;
    var h = '<div class="cab"><div><h1>Suporte de TI</h1><p>Impressora, rede, computador, sistema, backup ou WhatsApp com problema? Abra aqui e acompanhe a resposta da Nexus Safe.</p></div></div>';
    if (esperando) h += '<p class="aviso-demo" style="border-left:3px solid var(--ambar)"><b style="color:var(--tinta)">O suporte está esperando uma resposta sua</b> em ' + esperando + (esperando > 1 ? ' chamados.' : ' chamado.') + '</p>';
    h += '<div class="duas-col"><div><form class="bloco" data-form-suporte novalidate style="display:grid;gap:12px"><h3 style="margin:0">Abrir chamado</h3>' +
      '<label class="campo">O que aconteceu<input class="entrada" name="assunto" required autocomplete="off" placeholder="Ex.: impressora de ASO não imprime"></label>' +
      '<label class="campo">Conte mais<textarea class="entrada" name="descricao" required placeholder="Desde quando, em qual computador ou aparelho, o que já tentaram"></textarea></label>' +
      '<label class="campo">Tipo<select class="entrada" name="categoria" required>' + C.CATEGORIAS.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
      '<fieldset class="campo" style="border:0;padding:0;margin:0"><legend style="margin-bottom:6px">Está parando o atendimento?</legend><div class="opcoes-lista">' +
      Object.keys(C.PRIORIDADES).map(function (p, n) { var x = C.PRIORIDADES[p]; return '<label class="opcao"><input type="radio" name="prioridade" value="' + p + '"' + (p === 'normal' ? ' checked' : '') + '><span><b>' + esc(x.pergunta) + '</b><small>Resposta em até ' + C.duracao(x.resposta) + '</small></span></label>'; }).join('') + '</div></fieldset>' +
      '<div class="acoes-linha"><button class="botao" type="submit">Abrir chamado</button></div></form></div>';
    h += '<div><h2 class="titulo-secao" style="margin-top:0">Em aberto (' + abertos.length + ')</h2><div class="msgs">' + (abertos.length ? abertos.map(function (k) { return C.chamadoHtml(k, 'clinica'); }).join('') : '<p class="aviso-demo">Nada em aberto.</p>') + '</div>' +
      (resolvidos.length ? '<h2 class="titulo-secao">Resolvidos (' + resolvidos.length + ')</h2><div class="msgs">' + resolvidos.map(function (k) { return C.chamadoHtml(k, 'clinica'); }).join('') + '</div>' : '') + '</div></div>';
    vista.innerHTML = h;
  }
  document.addEventListener('submit', function (ev) {
    if (!ev.target.matches('[data-form-suporte]')) return;
    ev.preventDefault();
    if (window.Campos.validar(ev.target).length) return;
    var fd = new FormData(ev.target);
    window.Contas.abrirChamado({ agenciaId: AGENCIA, assunto: fd.get('assunto').trim(), descricao: fd.get('descricao').trim(), categoria: fd.get('categoria'), prioridade: fd.get('prioridade'), canal: 'Portal', por: 'Recepção' });
    renderSuporte(); toast('Chamado aberto. A Nexus Safe foi avisada.');
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-acao="enviar"], [data-avaliar]'); if (!t || !window.Contas) return;
    var C = window.Contas, card = t.closest('[data-chamado]'), id = card.dataset.chamado;
    if (t.matches('[data-acao="enviar"]')) {
      var r = card.querySelector('[data-resposta]'), txt = r.value.trim();
      if (!txt) { r.focus(); r.classList.add('entrada--falta'); return; }
      C.registrar(id, 'clinica', 'Recepção', txt); toast('Mensagem enviada ao suporte');
    } else if (t.dataset.avaliar === 'sim') { C.avaliar(id, true); toast('Obrigado pela avaliação'); }
    else { C.registrar(id, 'clinica', 'Recepção', 'Não resolveu. Reabrindo o chamado.', 'reabrir'); toast('Chamado reaberto'); }
    renderSuporte();
  });

  /* ---------- novo candidato ---------- */
  function preencherSelects() {
    var d = N.carregar();
    $('[data-sel-tipo]').innerHTML = N.TIPOS_EXAME.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + '</option>'; }).join('');
    var se = $('[data-sel-empresa]');
    se.innerHTML = d.empresas.map(function (e) { return '<option value="' + e.id + '">' + esc(e.nome) + '</option>'; }).join('');
    if (filtro.empresa) se.value = filtro.empresa;
    atualizarFuncoes();
    mostrarAdmissao();
  }
  function mostrarAdmissao() { window.Campos.porTipo($('[data-form-novo]'), $('[data-sel-tipo]').value); }
  function atualizarFuncoes() {
    var d = N.carregar(), eid = $('[data-sel-empresa]').value;
    var sf = $('[data-sel-funcao]');
    sf.innerHTML = d.funcoes.filter(function (f) { return f.empresaId === eid; }).map(function (f) { return '<option value="' + f.id + '">' + esc(f.nome) + '</option>'; }).join('');
    mostrarRiscos();
  }
  function mostrarRiscos() {
    var f = N.funcao($('[data-sel-funcao]').value);
    $('[data-riscos-funcao]').textContent = f ? 'Riscos: ' + f.riscos.map(function (r) { return N.RISCOS[r]; }).join(', ') + '. A ficha vai incluir as perguntas desses riscos.' : '';
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('button, a, [data-veu]');
    if (!t) return;
    var id = (location.hash.match(/^#\/c\/(\w+)/) || [])[1];
    var c = id ? candidato(id) : null;
    var d = N.carregar();

    if (t.matches('[data-etapa]')) { filtro.etapa = t.dataset.etapa; renderQuadro(); }
    else if (t.matches('[data-tarefa]')) { filtro.tarefa = t.dataset.tarefa === filtro.tarefa ? '' : t.dataset.tarefa; renderQuadro(); }
    else if (t.matches('[data-novo]')) { $('[data-form-novo]').reset(); $('[data-form-novo]').querySelectorAll('.campo__erro').forEach(function (x) { x.remove(); }); $('[data-form-novo]').querySelectorAll('.faltando').forEach(function (x) { x.classList.remove('faltando'); }); preencherSelects(); $('[data-modal-novo]').showModal(); }
    else if (t.matches('[data-fechar], [data-veu]')) fecharPainel();
    else if (t.matches('[data-copiar]')) {
      var inp = t.previousElementSibling; inp.select();
      try { navigator.clipboard.writeText(inp.value).then(function () { toast('Link copiado'); }, function () { document.execCommand('copy'); toast('Link copiado'); }); } catch (e) { document.execCommand('copy'); toast('Link copiado'); }
    }
    else if (t.matches('[data-agendar]') && c) {
      var v = $('[data-agenda]').value; if (!v) return;
      fazer('agendar', c.id, { quando: new Date(v).toISOString(), modo: $('[data-agenda-modo]').value }, 'Exame agendado');
    }
    else if (t.matches('[data-novo-link]') && c) fazer('novoLink', c.id, {}, 'Novo link gerado');
    else if (t.matches('[data-confirmar]') && c) fazer('confirmar', c.id, {}, 'Confirmação na fila de mensagens');
    else if (t.matches('[data-atendido]') && c) fazer('atendido', c.id, {}, 'Marcado como atendido');
    else if (t.matches('[data-emitir]') && c) {
      fazer('emitirAso', c.id, { resultado: $('[data-aso-resultado]').value, restricoes: $('[data-aso-restricoes]').value, obs: $('[data-aso-obs]').value }, '', function () { abrirAso(candidato(c.id)); });
    }
    else if (t.matches('[data-esocial]') && c) fazer('esocialEnviado', c.id, {}, 'S-2220 marcado como enviado');
    else if (t.matches('[data-ver-aso]') && c) abrirAso(c);
    else if (t.matches('[data-guia]') && c) { $('[data-aso-conteudo]').innerHTML = N.guiaHtml(c); $('[data-modal-aso]').showModal(); fazer('guia', c.id, {}, '', null, true); }
    else if (t.matches('[data-xml]') && c) { N.baixar(N.nomeArquivo(c), N.s2220Xml(c)); toast('XML do S-2220 baixado'); }
    else if (t.matches('[data-cobrar]')) fazer('cobrar', t.dataset.cobrar, {}, 'Cobrança na fila de mensagens');
    else if (t.matches('[data-rodar-autos]')) rodarAutomacoes();
    else if (t.matches('[data-avisar-rh]')) fazer('avisarRh', t.dataset.avisarRh, {}, 'Aviso enviado ao RH');
    else if (t.matches('[data-convocar]')) fazer('convocar', t.dataset.convocar, {}, 'Periódico convocado. Link enviado.');
    else if (t.matches('[data-imprimir-ficha]') && c && ehMedico()) { $('[data-aso-conteudo]').innerHTML = N.fichaImpressaHtml(c); $('[data-modal-aso]').showModal(); }
    else if (t.matches('[data-fechar-aso]')) $('[data-modal-aso]').close();
    else if (t.matches('[data-imprimir]')) window.print();
    else if (t.matches('[data-restaurar]') && !N.SERVIDOR) { if (confirm('Voltar a demonstração ao estado inicial? O que você fez aqui será apagado.')) { N.restaurar(); if (window.Contas) window.Contas.restaurar(); filtro = { empresa: '', busca: '', tarefa: '', etapa: '', tipo: '' }; location.hash = '#/quadro'; rota(); toast('Demonstração restaurada'); } }
  });

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.matches('[data-filtro-empresa]')) { filtro.empresa = t.value; renderQuadro(); }
    else if (t.matches('[data-filtro-tipo]')) { filtro.tipo = t.value; renderQuadro(); }
    else if (t.matches('[data-sel-tipo]')) mostrarAdmissao();
    else if (t.matches('[data-sel-empresa]')) atualizarFuncoes();
    else if (t.matches('[data-sel-funcao]')) mostrarRiscos();
    else if (t.matches('[data-auto]')) fazer('automacao', '', { id: t.dataset.auto, ativo: t.checked }, t.checked ? 'Automação ligada' : 'Automação desligada');
  });

  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.matches('[data-filtro-busca]')) {
      filtro.busca = t.value;
      var pos = t.selectionStart; renderQuadro();
      var n = $('[data-filtro-busca]'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {}
    }
  });

  $('[data-form-novo]').addEventListener('submit', function (ev) {
    if (ev.submitter && ev.submitter.value === 'cancelar') return;
    if (window.Campos.validar(ev.target).length) { ev.preventDefault(); return; }
    var fd = new FormData(ev.target);
    N.acao('criar', '', {
      tipoExame: fd.get('tipoExame') || 'admissional', nome: fd.get('nome'), cpf: fd.get('cpf'), celular: fd.get('celular'), empresaId: fd.get('empresaId'), funcaoId: fd.get('funcaoId'),
      admissaoEm: fd.get('admissaoEm') ? new Date(fd.get('admissaoEm') + 'T08:00:00').toISOString() : '', afastadoDesde: fd.get('afastadoDesde') ? new Date(fd.get('afastadoDesde') + 'T08:00:00').toISOString() : ''
    }).then(function (r) { location.hash = '#/c/' + r.novoId; rota(); toast('Atendimento cadastrado. Link gerado.'); }, falhou);
  });

  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !painel.hidden && !document.querySelector('dialog[open]')) fecharPainel(); });

  /* volta da ficha em outra aba: atualiza a tela */
  window.addEventListener('storage', function () { N.recarregar(); if (window.Contas) window.Contas.recarregar(); rota(); });
  window.addEventListener('hashchange', rota);
  window.addEventListener('nexus:atualizado', function () { if (/suporte/.test(location.hash)) renderSuporte(); });
  window.addEventListener('nexus:erro', function (e) { toast(e.detail || 'Não foi possível concluir.'); });

  var sessao = window.Contas.exigir('clinica'); if (!sessao) return;
  N.pronto(function () {
    $('[data-clinica]').textContent = N.carregar().clinica;
    var papelEl = document.querySelector('.lateral__clinica');
    if (papelEl) papelEl.insertAdjacentHTML('beforeend', '<span style="display:block;margin-top:4px">' + (ehMedico() ? 'Equipe médica' : 'Recepção') + '</span>');
    rota();
  });
})();
