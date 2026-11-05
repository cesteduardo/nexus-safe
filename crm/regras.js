/* Nexus Safe · regras do atendimento, iguais no navegador (demonstração) e no servidor (Cloudflare).
   Cada ação recebe o contexto (quem está fazendo, empresa, função, link) e o atendimento,
   valida, muda o atendimento e devolve as mensagens de WhatsApp que deveriam sair.
   Nada aqui toca em tela, localStorage ou banco: quem chama decide onde guardar. */
(function (raiz) {
  'use strict';

  var TIPOS = ['admissional', 'periodico', 'retorno_trabalho', 'mudanca_riscos', 'demissional'];
  var NOMES_TIPO = { admissional: 'Admissional', periodico: 'Periódico', retorno_trabalho: 'Retorno ao trabalho', mudanca_riscos: 'Mudança de riscos', demissional: 'Demissional' };
  var RESULTADOS = ['Apto', 'Apto com restrição', 'Inapto'];

  /* Catálogo de exames (nome, código e preparo). Quem diz qual exame cada função faz é o protocolo do PCMSO. */
  var CATALOGO = {
    clinico: { codigo: 'CLI', nome: 'Avaliação clínica ocupacional', preparo: '' },
    audiometria: { codigo: 'AUD', nome: 'Audiometria tonal e vocal', preparo: 'repouso acústico de 14 horas (sem barulho alto antes do exame)' },
    acuidade: { codigo: 'ACV', nome: 'Acuidade visual', preparo: 'traga seus óculos ou lentes, se usa' },
    ecg: { codigo: 'ECG', nome: 'Eletrocardiograma', preparo: '' },
    eeg: { codigo: 'EEG', nome: 'Eletroencefalograma', preparo: 'cabelo limpo e seco, sem creme ou gel' },
    glicemia: { codigo: 'GLI', nome: 'Glicemia de jejum', preparo: 'jejum de 8 horas' },
    hemograma: { codigo: 'HEM', nome: 'Hemograma completo', preparo: '' },
    espirometria: { codigo: 'ESP', nome: 'Espirometria', preparo: 'não fumar 2 horas antes' },
    raiox: { codigo: 'RXT', nome: 'Raio X de tórax', preparo: '' },
    parasitologico: { codigo: 'EPF', nome: 'Parasitológico de fezes', preparo: 'trazer a amostra no frasco entregue pela clínica' },
    toxicologico: { codigo: 'TOX', nome: 'Exame toxicológico de larga janela', preparo: 'coleta de cabelo ou pelo' }
  };

  function Erro(msg, status) { var e = new Error(msg); e.status = status || 400; e.publica = true; return e; }

  /* ---------- validação (a mesma regra do padrão GR Brands 2) ---------- */
  function digitos(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
  function nomeValido(v) { v = String(v || '').trim(); return v.length >= 2 && v.length <= 120 && /\p{L}/u.test(v) && !/[^\p{L}\p{M}' \-]/u.test(v); }
  function telValido(v) { var d = digitos(v); if (!/^[1-9][1-9]/.test(d)) return false; return d.length === 11 ? d[2] === '9' : d.length === 10 && /[2-5]/.test(d[2]); }
  function cpfValido(v) {
    var d = digitos(v); if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (var t = 9; t < 11; t++) { var s = 0; for (var i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i); if (((s * 10) % 11) % 10 !== Number(d[t])) return false; }
    return true;
  }
  function mascaraCpf(v) { v = digitos(v).slice(0, 11); return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); }
  function mascaraTel(v) { var d = digitos(v).slice(0, 11); var c = d.length === 11 ? 5 : 4; return '(' + d.slice(0, 2) + ') ' + d.slice(2, 2 + c) + '-' + d.slice(2 + c); }
  function dataValida(v) { return !!v && !isNaN(new Date(v)); }
  function texto(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max || 500); }

  /* ---------- textos ---------- */
  function primeiroNome(n) { return String(n || '').split(' ')[0]; }
  function nomeTipo(id) { return NOMES_TIPO[id] || 'Admissional'; }
  function semFicticia(n) { return String(n || '').replace(/ \(fict[íi]ci[ao]\)/, ''); }
  function dataCurta(iso) { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }); }
  function dataHora(iso) { var d = new Date(iso); return dataCurta(iso) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); }
  function dataLonga(iso) { return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
  function quandoExame(c) { return c.agendadoModo === 'chegada' ? dataLonga(c.agendadoPara) + ', por ordem de chegada (7h às 11h)' : dataHora(c.agendadoPara); }
  function somarMeses(iso, meses) { var d = new Date(iso); d.setMonth(d.getMonth() + (meses || 12)); return d.toISOString(); }
  function prazoS2220(iso) { var d = new Date(iso); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 16, 2, 59)).toISOString(); }
  function preparos(f) { var out = []; (f.exames || []).forEach(function (x) { var p = CATALOGO[x] && CATALOGO[x].preparo; if (p && out.indexOf(p) < 0) out.push(p); }); return out; }
  function textoLink(ctx, c) { return 'Oi, ' + primeiroNome(c.nome) + '! Aqui é da ' + ctx.clinica + '. Antes do seu exame ' + nomeTipo(c.tipoExame).toLowerCase() + ', preencha a ficha neste link (leva uns 10 minutos): ' + ctx.linkFicha(c); }

  function registrar(c, ctx, txt) { (c.historico = c.historico || []).push({ em: ctx.agora, txt: txt }); }

  /* ---------- ações ---------- */
  var ACOES = {};

  /* Novo atendimento (recepção da clínica ou RH da empresa). */
  ACOES.criar = function (ctx, _c, d) {
    d = d || {};
    var tipo = TIPOS.indexOf(d.tipoExame) >= 0 ? d.tipoExame : 'admissional';
    var nome = texto(d.nome, 120).replace(/ +/g, ' ');
    if (!nomeValido(nome)) throw Erro('Nome inválido.');
    if (!cpfValido(d.cpf)) throw Erro('CPF inválido.');
    if (!telValido(d.celular)) throw Erro('Celular inválido.');
    var e = ctx.empresa(d.empresaId), f = ctx.funcao(d.funcaoId);
    if (!e) throw Erro('Empresa não encontrada.', 404);
    if (!f || f.empresaId !== e.id) throw Erro('Função não pertence à empresa.');
    if (ctx.usuario.tipo === 'rh' && e.id !== ctx.usuario.empresaId) throw Erro('Sem permissão para esta empresa.', 403);
    if (tipo === 'admissional' && !dataValida(d.admissaoEm)) throw Erro('Informe a admissão prevista.');
    if (tipo === 'retorno_trabalho' && !dataValida(d.afastadoDesde)) throw Erro('Informe o início do afastamento.');
    var c = {
      id: ctx.novoId(), tipoExame: tipo, nome: nome, cpf: mascaraCpf(d.cpf), celular: mascaraTel(d.celular), empresaId: e.id, funcaoId: f.id,
      admissaoEm: tipo === 'admissional' ? new Date(d.admissaoEm).toISOString() : '', afastadoDesde: tipo === 'retorno_trabalho' ? new Date(d.afastadoDesde).toISOString() : '',
      etapa: 'enviado', criadoEm: ctx.agora, agendadoPara: '', agendadoModo: '', ficha: null, rascunho: null, aso: null, esocial: null, historico: []
    };
    ctx.prepararLink(c);
    registrar(c, ctx, ctx.usuario.tipo === 'rh' ? 'Pedido pelo RH da empresa (' + e.contato + ').' : 'Cadastrado(a) pela recepção.');
    return { novo: c, mensagens: [{ automacao: 'link', para: c.nome, texto: textoLink(ctx, c), aoEnviar: 'Link da ficha enviado pelo WhatsApp.', alvo: c }] };
  };

  ACOES.agendar = function (ctx, c, d) {
    exigirClinica(ctx);
    if (c.etapa !== 'recebida') throw Erro('Só dá para agendar depois que a ficha chega.');
    if (!dataValida(d && d.quando)) throw Erro('Data do exame inválida.');
    c.agendadoPara = new Date(d.quando).toISOString(); c.agendadoModo = d.modo === 'chegada' ? 'chegada' : 'hora'; c.etapa = 'agendado';
    registrar(c, ctx, 'Exame agendado para ' + quandoExame(c) + '.');
    var ori = preparos(ctx.funcao(c.funcaoId)).map(function (x) { return x.charAt(0).toLowerCase() + x.slice(1); });
    return { mensagens: [{ automacao: 'agenda', para: c.nome, texto: 'Oi, ' + primeiroNome(c.nome) + '! Seu exame ' + nomeTipo(c.tipoExame).toLowerCase() + ' está marcado para ' + quandoExame(c) + ' na ' + ctx.clinica + '. Leve RG e carteira de trabalho' + (ori.length ? '; ' + ori.join('; ') : '') + '.', aoEnviar: 'Confirmação enviada pelo WhatsApp.', alvo: c }] };
  };

  ACOES.atendido = function (ctx, c) {
    exigirClinica(ctx);
    if (c.etapa !== 'agendado') throw Erro('O atendimento ainda não foi agendado.');
    c.etapa = 'atendido'; registrar(c, ctx, 'Atendido(a) pela equipe médica.');
    return { mensagens: [] };
  };

  ACOES.emitirAso = function (ctx, c, d) {
    exigirMedico(ctx);
    if (c.etapa !== 'atendido') throw Erro('O ASO sai depois do atendimento.');
    d = d || {};
    var res = RESULTADOS.indexOf(d.resultado) >= 0 ? d.resultado : null;
    if (!res) throw Erro('Aptidão inválida.');
    var f = ctx.funcao(c.funcaoId), e = ctx.empresa(c.empresaId);
    c.aso = { resultado: res, restricoes: res === 'Apto com restrição' ? texto(d.restricoes, 300) : '', medico: ctx.usuario.nome, crm: ctx.usuario.crm || 'CRM-SP 123456', data: ctx.agora, validade: c.tipoExame === 'demissional' ? '' : somarMeses(ctx.agora, f.periodicidade), obs: texto(d.obs, 300) };
    c.etapa = 'aso'; c.esocial = { status: 'pendente', prazo: prazoS2220(ctx.agora) };
    registrar(c, ctx, 'ASO emitido: ' + res + '. S-2220 pendente até ' + dataLonga(c.esocial.prazo) + '.');
    return { mensagens: [{ automacao: 'aso', para: e.contato + ' · ' + semFicticia(e.nome), texto: 'Olá, ' + primeiroNome(e.contato) + '. O ASO ' + nomeTipo(c.tipoExame).toLowerCase() + ' de ' + c.nome + ' (' + f.nome + ') está pronto: ' + res.toUpperCase() + '. O PDF segue anexo. ' + ctx.clinica + '.', aoEnviar: 'Aviso enviado ao RH da empresa.', alvo: c }] };
  };

  ACOES.esocialEnviado = function (ctx, c) {
    exigirClinica(ctx);
    if (!c.esocial || c.esocial.status !== 'pendente') throw Erro('Não há S-2220 pendente.');
    c.esocial.status = 'enviado'; c.esocial.enviadoEm = ctx.agora; c.esocial.recibo = '1.2.' + String(Date.parse(ctx.agora)).slice(-10);
    registrar(c, ctx, 'S-2220 enviado ao eSocial.');
    return { mensagens: [] };
  };

  ACOES.guia = function (ctx, c) { registrar(c, ctx, 'Guia de encaminhamento emitida.'); return { mensagens: [] }; };

  ACOES.abrirFicha = function (ctx, c) { exigirMedico(ctx); registrar(c, ctx, 'Ficha aberta por ' + ctx.usuario.nome + '.'); return { mensagens: [] }; };

  ACOES.avisarRh = function (ctx, c) {
    exigirClinica(ctx);
    if (!c.aso || !c.aso.validade) throw Erro('Atendimento sem ASO com validade.');
    var e = ctx.empresa(c.empresaId), f = ctx.funcao(c.funcaoId);
    c.avisoRhEm = ctx.agora; registrar(c, ctx, 'RH avisado do vencimento do ASO.');
    return { mensagens: [{ automacao: 'periodico', para: e.contato + ' · ' + semFicticia(e.nome), texto: 'Olá, ' + primeiroNome(e.contato) + '. O ASO de ' + c.nome + ' (' + f.nome + ') vence em ' + dataLonga(c.aso.validade) + '. Podemos convocar o periódico? ' + ctx.clinica + '.', alvo: c, sempre: true }] };
  };

  ACOES.convocar = function (ctx, base) {
    exigirClinica(ctx);
    if (!base.aso || !base.aso.validade) throw Erro('Atendimento sem ASO com validade.');
    if (base.convocadoEm) throw Erro('Periódico já convocado.');
    var novo = { id: ctx.novoId(), tipoExame: 'periodico', nome: base.nome, cpf: base.cpf, celular: base.celular, empresaId: base.empresaId, funcaoId: base.funcaoId, admissaoEm: '', afastadoDesde: '', etapa: 'enviado', criadoEm: ctx.agora, agendadoPara: '', agendadoModo: '', ficha: null, rascunho: null, aso: null, esocial: null, historico: [] };
    ctx.prepararLink(novo);
    registrar(novo, ctx, 'Periódico convocado pela clínica (ASO anterior vence em ' + dataLonga(base.aso.validade) + ').');
    base.convocadoEm = ctx.agora; registrar(base, ctx, 'Periódico convocado.');
    return { novo: novo, mensagens: [{ automacao: 'link', para: novo.nome, texto: textoLink(ctx, novo), aoEnviar: 'Link da ficha enviado pelo WhatsApp.', alvo: novo }] };
  };

  function exigirClinica(ctx) { if (ctx.usuario.tipo !== 'clinica') throw Erro('Só a clínica faz isso.', 403); }
  function exigirMedico(ctx) { if (ctx.usuario.tipo !== 'clinica' || ctx.usuario.papel !== 'medico') throw Erro('Só a equipe médica faz isso.', 403); }

  /* Ação que cria (criar) não tem alvo; as outras mudam um atendimento que já existe. */
  var SEM_ALVO = { criar: true };

  /* ---------- ficha enviada pelo candidato: o mínimo que o servidor confere ---------- */
  function conferirFicha(st) {
    if (!st || typeof st !== 'object') throw Erro('Ficha vazia.');
    var p = st.pessoais || {};
    ['nascimento', 'sexo', 'estado_civil', 'escolaridade', 'endereco', 'emergencia_nome', 'emergencia_parentesco', 'emergencia_tel'].forEach(function (k) { if (!texto(p[k])) throw Erro('Ficha incompleta: ' + k + '.'); });
    if (!nomeValido(p.emergencia_nome)) throw Erro('Nome do contato de emergência inválido.');
    if (!telValido(p.emergencia_tel)) throw Erro('Telefone de emergência inválido.');
    var nasc = new Date(p.nascimento); if (isNaN(nasc) || nasc > new Date()) throw Erro('Nascimento inválido.');
    if (!st.aceite) throw Erro('Falta o aceite da declaração e da LGPD.');
    if (JSON.stringify(st).length > 400000) throw Erro('Ficha grande demais.', 413);
    return true;
  }

  raiz.NexusRegras = {
    ACOES: ACOES, SEM_ALVO: SEM_ALVO, TIPOS: TIPOS, Erro: Erro,
    nomeValido: nomeValido, telValido: telValido, cpfValido: cpfValido, mascaraCpf: mascaraCpf, mascaraTel: mascaraTel, digitos: digitos, texto: texto,
    quandoExame: quandoExame, prazoS2220: prazoS2220, somarMeses: somarMeses, nomeTipo: nomeTipo, textoLink: textoLink, conferirFicha: conferirFicha
  , CATALOGO: CATALOGO
  };
})(typeof window !== 'undefined' ? window : globalThis);
