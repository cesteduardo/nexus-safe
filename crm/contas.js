/* Nexus Safe · perfis, agências clientes e chamados de TI
   Três perfis no modelo:
   - admin: a equipe da Nexus Safe (quem oferece o serviço). Vê agências, uso e chamados. Nunca vê resposta de saúde.
   - clinica: a agência de SST, cliente da Nexus Safe. Usa o CRM e abre chamados.
   - rh: o RH da empresa, cliente da agência. Vê só os próprios funcionários, etapa e ASO.
   Tudo fictício e salvo só neste navegador.

   Chamados seguem o que funciona em help desk: prioridade na abertura, meta de primeira
   resposta separada da meta de solução, conversa nos dois sentidos, "aguardando a clínica"
   e avaliação no fim. */
(function () {
  'use strict';

  var CHAVE_PERFIL = 'nexus-safe-perfil';
  var CHAVE = 'nexus-safe-contas-v3';

  var PERFIS = {
    admin: { nome: 'Nexus Safe', papel: 'Administração', usuario: 'Equipe Nexus Safe', inicio: 'admin.html' },
    clinica: { nome: 'Clínica Vida Ocupacional', papel: 'Agência cliente', usuario: 'Recepção', inicio: './' },
    rh: { nome: 'RH da empresa', papel: 'Cliente da agência', usuario: 'RH', inicio: 'empresa.html' }
  };

  function lerPerfil() { try { return JSON.parse(localStorage.getItem(CHAVE_PERFIL)) || null; } catch (e) { return null; } }
  function gravarPerfil(p) { try { localStorage.setItem(CHAVE_PERFIL, JSON.stringify(p)); } catch (e) { /* segue sem lembrar */ } }

  /* Contas do modelo. Senha única de demonstração: 123.
     Na versão real: senha com hash no servidor, sessão com cookie seguro e permissão checada em cada pedido. */
  var SENHA_DEMO = '123';
  var USUARIOS = {
    'admin': { tipo: 'admin', nome: 'Equipe Nexus Safe' },
    'clinica': { tipo: 'clinica', papel: 'recepcao', nome: 'Recepção' },
    'medico': { tipo: 'clinica', papel: 'medico', nome: 'Dra. Camila Rocha' },
    'rh.metalurgica': { tipo: 'rh', empresaId: 'e1', nome: 'Fernanda (RH)' },
    'rh.construtora': { tipo: 'rh', empresaId: 'e2', nome: 'Paulo (DP)' },
    'rh.mercado': { tipo: 'rh', empresaId: 'e3', nome: 'Juliana (RH)' },
    'rh.transportes': { tipo: 'rh', empresaId: 'e4', nome: 'Marcos (frota)' }
  };
  function entrar(usuario, senha) {
    var u = USUARIOS[String(usuario || '').trim().toLowerCase()];
    if (!u || senha !== SENHA_DEMO) return null;
    var p = { tipo: u.tipo, papel: u.papel || '', empresaId: u.empresaId || '', usuario: String(usuario).trim().toLowerCase(), nome: u.nome, desde: new Date().toISOString() };
    gravarPerfil(p); return p;
  }
  function sair() { try { localStorage.removeItem(CHAVE_PERFIL); } catch (e) { /* nada a apagar */ } }
  function destino(p) { return p.tipo === 'admin' ? 'admin.html' : p.tipo === 'rh' ? 'empresa.html' : './'; }
  /* Página protegida: sem login do perfil certo, volta para a tela de entrada. */
  function exigir(tipo) {
    var p = lerPerfil();
    if (p && p.usuario && p.tipo === tipo) return p;
    location.replace('entrar.html'); return null;
  }

  var MIN = 6e4, HORA = 36e5;
  function ha(min) { return new Date(Date.now() - min * MIN).toISOString(); }
  function diasAtras(d) { return ha(d * 1440); }

  var SERVICOS = { suporte: 'Suporte de TI', automacoes: 'Automações de WhatsApp', plataforma: 'Plataforma Nexus Safe' };
  var CATEGORIAS = ['Impressora', 'Rede e Wi-Fi', 'Computador', 'Sistema da clínica', 'Backup', 'WhatsApp', 'Outro'];
  var SITUACOES = { aberto: 'Aberto', atendimento: 'Em atendimento', aguardando: 'Aguardando a clínica', resolvido: 'Resolvido' };
  var CANAIS = ['Portal', 'WhatsApp', 'Telefone'];
  var EQUIPE = ['Bruno (suporte)', 'Lívia (suporte)'];
  var NIVEL2 = 'Rafael (nível 2)';

  /* Metas de atendimento sugeridas para o plano mensal. Valores de exemplo: o dono ajusta. */
  var PRIORIDADES = {
    urgente: { nome: 'Urgente', pergunta: 'Sim, parou o atendimento', resposta: 30, solucao: 4 * 60 },
    normal: { nome: 'Normal', pergunta: 'Atrapalha, mas dá para trabalhar', resposta: 4 * 60, solucao: 24 * 60 },
    baixa: { nome: 'Baixa', pergunta: 'Pode esperar', resposta: 24 * 60, solucao: 72 * 60 }
  };

  function msg(min, lado, autor, txt) { return { em: ha(min), lado: lado, autor: autor, txt: txt }; }

  function seed() {
    return {
      versao: 3,
      agencias: [
        /* a única com CRM de verdade no modelo: os números saem do quadro */
        { id: 'a1', nome: 'Clínica Vida Ocupacional', cidade: 'São José do Rio Preto, SP', contato: 'Dra. Camila Rocha', tel: '(17) 99300-1010', desde: diasAtras(40), situacao: 'ativa', servicos: ['suporte', 'automacoes', 'plataforma'], usuarios: 4, aoVivo: true },
        { id: 'a2', nome: 'Ocupa Saúde Mirassol', cidade: 'Mirassol, SP', contato: 'Rogério Lima', tel: '(17) 99300-2020', desde: diasAtras(18), situacao: 'implantacao', servicos: ['suporte', 'plataforma'], usuarios: 2, uso: { fichas: 6, asos: 2, mensagens: 14 } },
        { id: 'a3', nome: 'SST Norte Paulista', cidade: 'Catanduva, SP', contato: 'Aline Prado', tel: '(17) 99300-3030', desde: diasAtras(7), situacao: 'teste', servicos: ['suporte'], usuarios: 1, uso: { fichas: 0, asos: 0, mensagens: 0 } }
      ],
      chamados: [
        { id: 'k1', agenciaId: 'a1', assunto: 'Impressora de etiquetas não puxa o papel', descricao: 'A Zebra da recepção liga, mas a etiqueta sai em branco e o papel trava. Já trocamos o rolo.', categoria: 'Impressora', prioridade: 'urgente', canal: 'Portal', situacao: 'aberto', abertoEm: ha(18), por: 'Recepção', responsavel: '', primeiraRespostaEm: '', resolvidoEm: '', mensagens: [], avaliacao: null },
        { id: 'k2', agenciaId: 'a2', assunto: 'Configurar o modelo de ASO no sistema da clínica', descricao: 'Queremos o ASO com o logo da clínica e o campo de riscos por grupo.', categoria: 'Sistema da clínica', prioridade: 'normal', canal: 'WhatsApp', situacao: 'aguardando', pausadoEm: ha(3 * 60), pausaMin: 0, abertoEm: ha(26 * 60), por: 'Rogério Lima', responsavel: 'Lívia (suporte)', primeiraRespostaEm: ha(25 * 60), resolvidoEm: '', avaliacao: null,
          mensagens: [msg(25 * 60, 'nexus', 'Lívia (suporte)', 'Recebi. Vou montar o modelo e mando para aprovação.'), msg(3 * 60, 'nexus', 'Lívia (suporte)', 'Modelo montado. Falta o médico coordenador aprovar o texto do rodapé. Pode me mandar o CRM dele?')] },
        { id: 'k3', agenciaId: 'a1', assunto: 'Backup da noite de terça falhou', descricao: 'Alerta automático do monitoramento: a cópia noturna não terminou.', categoria: 'Backup', prioridade: 'urgente', canal: 'Portal', situacao: 'resolvido', abertoEm: diasAtras(6), por: 'Nexus Safe (alerta automático)', responsavel: 'Bruno (suporte)', primeiraRespostaEm: ha(6 * 1440 - 12), resolvidoEm: ha(6 * 1440 - 170), avaliacao: { boa: true, em: ha(5 * 1440) },
          mensagens: [msg(6 * 1440 - 12, 'nexus', 'Bruno (suporte)', 'Vi o alerta. Estou entrando remoto agora.'), msg(6 * 1440 - 170, 'nexus', 'Bruno (suporte)', 'Disco externo estava cheio. Ajustei a rotação para guardar 30 dias e refiz o backup. Testei a restauração de um arquivo.')] },
        { id: 'k4', agenciaId: 'a3', assunto: 'Wi-Fi da recepção cai à tarde', descricao: 'Por volta das 15h a internet some por uns minutos, todo dia.', categoria: 'Rede e Wi-Fi', prioridade: 'normal', canal: 'Telefone', situacao: 'atendimento', abertoEm: ha(7 * 60), por: 'Aline Prado', responsavel: 'Rafael (nível 2)', nivel: 2, escalonadoEm: ha(2 * 60), primeiraRespostaEm: ha(6 * 60), resolvidoEm: '', avaliacao: null,
          mensagens: [msg(6 * 60, 'nexus', 'Bruno (suporte)', 'Pode ser o roteador esquentando ou interferência. Vou olhar o registro dele hoje à tarde, no horário da queda.'), msg(2 * 60, 'nexus', 'Bruno (suporte)', 'Passei para o nível 2: o roteador reinicia sozinho e o registro mostra falha de hardware. Precisa de visita e talvez troca.')] }
      ]
    };
  }

  var memoria = null;
  var SERVIDOR = typeof window !== 'undefined' && !!window.NEXUS_SERVIDOR;
  function usar(d) { memoria = d; }
  function carregar() {
    if (memoria) return memoria;
    if (SERVIDOR || typeof window === 'undefined') return { versao: 3, agencias: [], chamados: [] };
    try { var t = localStorage.getItem(CHAVE); if (t) memoria = JSON.parse(t); } catch (e) { memoria = null; }
    if (!memoria || memoria.versao !== 3) { memoria = seed(); salvar(); }
    return memoria;
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(memoria)); } catch (e) { /* segue só em memória */ } }
  function restaurar() { memoria = seed(); salvar(); return memoria; }
  function recarregar() { memoria = null; return carregar(); }

  function agencia(id) { var d = carregar(); for (var i = 0; i < d.agencias.length; i++) if (d.agencias[i].id === id) return d.agencias[i]; return null; }
  function chamado(id) { var d = carregar(); for (var i = 0; i < d.chamados.length; i++) if (d.chamados[i].id === id) return d.chamados[i]; return null; }

  /* Uso do mês: a agência ao vivo conta o que está no quadro; as outras têm números fixos. */
  function uso(a) {
    if (!a.aoVivo || typeof window === 'undefined' || !window.Nexus) return a.uso || { fichas: 0, asos: 0, mensagens: 0 };
    var d = window.Nexus.carregar(), ini = new Date(); ini.setDate(1); ini.setHours(0, 0, 0, 0);
    var noMes = function (iso) { return iso && new Date(iso) >= ini; };
    return {
      fichas: d.candidatos.filter(function (c) { return c.ficha && noMes(c.ficha.enviadoEm); }).length,
      asos: d.candidatos.filter(function (c) { return c.aso && noMes(c.aso.data); }).length,
      mensagens: d.mensagens.filter(function (m) { return noMes(m.em); }).length
    };
  }

  /* ---------- prazos ---------- */
  function duracao(min) {
    min = Math.max(0, Math.round(min));
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    if (h < 48) return h + ' h' + (m ? ' ' + m + ' min' : '');
    return Math.round(h / 24) + ' dias';
  }
  /* Situação do prazo: o que vale agora é a resposta (se ninguém respondeu) ou a solução. */
  /* Minutos em que o chamado esperou a clínica: não contam no prazo de solução. */
  function pausa(k) { return (k.pausaMin || 0) + (k.situacao === 'aguardando' && k.pausadoEm ? (Date.now() - new Date(k.pausadoEm)) / MIN : 0); }
  function prazo(k) {
    var p = PRIORIDADES[k.prioridade] || PRIORIDADES.normal, ab = new Date(k.abertoEm).getTime() + pausa(k) * MIN, agora = Date.now();
    if (k.situacao === 'aguardando') {
      var resta = (ab + p.solucao * MIN - agora) / MIN;
      return { tipo: 'pausa', fora: resta < 0, texto: resta >= 0 ? 'Prazo pausado, restam ' + duracao(resta) : 'Prazo pausado, já estava atrasado' };
    }
    if (k.situacao === 'resolvido') {
      var levou = (new Date(k.resolvidoEm).getTime() - ab) / MIN;
      return { tipo: 'feito', fora: levou > p.solucao, texto: 'Resolvido em ' + duracao(levou) + (levou > p.solucao ? ', fora do prazo' : ', no prazo') };
    }
    if (!k.primeiraRespostaEm) {
      var r = ab + p.resposta * MIN - agora;
      return r >= 0 ? { tipo: 'resposta', fora: false, perto: r < p.resposta * MIN * 0.25, texto: 'Responder em ' + duracao(r / MIN) } : { tipo: 'resposta', fora: true, texto: 'Resposta atrasada ' + duracao(-r / MIN) };
    }
    var s = ab + p.solucao * MIN - agora;
    return s >= 0 ? { tipo: 'solucao', fora: false, perto: s < p.solucao * MIN * 0.25, texto: 'Resolver em ' + duracao(s / MIN) } : { tipo: 'solucao', fora: true, texto: 'Fora do prazo há ' + duracao(-s / MIN) };
  }

  /* ---------- ações ---------- */
  function abrirChamado(dados) {
    var d = carregar();
    var k = { id: 'k' + Date.now().toString(36), agenciaId: dados.agenciaId, assunto: dados.assunto, descricao: dados.descricao || '', categoria: dados.categoria, prioridade: dados.prioridade || 'normal', canal: dados.canal || 'Portal', situacao: 'aberto', abertoEm: new Date().toISOString(), por: dados.por, responsavel: '', primeiraRespostaEm: '', resolvidoEm: '', mensagens: [], avaliacao: null };
    d.chamados.unshift(k); salvar(); return k;
  }
  /* lado: 'nexus' (suporte) ou 'clinica'. acao: 'responder' | 'pedir' (aguardando a clínica) | 'resolver' | 'reabrir' */
  function registrar(id, lado, autor, txt, acao) {
    var k = chamado(id); if (!k) return null;
    var agora = new Date().toISOString();
    if (txt) k.mensagens.push({ em: agora, lado: lado, autor: autor, txt: txt });
    var estavaPausado = k.situacao === 'aguardando';
    if (lado === 'nexus') {
      if (!k.primeiraRespostaEm) k.primeiraRespostaEm = agora;
      if (!k.responsavel) k.responsavel = autor;
      k.situacao = acao === 'pedir' ? 'aguardando' : acao === 'resolver' ? 'resolvido' : 'atendimento';
      if (acao === 'resolver') k.resolvidoEm = agora;
    } else {
      if (acao === 'reabrir') { k.situacao = 'atendimento'; k.resolvidoEm = ''; k.avaliacao = null; }
      else if (k.situacao === 'aguardando') k.situacao = 'atendimento';
    }
    if (estavaPausado && k.situacao !== 'aguardando') { k.pausaMin = (k.pausaMin || 0) + (Date.now() - new Date(k.pausadoEm)) / MIN; k.pausadoEm = ''; }
    if (!estavaPausado && k.situacao === 'aguardando') k.pausadoEm = agora;
    salvar(); return k;
  }
  /* Segundo nível: o que o primeiro atendimento não resolve sobe com o motivo escrito. */
  function escalonar(id, autor, motivo) {
    var k = chamado(id); if (!k) return null;
    var agora = new Date().toISOString();
    k.nivel = 2; k.escalonadoEm = agora; k.responsavel = NIVEL2;
    if (!k.primeiraRespostaEm) k.primeiraRespostaEm = agora;
    if (k.situacao === 'aguardando') { k.pausaMin = (k.pausaMin || 0) + (Date.now() - new Date(k.pausadoEm)) / MIN; k.pausadoEm = ''; }
    if (k.situacao !== 'resolvido') k.situacao = 'atendimento';
    k.mensagens.push({ em: agora, lado: 'nexus', autor: autor, txt: 'Passei para o nível 2: ' + motivo });
    salvar(); return k;
  }
  function atribuir(id, nome) { var k = chamado(id); if (!k) return; k.responsavel = nome; salvar(); }
  function avaliar(id, boa) { var k = chamado(id); if (!k) return; k.avaliacao = { boa: boa, em: new Date().toISOString() }; salvar(); }

  /* Números do suporte para o painel da administração. */
  function indicadores(lista) {
    var abertos = lista.filter(function (k) { return k.situacao !== 'resolvido'; });
    var fora = abertos.filter(function (k) { return prazo(k).fora; }).length;
    var resp = lista.filter(function (k) { return k.primeiraRespostaEm; }).map(function (k) { return (new Date(k.primeiraRespostaEm) - new Date(k.abertoEm)) / MIN; });
    var aval = lista.filter(function (k) { return k.avaliacao; });
    return {
      abertos: abertos.length, fora: fora,
      urgentes: abertos.filter(function (k) { return k.prioridade === 'urgente'; }).length,
      respostaMedia: resp.length ? duracao(resp.reduce(function (a, b) { return a + b; }, 0) / resp.length) : 'sem dados',
      boas: aval.filter(function (k) { return k.avaliacao.boa; }).length, avaliados: aval.length,
      escalonados: abertos.filter(function (k) { return k.nivel === 2; }).length
    };
  }

  /* ---------- desenho ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dataHora(iso) { var d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  var COR_SITUACAO = { aberto: 'selo--ambar', atendimento: 'selo--azul', aguardando: 'selo', resolvido: 'selo--verde' };

  /* Cartão de chamado. lado 'nexus' atende; lado 'clinica' acompanha, responde e avalia. */
  function chamadoHtml(k, lado) {
    var a = agencia(k.agenciaId), pz = prazo(k), nexus = lado === 'nexus';
    var corPrazo = pz.tipo === 'feito' ? (pz.fora ? 'selo--ambar' : 'selo--verde') : pz.tipo === 'pausa' ? 'selo' : pz.fora ? 'selo--vermelho' : pz.perto ? 'selo--ambar' : 'selo';
    var h = '<article class="chamado" data-chamado="' + k.id + '"' + (pz.fora && k.situacao !== 'resolvido' ? ' data-fora' : '') + '>' +
      '<div class="msg__cab"><span>' + (nexus ? '<b>' + esc(a ? a.nome : '') + '</b> · ' : '') + esc(k.categoria) + ' · ' + esc(k.canal) + ' · ' + esc(k.por) + '</span><span>' + dataHora(k.abertoEm) + '</span></div>' +
      '<p class="chamado__assunto">' + esc(k.assunto) + '</p>' + (k.descricao ? '<p class="chamado__desc">' + esc(k.descricao) + '</p>' : '') +
      '<div class="chips" style="margin-top:10px"><span class="selo ' + COR_SITUACAO[k.situacao] + '">' + esc(SITUACOES[k.situacao]) + '</span>' +
      (k.prioridade !== 'normal' ? '<span class="selo ' + (k.prioridade === 'urgente' ? 'selo--vermelho' : '') + '">' + esc(PRIORIDADES[k.prioridade].nome) + '</span>' : '') +
      '<span class="selo ' + corPrazo + '">' + esc(pz.texto) + '</span>' +
      (k.nivel === 2 ? '<span class="selo selo--azul">Nível 2</span>' : '') +
      (k.responsavel ? '<span class="selo">Com ' + esc(k.responsavel) + '</span>' : '') +
      (k.avaliacao ? '<span class="selo ' + (k.avaliacao.boa ? 'selo--verde' : 'selo--ambar') + '">' + (k.avaliacao.boa ? 'Avaliado: resolveu' : 'Avaliado: não resolveu') + '</span>' : '') + '</div>';

    if (k.mensagens.length) h += '<ol class="conversa">' + k.mensagens.map(function (m) { return '<li class="conversa__msg conversa__msg--' + m.lado + '"><div><b>' + esc(m.autor) + '</b><time>' + dataHora(m.em) + '</time></div><p>' + esc(m.txt) + '</p></li>'; }).join('') + '</ol>';

    if (nexus && k.situacao !== 'resolvido') {
      h += '<div class="chamado__acoes"><textarea class="entrada" data-resposta rows="2" placeholder="Responder à clínica" aria-label="Resposta para a clínica"></textarea>' +
        '<div class="chamado__botoes"><select class="entrada" data-responsavel aria-label="Responsável">' + EQUIPE.concat(k.nivel === 2 ? [NIVEL2] : []).map(function (n) { return '<option' + (n === k.responsavel ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
        (k.nivel === 2 ? '' : '<button class="botao botao--claro botao--pequeno" type="button" data-acao="escalonar">Escalonar</button>') +
        '<button class="botao botao--claro botao--pequeno" type="button" data-acao="responder">Responder</button>' +
        '<button class="botao botao--claro botao--pequeno" type="button" data-acao="pedir">Pedir informação</button>' +
        '<button class="botao botao--pequeno" type="button" data-acao="resolver">Resolver</button></div></div>';
    }
    if (!nexus && k.situacao !== 'resolvido') {
      h += '<div class="chamado__acoes"><textarea class="entrada" data-resposta rows="2" placeholder="' + (k.situacao === 'aguardando' ? 'O suporte está esperando sua resposta' : 'Acrescentar uma informação') + '" aria-label="Mensagem para o suporte"></textarea>' +
        '<div class="chamado__botoes"><button class="botao botao--claro botao--pequeno" type="button" data-acao="enviar">Enviar</button></div></div>';
    }
    if (!nexus && k.situacao === 'resolvido' && !k.avaliacao) {
      h += '<div class="chamado__avaliar"><span>O problema foi resolvido?</span><button class="botao botao--pequeno" type="button" data-avaliar="sim">Sim, resolveu</button><button class="botao botao--claro botao--pequeno" type="button" data-avaliar="nao">Não, reabrir</button></div>';
    }
    return h + '</article>';
  }

  (typeof window !== 'undefined' ? window : globalThis).Contas = {
    PERFIS: PERFIS, SERVICOS: SERVICOS, CATEGORIAS: CATEGORIAS, SITUACOES: SITUACOES, PRIORIDADES: PRIORIDADES, CANAIS: CANAIS, EQUIPE: EQUIPE,
    lerPerfil: lerPerfil, gravarPerfil: gravarPerfil, USUARIOS: USUARIOS, entrar: entrar, sair: sair, exigir: exigir, destino: destino,
    carregar: carregar, salvar: salvar, restaurar: restaurar, recarregar: recarregar, agencia: agencia, chamado: chamado, uso: uso,
    abrirChamado: abrirChamado, registrar: registrar, escalonar: escalonar, atribuir: atribuir, NIVEL2: NIVEL2, avaliar: avaliar, prazo: prazo, duracao: duracao, indicadores: indicadores,
    chamadoHtml: chamadoHtml, esc: esc, dataHora: dataHora, usar: usar
  };

  /* No servidor, cada mudança de chamado aparece na hora (otimista) e vai para a API;
     quando a resposta chega, a tela redesenha com o que o banco gravou. */
  if (SERVIDOR) {
    var C = window.Contas;
    ['abrirChamado', 'registrar', 'escalonar', 'atribuir', 'avaliar'].forEach(function (nome) {
      var local = C[nome];
      C[nome] = function () {
        var args = Array.prototype.slice.call(arguments), r = local.apply(null, args);
        window.Nexus.acao('chamado.' + nome, '', { args: args }).then(function () { window.dispatchEvent(new Event('nexus:atualizado')); }, function (e) {
          window.dispatchEvent(new CustomEvent('nexus:erro', { detail: e.message })); window.dispatchEvent(new Event('nexus:atualizado'));
        });
        return r;
      };
    });
    C.restaurar = function () { return carregar(); };
  }
})();
