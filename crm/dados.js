/* Nexus Safe · modelo do CRM
   Tudo fica no localStorage do navegador. Dados fictícios. */
(function () {
  'use strict';

  var CHAVE = 'nexus-safe-demo-v2';

  var ETAPAS = [
    { id: 'enviado', nome: 'Link enviado' },
    { id: 'preenchendo', nome: 'Preenchendo' },
    { id: 'recebida', nome: 'Ficha recebida' },
    { id: 'agendado', nome: 'Agendado' },
    { id: 'atendido', nome: 'Atendido' },
    { id: 'aso', nome: 'ASO emitido' }
  ];

  var RISCOS = {
    ruido: 'Ruído',
    altura: 'Trabalho em altura',
    eletricidade: 'Eletricidade',
    quimico: 'Produto químico',
    poeira: 'Poeira',
    calor: 'Calor',
    alimentos: 'Manipulação de alimentos',
    motorista: 'Direção de veículo',
    confinado: 'Espaço confinado',
    ergonomico: 'Ergonômico'
  };

  /* Grupos de risco (como no inventário do SST e no ASO da NR-7) */
  var RISCO_GRUPO = { ruido: 'Físico', calor: 'Físico', quimico: 'Químico', poeira: 'Químico', alimentos: 'Biológico', ergonomico: 'Ergonômico', eletricidade: 'Acidente', altura: 'Acidente', motorista: 'Acidente', confinado: 'Acidente' };

  /* Catálogo de exames: o mesmo vocabulário do SST (routes/exames.js, CATALOGO_BASICO).
     Só nome, código e preparo. Quem diz qual exame cada função faz é o protocolo do PCMSO. */
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
  var EXAMES = {};
  Object.keys(CATALOGO).forEach(function (k) { EXAMES[k] = CATALOGO[k].nome; });

  /* Tipos de exame do PCMSO (routes/pcmso.js do SST) */
  var TIPOS_EXAME = [['admissional', 'Admissional'], ['periodico', 'Periódico'], ['retorno_trabalho', 'Retorno ao trabalho'], ['mudanca_riscos', 'Mudança de riscos'], ['demissional', 'Demissional']];
  function nomeTipo(id) { for (var i = 0; i < TIPOS_EXAME.length; i++) if (TIPOS_EXAME[i][0] === id) return TIPOS_EXAME[i][1]; return 'Admissional'; }
  function preparos(funcao) { var out = []; (funcao.exames || []).forEach(function (x) { var p = CATALOGO[x] && CATALOGO[x].preparo; if (p && out.indexOf(p) < 0) out.push(p); }); return out; }
  function somarMeses(iso, meses) { var d = new Date(iso); d.setMonth(d.getMonth() + (meses || 12)); return d.toISOString(); }

  var SAUDE = [
    ['pressao', 'Pressão alta'],
    ['diabetes', 'Diabetes'],
    ['coracao', 'Problema no coração'],
    ['asma', 'Asma ou bronquite'],
    ['convulsao', 'Convulsão ou epilepsia'],
    ['desmaio', 'Desmaio'],
    ['labirintite', 'Labirintite ou tontura'],
    ['coluna', 'Problema de coluna'],
    ['ler', 'LER/DORT (dor por esforço repetitivo)'],
    ['hernia', 'Hérnia'],
    ['varizes', 'Varizes'],
    ['audicao', 'Problema de audição'],
    ['visao', 'Problema de visão'],
    ['pele', 'Problema de pele'],
    ['mental', 'Ansiedade, depressão ou outro problema de saúde mental'],
    ['hepatite', 'Hepatite'],
    ['tuberculose', 'Tuberculose']
  ];

  var ESPECIFICAS = {
    ruido: [['ruido_14h', 'Ficou em lugar com barulho alto nas últimas 14 horas?'], ['zumbido', 'Sente zumbido no ouvido?'], ['ouvido', 'Já teve infecção ou cirurgia no ouvido?']],
    altura: [['medo_altura', 'Tem medo de altura?'], ['tontura_alt', 'Já sentiu tontura ou vertigem trabalhando no alto?'], ['remedio_sono', 'Usa algum remédio que dá sono?']],
    eletricidade: [['choque', 'Já levou choque elétrico forte?'], ['marcapasso', 'Usa marca-passo?']],
    quimico: [['alergia_quim', 'Tem alergia a algum produto químico?'], ['rinite', 'Tem rinite ou falta de ar com cheiro forte?']],
    poeira: [['tosse', 'Tem tosse frequente ou chiado no peito?']],
    calor: [['passou_mal_calor', 'Já passou mal no calor (desmaio, queda de pressão)?']],
    alimentos: [['diarreia', 'Teve diarreia ou vômito nos últimos 15 dias?'], ['ferida_mao', 'Tem ferida, corte ou micose nas mãos?']],
    motorista: [['cnh_cde', 'Tem CNH categoria C, D ou E?'], ['oculos_dirigir', 'Precisa de óculos para dirigir?'], ['cnh_suspensa', 'Já teve a CNH suspensa?']],
    confinado: [['claustrofobia', 'Sente falta de ar ou aflição em lugar fechado?']],
    ergonomico: [['dor_punho', 'Sente dor nos punhos, ombros ou coluna?']]
  };

  var EXPOSICOES = ['Ruído', 'Poeira', 'Produto químico', 'Calor', 'Frio', 'Vibração', 'Radiação', 'Agente biológico', 'Altura', 'Eletricidade'];

  var FAMILIA = ['Pressão alta', 'Diabetes', 'Doença do coração', 'Câncer', 'Problema mental'];

  /* Pontos de atenção: cruzam as respostas com os riscos da função */
  var REGRAS = [
    { risco: 'altura', saude: ['convulsao', 'desmaio', 'labirintite'], texto: 'Função em altura com histórico de {x}' },
    { risco: 'eletricidade', saude: ['convulsao', 'coracao'], texto: 'Eletricidade com histórico de {x}' },
    { risco: 'motorista', saude: ['convulsao', 'desmaio', 'visao'], texto: 'Direção de veículo com histórico de {x}' },
    { risco: 'ruido', saude: ['audicao'], texto: 'Exposição a ruído com {x}' },
    { risco: 'poeira', saude: ['asma', 'tuberculose'], texto: 'Exposição a poeira com {x}' },
    { risco: 'quimico', saude: ['asma', 'pele'], texto: 'Produto químico com {x}' },
    { risco: 'alimentos', saude: ['hepatite', 'pele'], texto: 'Manipulação de alimentos com {x}' },
    { risco: 'ergonomico', saude: ['ler', 'coluna'], texto: 'Função ergonômica com {x}' },
    { risco: 'calor', saude: ['pressao', 'coracao'], texto: 'Exposição ao calor com {x}' }
  ];

  function nomeSaude(id) { for (var i = 0; i < SAUDE.length; i++) if (SAUDE[i][0] === id) return SAUDE[i][1]; return id; }
  function nomeEspecifica(id) { for (var r in ESPECIFICAS) for (var i = 0; i < ESPECIFICAS[r].length; i++) if (ESPECIFICAS[r][i][0] === id) return ESPECIFICAS[r][i][1]; return id; }

  function alertas(ficha, funcao) {
    if (!ficha) return { fortes: [], leves: [] };
    var fortes = [], leves = [];
    var riscos = (funcao && funcao.riscos) || [];
    var s = ficha.saude || {};
    REGRAS.forEach(function (r) {
      if (riscos.indexOf(r.risco) < 0) return;
      r.saude.forEach(function (k) { if (s[k] && s[k].sim) fortes.push(r.texto.replace('{x}', nomeSaude(k).toLowerCase())); });
    });
    Object.keys(s).forEach(function (k) { if (s[k] && s[k].sim) leves.push(nomeSaude(k) + (s[k].detalhe ? ': ' + s[k].detalhe : '')); });
    var e = ficha.especificas || {};
    Object.keys(e).forEach(function (k) {
      if (!e[k] || !e[k].sim) return;
      if (k === 'cnh_cde') return;
      if (k === 'ruido_14h') { fortes.push('Sem repouso auditivo de 14 h: remarcar a audiometria'); return; }
      leves.push('Função: "' + nomeEspecifica(k) + '" Sim' + (e[k].detalhe ? ' (' + e[k].detalhe + ')' : ''));
    });
    var a = ficha.acidentes || {};
    if (a.acidente && a.acidente.sim) leves.push('Acidente de trabalho anterior' + (a.acidente.detalhe ? ': ' + a.acidente.detalhe : ''));
    if (a.inss && a.inss.sim) leves.push('Afastamento pelo INSS' + (a.inss.detalhe ? ': ' + a.inss.detalhe : ''));
    if (a.ocupacional && a.ocupacional.sim) fortes.push('Doença ocupacional anterior' + (a.ocupacional.detalhe ? ': ' + a.ocupacional.detalhe : ''));
    return { fortes: fortes, leves: leves };
  }

  /* ---------- dados de demonstração ---------- */
  function agoraMenos(dias, horas) { var d = new Date(); d.setDate(d.getDate() - dias); d.setHours(horas || 9, 0, 0, 0); return d.toISOString(); }
  function daquiA(dias, horas) { var d = new Date(); d.setDate(d.getDate() + dias); d.setHours(horas || 8, 0, 0, 0); return d.toISOString(); }
  function token() { var c = 'abcdefghijkmnpqrstuvwxyz23456789', s = ''; for (var i = 0; i < 24; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
  function uid() { return Math.random().toString(36).slice(2, 10); }

  function fichaBase(over) {
    var f = {
      pessoais: { nome_social: '', nascimento: '1994-05-12', sexo: 'Masculino', estado_civil: 'Casado(a)', escolaridade: 'Ensino médio completo', endereco: 'Rua das Acácias, 120, Jardim Bela Vista', emergencia_nome: 'Maria (esposa)', emergencia_tel: '(17) 99100-2233', pcd: { sim: false, detalhe: '' } },
      trabalhos: [{ empresa: 'Serralheria Paulista', funcao: 'Ajudante', tempo: '2 anos', exposicoes: ['Ruído', 'Poeira'], epi: 'sim' }],
      acidentes: { acidente: { sim: false, detalhe: '' }, inss: { sim: false, detalhe: '' }, ocupacional: { sim: false, detalhe: '' } },
      saude: {},
      cirurgias: 'Nenhuma', remedios: 'Nenhum', alergias: 'Nenhuma', oculos: 'nao',
      habitos: { fuma: 'nao', fuma_detalhe: '', alcool: 'socialmente', atividade: 'sim' },
      familia: ['Pressão alta'],
      especificas: {},
      aceite: true, assinatura: '', enviadoEm: agoraMenos(1, 14)
    };
    SAUDE.forEach(function (s) { f.saude[s[0]] = { sim: false, detalhe: '' }; });
    return Object.assign(f, over || {});
  }

  function seed() {
    var empresas = [
      { id: 'e1', nome: 'Metalúrgica Vale Norte (fictícia)', cnpj: '12.345.678/0001-90', contato: 'Fernanda (RH)', tel: '(17) 99200-1111' },
      { id: 'e2', nome: 'Construtora Horizonte Azul (fictícia)', cnpj: '23.456.789/0001-01', contato: 'Paulo (DP)', tel: '(17) 99200-2222' },
      { id: 'e3', nome: 'Mercado Bom Dia (fictício)', cnpj: '34.567.890/0001-12', contato: 'Juliana (RH)', tel: '(17) 99200-3333' },
      { id: 'e4', nome: 'Transportes Rota Certa (fictícia)', cnpj: '45.678.901/0001-23', contato: 'Marcos (frota)', tel: '(17) 99200-4444' }
    ];
    var funcoes = [
      { id: 'f1', empresaId: 'e1', nome: 'Soldador', setor: 'Caldeiraria', riscos: ['ruido', 'quimico', 'calor'], exames: ['clinico', 'audiometria', 'espirometria', 'raiox'], periodicidade: 6 },
      { id: 'f2', empresaId: 'e1', nome: 'Eletricista de manutenção', setor: 'Manutenção', riscos: ['eletricidade', 'altura', 'ruido'], exames: ['clinico', 'audiometria', 'acuidade', 'ecg', 'eeg', 'glicemia'], periodicidade: 12 },
      { id: 'f3', empresaId: 'e2', nome: 'Servente de obras', setor: 'Obra', riscos: ['ruido', 'poeira', 'altura'], exames: ['clinico', 'audiometria', 'acuidade', 'ecg', 'eeg', 'glicemia'], periodicidade: 12 },
      { id: 'f4', empresaId: 'e3', nome: 'Auxiliar de padaria', setor: 'Padaria', riscos: ['calor', 'alimentos'], exames: ['clinico', 'hemograma', 'parasitologico'], periodicidade: 12 },
      { id: 'f5', empresaId: 'e3', nome: 'Operador(a) de caixa', setor: 'Frente de loja', riscos: ['ergonomico'], exames: ['clinico'], periodicidade: 24 },
      { id: 'f6', empresaId: 'e4', nome: 'Motorista de caminhão', setor: 'Frota', riscos: ['motorista', 'ruido'], exames: ['clinico', 'audiometria', 'acuidade', 'glicemia', 'toxicologico'], periodicidade: 12 }
    ];

    function cand(o) {
      return Object.assign({ id: uid(), token: token(), tipoExame: 'admissional', criadoEm: agoraMenos(3), agendadoPara: '', ficha: null, rascunho: null, aso: null, historico: [] }, o);
    }

    var saudeLucas = fichaBase().saude; saudeLucas.labirintite = { sim: true, detalhe: 'Crise em 2023, tomou remédio por 1 mês' };
    var saudeRenata = fichaBase().saude; saudeRenata.ler = { sim: true, detalhe: 'Tendinite no punho direito em 2022' };
    var saudeJose = fichaBase().saude; saudeJose.pressao = { sim: true, detalhe: 'Toma losartana' };

    var candidatos = [
      cand({ nome: 'Ana Beatriz Moreira', cpf: '123.456.789-09', celular: '(17) 99123-4567', empresaId: 'e3', funcaoId: 'f5', etapa: 'enviado', criadoEm: agoraMenos(0, 8), historico: [{ em: agoraMenos(0, 8), txt: 'Cadastrada pela recepção. Link enviado pelo WhatsApp.' }] }),
      cand({ nome: 'Marcos Vinícius Teixeira', tipoExame: 'periodico', cpf: '890.123.456-78', celular: '(17) 99890-1234', empresaId: 'e2', funcaoId: 'f3', etapa: 'enviado', criadoEm: agoraMenos(1, 15), historico: [{ em: agoraMenos(30, 9), txt: 'Aviso automático ao RH: periódico vence em 30 dias.' }, { em: agoraMenos(1, 15), txt: 'Periódico solicitado pelo RH. Link enviado.' }] }),
      cand({ nome: 'Carlos Eduardo Lima', cpf: '234.567.890-12', celular: '(17) 99234-5678', empresaId: 'e2', funcaoId: 'f3', etapa: 'enviado', criadoEm: agoraMenos(2, 10), historico: [{ em: agoraMenos(2, 10), txt: 'Cadastrado pelo RH da empresa. Link enviado.' }, { em: agoraMenos(1, 10), txt: 'Lembrete automático: falta preencher a ficha.' }] }),
      cand({ nome: 'Diego Santos Pereira', cpf: '345.678.901-23', celular: '(17) 99345-6789', empresaId: 'e1', funcaoId: 'f1', etapa: 'preenchendo', criadoEm: agoraMenos(1, 9), rascunho: { passo: 3 }, historico: [{ em: agoraMenos(1, 9), txt: 'Link enviado.' }, { em: agoraMenos(0, 7), txt: 'Abriu a ficha e começou a preencher.' }] }),
      cand({ nome: 'Lucas Henrique Souza', cpf: '456.789.012-34', celular: '(17) 99456-7890', empresaId: 'e1', funcaoId: 'f2', etapa: 'recebida', criadoEm: agoraMenos(3, 9),
        ficha: fichaBase({ saude: saudeLucas, especificas: { choque: { sim: false }, marcapasso: { sim: false }, medo_altura: { sim: false }, tontura_alt: { sim: true, detalhe: 'Uma vez, em andaime' }, remedio_sono: { sim: false }, ruido_14h: { sim: false }, zumbido: { sim: false }, ouvido: { sim: false } } }),
        historico: [{ em: agoraMenos(3, 9), txt: 'Link enviado.' }, { em: agoraMenos(1, 14), txt: 'Ficha enviada pelo candidato.' }] }),
      cand({ nome: 'Renata Alves Costa', cpf: '567.890.123-45', celular: '(17) 99567-8901', empresaId: 'e3', funcaoId: 'f4', etapa: 'agendado', criadoEm: agoraMenos(4, 9), agendadoPara: daquiA(1, 8),
        ficha: fichaBase({ saude: saudeRenata, pessoais: Object.assign(fichaBase().pessoais, { sexo: 'Feminino', estado_civil: 'Solteiro(a)', emergencia_nome: 'Sônia (mãe)' }), trabalhos: [{ empresa: 'Lanchonete Central', funcao: 'Atendente', tempo: '1 ano e meio', exposicoes: ['Calor'], epi: 'sim' }], especificas: { passou_mal_calor: { sim: false }, diarreia: { sim: false }, ferida_mao: { sim: false } } }),
        historico: [{ em: agoraMenos(4, 9), txt: 'Link enviado.' }, { em: agoraMenos(3, 20), txt: 'Ficha enviada pelo candidato.' }, { em: agoraMenos(2, 11), txt: 'Exame agendado. Confirmação enviada.' }] }),
      cand({ nome: 'José Roberto Nunes', cpf: '678.901.234-56', celular: '(17) 99678-9012', empresaId: 'e4', funcaoId: 'f6', etapa: 'atendido', criadoEm: agoraMenos(6, 9), agendadoPara: agoraMenos(0, 8),
        ficha: fichaBase({ saude: saudeJose, habitos: { fuma: 'sim', fuma_detalhe: '10 cigarros por dia há 15 anos', alcool: 'socialmente', atividade: 'nao' }, trabalhos: [{ empresa: 'Logística Sul', funcao: 'Motorista', tempo: '8 anos', exposicoes: ['Ruído', 'Vibração'], epi: 'sim' }], especificas: { cnh_cde: { sim: true }, oculos_dirigir: { sim: false }, cnh_suspensa: { sim: false }, ruido_14h: { sim: false }, zumbido: { sim: true, detalhe: 'Às vezes, no ouvido esquerdo' }, ouvido: { sim: false } } }),
        historico: [{ em: agoraMenos(6, 9), txt: 'Link enviado.' }, { em: agoraMenos(5, 19), txt: 'Ficha enviada pelo candidato.' }, { em: agoraMenos(4, 10), txt: 'Exame agendado. Confirmação enviada.' }, { em: agoraMenos(0, 9), txt: 'Atendido pela Dra. Camila Rocha.' }] }),
      cand({ nome: 'Patrícia Gomes Ribeiro', cpf: '789.012.345-67', celular: '(17) 99789-0123', empresaId: 'e1', funcaoId: 'f1', etapa: 'aso', criadoEm: agoraMenos(9, 9), agendadoPara: agoraMenos(5, 8),
        ficha: fichaBase({ pessoais: Object.assign(fichaBase().pessoais, { sexo: 'Feminino' }), especificas: { ruido_14h: { sim: false }, zumbido: { sim: false }, ouvido: { sim: false }, alergia_quim: { sim: false }, rinite: { sim: false }, passou_mal_calor: { sim: false } } }),
        aso: { resultado: 'Apto', restricoes: '', medico: 'Dra. Camila Rocha', crm: 'CRM-SP 123456', data: agoraMenos(5, 11), validade: somarMeses(agoraMenos(5, 11), 6), obs: '' },
        historico: [{ em: agoraMenos(9, 9), txt: 'Link enviado.' }, { em: agoraMenos(8, 18), txt: 'Ficha enviada.' }, { em: agoraMenos(7, 10), txt: 'Exame agendado.' }, { em: agoraMenos(5, 9), txt: 'Atendida.' }, { em: agoraMenos(5, 11), txt: 'ASO emitido: Apto. Aviso enviado ao RH.' }] })
    ];

    var automacoes = [
      { id: 'link', nome: 'Link da ficha', quando: 'Candidato cadastrado', para: 'Candidato', ativo: true },
      { id: 'falta', nome: 'Falta terminar a ficha', quando: '24 h sem enviar', para: 'Candidato', ativo: true },
      { id: 'agenda', nome: 'Confirmação de horário', quando: 'Exame agendado', para: 'Candidato', ativo: true },
      { id: 'vespera', nome: 'Lembrete da véspera', quando: '1 dia antes do exame', para: 'Candidato', ativo: true },
      { id: 'aso', nome: 'ASO pronto', quando: 'ASO emitido', para: 'RH da empresa', ativo: true },
      { id: 'periodico', nome: 'Periódico vencendo', quando: '30 dias antes do vencimento', para: 'RH da empresa', ativo: false }
    ];

    var mensagens = [
      { em: agoraMenos(5, 11), automacao: 'aso', para: 'Fernanda (RH) · Metalúrgica Vale Norte', texto: 'Olá, Fernanda. O ASO admissional de Patrícia Gomes Ribeiro (Soldador) está pronto: APTO. O PDF segue anexo. Clínica Vida Ocupacional.' },
      { em: agoraMenos(2, 11), automacao: 'agenda', para: 'Renata Alves Costa', texto: 'Oi, Renata! Seu exame admissional está marcado. Leve RG e carteira de trabalho. Para o exame de sangue, venha em jejum de 8 horas.' },
      { em: agoraMenos(1, 10), automacao: 'falta', para: 'Carlos Eduardo Lima', texto: 'Oi, Carlos! Sua ficha admissional ainda não foi enviada. Ela fica salva e você continua de onde parou pelo mesmo link.' },
      { em: agoraMenos(0, 8), automacao: 'link', para: 'Ana Beatriz Moreira', texto: 'Oi, Ana! Aqui é da Clínica Vida Ocupacional. Antes do seu exame admissional, preencha a ficha neste link (leva uns 10 minutos).' }
    ];

    return { versao: 2, clinica: 'Clínica Vida Ocupacional', pcmso: { coordenador: 'Dr. Ricardo Alves', crm: 'CRM-SP 654321', aprovadoEm: agoraMenos(60, 10) }, empresas: empresas, funcoes: funcoes, candidatos: candidatos, automacoes: automacoes, mensagens: mensagens };
  }

  /* ---------- armazenamento ---------- */
  var memoria = null;
  function carregar() {
    if (memoria) return memoria;
    try { var t = localStorage.getItem(CHAVE); if (t) memoria = JSON.parse(t); } catch (e) { memoria = null; }
    if (!memoria || memoria.versao !== 2) { memoria = seed(); salvar(); }
    return memoria;
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(memoria)); } catch (e) { /* segue só em memória */ } }
  function recarregar() { memoria = null; return carregar(); }
  function restaurar() { memoria = seed(); salvar(); return memoria; }

  function empresa(id) { var d = carregar(); for (var i = 0; i < d.empresas.length; i++) if (d.empresas[i].id === id) return d.empresas[i]; return null; }
  function funcao(id) { var d = carregar(); for (var i = 0; i < d.funcoes.length; i++) if (d.funcoes[i].id === id) return d.funcoes[i]; return null; }

  function enfileirar(automacaoId, para, texto) {
    var d = carregar();
    var a = d.automacoes.filter(function (x) { return x.id === automacaoId; })[0];
    if (a && !a.ativo) return false;
    d.mensagens.unshift({ em: new Date().toISOString(), automacao: automacaoId, para: para, texto: texto });
    salvar();
    return true;
  }

  function primeiroNome(n) { return String(n || '').split(' ')[0]; }

  window.Nexus = {
    ETAPAS: ETAPAS, RISCOS: RISCOS, RISCO_GRUPO: RISCO_GRUPO, EXAMES: EXAMES, CATALOGO: CATALOGO, TIPOS_EXAME: TIPOS_EXAME, nomeTipo: nomeTipo, preparos: preparos, somarMeses: somarMeses, SAUDE: SAUDE, ESPECIFICAS: ESPECIFICAS, EXPOSICOES: EXPOSICOES, FAMILIA: FAMILIA,
    carregar: carregar, recarregar: recarregar, salvar: salvar, restaurar: restaurar, empresa: empresa, funcao: funcao,
    alertas: alertas, nomeSaude: nomeSaude, nomeEspecifica: nomeEspecifica, enfileirar: enfileirar,
    token: token, uid: uid, primeiroNome: primeiroNome
  };
})();
