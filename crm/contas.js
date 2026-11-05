/* Nexus Safe · perfis, agências clientes e chamados de TI
   Três perfis no modelo:
   - admin: a equipe da Nexus Safe (quem oferece o serviço). Vê agências, uso e chamados. Nunca vê resposta de saúde.
   - clinica: a agência de SST, cliente da Nexus Safe. Usa o CRM e abre chamados.
   - rh: o RH da empresa, cliente da agência. Vê só os próprios funcionários, etapa e ASO.
   Tudo fictício e salvo só neste navegador. */
(function () {
  'use strict';

  var CHAVE_PERFIL = 'nexus-safe-perfil';
  var CHAVE = 'nexus-safe-contas-v1';

  var PERFIS = {
    admin: { nome: 'Nexus Safe', papel: 'Administração', usuario: 'Equipe Nexus Safe', inicio: 'admin.html' },
    clinica: { nome: 'Clínica Vida Ocupacional', papel: 'Agência cliente', usuario: 'Recepção', inicio: './' },
    rh: { nome: 'RH da empresa', papel: 'Cliente da agência', usuario: 'RH', inicio: 'empresa.html' }
  };

  function lerPerfil() { try { return JSON.parse(localStorage.getItem(CHAVE_PERFIL)) || null; } catch (e) { return null; } }
  function gravarPerfil(p) { try { localStorage.setItem(CHAVE_PERFIL, JSON.stringify(p)); } catch (e) { /* segue sem lembrar */ } }

  function quando(dias, hora) { var d = new Date(); d.setDate(d.getDate() - dias); d.setHours(hora || 9, 0, 0, 0); return d.toISOString(); }

  var SERVICOS = { suporte: 'Suporte de TI', automacoes: 'Automações de WhatsApp', plataforma: 'Plataforma Nexus Safe' };
  var CATEGORIAS = ['Impressora', 'Rede e Wi-Fi', 'Computador', 'Sistema da clínica', 'Backup', 'WhatsApp', 'Outro'];
  var SITUACOES = { aberto: 'Aberto', andamento: 'Em andamento', resolvido: 'Resolvido' };

  function seed() {
    return {
      versao: 1,
      agencias: [
        /* a única com CRM de verdade no modelo: os números saem do quadro */
        { id: 'a1', nome: 'Clínica Vida Ocupacional', cidade: 'São José do Rio Preto, SP', contato: 'Dra. Camila Rocha', tel: '(17) 99300-1010', desde: quando(40), situacao: 'ativa', servicos: ['suporte', 'automacoes', 'plataforma'], usuarios: 4, aoVivo: true },
        { id: 'a2', nome: 'Ocupa Saúde Mirassol', cidade: 'Mirassol, SP', contato: 'Rogério Lima', tel: '(17) 99300-2020', desde: quando(18), situacao: 'implantacao', servicos: ['suporte', 'plataforma'], usuarios: 2, uso: { fichas: 6, asos: 2, mensagens: 14 } },
        { id: 'a3', nome: 'SST Norte Paulista', cidade: 'Catanduva, SP', contato: 'Aline Prado', tel: '(17) 99300-3030', desde: quando(7), situacao: 'teste', servicos: ['suporte'], usuarios: 1, uso: { fichas: 0, asos: 0, mensagens: 0 } }
      ],
      chamados: [
        { id: 'k1', agenciaId: 'a1', assunto: 'Impressora de etiquetas não puxa o papel', categoria: 'Impressora', prioridade: 'alta', situacao: 'aberto', abertoEm: quando(0, 8), por: 'Recepção', notas: [] },
        { id: 'k2', agenciaId: 'a2', assunto: 'Configurar o modelo de ASO no sistema da clínica', categoria: 'Sistema da clínica', prioridade: 'normal', situacao: 'andamento', abertoEm: quando(2, 10), por: 'Rogério Lima', notas: [{ em: quando(1, 15), txt: 'Modelo montado, falta o médico aprovar.' }] },
        { id: 'k3', agenciaId: 'a1', assunto: 'Backup da noite de terça falhou', categoria: 'Backup', prioridade: 'alta', situacao: 'resolvido', abertoEm: quando(6, 7), por: 'Nexus Safe (alerta automático)', notas: [{ em: quando(6, 11), txt: 'Disco externo cheio. Rotação ajustada e backup refeito.' }] },
        { id: 'k4', agenciaId: 'a3', assunto: 'Wi-Fi da recepção cai à tarde', categoria: 'Rede e Wi-Fi', prioridade: 'normal', situacao: 'aberto', abertoEm: quando(1, 16), por: 'Aline Prado', notas: [] }
      ]
    };
  }

  var memoria = null;
  function carregar() {
    if (memoria) return memoria;
    try { var t = localStorage.getItem(CHAVE); if (t) memoria = JSON.parse(t); } catch (e) { memoria = null; }
    if (!memoria || memoria.versao !== 1) { memoria = seed(); salvar(); }
    return memoria;
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(memoria)); } catch (e) { /* segue só em memória */ } }
  function restaurar() { memoria = seed(); salvar(); return memoria; }
  function recarregar() { memoria = null; return carregar(); }

  function agencia(id) { var d = carregar(); for (var i = 0; i < d.agencias.length; i++) if (d.agencias[i].id === id) return d.agencias[i]; return null; }

  /* Uso do mês: a agência ao vivo conta o que está no quadro; as outras têm números fixos. */
  function uso(a) {
    if (!a.aoVivo || !window.Nexus) return a.uso || { fichas: 0, asos: 0, mensagens: 0 };
    var d = window.Nexus.carregar(), ini = new Date(); ini.setDate(1); ini.setHours(0, 0, 0, 0);
    var noMes = function (iso) { return iso && new Date(iso) >= ini; };
    return {
      fichas: d.candidatos.filter(function (c) { return c.ficha && noMes(c.ficha.enviadoEm); }).length,
      asos: d.candidatos.filter(function (c) { return c.aso && noMes(c.aso.data); }).length,
      mensagens: d.mensagens.filter(function (m) { return noMes(m.em); }).length
    };
  }

  function abrirChamado(dados) {
    var d = carregar();
    var k = { id: 'k' + Date.now().toString(36), agenciaId: dados.agenciaId, assunto: dados.assunto, categoria: dados.categoria, prioridade: dados.prioridade || 'normal', situacao: 'aberto', abertoEm: new Date().toISOString(), por: dados.por, notas: [] };
    d.chamados.unshift(k); salvar(); return k;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dataHora(iso) { var d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  var COR_SITUACAO = { aberto: 'selo--ambar', andamento: 'selo--azul', resolvido: 'selo--verde' };

  /* Cartão de chamado. A administração muda a situação e anota; a clínica só acompanha. */
  function chamadoHtml(k, admin) {
    var a = agencia(k.agenciaId);
    var h = '<article class="msg chamado" data-chamado="' + k.id + '"><div class="msg__cab"><span>' + (admin ? '<b>' + esc(a ? a.nome : '') + '</b> · ' : '') + esc(k.categoria) + ' · aberto por ' + esc(k.por) + '</span><span>' + dataHora(k.abertoEm) + '</span></div>' +
      '<p class="chamado__assunto">' + esc(k.assunto) + '</p><div class="chips" style="margin-top:8px"><span class="selo ' + COR_SITUACAO[k.situacao] + '">' + esc(SITUACOES[k.situacao]) + '</span>' + (k.prioridade === 'alta' ? '<span class="selo selo--vermelho">Prioridade alta</span>' : '') + '</div>';
    if (k.notas.length) h += '<ol class="linha-tempo chamado__notas">' + k.notas.map(function (n) { return '<li><time>' + dataHora(n.em) + '</time><span>' + esc(n.txt) + '</span></li>'; }).join('') + '</ol>';
    if (admin && k.situacao !== 'resolvido') {
      h += '<div class="chamado__acoes"><input class="entrada" data-nota placeholder="Anotar o que foi feito" aria-label="Anotação do chamado">' +
        (k.situacao === 'aberto' ? '<button class="botao botao--claro botao--pequeno" type="button" data-situacao="andamento">Começar</button>' : '') +
        '<button class="botao botao--pequeno" type="button" data-situacao="resolvido">Resolver</button></div>';
    }
    return h + '</article>';
  }

  function mudarSituacao(id, situacao, nota) {
    var d = carregar(), k = d.chamados.filter(function (x) { return x.id === id; })[0];
    if (!k) return null;
    k.situacao = situacao;
    k.notas.push({ em: new Date().toISOString(), txt: nota || (situacao === 'resolvido' ? 'Chamado resolvido.' : 'Atendimento começou.') });
    salvar(); return k;
  }

  window.Contas = {
    PERFIS: PERFIS, SERVICOS: SERVICOS, CATEGORIAS: CATEGORIAS, SITUACOES: SITUACOES,
    lerPerfil: lerPerfil, gravarPerfil: gravarPerfil,
    carregar: carregar, salvar: salvar, restaurar: restaurar, recarregar: recarregar, agencia: agencia, uso: uso, abrirChamado: abrirChamado, mudarSituacao: mudarSituacao, chamadoHtml: chamadoHtml, esc: esc, dataHora: dataHora
  };
})();
