(function () {
  'use strict';
  var N = window.Nexus;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var vista = $('#vista');
  var painel = $('[data-painel]');
  var veu = $('[data-veu]');
  var filtro = { empresa: '', busca: '' };
  var verComo = 'medico';

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
  function etapaNome(id) { for (var i = 0; i < N.ETAPAS.length; i++) if (N.ETAPAS[i].id === id) return N.ETAPAS[i].nome; return id; }
  function registrar(c, txt) { c.historico.push({ em: new Date().toISOString(), txt: txt }); }

  /* ---------- rotas ---------- */
  function rota() {
    var h = location.hash.replace(/^#\/?/, '') || 'quadro';
    var partes = h.split('/');
    var base = partes[0];
    document.querySelectorAll('[data-rota]').forEach(function (a) { if (a.dataset.rota === (base === 'c' ? 'quadro' : base)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (base === 'cadastros') { fecharPainel(true); renderCadastros(); }
    else if (base === 'automacoes') { fecharPainel(true); renderAutomacoes(); }
    else {
      renderQuadro();
      if (base === 'c' && partes[1]) abrirPainel(partes[1]); else fecharPainel(true);
    }
  }

  /* ---------- quadro ---------- */
  function renderQuadro() {
    var d = N.carregar();
    var lista = d.candidatos.filter(function (c) {
      if (filtro.empresa && c.empresaId !== filtro.empresa) return false;
      if (filtro.busca) { var b = filtro.busca.toLowerCase(); if ((c.nome + ' ' + c.cpf).toLowerCase().indexOf(b) < 0) return false; }
      return true;
    });
    var opts = '<option value="">Todas as empresas</option>' + d.empresas.map(function (e) { return '<option value="' + e.id + '"' + (filtro.empresa === e.id ? ' selected' : '') + '>' + esc(e.nome) + '</option>'; }).join('');
    var colunas = N.ETAPAS.map(function (et) {
      var itens = lista.filter(function (c) { return c.etapa === et.id; });
      return '<section class="coluna" aria-label="' + esc(et.nome) + '"><div class="coluna__cab">' + esc(et.nome) + '<span>' + itens.length + '</span></div>' +
        (itens.length ? itens.map(cardHtml).join('') : '<p class="coluna__vazia">Nenhum candidato</p>') + '</section>';
    }).join('');
    vista.innerHTML =
      '<div class="cab"><div><h1>Atendimentos</h1><p>Do link da ficha até o ASO. Clique num cartão para abrir.</p></div>' +
      '<div class="cab__acoes"><button class="botao" type="button" data-novo>+ Novo atendimento</button></div></div>' +
      '<div class="filtros"><select class="entrada" data-filtro-empresa aria-label="Filtrar por empresa">' + opts + '</select>' +
      '<input class="entrada" type="search" placeholder="Buscar por nome ou CPF" value="' + esc(filtro.busca) + '" data-filtro-busca aria-label="Buscar"></div>' +
      '<div class="quadro">' + colunas + '</div>';
  }

  function cardHtml(c) {
    var f = N.funcao(c.funcaoId), e = N.empresa(c.empresaId);
    var al = N.alertas(c.ficha, f);
    var meta = [];
    if (c.tipoExame && c.tipoExame !== 'admissional') meta.push('<span class="selo selo--azul">' + esc(N.nomeTipo(c.tipoExame)) + '</span>');
    if (c.etapa === 'enviado') meta.push('<span class="selo">Enviado ' + ha(c.criadoEm) + '</span>');
    if (c.etapa === 'preenchendo') meta.push('<span class="selo selo--azul">Rascunho salvo</span>');
    if (c.etapa === 'agendado' && c.agendadoPara) meta.push('<span class="selo selo--azul">' + data(c.agendadoPara, true) + '</span>');
    if (c.etapa === 'aso' && c.aso) meta.push('<span class="selo ' + (c.aso.resultado === 'Inapto' ? 'selo--vermelho' : 'selo--verde') + '">' + esc(c.aso.resultado) + '</span>');
    if (c.ficha && c.etapa !== 'aso') {
      if (al.fortes.length) meta.push('<span class="selo selo--vermelho">' + al.fortes.length + (al.fortes.length > 1 ? ' pontos' : ' ponto') + ' de atenção</span>');
      else if (al.leves.length) meta.push('<span class="selo selo--ambar">' + al.leves.length + (al.leves.length > 1 ? ' respostas' : ' resposta') + ' "sim"</span>');
    }
    return '<a class="card" href="#/c/' + c.id + '"><b>' + esc(c.nome) + '</b><div class="card__sub">' + esc(f ? f.nome : '') + ' · ' + esc(e ? e.nome.replace(/ \(fict[íi]ci[ao]\)/, '') : '') + '</div>' +
      (meta.length ? '<div class="card__meta">' + meta.join('') + '</div>' : '') + '</a>';
  }

  /* ---------- painel do candidato ---------- */
  function candidato(id) { var d = N.carregar(); for (var i = 0; i < d.candidatos.length; i++) if (d.candidatos[i].id === id) return d.candidatos[i]; return null; }

  function abrirPainel(id) {
    var c = candidato(id);
    if (!c) { location.hash = '#/quadro'; return; }
    renderPainel(c);
    if (painel.hidden) {
      painel.hidden = false; veu.hidden = false;
      requestAnimationFrame(function () { painel.classList.add('aberto'); veu.classList.add('aberto'); });
      document.body.style.overflow = 'hidden';
      painel.setAttribute('tabindex', '-1');
      setTimeout(function () { painel.focus(); }, 30);
    }
  }
  function fecharPainel(semHash) {
    if (painel.hidden) return;
    painel.classList.remove('aberto'); veu.classList.remove('aberto');
    document.body.style.overflow = '';
    setTimeout(function () { painel.hidden = true; veu.hidden = true; }, 260);
    if (!semHash) location.hash = '#/quadro';
  }

  function renderPainel(c) {
    var f = N.funcao(c.funcaoId), e = N.empresa(c.empresaId);
    var medico = verComo === 'medico';
    var h = '';
    h += '<div class="painel__cab"><div class="painel__linha"><div><h2>' + esc(c.nome) + '</h2><p>' + esc(N.nomeTipo(c.tipoExame)) + ' · ' + esc(f.nome) + ' · ' + esc(e.nome) + '</p></div>' +
      '<button class="fechar" type="button" data-fechar aria-label="Fechar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
      '<div class="painel__linha" style="align-items:center;flex-wrap:wrap"><span class="selo selo--verde">' + esc(etapaNome(c.etapa)) + '</span>' +
      '<div class="segmento" role="group" aria-label="Ver como"><button type="button" data-ver="medico" aria-pressed="' + medico + '">Equipe médica</button><button type="button" data-ver="empresa" aria-pressed="' + !medico + '">Empresa cliente</button></div></div></div>';

    h += '<div class="painel__corpo">';

    if (medico) h += acoesHtml(c, f);
    else if (c.aso) h += '<div class="bloco"><h3>ASO</h3><p>Aptidão: <b style="color:var(--tinta)">' + esc(c.aso.resultado) + '</b> em ' + data(c.aso.data) + '.' + (c.aso.restricoes ? ' Restrições: ' + esc(c.aso.restricoes) + '.' : '') + (c.aso.validade ? ' Próximo periódico até ' + new Date(c.aso.validade).toLocaleDateString('pt-BR') + '.' : '') + '</p><div class="acoes-linha" style="margin-top:10px"><button class="botao botao--pequeno" type="button" data-ver-aso>Ver ASO</button></div></div>';

    h += '<div class="bloco"><h3>Cadastro</h3><dl class="dl"><dt>CPF</dt><dd>' + esc(c.cpf) + '</dd><dt>Celular</dt><dd>' + esc(c.celular) + '</dd><dt>Empresa</dt><dd>' + esc(e.nome) + '</dd><dt>Função</dt><dd>' + esc(f.nome) + ' (' + esc(f.setor) + ')</dd>' +
      (c.agendadoPara ? '<dt>Exame</dt><dd>' + data(c.agendadoPara, true) + '</dd>' : '') + '</dl></div>';

    var pc = N.carregar().pcmso, prep = N.preparos(f);
    h += '<div class="bloco"><h3>Riscos e protocolo do PCMSO</h3><p class="sub">Riscos da função (PGR)</p><div class="chips">' + f.riscos.map(function (r) { return '<span class="selo selo--ambar">' + esc(N.RISCO_GRUPO[r]) + ': ' + esc(N.RISCOS[r]) + '</span>'; }).join('') + '</div>' +
      '<p class="sub">Exames do protocolo · ' + esc(N.nomeTipo(c.tipoExame).toLowerCase()) + '</p><div class="chips">' + f.exames.map(function (x) { return '<span class="selo"><b style="font-weight:700">' + esc(N.CATALOGO[x].codigo) + '</b> ' + esc(N.EXAMES[x]) + '</span>'; }).join('') + '</div>' +
      (prep.length ? '<p class="sub">Preparo (vai na confirmação)</p><p style="font-size:14px">' + esc(prep.join('; ').replace(/^./, function (x) { return x.toUpperCase(); })) + '.</p>' : '') +
      '<p style="font-size:13px;margin-top:12px">Protocolo aprovado por ' + esc(pc.coordenador) + ', médico coordenador do PCMSO, em ' + new Date(pc.aprovadoEm).toLocaleDateString('pt-BR') + '. Periódico a cada ' + f.periodicidade + ' meses.</p></div>';

    if (medico) {
      if (c.ficha) {
        var al = N.alertas(c.ficha, f);
        h += '<div class="bloco"><h3>Pontos de atenção</h3>' + (al.fortes.length + al.leves.length ? '<ul class="atencao">' + al.fortes.map(function (t) { return '<li class="forte">' + esc(t) + '</li>'; }).join('') + al.leves.map(function (t) { return '<li class="leve">' + esc(t) + '</li>'; }).join('') + '</ul>' : '<p>Nenhuma resposta "sim" na ficha.</p>') + '</div>';
        h += fichaHtml(c.ficha, f);
      } else {
        h += '<div class="bloco"><h3>Ficha</h3><p>' + (c.etapa === 'preenchendo' ? 'O candidato está preenchendo. O rascunho fica salvo no celular dele até o envio.' : 'A ficha ainda não foi preenchida.') + '</p></div>';
      }
    } else {
      h += '<div class="bloco bloco--trava"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><b>Respostas de saúde ficam só com a equipe médica</b><p>Dado de saúde é dado sensível (LGPD, art. 11). A empresa acompanha a etapa e recebe o ASO, sem diagnóstico.</p></div>';
    }

    h += '<div class="bloco"><h3>Histórico</h3><ol class="linha-tempo">' + c.historico.slice().reverse().map(function (x) { return '<li><time>' + data(x.em, true) + '</time><span>' + esc(x.txt) + '</span></li>'; }).join('') + '</ol></div>';
    h += '</div>';
    painel.innerHTML = h;
  }

  function acoesHtml(c, f) {
    var h = '<div class="bloco"><h3>Próximo passo</h3>';
    if (c.etapa === 'enviado' || c.etapa === 'preenchendo') {
      h += '<div class="link-ficha"><input class="entrada" readonly value="' + esc(linkFicha(c)) + '" aria-label="Link da ficha"><button class="botao botao--claro botao--pequeno" type="button" data-copiar>Copiar</button></div>' +
        '<div class="acoes-linha"><a class="botao botao--pequeno" target="_blank" rel="noopener" href="' + esc(waLink(c, textoLink(c))) + '">Mandar no WhatsApp</a>' +
        '<a class="botao botao--claro botao--pequeno" target="_blank" rel="noopener" href="' + esc(linkFicha(c)) + '">Abrir a ficha como o candidato</a></div>' +
        '<p style="margin-top:10px;font-size:13.5px">Dica: abra a ficha, preencha no lugar do candidato e volte aqui. O cartão muda de coluna sozinho.</p>';
    } else if (c.etapa === 'recebida') {
      var sug = new Date(); sug.setDate(sug.getDate() + 1); sug.setHours(8, 0, 0, 0);
      var v = new Date(sug.getTime() - sug.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
      h += '<p style="margin-bottom:10px">Ficha recebida. Marque o exame: a confirmação sai pelo WhatsApp com as orientações da função.</p><div class="acoes-linha"><label class="campo">Data e hora<input class="entrada" type="datetime-local" value="' + v + '" data-agenda></label><button class="botao" type="button" data-agendar>Agendar exame</button></div>';
    } else if (c.etapa === 'agendado') {
      h += '<p style="margin-bottom:10px">Exame em ' + data(c.agendadoPara, true) + '. Quando o candidato for atendido, marque aqui.</p><div class="acoes-linha"><button class="botao" type="button" data-atendido>Marcar como atendido</button></div>';
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

  function fichaHtml(fi, f) {
    var p = fi.pessoais || {};
    var h = '<div class="bloco"><h3>Ficha preenchida <span class="selo">enviada ' + data(fi.enviadoEm, true) + '</span></h3>';
    h += '<p class="sub">Dados pessoais</p><dl class="dl">' +
      (p.nome_social ? '<dt>Nome social</dt><dd>' + esc(p.nome_social) + '</dd>' : '') +
      '<dt>Nascimento</dt><dd>' + esc(p.nascimento ? p.nascimento.split('-').reverse().join('/') : '') + '</dd><dt>Sexo</dt><dd>' + esc(p.sexo) + '</dd><dt>Estado civil</dt><dd>' + esc(p.estado_civil) + '</dd><dt>Escolaridade</dt><dd>' + esc(p.escolaridade) + '</dd><dt>Endereço</dt><dd>' + esc(p.endereco) + '</dd><dt>Emergência</dt><dd>' + esc(p.emergencia_nome) + ' ' + esc(p.emergencia_tel) + '</dd><dt>PcD</dt>' + simNao(p.pcd) + '</dl>';
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
  function asoHtml(c) {
    var d = N.carregar(), f = N.funcao(c.funcaoId), e = N.empresa(c.empresaId);
    return '<div class="aso"><div class="aso__cab"><div><h2>Atestado de Saúde Ocupacional</h2><p>' + esc(d.clinica) + ' · modelo de demonstração</p></div><div style="text-align:right"><p>Tipo de exame</p><b>' + esc(N.nomeTipo(c.tipoExame)) + '</b></div></div>' +
      '<table><tr><th>Empresa</th><td>' + esc(e.nome) + '<br>CNPJ ' + esc(e.cnpj) + '</td></tr><tr><th>Trabalhador</th><td>' + esc(c.nome) + '<br>CPF ' + esc(c.cpf) + '</td></tr><tr><th>Função e setor</th><td>' + esc(f.nome) + ' · ' + esc(f.setor) + '</td></tr>' +
      '<tr><th>Riscos ocupacionais (PGR)</th><td>' + f.riscos.map(function (r) { return esc(N.RISCO_GRUPO[r]) + ': ' + esc(N.RISCOS[r]); }).join('<br>') + '</td></tr>' +
      '<tr><th>Exames realizados</th><td>' + f.exames.map(function (x) { return esc(N.CATALOGO[x].codigo) + ' · ' + esc(N.EXAMES[x]) + ' (' + data(c.agendadoPara || c.aso.data) + ')'; }).join('<br>') + '</td></tr>' +
      (c.aso.restricoes ? '<tr><th>Restrições</th><td>' + esc(c.aso.restricoes) + '</td></tr>' : '') +
      (c.aso.obs ? '<tr><th>Observação</th><td>' + esc(c.aso.obs) + '</td></tr>' : '') +
      (c.aso.validade ? '<tr><th>Validade</th><td>Próximo exame periódico até ' + new Date(c.aso.validade).toLocaleDateString('pt-BR') + '</td></tr>' : '') + '</table>' +
      '<p>Conclusão: o trabalhador está</p><div class="aso__resultado">' + esc(c.aso.resultado.toUpperCase()) + ' para a função</div>' +
      '<p style="font-size:12.5px;color:#444">Emitido em ' + new Date(c.aso.data).toLocaleDateString('pt-BR') + '. Médico(a) responsável pelo exame: ' + esc(c.aso.medico) + ', ' + esc(c.aso.crm || 'CRM-SP 123456') + '.</p>' +
      '<div class="aso__assin"><div>' + esc(c.aso.medico) + '<br>Médico(a) examinador(a)</div><div>' + esc(c.nome) + '<br>Trabalhador(a): recebi a 2ª via</div></div>' +
      '<p class="aso__ns"><svg class="ns" viewBox="18 18 64 64" aria-hidden="true"><path d="M24 76V24L46.5 76H60C69.5 76 76 71 76 63C76 55.5 70.5 52 61 50.2C51.5 48.4 46 45 46 37.2C46 29.5 52 24 61 24C67 24 72 26.6 75 31"/></svg>Emitido com Nexus Safe</p></div>';
  }
  function abrirAso(c) { $('[data-aso-conteudo]').innerHTML = asoHtml(c); $('[data-modal-aso]').showModal(); }

  /* ---------- cadastros ---------- */
  function renderCadastros() {
    var d = N.carregar();
    var h = '<div class="cab"><div><h1>Empresas e funções</h1><p>Cada função diz quais riscos tem e quais exames pede. É isso que monta a ficha e o ASO.</p></div></div>';
    h += '<div class="rolagem"><table class="tabela"><thead><tr><th>Empresa cliente</th><th>CNPJ</th><th>Contato</th><th>Candidatos</th></tr></thead><tbody>' +
      d.empresas.map(function (e) { var n = d.candidatos.filter(function (c) { return c.empresaId === e.id; }).length; return '<tr><td><b>' + esc(e.nome) + '</b></td><td>' + esc(e.cnpj) + '</td><td>' + esc(e.contato) + '<br><span style="color:var(--apoio)">' + esc(e.tel) + '</span></td><td>' + n + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<h2 class="titulo-secao">Funções</h2><div class="rolagem"><table class="tabela"><thead><tr><th>Função</th><th>Empresa</th><th>Riscos (PGR)</th><th>Protocolo do PCMSO</th></tr></thead><tbody>' +
      d.funcoes.map(function (f) { var e = N.empresa(f.empresaId); return '<tr><td><b>' + esc(f.nome) + '</b><br><span style="color:var(--apoio)">' + esc(f.setor) + '</span></td><td>' + esc(e.nome) + '</td><td><div class="chips">' + f.riscos.map(function (r) { return '<span class="selo selo--ambar">' + esc(N.RISCO_GRUPO[r]) + ': ' + esc(N.RISCOS[r]) + '</span>'; }).join('') + '</div></td><td><div class="chips">' + f.exames.map(function (x) { return '<span class="selo">' + esc(N.EXAMES[x]) + '</span>'; }).join('') + '</div><span style="font-size:13px;color:var(--apoio)">Periódico a cada ' + f.periodicidade + ' meses</span></td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<p class="aviso-demo" style="margin-top:16px">Como no SST: o exame não sai direto do risco. Ele vem do protocolo do PCMSO, aprovado pelo médico coordenador (' + esc(d.pcmso.coordenador) + '). Na versão real, a clínica cadastra e edita empresas, funções e protocolos aqui; no modelo, a lista é fixa.</p>';
    vista.innerHTML = h;
  }

  /* ---------- automações ---------- */
  function renderAutomacoes() {
    var d = N.carregar();
    var h = '<div class="cab"><div><h1>Automações</h1><p>Mensagens que saem sozinhas quando algo acontece no quadro.</p></div></div>';
    h += '<p class="aviso-demo">No modelo, nada é enviado de verdade: as mensagens caem na fila ao lado para você ver o que sairia. Na versão real, elas vão pela API oficial do WhatsApp.</p>';
    h += '<div class="duas-col"><div><div class="lista-autos">' + d.automacoes.map(function (a) {
      return '<div class="auto"><div><b>' + esc(a.nome) + '</b><span>' + esc(a.quando) + ' · para ' + esc(a.para) + '</span></div><label class="chave"><input type="checkbox" data-auto="' + a.id + '"' + (a.ativo ? ' checked' : '') + ' aria-label="Ativar ' + esc(a.nome) + '"><span></span></label></div>';
    }).join('') + '</div></div>';
    h += '<div><h2 class="titulo-secao" style="margin-top:0">Fila de mensagens</h2><div class="msgs">' + (d.mensagens.length ? d.mensagens.map(function (m) {
      var a = d.automacoes.filter(function (x) { return x.id === m.automacao; })[0];
      return '<div class="msg"><div class="msg__cab"><span>Para <b>' + esc(m.para) + '</b></span><span>' + data(m.em, true) + '</span></div><p>' + esc(m.texto) + '</p><div style="margin-top:8px"><span class="selo">' + esc(a ? a.nome : m.automacao) + '</span></div></div>';
    }).join('') : '<p class="aviso-demo">Nenhuma mensagem ainda.</p>') + '</div></div></div>';
    vista.innerHTML = h;
  }

  /* ---------- novo candidato ---------- */
  function preencherSelects() {
    var d = N.carregar();
    $('[data-sel-tipo]').innerHTML = N.TIPOS_EXAME.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + '</option>'; }).join('');
    var se = $('[data-sel-empresa]');
    se.innerHTML = d.empresas.map(function (e) { return '<option value="' + e.id + '">' + esc(e.nome) + '</option>'; }).join('');
    if (filtro.empresa) se.value = filtro.empresa;
    atualizarFuncoes();
  }
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
  function mascaraCpf(v) { v = v.replace(/\D/g, '').slice(0, 11); return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); }
  function mascaraTel(v) { v = v.replace(/\D/g, '').slice(0, 11); if (v.length > 6) return '(' + v.slice(0, 2) + ') ' + v.slice(2, v.length - 4) + '-' + v.slice(-4); if (v.length > 2) return '(' + v.slice(0, 2) + ') ' + v.slice(2); return v; }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('button, a, [data-veu]');
    if (!t) return;
    var id = (location.hash.match(/^#\/c\/(\w+)/) || [])[1];
    var c = id ? candidato(id) : null;
    var d = N.carregar();

    if (t.matches('[data-novo]')) { $('[data-form-novo]').reset(); preencherSelects(); $('[data-modal-novo]').showModal(); }
    else if (t.matches('[data-fechar], [data-veu]')) fecharPainel();
    else if (t.matches('[data-ver]')) { verComo = t.dataset.ver; renderPainel(c); }
    else if (t.matches('[data-copiar]')) {
      var inp = t.previousElementSibling; inp.select();
      try { navigator.clipboard.writeText(inp.value).then(function () { toast('Link copiado'); }, function () { document.execCommand('copy'); toast('Link copiado'); }); } catch (e) { document.execCommand('copy'); toast('Link copiado'); }
    }
    else if (t.matches('[data-agendar]') && c) {
      var v = $('[data-agenda]').value; if (!v) return;
      c.agendadoPara = new Date(v).toISOString(); c.etapa = 'agendado';
      registrar(c, 'Exame agendado para ' + data(c.agendadoPara, true) + '.');
      var f = N.funcao(c.funcaoId), ori = N.preparos(f).map(function (x) { return x.charAt(0).toLowerCase() + x.slice(1); });
      if (N.enfileirar('agenda', c.nome, 'Oi, ' + N.primeiroNome(c.nome) + '! Seu exame ' + N.nomeTipo(c.tipoExame).toLowerCase() + ' está marcado para ' + data(c.agendadoPara, true) + ' na ' + d.clinica + '. Leve RG e carteira de trabalho' + (ori.length ? '; ' + ori.join('; ') : '') + '.')) registrar(c, 'Confirmação enviada pelo WhatsApp.');
      N.salvar(); renderPainel(c); renderQuadro(); toast('Exame agendado');
    }
    else if (t.matches('[data-atendido]') && c) {
      c.etapa = 'atendido'; registrar(c, 'Atendido(a) pela equipe médica.'); N.salvar(); renderPainel(c); renderQuadro(); toast('Marcado como atendido');
    }
    else if (t.matches('[data-emitir]') && c) {
      var res = $('[data-aso-resultado]').value, med = $('[data-aso-medico]').value || 'Dra. Camila Rocha';
      var agora = new Date().toISOString(), fa = N.funcao(c.funcaoId);
      c.aso = { resultado: res, restricoes: res === 'Apto com restrição' ? $('[data-aso-restricoes]').value.trim() : '', medico: med, crm: 'CRM-SP 123456', data: agora, validade: c.tipoExame === 'demissional' ? '' : N.somarMeses(agora, fa.periodicidade), obs: $('[data-aso-obs]').value.trim() };
      c.etapa = 'aso'; registrar(c, 'ASO emitido: ' + res + '.');
      var e = N.empresa(c.empresaId), fu = N.funcao(c.funcaoId);
      if (N.enfileirar('aso', e.contato + ' · ' + e.nome.replace(/ \(fict[íi]ci[ao]\)/, ''), 'Olá, ' + N.primeiroNome(e.contato) + '. O ASO ' + N.nomeTipo(c.tipoExame).toLowerCase() + ' de ' + c.nome + ' (' + fu.nome + ') está pronto: ' + res.toUpperCase() + '. O PDF segue anexo. ' + d.clinica + '.')) registrar(c, 'Aviso enviado ao RH da empresa.');
      N.salvar(); renderPainel(c); renderQuadro(); abrirAso(c);
    }
    else if (t.matches('[data-ver-aso]') && c) abrirAso(c);
    else if (t.matches('[data-fechar-aso]')) $('[data-modal-aso]').close();
    else if (t.matches('[data-imprimir]')) window.print();
    else if (t.matches('[data-restaurar]')) { if (confirm('Voltar a demonstração ao estado inicial? O que você fez aqui será apagado.')) { N.restaurar(); filtro = { empresa: '', busca: '' }; location.hash = '#/quadro'; rota(); toast('Demonstração restaurada'); } }
  });

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.matches('[data-filtro-empresa]')) { filtro.empresa = t.value; renderQuadro(); }
    else if (t.matches('[data-sel-empresa]')) atualizarFuncoes();
    else if (t.matches('[data-sel-funcao]')) mostrarRiscos();
    else if (t.matches('[data-auto]')) { var d = N.carregar(); d.automacoes.forEach(function (a) { if (a.id === t.dataset.auto) a.ativo = t.checked; }); N.salvar(); toast(t.checked ? 'Automação ligada' : 'Automação desligada'); }
  });

  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.matches('[data-filtro-busca]')) {
      filtro.busca = t.value;
      var pos = t.selectionStart; renderQuadro();
      var n = $('[data-filtro-busca]'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {}
    }
    else if (t.name === 'cpf') t.value = mascaraCpf(t.value);
    else if (t.name === 'celular') t.value = mascaraTel(t.value);
  });

  $('[data-form-novo]').addEventListener('submit', function (ev) {
    if (ev.submitter && ev.submitter.value === 'cancelar') return;
    var fd = new FormData(ev.target);
    var d = N.carregar();
    var c = { id: N.uid(), token: N.token(), tipoExame: fd.get('tipoExame') || 'admissional', nome: fd.get('nome').trim(), cpf: fd.get('cpf'), celular: fd.get('celular'), empresaId: fd.get('empresaId'), funcaoId: fd.get('funcaoId'), etapa: 'enviado', criadoEm: new Date().toISOString(), agendadoPara: '', ficha: null, rascunho: null, aso: null, historico: [] };
    registrar(c, 'Cadastrado(a) pela recepção.');
    if (N.enfileirar('link', c.nome, textoLink(c))) registrar(c, 'Link da ficha enviado pelo WhatsApp.');
    d.candidatos.unshift(c); N.salvar();
    location.hash = '#/c/' + c.id;
    toast('Atendimento cadastrado. Link gerado.');
  });

  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !painel.hidden && !document.querySelector('dialog[open]')) fecharPainel(); });

  /* volta da ficha em outra aba: atualiza a tela */
  window.addEventListener('storage', function () { N.recarregar(); rota(); });
  window.addEventListener('hashchange', rota);

  $('[data-clinica]').textContent = N.carregar().clinica;
  rota();
})();
