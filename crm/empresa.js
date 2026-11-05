/* Nexus Safe · visão do RH da empresa cliente
   Só os funcionários desta empresa: cadastro, etapa, data do exame e ASO.
   Nenhuma resposta de saúde, nenhum ponto de atenção (LGPD, art. 11). */
(function () {
  'use strict';
  var N = window.Nexus, C = window.Contas, esc = C.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var vista = $('#vista');

  /* A empresa vem do login, nunca do endereço: o RH de uma empresa não vê a outra. */
  var sessao = C.exigir('rh'); if (!sessao) return;
  var empresaId = sessao.empresaId;
  if (!N.empresa(empresaId)) { C.sair(); location.replace('entrar.html'); return; }

  function toast(msg) { var t = $('[data-toast]'); t.textContent = msg; t.classList.add('visivel'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('visivel'); }, 2600); }
  function dia(iso, hora) { if (!iso) return ''; var d = new Date(iso), t = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); return hora ? t + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : t; }
  function semFicticia(n) { return n.replace(/ \(fict[íi]ci[ao]\)/, ''); }

  /* O que o RH lê em cada etapa, sem nada da ficha. */
  var LEITURA = {
    enviado: 'Link da ficha enviado ao funcionário',
    preenchendo: 'Funcionário preenchendo a ficha',
    recebida: 'Ficha com a clínica, aguardando horário',
    agendado: 'Exame marcado',
    atendido: 'Exame feito, ASO em emissão',
    aso: 'ASO emitido'
  };

  function render() {
    var d = N.carregar(), e = N.empresa(empresaId);
    $('[data-empresa-nome]').textContent = semFicticia(e.nome);
    var lista = d.candidatos.filter(function (c) { return c.empresaId === empresaId; });
    var limite = new Date(); limite.setDate(limite.getDate() + 60);
    var andamento = lista.filter(function (c) { return c.etapa !== 'aso'; }).length;
    var emitidos = lista.filter(function (c) { return c.etapa === 'aso'; }).length;
    var vencendo = lista.filter(function (c) { return c.aso && c.aso.validade && new Date(c.aso.validade) <= limite; }).length;

    var h = '<div class="cab"><div><h1>' + esc(semFicticia(e.nome)) + '</h1><p>Exames dos seus funcionários na ' + esc(d.clinica) + '.</p></div>' +
      '<div class="cab__acoes"><button class="botao" type="button" data-pedir>+ Pedir exame</button></div></div>';
    h += '<div class="agora agora--fixa">' + [[andamento, 'Em andamento', 'Do link ao ASO'], [emitidos, 'ASOs emitidos', 'Prontos para baixar'], [vencendo, 'Periódicos a vencer', 'Nos próximos 60 dias']].map(function (r) { return '<div class="agora__item"><b>' + r[0] + '</b><span>' + esc(r[1]) + '<small>' + esc(r[2]) + '</small></span></div>'; }).join('') + '</div>';

    if (!lista.length) h += '<p class="aviso-demo">Nenhum exame pedido ainda. Use "Pedir exame" para começar.</p>';
    else h += '<div class="rolagem"><table class="tabela"><thead><tr><th>Funcionário</th><th>Exame</th><th>Onde está</th><th>ASO</th></tr></thead><tbody>' + lista.map(function (c) {
      var f = N.funcao(c.funcaoId), passo = N.ETAPAS.map(function (x) { return x.id; }).indexOf(c.etapa) + 1;
      return '<tr data-cand="' + c.id + '"><td><span class="agencia__nome">' + esc(c.nome) + '<small>' + esc(f ? f.nome : '') + '</small></span></td>' +
        '<td>' + esc(N.nomeTipo(c.tipoExame)) + (c.agendadoPara && (c.etapa === 'agendado') ? '<br><span style="color:var(--apoio)">' + (c.agendadoModo === 'chegada' ? dia(c.agendadoPara) + ', ordem de chegada' : dia(c.agendadoPara, true)) + '</span>' : '') + (c.admissaoEm && c.etapa !== 'aso' ? '<br><span style="font-size:13px;color:var(--apoio)">Admissão ' + dia(c.admissaoEm) + '</span>' : '') + '</td>' +
        '<td>' + esc(LEITURA[c.etapa]) + '<br><span style="color:var(--apoio);font-size:13px">Passo ' + passo + ' de ' + N.ETAPAS.length + '</span></td>' +
        '<td>' + (c.aso ? '<div class="acoes-linha"><button class="botao botao--claro botao--pequeno" type="button" data-ver-aso="' + c.id + '">Ver ASO</button><button class="botao botao--claro botao--pequeno" type="button" data-xml="' + c.id + '">XML S-2220</button></div><br><span style="font-size:13px;color:var(--apoio)">' + esc(c.aso.resultado) + (c.aso.validade ? ' · vence ' + dia(c.aso.validade) : '') + '</span>' + (c.esocial ? '<br><span class="selo ' + (c.esocial.status === 'enviado' ? 'selo--verde' : 'selo--ambar') + '" style="margin-top:4px">S-2220 ' + (c.esocial.status === 'enviado' ? 'enviado' : 'pendente') + '</span>' : '') : '<span style="color:var(--apoio)">Ainda não</span><br><button class="botao botao--claro botao--pequeno" type="button" data-guia="' + c.id + '" style="margin-top:6px">Guia de encaminhamento</button>') + '</td></tr>';
    }).join('') + '</tbody></table></div>';

    h += '<div class="bloco bloco--trava" style="margin-top:16px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><b>As respostas de saúde ficam só com a equipe médica</b><p>O RH acompanha a etapa e recebe o ASO com a aptidão, sem diagnóstico (LGPD, art. 11).</p></div>';
    vista.innerHTML = h;
  }

  function pedir() {
    var f = $('[data-form-pedido]');
    f.reset(); f.querySelectorAll('.campo__erro').forEach(function (x) { x.remove(); }); f.querySelectorAll('.faltando').forEach(function (x) { x.classList.remove('faltando'); });
    $('[data-sel-tipo]').innerHTML = N.TIPOS_EXAME.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + '</option>'; }).join('');
    $('[data-sel-funcao]').innerHTML = N.carregar().funcoes.filter(function (x) { return x.empresaId === empresaId; }).map(function (x) { return '<option value="' + x.id + '">' + esc(x.nome) + '</option>'; }).join('');
    mostrarAdmissao();
    $('[data-modal-pedido]').showModal();
  }
  function mostrarAdmissao() { window.Campos.porTipo($('[data-form-pedido]'), $('[data-sel-tipo]').value); }
  document.addEventListener('change', function (ev) { if (ev.target.matches('[data-sel-tipo]')) mostrarAdmissao(); });

  $('[data-form-pedido]').addEventListener('submit', function (ev) {
    if (ev.submitter && ev.submitter.value === 'cancelar') return;
    if (window.Campos.validar(ev.target).length) { ev.preventDefault(); return; }
    var fd = new FormData(ev.target), d = N.carregar(), e = N.empresa(empresaId);
    var c = { id: N.uid(), token: N.token(), tipoExame: fd.get('tipoExame'), nome: fd.get('nome').trim().replace(/ +/g, ' '), cpf: fd.get('cpf'), celular: fd.get('celular'), empresaId: empresaId, funcaoId: fd.get('funcaoId'), admissaoEm: fd.get('admissaoEm') ? new Date(fd.get('admissaoEm') + 'T08:00:00').toISOString() : '', afastadoDesde: fd.get('afastadoDesde') ? new Date(fd.get('afastadoDesde') + 'T08:00:00').toISOString() : '', etapa: 'enviado', criadoEm: new Date().toISOString(), agendadoPara: '', ficha: null, rascunho: null, aso: null, historico: [] };
    c.historico.push({ em: c.criadoEm, txt: 'Pedido pelo RH da empresa (' + e.contato + ').' });
    var link = new URL('ficha.html?t=' + c.token, location.href).href;
    if (N.enfileirar('link', c.nome, 'Oi, ' + N.primeiroNome(c.nome) + '! Aqui é da ' + d.clinica + '. Antes do seu exame ' + N.nomeTipo(c.tipoExame).toLowerCase() + ', preencha a ficha neste link (leva uns 10 minutos): ' + link)) c.historico.push({ em: c.criadoEm, txt: 'Link da ficha enviado pelo WhatsApp.' });
    d.candidatos.unshift(c); N.salvar(); render(); toast('Pedido enviado à clínica');
  });

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('button'); if (!t) return;
    if (t.matches('[data-pedir]')) pedir();
    else if (t.matches('[data-ver-aso]')) {
      var c = N.carregar().candidatos.filter(function (x) { return x.id === t.dataset.verAso && x.empresaId === empresaId; })[0];
      if (c && c.aso) { $('[data-aso-conteudo]').innerHTML = N.asoHtml(c); $('[data-modal-aso]').showModal(); }
    }
    else if (t.matches('[data-guia]') || t.matches('[data-xml]')) {
      var g = N.carregar().candidatos.filter(function (x) { return x.id === (t.dataset.guia || t.dataset.xml) && x.empresaId === empresaId; })[0];
      if (g && t.matches('[data-guia]')) { $('[data-aso-conteudo]').innerHTML = N.guiaHtml(g); $('[data-modal-aso]').showModal(); }
      else if (g && g.aso) { N.baixar(N.nomeArquivo(g), N.s2220Xml(g)); toast('XML do S-2220 baixado'); }
    }
    else if (t.matches('[data-fechar-aso]')) $('[data-modal-aso]').close();
    else if (t.matches('[data-imprimir]')) window.print();
  });

  window.addEventListener('storage', function () { N.recarregar(); render(); });
  render();
})();
