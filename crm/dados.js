/* Nexus Safe · modelo do CRM
   Tudo fica no localStorage do navegador. Dados fictícios. */
(function () {
  'use strict';

  var CHAVE = 'nexus-safe-demo-v6';

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
  var CATALOGO = window.NexusRegras.CATALOGO;
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
  /* S-2220 (eSocial): até o dia 15 do mês seguinte ao ASO. */
  function prazoS2220(isoAso) { var d = new Date(isoAso); return new Date(d.getFullYear(), d.getMonth() + 1, 15, 23, 59).toISOString(); }
  /* NR-7: o demissional pode ser dispensado se o último exame foi há menos de 135 dias (grau de risco 1 e 2) ou 90 dias (grau 3 e 4). */
  function limiteDispensa(grau) { return grau <= 2 ? 135 : 90; }
  function daquiA(dias, horas) { var d = new Date(); d.setDate(d.getDate() + dias); d.setHours(horas || 8, 0, 0, 0); return d.toISOString(); }
  function token() { var c = 'abcdefghijkmnpqrstuvwxyz23456789', s = ''; for (var i = 0; i < 24; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
  function uid() { return Math.random().toString(36).slice(2, 10); }

  function fichaBase(over) {
    var f = {
      pessoais: { nome_social: '', nascimento: '1994-05-12', sexo: 'Masculino', estado_civil: 'Casado(a)', escolaridade: 'Ensino médio completo', endereco: 'Rua das Acácias, 120, Jardim Bela Vista', emergencia_nome: 'Maria Souza', emergencia_parentesco: 'Cônjuge', emergencia_tel: '(17) 99100-2233', pcd: { sim: false, detalhe: '' } },
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
      { id: 'e1', nome: 'Metalúrgica Vale Norte (fictícia)', cnpj: '12.345.678/0001-90', contato: 'Fernanda (RH)', tel: '(17) 99200-1111', grauRisco: 3 },
      { id: 'e2', nome: 'Construtora Horizonte Azul (fictícia)', cnpj: '23.456.789/0001-01', contato: 'Paulo (DP)', tel: '(17) 99200-2222', grauRisco: 4 },
      { id: 'e3', nome: 'Mercado Bom Dia (fictício)', cnpj: '34.567.890/0001-12', contato: 'Juliana (RH)', tel: '(17) 99200-3333', grauRisco: 2 },
      { id: 'e4', nome: 'Transportes Rota Certa (fictícia)', cnpj: '45.678.901/0001-23', contato: 'Marcos (frota)', tel: '(17) 99200-4444', grauRisco: 3 }
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
      var c = Object.assign({ id: uid(), token: token(), tipoExame: 'admissional', criadoEm: agoraMenos(3), agendadoPara: '', ficha: null, rascunho: null, aso: null, historico: [] }, o);
      if (!c.expiraEm) c.expiraEm = new Date(new Date(c.criadoEm).getTime() + 7 * 864e5).toISOString();
      if (!c.etapaDesde) c.etapaDesde = (c.historico.length ? c.historico[c.historico.length - 1].em : c.criadoEm);
      return c;
    }

    var saudeLucas = fichaBase().saude; saudeLucas.labirintite = { sim: true, detalhe: 'Crise em 2023, tomou remédio por 1 mês' };
    var saudeRenata = fichaBase().saude; saudeRenata.ler = { sim: true, detalhe: 'Tendinite no punho direito em 2022' };
    var saudeJose = fichaBase().saude; saudeJose.pressao = { sim: true, detalhe: 'Toma losartana' };

    var candidatos = [
      cand({ nome: 'Valter Gomes Silva', tipoExame: 'demissional', cpf: '901.234.567-89', celular: '(17) 99901-2345', empresaId: 'e3', funcaoId: 'f5', etapa: 'enviado', criadoEm: agoraMenos(0, 9), historico: [{ em: agoraMenos(0, 9), txt: 'Demissional pedido pelo RH. Link enviado.' }] }),
      cand({ nome: 'Márcia Duarte Lopes', tipoExame: 'retorno_trabalho', afastadoDesde: agoraMenos(45), cpf: '135.792.468-01', celular: '(17) 99135-7924', empresaId: 'e1', funcaoId: 'f1', etapa: 'enviado', criadoEm: agoraMenos(0, 10), historico: [{ em: agoraMenos(0, 10), txt: 'Retorno ao trabalho pedido pelo RH (afastamento por cirurgia). Link enviado.' }] }),
      cand({ admissaoEm: daquiA(6), nome: 'Ana Beatriz Moreira', cpf: '123.456.789-09', celular: '(17) 99123-4567', empresaId: 'e3', funcaoId: 'f5', etapa: 'enviado', criadoEm: agoraMenos(0, 8), historico: [{ em: agoraMenos(0, 8), txt: 'Cadastrada pela recepção. Link enviado pelo WhatsApp.' }] }),
      cand({ nome: 'Marcos Vinícius Teixeira', tipoExame: 'periodico', cpf: '890.123.456-78', celular: '(17) 99890-1234', empresaId: 'e2', funcaoId: 'f3', etapa: 'enviado', criadoEm: agoraMenos(1, 15), historico: [{ em: agoraMenos(30, 9), txt: 'Aviso automático ao RH: periódico vence em 30 dias.' }, { em: agoraMenos(1, 15), txt: 'Periódico solicitado pelo RH. Link enviado.' }] }),
      cand({ admissaoEm: agoraMenos(1), nome: 'Carlos Eduardo Lima', cpf: '234.567.890-12', celular: '(17) 99234-5678', empresaId: 'e2', funcaoId: 'f3', etapa: 'enviado', criadoEm: agoraMenos(2, 10), historico: [{ em: agoraMenos(2, 10), txt: 'Cadastrado pelo RH da empresa. Link enviado.' }, { em: agoraMenos(1, 10), txt: 'Lembrete automático: falta preencher a ficha.' }] }),
      cand({ etapaDesde: agoraMenos(4, 9), admissaoEm: daquiA(4), nome: 'Diego Santos Pereira', cpf: '345.678.901-23', celular: '(17) 99345-6789', empresaId: 'e1', funcaoId: 'f1', etapa: 'preenchendo', criadoEm: agoraMenos(1, 9), rascunho: { passo: 3 }, historico: [{ em: agoraMenos(1, 9), txt: 'Link enviado.' }, { em: agoraMenos(0, 7), txt: 'Abriu a ficha e começou a preencher.' }] }),
      cand({ admissaoEm: daquiA(2), nome: 'Lucas Henrique Souza', cpf: '456.789.012-34', celular: '(17) 99456-7890', empresaId: 'e1', funcaoId: 'f2', etapa: 'recebida', criadoEm: agoraMenos(3, 9),
        ficha: fichaBase({ saude: saudeLucas, especificas: { choque: { sim: false }, marcapasso: { sim: false }, medo_altura: { sim: false }, tontura_alt: { sim: true, detalhe: 'Uma vez, em andaime' }, remedio_sono: { sim: false }, ruido_14h: { sim: false }, zumbido: { sim: false }, ouvido: { sim: false } } }),
        historico: [{ em: agoraMenos(3, 9), txt: 'Link enviado.' }, { em: agoraMenos(1, 14), txt: 'Ficha enviada pelo candidato.' }] }),
      cand({ admissaoEm: daquiA(3), nome: 'Renata Alves Costa', cpf: '567.890.123-45', celular: '(17) 99567-8901', empresaId: 'e3', funcaoId: 'f4', etapa: 'agendado', criadoEm: agoraMenos(4, 9), agendadoPara: daquiA(1, 8),
        ficha: fichaBase({ saude: saudeRenata, pessoais: Object.assign(fichaBase().pessoais, { sexo: 'Feminino', estado_civil: 'Solteiro(a)', emergencia_nome: 'Sônia Costa', emergencia_parentesco: 'Mãe' }), trabalhos: [{ empresa: 'Lanchonete Central', funcao: 'Atendente', tempo: '1 ano e meio', exposicoes: ['Calor'], epi: 'sim' }], especificas: { passou_mal_calor: { sim: false }, diarreia: { sim: false }, ferida_mao: { sim: false } } }),
        historico: [{ em: agoraMenos(4, 9), txt: 'Link enviado.' }, { em: agoraMenos(3, 20), txt: 'Ficha enviada pelo candidato.' }, { em: agoraMenos(2, 11), txt: 'Exame agendado. Confirmação enviada.' }] }),
      cand({ admissaoEm: daquiA(1), nome: 'José Roberto Nunes', cpf: '678.901.234-56', celular: '(17) 99678-9012', empresaId: 'e4', funcaoId: 'f6', etapa: 'atendido', criadoEm: agoraMenos(6, 9), agendadoPara: agoraMenos(0, 8),
        ficha: fichaBase({ saude: saudeJose, habitos: { fuma: 'sim', fuma_detalhe: '10 cigarros por dia há 15 anos', alcool: 'socialmente', atividade: 'nao' }, trabalhos: [{ empresa: 'Logística Sul', funcao: 'Motorista', tempo: '8 anos', exposicoes: ['Ruído', 'Vibração'], epi: 'sim' }], especificas: { cnh_cde: { sim: true }, oculos_dirigir: { sim: false }, cnh_suspensa: { sim: false }, ruido_14h: { sim: false }, zumbido: { sim: true, detalhe: 'Às vezes, no ouvido esquerdo' }, ouvido: { sim: false } } }),
        historico: [{ em: agoraMenos(6, 9), txt: 'Link enviado.' }, { em: agoraMenos(5, 19), txt: 'Ficha enviada pelo candidato.' }, { em: agoraMenos(4, 10), txt: 'Exame agendado. Confirmação enviada.' }, { em: agoraMenos(0, 9), txt: 'Atendido pela Dra. Camila Rocha.' }] }),
      cand({ nome: 'Patrícia Gomes Ribeiro', cpf: '789.012.345-67', celular: '(17) 99789-0123', empresaId: 'e1', funcaoId: 'f1', etapa: 'aso', criadoEm: agoraMenos(9, 9), agendadoPara: agoraMenos(5, 8),
        ficha: fichaBase({ pessoais: Object.assign(fichaBase().pessoais, { sexo: 'Feminino' }), especificas: { ruido_14h: { sim: false }, zumbido: { sim: false }, ouvido: { sim: false }, alergia_quim: { sim: false }, rinite: { sim: false }, passou_mal_calor: { sim: false } } }),
        aso: { resultado: 'Apto', restricoes: '', medico: 'Dra. Camila Rocha', crm: 'CRM-SP 123456', data: agoraMenos(5, 11), validade: somarMeses(agoraMenos(5, 11), 6), obs: '' }, esocial: { status: 'pendente', prazo: prazoS2220(agoraMenos(5, 11)) },
        historico: [{ em: agoraMenos(9, 9), txt: 'Link enviado.' }, { em: agoraMenos(8, 18), txt: 'Ficha enviada.' }, { em: agoraMenos(7, 10), txt: 'Exame agendado.' }, { em: agoraMenos(5, 9), txt: 'Atendida.' }, { em: agoraMenos(5, 11), txt: 'ASO emitido: Apto. Aviso enviado ao RH.' }] })
    ];

    var automacoes = [
      { id: 'link', nome: 'Link da ficha', quando: 'Candidato cadastrado', para: 'Candidato', ativo: true },
      { id: 'falta', nome: 'Falta terminar a ficha', quando: '24 h sem enviar', para: 'Candidato', ativo: true },
      { id: 'agenda', nome: 'Confirmação de horário', quando: 'Exame agendado', para: 'Candidato', ativo: true },
      { id: 'vespera', nome: 'Lembrete da véspera', quando: '1 dia antes do exame', para: 'Candidato', ativo: true },
      { id: 'aso', nome: 'ASO pronto', quando: 'ASO emitido', para: 'RH da empresa', ativo: true },
      { id: 'periodico', nome: 'Periódico vencendo', quando: '30 dias antes do vencimento', para: 'RH da empresa', ativo: true }
    ];

    candidatos.push(
      cand({ nome: 'Sérgio Almeida Prado', tipoExame: 'periodico', cpf: '012.345.678-90', celular: '(17) 99012-3456', empresaId: 'e4', funcaoId: 'f6', etapa: 'aso', criadoEm: agoraMenos(342, 9), agendadoPara: agoraMenos(340, 8),
        aso: { resultado: 'Apto', restricoes: '', medico: 'Dra. Camila Rocha', crm: 'CRM-SP 123456', data: agoraMenos(340, 11), validade: somarMeses(agoraMenos(340, 11), 12), obs: '' }, esocial: { status: 'enviado', prazo: prazoS2220(agoraMenos(340, 11)), enviadoEm: agoraMenos(338, 10) },
        historico: [{ em: agoraMenos(342, 9), txt: 'Periódico convocado.' }, { em: agoraMenos(340, 11), txt: 'ASO emitido: Apto.' }, { em: agoraMenos(338, 10), txt: 'S-2220 enviado ao eSocial.' }] }),
      cand({ nome: 'Valter Gomes Silva', tipoExame: 'periodico', cpf: '901.234.567-89', celular: '(17) 99901-2345', empresaId: 'e3', funcaoId: 'f5', etapa: 'aso', criadoEm: agoraMenos(82, 9), agendadoPara: agoraMenos(80, 8),
        aso: { resultado: 'Apto', restricoes: '', medico: 'Dra. Camila Rocha', crm: 'CRM-SP 123456', data: agoraMenos(80, 11), validade: somarMeses(agoraMenos(80, 11), 24), obs: '' }, esocial: { status: 'enviado', prazo: prazoS2220(agoraMenos(80, 11)), enviadoEm: agoraMenos(79, 10) },
        historico: [{ em: agoraMenos(80, 11), txt: 'ASO emitido: Apto.' }, { em: agoraMenos(79, 10), txt: 'S-2220 enviado ao eSocial.' }] })
    );

    var mensagens = [
      { em: agoraMenos(5, 11), automacao: 'aso', para: 'Fernanda (RH) · Metalúrgica Vale Norte', texto: 'Olá, Fernanda. O ASO admissional de Patrícia Gomes Ribeiro (Soldador) está pronto: APTO. O PDF segue anexo. Clínica Vida Ocupacional.' },
      { em: agoraMenos(2, 11), automacao: 'agenda', para: 'Renata Alves Costa', texto: 'Oi, Renata! Seu exame admissional está marcado. Leve RG e carteira de trabalho. Para o exame de sangue, venha em jejum de 8 horas.' },
      { em: agoraMenos(1, 10), automacao: 'falta', para: 'Carlos Eduardo Lima', texto: 'Oi, Carlos! Sua ficha admissional ainda não foi enviada. Ela fica salva e você continua de onde parou pelo mesmo link.' },
      { em: agoraMenos(0, 8), automacao: 'link', para: 'Ana Beatriz Moreira', texto: 'Oi, Ana! Aqui é da Clínica Vida Ocupacional. Antes do seu exame admissional, preencha a ficha neste link (leva uns 10 minutos).' }
    ];

    return { versao: 6, clinica: 'Clínica Vida Ocupacional', endereco: 'Rua das Palmeiras, 450, Centro (endereço fictício)', horario: 'Segunda a sexta, das 7h às 17h. Exames de sangue até as 10h.', pcmso: { coordenador: 'Dr. Ricardo Alves', crm: 'CRM-SP 654321', aprovadoEm: agoraMenos(60, 10) }, empresas: empresas, funcoes: funcoes, candidatos: candidatos, automacoes: automacoes, mensagens: mensagens };
  }

  /* ---------- armazenamento ---------- */
  var memoria = null;
  /* Modo servidor: a página foi entregue pelo Worker da Cloudflare (crm/modo.js diz isso).
     Os dados vêm da API, já filtrados pelo perfil de quem entrou. Na demonstração (GitHub Pages),
     tudo continua no localStorage. */
  var SERVIDOR = typeof window !== 'undefined' && !!window.NEXUS_SERVIDOR;
  /* a Cloudflare tira o .html do endereço (/crm/ficha.html vira /crm/ficha) */
  var NA_FICHA = SERVIDOR && /\/ficha(\.html)?$/.test(location.pathname);
  var TOKEN_FICHA = NA_FICHA ? new URLSearchParams(location.search).get('t') || '' : '';
  function carregar() {
    if (SERVIDOR) return memoria || { candidatos: [], empresas: [], funcoes: [], automacoes: [], mensagens: [], pcmso: {}, clinica: '' };
    if (memoria) return memoria;
    try { var t = localStorage.getItem(CHAVE); if (t) memoria = JSON.parse(t); } catch (e) { memoria = null; }
    if (!memoria || memoria.versao !== 6) { memoria = seed(); salvar(); }
    return memoria;
  }
  function salvar() {
    if (NA_FICHA) { guardarRascunhoServidor(); return; }
    if (SERVIDOR) return; /* no servidor, quem grava é N.acao */
    try { localStorage.setItem(CHAVE, JSON.stringify(memoria)); } catch (e) { /* segue só em memória */ }
  }

  /* ---------- API ---------- */
  function api(caminho, corpo) {
    return fetch('/api/' + caminho, { method: corpo ? 'POST' : 'GET', credentials: 'same-origin', headers: corpo ? { 'content-type': 'application/json' } : {}, body: corpo ? JSON.stringify(corpo) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 && !NA_FICHA) { try { localStorage.removeItem('nexus-safe-perfil'); } catch (e) { /* nada */ } location.replace('entrar.html'); throw new Error('Sessão expirada.'); }
          if (!r.ok) { var e = new Error(j.erro || 'Erro ' + r.status); e.status = r.status; throw e; }
          return j;
        });
      });
  }
  /* A tela só monta depois que os dados chegam. Na demonstração, monta na hora. */
  function pronto(fn) {
    if (!SERVIDOR) { fn(); return; }
    var pedido = NA_FICHA ? api('ficha/' + encodeURIComponent(TOKEN_FICHA)).catch(function () { return { estado: null }; }) : api('estado');
    pedido.then(function (j) { memoria = j.estado || null; if (j.estado && j.estado.contas && window.Contas) window.Contas.usar(j.estado.contas); fn(); }, function (e) {
      document.body.insertAdjacentHTML('afterbegin', '<p class="aviso-demo" role="alert" style="margin:16px">Não foi possível carregar os dados (' + String(e.message).replace(/[<>&]/g, '') + '). Tente de novo em instantes.</p>');
    });
  }
  var rascunhoTimer = 0;
  function guardarRascunhoServidor() {
    clearTimeout(rascunhoTimer);
    rascunhoTimer = setTimeout(function () {
      var c = memoria && memoria.candidatos[0]; if (!c || !c.rascunho) return;
      api('ficha/' + encodeURIComponent(TOKEN_FICHA) + '/rascunho', { rascunho: c.rascunho }).catch(function () { /* tenta de novo no próximo campo */ });
    }, 700);
  }
  /* Envio da ficha: no servidor, só mostra "enviada" depois que o banco confirmou. */
  function enviarFicha(c) {
    if (!SERVIDOR) { salvar(); return Promise.resolve(); }
    clearTimeout(rascunhoTimer);
    return api('ficha/' + encodeURIComponent(TOKEN_FICHA) + '/enviar', { ficha: c.ficha });
  }

  /* Ações do atendimento (regras.js). Devolve uma promessa nos dois modos. */
  function contexto(d) {
    var p = (window.Contas && window.Contas.lerPerfil()) || {};
    return {
      agora: new Date().toISOString(), clinica: d.clinica, empresa: empresa, funcao: funcao, novoId: uid,
      usuario: { tipo: p.tipo || '', papel: p.papel || '', empresaId: p.empresaId || '', nome: p.nome || '' },
      prepararLink: function (c) { c.token = token(); c.expiraEm = new Date(Date.now() + 7 * 864e5).toISOString(); },
      linkFicha: function (c) { return new URL('ficha.html?t=' + c.token, location.href).href; }
    };
  }
  function acao(nome, alvoId, dados) {
    if (SERVIDOR) return api('acao', { acao: nome, alvo: alvoId || '', dados: dados || {} }).then(function (j) { memoria = j.estado; if (j.estado && j.estado.contas && window.Contas) window.Contas.usar(j.estado.contas); return { novoId: j.novoId || '' }; });
    try {
      var R = window.NexusRegras, d = carregar();
      if (nome === 'automacao') { d.automacoes.forEach(function (a) { if (a.id === dados.id) a.ativo = !!dados.ativo; }); salvar(); return Promise.resolve({}); }
      var alvo = alvoId ? d.candidatos.filter(function (x) { return x.id === alvoId; })[0] : null;
      if (!R.SEM_ALVO[nome] && !alvo) throw R.Erro('Atendimento não encontrado.', 404);
      var ctx = contexto(d), r = R.ACOES[nome](ctx, alvo, dados || {});
      if (r.novo) d.candidatos.unshift(r.novo);
      r.mensagens.forEach(function (m) { if (enfileirar(m.automacao, m.para, m.texto, m.sempre) && m.aoEnviar) m.alvo.historico.push({ em: ctx.agora, txt: m.aoEnviar }); });
      salvar();
      return Promise.resolve({ novoId: r.novo ? r.novo.id : '' });
    } catch (e) { return Promise.reject(e); }
  }
  /* Cadastro de empresa e função (regras.js, CADASTROS). Só no modelo: no servidor ainda não grava. */
  function cadastrar(nome, dados) {
    if (SERVIDOR) return Promise.reject(new Error('O cadastro de empresa e função ainda não existe no servidor.'));
    try {
      var R = window.NexusRegras, d = carregar(), ctx = contexto(d);
      ctx.empresas = d.empresas; ctx.funcoes = d.funcoes; ctx.riscos = Object.keys(RISCOS);
      var r = R.CADASTROS[nome](ctx, dados || {});
      if (r.empresa) d.empresas.push(r.empresa);
      if (r.funcao) d.funcoes.push(r.funcao);
      salvar();
      return Promise.resolve({ id: (r.empresa || r.funcao).id });
    } catch (e) { return Promise.reject(e); }
  }
  function recarregar() { memoria = null; return carregar(); }
  function restaurar() { memoria = seed(); salvar(); return memoria; }

  function empresa(id) { var d = carregar(); for (var i = 0; i < d.empresas.length; i++) if (d.empresas[i].id === id) return d.empresas[i]; return null; }
  function funcao(id) { var d = carregar(); for (var i = 0; i < d.funcoes.length; i++) if (d.funcoes[i].id === id) return d.funcoes[i]; return null; }

  /* forcar: aviso pedido à mão (botão), sai mesmo com a automação desligada */
  function enfileirar(automacaoId, para, texto, forcar) {
    var d = carregar();
    var a = d.automacoes.filter(function (x) { return x.id === automacaoId; })[0];
    if (a && !a.ativo && !forcar) return false;
    d.mensagens.unshift({ em: new Date().toISOString(), automacao: automacaoId, para: para, texto: texto });
    salvar();
    return true;
  }

  function primeiroNome(n) { return String(n || '').split(' ')[0]; }

  /* ---------- ASO (o mesmo para a clínica e para o RH) ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function data(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''; }
  function asoHtml(c) {
    var d = carregar(), f = funcao(c.funcaoId), e = empresa(c.empresaId), N = window.Nexus;
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
      '<p class="aso__ns"><svg class="ns" viewBox="15 15 70 70" aria-hidden="true"><path class="ns__a" d="M22 64V34a12 12 0 0 1 12-12h30"/><path class="ns__b" d="M78 36v30a12 12 0 0 1-12 12H36"/><rect class="ns__c" x="42" y="42" width="16" height="16" rx="4"/></svg>Emitido com Nexus Safe</p></div>';
  }

  /* ---------- ficha preenchida para imprimir (só a equipe médica chama isto) ---------- */
  function fichaImpressaHtml(c) {
    var d = carregar(), f = funcao(c.funcaoId), e = empresa(c.empresaId), fi = c.ficha || {}, p = fi.pessoais || {};
    var sn = function (o) { return o && o.sim ? '<b>Sim</b>' + (o.detalhe ? ': ' + esc(o.detalhe) : '') : 'Não'; };
    var lin = function (r, v) { return '<tr><th>' + esc(r) + '</th><td>' + v + '</td></tr>'; };
    var a = fi.acidentes || {}, hb = fi.habitos || {}, esp = fi.especificas || {}, ass = c.fichaAssinatura || {};
    var chaves = [];
    f.riscos.forEach(function (r) { (ESPECIFICAS[r] || []).forEach(function (q) { if (chaves.indexOf(q[0]) < 0) chaves.push(q[0]); }); });
    var trab = fi.trabalhos && fi.trabalhos.length ? fi.trabalhos.map(function (t) { return esc(t.empresa) + ', ' + esc(t.funcao) + ', ' + esc(t.tempo) + (t.exposicoes && t.exposicoes.length ? '. Exposto a: ' + esc(t.exposicoes.join(', ')) : '') + '. EPI: ' + (t.epi === 'sim' ? 'sim' : t.epi === 'nao' ? 'não' : 'às vezes'); }).join('<br>') : 'Primeiro emprego';
    return '<div class="aso ficha-imp"><div class="aso__cab"><div><h2>Ficha de saúde ocupacional</h2><p>' + esc(d.clinica) + ' · uso exclusivo da equipe médica</p></div><div style="text-align:right"><p>Tipo de exame</p><b>' + esc(nomeTipo(c.tipoExame)) + '</b></div></div>' +
      '<table>' + lin('Trabalhador', esc(c.nome) + '<br>CPF ' + esc(c.cpf)) + lin('Empresa', esc(e.nome) + '<br>CNPJ ' + esc(e.cnpj)) + lin('Função e setor', esc(f.nome) + ' · ' + esc(f.setor)) + '</table>' +
      '<h3>Dados pessoais</h3><table>' + (p.nome_social ? lin('Nome social', esc(p.nome_social)) : '') +
      lin('Nascimento', esc(p.nascimento ? p.nascimento.split('-').reverse().join('/') : '')) + lin('Sexo', esc(p.sexo)) + lin('Estado civil', esc(p.estado_civil)) + lin('Escolaridade', esc(p.escolaridade)) + lin('Endereço', esc(p.endereco)) +
      lin('Emergência', esc(p.emergencia_nome) + (p.emergencia_parentesco ? ' (' + esc(p.emergencia_parentesco.toLowerCase()) + ')' : '') + ' ' + esc(p.emergencia_tel)) + lin('PcD', sn(p.pcd)) + '</table>' +
      '<h3>Trabalhos anteriores e acidentes</h3><table>' + lin('Trabalhos anteriores', trab) + lin('Acidente de trabalho', sn(a.acidente)) + lin('Afastamento INSS', sn(a.inss)) + lin('Doença ocupacional', sn(a.ocupacional)) + '</table>' +
      '<h3>Saúde</h3><table>' + SAUDE.map(function (s) { return lin(s[1], sn((fi.saude || {})[s[0]])); }).join('') +
      lin('Cirurgias', esc(fi.cirurgias || 'Nenhuma')) + lin('Remédios', esc(fi.remedios || 'Nenhum')) + lin('Alergias', esc(fi.alergias || 'Nenhuma')) + lin('Usa óculos ou lente', fi.oculos === 'sim' ? 'Sim' : 'Não') + '</table>' +
      '<h3>Hábitos e família</h3><table>' + lin('Fuma', hb.fuma === 'sim' ? 'Sim' + (hb.fuma_detalhe ? ': ' + esc(hb.fuma_detalhe) : '') : hb.fuma === 'parou' ? 'Parou' : 'Não') + lin('Álcool', esc(hb.alcool)) + lin('Atividade física', hb.atividade === 'sim' ? 'Sim' : 'Não') + lin('Família', esc((fi.familia || []).join(', ') || 'Nada informado')) + '</table>' +
      (chaves.length ? '<h3>Sobre a função</h3><table>' + chaves.map(function (k) { return lin(nomeEspecifica(k), sn(esp[k])); }).join('') + '</table>' : '') +
      '<p style="font-size:12.5px;color:#444">O candidato declarou que as informações são verdadeiras e aceitou o tratamento dos dados de saúde pela clínica, enviando a ficha em ' + (ass.em || fi.enviadoEm ? new Date(ass.em || fi.enviadoEm).toLocaleDateString('pt-BR') : '') + '.</p>' +
      (fi.assinatura ? '<img class="assinatura" src="' + esc(fi.assinatura) + '" alt="Assinatura do candidato" style="max-height:80px">' : '') +
      '<p style="font-size:12px;color:#444;margin-top:10px">Dado de saúde é sensível (LGPD, art. 11). Guarde esta folha só no prontuário e não entregue à empresa.</p>' +
      '<p class="aso__ns">Emitido com Nexus Safe</p></div>';
  }

  /* ---------- guia de encaminhamento (o RH entrega ao funcionário) ---------- */
  function guiaHtml(c) {
    var d = carregar(), f = funcao(c.funcaoId), e = empresa(c.empresaId), N = window.Nexus, prep = preparos(f);
    var link = new URL('ficha.html?t=' + c.token, location.href).href;
    var exame = c.agendadoPara ? (c.agendadoModo === 'chegada' ? new Date(c.agendadoPara).toLocaleDateString('pt-BR') + ', por ordem de chegada (7h às 11h)' : new Date(c.agendadoPara).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })) : 'A clínica confirma o horário pelo WhatsApp depois que a ficha for enviada.';
    return '<div class="aso guia"><div class="aso__cab"><div><h2>Guia de encaminhamento</h2><p>Exame ocupacional · ' + esc(d.clinica) + '</p></div><div style="text-align:right"><p>Tipo de exame</p><b>' + esc(nomeTipo(c.tipoExame)) + '</b></div></div>' +
      '<table><tr><th>Clínica</th><td>' + esc(d.clinica) + '<br>' + esc(d.endereco) + '<br>' + esc(d.horario) + '</td></tr>' +
      '<tr><th>Quando</th><td>' + esc(exame) + '</td></tr>' +
      '<tr><th>Empresa</th><td>' + esc(e.nome) + '<br>CNPJ ' + esc(e.cnpj) + '</td></tr>' +
      '<tr><th>Funcionário</th><td>' + esc(c.nome) + '<br>CPF ' + esc(c.cpf) + '</td></tr>' +
      '<tr><th>Função e setor</th><td>' + esc(f.nome) + ' · ' + esc(f.setor) + '</td></tr>' +
      (c.admissaoEm ? '<tr><th>Admissão prevista</th><td>' + new Date(c.admissaoEm).toLocaleDateString('pt-BR') + '</td></tr>' : '') +
      '<tr><th>Riscos ocupacionais (PGR)</th><td>' + f.riscos.map(function (r) { return esc(RISCO_GRUPO[r]) + ': ' + esc(RISCOS[r]); }).join('<br>') + '</td></tr>' +
      '<tr><th>Exames do protocolo (PCMSO)</th><td>' + f.exames.map(function (x) { return esc(CATALOGO[x].codigo) + ' · ' + esc(EXAMES[x]); }).join('<br>') + '</td></tr>' +
      '<tr><th>Preparo</th><td>' + esc((prep.length ? prep.join('; ') + '; ' : '') + 'levar documento com foto e carteira de trabalho').replace(/^./, function (x) { return x.toUpperCase(); }) + '.</td></tr>' +
      '<tr><th>Antes de ir</th><td>Preencher a ficha no celular (uns 10 minutos):<br><span style="word-break:break-all">' + esc(link) + '</span></td></tr></table>' +
      '<p style="font-size:12.5px;color:#444">O exame é pago pela empresa. As respostas de saúde da ficha vão só para a equipe médica da clínica.</p>' +
      '<div class="aso__assin"><div>' + esc(e.contato) + '<br>Responsável pelo encaminhamento</div><div>' + new Date().toLocaleDateString('pt-BR') + '<br>Data da emissão</div></div>' +
      '<p class="aso__ns">Emitido com Nexus Safe</p></div>';
  }

  function nomeArquivo(c) { return 'S-2220-' + String(c.nome).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.xml'; }
  function baixar(nome, texto) {
    var url = URL.createObjectURL(new Blob([texto], { type: 'application/xml' })), a = document.createElement('a');
    a.href = url; a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  /* ---------- S-2220 (eSocial): XML de exemplo, para conferir antes de transmitir ---------- */
  var TP_EXAME = { admissional: 0, periodico: 1, retorno_trabalho: 2, mudanca_riscos: 3, demissional: 9 };
  function xmlEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]; }); }
  function dia(iso) { return new Date(iso).toISOString().slice(0, 10); }
  function s2220Xml(c) {
    var d = carregar(), f = funcao(c.funcaoId), e = empresa(c.empresaId), a = c.aso;
    var so = function (v) { return String(v || '').replace(/\D/g, ''); };
    var crm = function (t) { var m = String(t || '').match(/CRM-?([A-Z]{2})\s*(\d+)/); return m ? { uf: m[1], nr: m[2] } : { uf: 'SP', nr: so(t) }; };
    var med = crm(a.crm), coord = crm(d.pcmso.crm);
    var dtExm = dia(c.agendadoPara || a.data);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!-- Gerado pelo modelo da Nexus Safe. Exemplo para conferir: validar no leiaute S-1.2 do eSocial antes de transmitir.\n' +
      '     procRealizado usa a Tabela 27 do eSocial; o código de cada exame ainda precisa ser preenchido. -->\n' +
      '<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_02_00">\n' +
      '  <evtMonit Id="ID1' + so(e.cnpj).slice(0, 8).padEnd(14, '0') + dia(a.data).replace(/-/g, '') + '000000' + '00001">\n' +
      '    <ideEvento><indRetif>1</indRetif><tpAmb>2</tpAmb><procEmi>1</procEmi><verProc>NexusSafe-modelo</verProc></ideEvento>\n' +
      '    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>' + so(e.cnpj).slice(0, 8) + '</nrInsc></ideEmpregador>\n' +
      '    <ideVinculo><cpfTrab>' + so(c.cpf) + '</cpfTrab><matricula>A_PREENCHER</matricula></ideVinculo>\n' +
      '    <exMedOcup>\n' +
      '      <tpExameOcup>' + TP_EXAME[c.tipoExame] + '</tpExameOcup>\n' +
      '      <aso>\n' +
      '        <dtAso>' + dia(a.data) + '</dtAso>\n' +
      '        <resAso>' + (a.resultado === 'Inapto' ? 2 : 1) + '</resAso>\n' +
      f.exames.map(function (x) { return '        <exame><dtExm>' + dtExm + '</dtExm><procRealizado>A_PREENCHER</procRealizado><obsProc>' + xmlEsc(CATALOGO[x].codigo + ' ' + EXAMES[x]) + '</obsProc></exame>\n'; }).join('') +
      '        <medico><nmMed>' + xmlEsc(a.medico) + '</nmMed><nrCRM>' + med.nr + '</nrCRM><ufCRM>' + med.uf + '</ufCRM></medico>\n' +
      '      </aso>\n' +
      '      <respMonit><nmResp>' + xmlEsc(d.pcmso.coordenador) + '</nmResp><nrCRM>' + coord.nr + '</nrCRM><ufCRM>' + coord.uf + '</ufCRM></respMonit>\n' +
      '    </exMedOcup>\n' +
      '  </evtMonit>\n' +
      '</eSocial>\n';
  }

  window.Nexus = {
    ETAPAS: ETAPAS, RISCOS: RISCOS, RISCO_GRUPO: RISCO_GRUPO, EXAMES: EXAMES, CATALOGO: CATALOGO, TIPOS_EXAME: TIPOS_EXAME, nomeTipo: nomeTipo, preparos: preparos, somarMeses: somarMeses, SAUDE: SAUDE, ESPECIFICAS: ESPECIFICAS, EXPOSICOES: EXPOSICOES, FAMILIA: FAMILIA,
    carregar: carregar, recarregar: recarregar, salvar: salvar, restaurar: restaurar, empresa: empresa, funcao: funcao,
    alertas: alertas, nomeSaude: nomeSaude, nomeEspecifica: nomeEspecifica, enfileirar: enfileirar,
    token: token, uid: uid, primeiroNome: primeiroNome, SERVIDOR: SERVIDOR, api: api, pronto: pronto, acao: acao, cadastrar: cadastrar, enviarFicha: enviarFicha, asoHtml: asoHtml, guiaHtml: guiaHtml, fichaImpressaHtml: fichaImpressaHtml, s2220Xml: s2220Xml, baixar: baixar, nomeArquivo: nomeArquivo, prazoS2220: prazoS2220, limiteDispensa: limiteDispensa
  };
})();
