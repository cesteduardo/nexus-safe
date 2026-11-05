/* Nexus Safe · servidor (Cloudflare Worker + D1)
   Entrega o site e a API. Regras do atendimento vêm de crm/regras.js (as mesmas da demonstração).

   Segurança, em resumo (detalhes em SEGURANCA.md):
   - senha com PBKDF2-SHA256 e sal; sessão em cookie HttpOnly + Secure + SameSite=Strict, guardada só como hash;
   - permissão conferida aqui, por perfil: recepção e RH nunca recebem resposta de saúde, RH só a própria empresa,
     administração só contagens;
   - link da ficha: 32 bytes aleatórios, só o hash no banco, expira em 7 dias e trava depois do envio;
   - ficha e rascunho cifrados com AES-GCM (chave FICHA_CHAVE, fora do código);
   - limite de tentativas no login e no link da ficha; origem conferida em toda gravação (CSRF);
   - quem abriu cada ficha fica na tabela auditoria. */
import '../crm/regras.js';
import '../crm/contas.js';

const R = globalThis.NexusRegras;
const Contas = globalThis.Contas;

const SESSAO_HORAS = 12;
const LINK_DIAS = 7;
const COOKIE = '__Host-ns';
const JSON_MAX = 450000;

/* ---------- respostas ---------- */
const CABECALHOS_API = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY'
};
function json(corpo, status = 200, extra = {}) { return new Response(JSON.stringify(corpo), { status, headers: { ...CABECALHOS_API, ...extra } }); }
function erro(msg, status = 400) { return json({ erro: msg }, status); }

/* ---------- cripto ---------- */
const enc = new TextEncoder(), dec = new TextDecoder();
function b64(buf) { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
function deB64(s) { const t = atob(s), b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return b; }
function b64url(buf) { return b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function aleatorio(n = 32) { return crypto.getRandomValues(new Uint8Array(n)); }
async function sha256(txt) { return b64url(await crypto.subtle.digest('SHA-256', enc.encode(txt))); }
function igual(a, b) { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }

export async function hashSenha(senha, iter = 100000, sal = aleatorio(16)) {
  const chave = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iter }, chave, 256);
  return `pbkdf2$${iter}$${b64(sal)}$${b64(bits)}`;
}
async function conferirSenha(senha, guardada) {
  const [tipo, iter, sal, hash] = String(guardada || '').split('$');
  if (tipo !== 'pbkdf2') return false;
  const novo = await hashSenha(senha, Number(iter), deB64(sal));
  return igual(novo.split('$')[3], hash);
}
const SENHA_FALSA = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

let chaveCache = null;
async function chaveFicha(env) {
  if (chaveCache) return chaveCache;
  if (!env.FICHA_CHAVE) throw new Error('FICHA_CHAVE não configurada.');
  const bruta = deB64(env.FICHA_CHAVE);
  if (bruta.length !== 32) throw new Error('FICHA_CHAVE precisa ter 32 bytes em base64.');
  chaveCache = await crypto.subtle.importKey('raw', bruta, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return chaveCache;
}
async function cifrar(env, obj, ad) {
  const iv = aleatorio(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(ad) }, await chaveFicha(env), enc.encode(JSON.stringify(obj)));
  return `v1:${b64(iv)}:${b64(ct)}`;
}
async function decifrar(env, txt, ad) {
  if (!txt) return null;
  const [v, iv, ct] = txt.split(':');
  if (v !== 'v1') throw new Error('Formato de cifra desconhecido.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv), additionalData: enc.encode(ad) }, await chaveFicha(env), deB64(ct));
  return JSON.parse(dec.decode(pt));
}

/* ---------- pedido ---------- */
function ip(req) { return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'local'; }
function lerCookie(req, nome) { const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + nome.replace(/[$]/g, '\\$') + '=([^;]+)')); return m ? m[1] : ''; }
async function lerJson(req) {
  const tipo = req.headers.get('content-type') || '';
  if (!tipo.startsWith('application/json')) throw R.Erro('Envie JSON.', 415);
  const txt = await req.text();
  if (txt.length > JSON_MAX) throw R.Erro('Pedido grande demais.', 413);
  try { return JSON.parse(txt || '{}'); } catch { throw R.Erro('JSON inválido.'); }
}
/* CSRF: toda gravação precisa vir do próprio site. */
function mesmaOrigem(req) {
  const origem = req.headers.get('origin');
  if (origem) return origem === new URL(req.url).origin;
  return req.headers.get('sec-fetch-site') === 'same-origin';
}

/* ---------- limite de tentativas (janela fixa) ---------- */
async function limite(env, chave, max, janelaSeg) {
  const balde = Math.floor(Date.now() / (janelaSeg * 1000));
  const k = `${chave}:${balde}`;
  const r = await env.DB.prepare('INSERT INTO limites (chave, contagem, expira) VALUES (?1, 1, ?2) ON CONFLICT(chave) DO UPDATE SET contagem = contagem + 1 RETURNING contagem')
    .bind(k, (balde + 1) * janelaSeg * 1000).first();
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM limites WHERE expira < ?1').bind(Date.now()).run();
  return r.contagem <= max;
}

/* ---------- sessão ---------- */
async function usuarioDaSessao(env, req) {
  const tk = lerCookie(req, COOKIE);
  if (!tk || tk.length < 40) return null;
  const u = await env.DB.prepare(`SELECT u.id, u.login, u.nome, u.tipo, u.papel, u.crm, u.agencia_id, u.empresa_id, s.expira_em
    FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.id = ?1 AND u.ativo = 1`).bind(await sha256(tk)).first();
  if (!u || u.expira_em < new Date().toISOString()) return null;
  return u;
}
function perfilPublico(u) { return { tipo: u.tipo, papel: u.papel || '', empresaId: u.empresa_id || '', usuario: u.login, nome: u.nome }; }
function cookieSessao(valor, segundos) { return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${segundos}`; }

async function entrar(env, req) {
  const corpo = await lerJson(req);
  const login = R.texto(corpo.usuario, 60).toLowerCase(), senha = String(corpo.senha || '').slice(0, 200);
  if (!login || !senha) return erro('Informe usuário e senha.');
  if (!(await limite(env, 'login-ip:' + ip(req), 30, 900)) || !(await limite(env, 'login-u:' + login, 10, 900))) return erro('Muitas tentativas. Espere 15 minutos.', 429);
  const u = await env.DB.prepare('SELECT * FROM usuarios WHERE login = ?1').bind(login).first();
  const agora = new Date().toISOString();
  if (u && u.bloqueado_ate && u.bloqueado_ate > agora) return erro('Conta bloqueada por tentativas erradas. Espere 15 minutos.', 429);
  const ok = await conferirSenha(senha, u ? u.senha : SENHA_FALSA);
  if (!u || !u.ativo || !ok) {
    if (u) {
      const falhas = u.falhas + 1;
      await env.DB.prepare('UPDATE usuarios SET falhas = ?1, bloqueado_ate = ?2 WHERE id = ?3')
        .bind(falhas >= 5 ? 0 : falhas, falhas >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : u.bloqueado_ate, u.id).run();
      await auditar(env, u.id, 'login-falhou', '', req);
    }
    return erro('Usuário ou senha incorretos.', 401);
  }
  const tk = b64url(aleatorio(32));
  await env.DB.batch([
    env.DB.prepare('UPDATE usuarios SET falhas = 0, bloqueado_ate = NULL WHERE id = ?1').bind(u.id),
    env.DB.prepare('INSERT INTO sessoes (id, usuario_id, criada_em, expira_em, ip) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(await sha256(tk), u.id, agora, new Date(Date.now() + SESSAO_HORAS * 3600000).toISOString(), ip(req)),
    env.DB.prepare('DELETE FROM sessoes WHERE expira_em < ?1').bind(agora)
  ]);
  await auditar(env, u.id, 'login', '', req);
  return json({ perfil: perfilPublico(u) }, 200, { 'set-cookie': cookieSessao(tk, SESSAO_HORAS * 3600) });
}
async function sair(env, req) {
  const tk = lerCookie(req, COOKIE);
  if (tk) await env.DB.prepare('DELETE FROM sessoes WHERE id = ?1').bind(await sha256(tk)).run();
  return json({ ok: true }, 200, { 'set-cookie': cookieSessao('', 0) });
}

async function auditar(env, usuarioId, acao, alvo, req) {
  await env.DB.prepare('INSERT INTO auditoria (em, usuario_id, acao, alvo, ip) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(new Date().toISOString(), usuarioId || null, acao, alvo || '', req ? ip(req) : '').run();
}

/* ---------- leitura do banco no formato das telas ---------- */
function parse(t, padrao) { try { return t ? JSON.parse(t) : padrao; } catch { return padrao; } }
async function agenciaDados(env, agId) {
  const a = await env.DB.prepare('SELECT * FROM agencias WHERE id = ?1').bind(agId).first();
  if (!a) throw R.Erro('Agência não encontrada.', 404);
  const emp = (await env.DB.prepare('SELECT * FROM empresas WHERE agencia_id = ?1 ORDER BY nome').bind(agId).all()).results;
  const fun = (await env.DB.prepare('SELECT f.* FROM funcoes f JOIN empresas e ON e.id = f.empresa_id WHERE e.agencia_id = ?1 ORDER BY f.nome').bind(agId).all()).results;
  return {
    a,
    empresas: emp.map(e => ({ id: e.id, nome: e.nome, cnpj: e.cnpj, contato: e.contato, tel: e.tel, grauRisco: e.grau_risco })),
    funcoes: fun.map(f => ({ id: f.id, empresaId: f.empresa_id, nome: f.nome, setor: f.setor, riscos: parse(f.riscos, []), exames: parse(f.exames, []), periodicidade: f.periodicidade }))
  };
}
function contextoServidor(u, ag, extras = {}) {
  const e = id => ag.empresas.find(x => x.id === id) || null, f = id => ag.funcoes.find(x => x.id === id) || null;
  return {
    agora: new Date().toISOString(), clinica: ag.a.nome, empresa: e, funcao: f,
    usuario: { tipo: u.tipo, papel: u.papel || '', empresaId: u.empresa_id || '', nome: u.nome, crm: u.crm || '' },
    novoId: () => b64url(aleatorio(9)),
    prepararLink: c => { c.token = b64url(aleatorio(32)); },
    linkFicha: c => `${extras.origem}/crm/ficha.html?t=${c.token}`
  };
}

/* Estado para a tela, já filtrado pelo perfil. Saúde só para a equipe médica. */
async function estadoPara(env, u) {
  if (u.tipo === 'admin') return { contas: await contasAdmin(env) };
  const agId = u.tipo === 'clinica' ? u.agencia_id : (await env.DB.prepare('SELECT agencia_id FROM empresas WHERE id = ?1').bind(u.empresa_id).first())?.agencia_id;
  const ag = await agenciaDados(env, agId);
  const medico = u.tipo === 'clinica' && u.papel === 'medico';
  const filtro = u.tipo === 'rh' ? 'a.empresa_id = ?2' : '?2 = ?2';
  const linhas = (await env.DB.prepare(`SELECT a.id, a.etapa, a.dados, a.atualizado_em, f.ficha, f.enviado_em, f.assinatura_ip, l.token_cifrado
      FROM atendimentos a
      LEFT JOIN fichas f ON f.atendimento_id = a.id
      LEFT JOIN links l ON l.atendimento_id = a.id AND l.revogado = 0 AND l.usado_em IS NULL AND l.expira_em > ?3
      WHERE a.agencia_id = ?1 AND ${filtro} ORDER BY a.criado_em DESC LIMIT 2000`)
    .bind(agId, u.tipo === 'rh' ? u.empresa_id : 1, new Date().toISOString()).all()).results;
  const candidatos = [];
  for (const l of linhas) {
    const c = parse(l.dados, {});
    c.id = l.id; c.etapa = l.etapa; c.versao = l.atualizado_em;
    c.ficha = null; c.rascunho = null;
    if (l.token_cifrado && (c.etapa === 'enviado' || c.etapa === 'preenchendo')) c.token = (await decifrar(env, l.token_cifrado, 'token:' + l.id)).t;
    /* a ficha só sai para a equipe médica, e só enquanto o exame está em andamento */
    if (medico && l.ficha && ['recebida', 'agendado', 'atendido'].includes(c.etapa)) {
      c.ficha = await decifrar(env, l.ficha, 'ficha:' + l.id);
      c.fichaAssinatura = { em: l.enviado_em, ip: l.assinatura_ip || '' };
    }
    else if (medico && l.enviado_em) c.fichaArquivada = l.enviado_em;
    if (u.tipo === 'rh') delete c.historico;
    candidatos.push(c);
  }
  const estado = {
    versao: 4, clinica: ag.a.nome, endereco: ag.a.endereco, horario: ag.a.horario, pcmso: parse(ag.a.pcmso, {}),
    empresas: u.tipo === 'rh' ? ag.empresas.filter(e => e.id === u.empresa_id) : ag.empresas,
    funcoes: u.tipo === 'rh' ? ag.funcoes.filter(f => f.empresaId === u.empresa_id) : ag.funcoes,
    candidatos, automacoes: [], mensagens: []
  };
  if (u.tipo === 'clinica') {
    estado.automacoes = (await env.DB.prepare('SELECT id, nome, quando, para, ativo FROM automacoes WHERE agencia_id = ?1 ORDER BY ordem').bind(agId).all()).results.map(x => ({ ...x, ativo: !!x.ativo }));
    estado.mensagens = (await env.DB.prepare('SELECT em, automacao, para, texto FROM mensagens WHERE agencia_id = ?1 ORDER BY em DESC LIMIT 100').bind(agId).all()).results;
    estado.contas = await contasDaAgencia(env, agId);
  }
  return estado;
}

/* ---------- chamados ---------- */
function agenciaParaContas(a, uso) { return { id: a.id, nome: a.nome, cidade: a.cidade, contato: a.contato, tel: a.tel, desde: a.criado_em, situacao: a.situacao, servicos: parse(a.servicos, []), usuarios: a.usuarios || 0, uso }; }
async function contasDaAgencia(env, agId) {
  const a = await env.DB.prepare('SELECT * FROM agencias WHERE id = ?1').bind(agId).first();
  const ks = (await env.DB.prepare('SELECT dados FROM chamados WHERE agencia_id = ?1 ORDER BY aberto_em DESC LIMIT 500').bind(agId).all()).results.map(k => parse(k.dados, null)).filter(Boolean);
  return { versao: 3, agencias: [agenciaParaContas(a, { fichas: 0, asos: 0, mensagens: 0 })], chamados: ks };
}
async function contasAdmin(env) {
  const ini = new Date(); ini.setUTCDate(1); ini.setUTCHours(3, 0, 0, 0);
  const desde = ini.toISOString();
  const ags = (await env.DB.prepare(`SELECT a.*,
      (SELECT COUNT(*) FROM usuarios u WHERE u.agencia_id = a.id) AS usuarios,
      (SELECT COUNT(*) FROM fichas f JOIN atendimentos t ON t.id = f.atendimento_id WHERE t.agencia_id = a.id AND f.enviado_em >= ?1) AS fichas,
      (SELECT COUNT(*) FROM atendimentos t WHERE t.agencia_id = a.id AND t.etapa = 'aso' AND t.atualizado_em >= ?1) AS asos,
      (SELECT COUNT(*) FROM mensagens m WHERE m.agencia_id = a.id AND m.em >= ?1) AS mensagens
      FROM agencias a ORDER BY a.nome`).bind(desde).all()).results;
  const ks = (await env.DB.prepare('SELECT dados FROM chamados ORDER BY aberto_em DESC LIMIT 1000').all()).results.map(k => parse(k.dados, null)).filter(Boolean);
  return { versao: 3, agencias: ags.map(a => agenciaParaContas(a, { fichas: a.fichas, asos: a.asos, mensagens: a.mensagens })), chamados: ks };
}
const CHAMADO_ACOES = {
  abrirChamado: { quem: ['admin', 'clinica'] },
  registrar: { quem: ['admin', 'clinica'] },
  escalonar: { quem: ['admin'] },
  atribuir: { quem: ['admin'] },
  avaliar: { quem: ['clinica'] }
};
async function acaoChamado(env, u, nome, args) {
  const regra = CHAMADO_ACOES[nome];
  if (!regra || !regra.quem.includes(u.tipo)) throw R.Erro('Sem permissão.', 403);
  if (!Array.isArray(args) || args.length > 6) throw R.Erro('Pedido inválido.');
  args = args.map(a => typeof a === 'string' ? R.texto(a, 2000) : a);
  const contas = u.tipo === 'admin' ? await contasAdmin(env) : await contasDaAgencia(env, u.agencia_id);
  Contas.usar(contas);
  const antes = new Map(contas.chamados.map(k => [k.id, JSON.stringify(k)]));
  if (nome === 'abrirChamado') {
    const d = args[0] || {};
    if (!R.texto(d.assunto) || !R.texto(d.descricao)) throw R.Erro('Preencha o assunto e os detalhes.');
    const agId = u.tipo === 'clinica' ? u.agencia_id : R.texto(d.agenciaId, 40);
    if (!contas.agencias.some(a => a.id === agId)) throw R.Erro('Agência não encontrada.', 404);
    Contas.abrirChamado({ agenciaId: agId, assunto: R.texto(d.assunto, 160), descricao: R.texto(d.descricao, 2000), categoria: Contas.CATEGORIAS.includes(d.categoria) ? d.categoria : 'Outro', prioridade: Contas.PRIORIDADES[d.prioridade] ? d.prioridade : 'normal', canal: u.tipo === 'clinica' ? 'Portal' : (Contas.CANAIS.includes(d.canal) ? d.canal : 'Portal'), por: u.tipo === 'clinica' ? u.nome : 'Aberto pela Nexus Safe' });
  } else {
    const [id] = args;
    if (!contas.chamados.some(k => k.id === id)) throw R.Erro('Chamado não encontrado.', 404);
    if (nome === 'registrar') {
      const lado = u.tipo === 'admin' ? 'nexus' : 'clinica';
      const autor = u.tipo === 'admin' ? (Contas.EQUIPE.concat([Contas.NIVEL2]).includes(args[2]) ? args[2] : u.nome) : u.nome;
      const acao = u.tipo === 'admin' ? (['responder', 'pedir', 'resolver'].includes(args[4]) ? args[4] : 'responder') : (args[4] === 'reabrir' ? 'reabrir' : undefined);
      if (!R.texto(args[3])) throw R.Erro('Escreva a mensagem.');
      Contas.registrar(id, lado, autor, args[3], acao);
    } else if (nome === 'escalonar') { if (!R.texto(args[2])) throw R.Erro('Escreva o motivo.'); Contas.escalonar(id, R.texto(args[1], 60), args[2]); }
    else if (nome === 'atribuir') { if (!Contas.EQUIPE.concat([Contas.NIVEL2]).includes(args[1])) throw R.Erro('Responsável inválido.'); Contas.atribuir(id, args[1]); }
    else if (nome === 'avaliar') Contas.avaliar(id, !!args[1]);
  }
  const grava = [];
  for (const k of Contas.carregar().chamados) {
    const novo = JSON.stringify(k);
    if (antes.get(k.id) === novo) continue;
    grava.push(env.DB.prepare('INSERT INTO chamados (id, agencia_id, situacao, aberto_em, dados) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(id) DO UPDATE SET situacao = excluded.situacao, dados = excluded.dados')
      .bind(k.id, k.agenciaId, k.situacao, k.abertoEm, novo));
  }
  if (grava.length) await env.DB.batch(grava);
}

/* ---------- ações do atendimento ---------- */
const PODE = { clinica: null /* todas */, rh: ['criar'], admin: [] };
async function acao(env, req, u) {
  const corpo = await lerJson(req);
  const nome = String(corpo.acao || '');
  if (nome.startsWith('chamado.')) { await acaoChamado(env, u, nome.slice(8), corpo.dados && corpo.dados.args); return json({ estado: await estadoPara(env, u) }); }
  if (u.tipo === 'admin') throw R.Erro('A administração não mexe em atendimentos.', 403);
  if (PODE[u.tipo] && !PODE[u.tipo].includes(nome)) throw R.Erro('Sem permissão.', 403);
  const agId = u.tipo === 'clinica' ? u.agencia_id : (await env.DB.prepare('SELECT agencia_id FROM empresas WHERE id = ?1').bind(u.empresa_id).first()).agencia_id;

  if (nome === 'automacao') {
    const d = corpo.dados || {};
    await env.DB.prepare('UPDATE automacoes SET ativo = ?1 WHERE agencia_id = ?2 AND id = ?3').bind(d.ativo ? 1 : 0, agId, String(d.id || '')).run();
    return json({ estado: await estadoPara(env, u) });
  }
  if (!Object.prototype.hasOwnProperty.call(R.ACOES, nome)) throw R.Erro('Ação desconhecida.', 404);

  const ag = await agenciaDados(env, agId);
  const ctx = contextoServidor(u, ag, { origem: new URL(req.url).origin });
  let alvo = null, linhaAlvo = null;
  if (!R.SEM_ALVO[nome]) {
    linhaAlvo = await env.DB.prepare('SELECT * FROM atendimentos WHERE id = ?1 AND agencia_id = ?2').bind(String(corpo.alvo || ''), agId).first();
    if (!linhaAlvo) throw R.Erro('Atendimento não encontrado.', 404);
    alvo = parse(linhaAlvo.dados, {}); alvo.id = linhaAlvo.id; alvo.etapa = linhaAlvo.etapa;
  }
  const r = R.ACOES[nome](ctx, alvo, corpo.dados || {});
  /* só depois que a regra aceitou: tentativa barrada não vira "ficha aberta" */
  if (nome === 'abrirFicha') await auditar(env, u.id, 'ficha-aberta', alvo.id, req);

  /* igual à demonstração: a mensagem só não sai se a automação existir e estiver desligada */
  const desligadas = new Set((await env.DB.prepare('SELECT id FROM automacoes WHERE agencia_id = ?1 AND ativo = 0').bind(agId).all()).results.map(x => x.id));
  const grava = [];
  for (const m of r.mensagens) {
    if (desligadas.has(m.automacao) && !m.sempre) continue;
    grava.push(env.DB.prepare('INSERT INTO mensagens (agencia_id, em, automacao, para, texto) VALUES (?1, ?2, ?3, ?4, ?5)').bind(agId, ctx.agora, m.automacao, m.para, m.texto));
    if (m.aoEnviar) m.alvo.historico.push({ em: ctx.agora, txt: m.aoEnviar });
  }
  const salvarAtendimento = c => { const { id, etapa, token, ficha, rascunho, versao, ...resto } = c; return [id, etapa, JSON.stringify(resto)]; };
  if (alvo) {
    const [id, etapa, dados] = salvarAtendimento(alvo);
    /* trava otimista: se alguém mudou o atendimento no meio, não sobrescreve */
    grava.unshift(env.DB.prepare('UPDATE atendimentos SET etapa = ?1, dados = ?2, atualizado_em = ?3 WHERE id = ?4 AND atualizado_em = ?5').bind(etapa, dados, ctx.agora, id, linhaAlvo.atualizado_em));
  }
  if (r.novo) {
    const c = r.novo, [id, etapa, dados] = salvarAtendimento(c);
    grava.push(env.DB.prepare('INSERT INTO atendimentos (id, agencia_id, empresa_id, funcao_id, etapa, criado_em, atualizado_em, dados) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7)').bind(id, agId, c.empresaId, c.funcaoId, etapa, ctx.agora, dados));
    grava.push(env.DB.prepare('INSERT INTO links (token_hash, atendimento_id, token_cifrado, criado_em, expira_em) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(await sha256(c.token), id, await cifrar(env, { t: c.token }, 'token:' + id), ctx.agora, new Date(Date.now() + LINK_DIAS * 86400000).toISOString()));
  }
  const res = await env.DB.batch(grava);
  if (alvo && res[0].meta.changes === 0) throw R.Erro('Este atendimento mudou enquanto você mexia. A tela foi atualizada; confira e tente de novo.', 409);
  return json({ estado: await estadoPara(env, u), novoId: r.novo ? r.novo.id : '' });
}

/* ---------- ficha pública (link do candidato) ---------- */
async function linkValido(env, token) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  return env.DB.prepare(`SELECT l.*, a.etapa, a.dados, a.agencia_id, a.empresa_id, a.funcao_id, a.atualizado_em FROM links l JOIN atendimentos a ON a.id = l.atendimento_id
    WHERE l.token_hash = ?1 AND l.revogado = 0`).bind(await sha256(token)).first();
}
async function ficha(env, req, token, parte) {
  if (!(await limite(env, 'ficha-ip:' + ip(req), parte ? 300 : 120, 600))) return erro('Muitos acessos. Espere alguns minutos.', 429);
  const l = await linkValido(env, token);
  if (!l) { await limite(env, 'ficha-erro:' + ip(req), 1000, 600); return erro('Link inválido.', 404); }
  const agora = new Date().toISOString();
  const c = parse(l.dados, {}); c.id = l.atendimento_id; c.etapa = l.etapa;
  const reg = await env.DB.prepare('SELECT rascunho, enviado_em FROM fichas WHERE atendimento_id = ?1').bind(c.id).first();

  if (!parte) {
    if (!reg || !reg.enviado_em) { if (l.usado_em || l.expira_em < agora) return erro('Link expirado. Peça outro à clínica.', 410); }
    const ag = await agenciaDados(env, l.agencia_id);
    const e = ag.empresas.find(x => x.id === l.empresa_id), f = ag.funcoes.find(x => x.id === l.funcao_id);
    const rasc = reg && reg.rascunho && !reg.enviado_em ? await decifrar(env, reg.rascunho, 'rascunho:' + c.id) : null;
    return json({ estado: {
      versao: 4, clinica: ag.a.nome, empresas: [{ id: e.id, nome: e.nome }], funcoes: [f], automacoes: [], mensagens: [],
      candidatos: [{ id: c.id, token, nome: c.nome, cpf: c.cpf, tipoExame: c.tipoExame, empresaId: e.id, funcaoId: f.id, etapa: c.etapa, historico: [], ficha: reg && reg.enviado_em ? { enviadoEm: reg.enviado_em } : null, rascunho: rasc }]
    } });
  }

  if (req.method !== 'POST') return erro('Método não permitido.', 405);
  if (!mesmaOrigem(req)) return erro('Origem não permitida.', 403);
  if (l.usado_em || (reg && reg.enviado_em)) return erro('Esta ficha já foi enviada.', 409);
  if (l.expira_em < agora) return erro('Link expirado. Peça outro à clínica.', 410);
  const corpo = await lerJson(req);
  const hist = c.historico || [];

  if (parte === 'rascunho') {
    const r = corpo.rascunho || {};
    const cifrado = await cifrar(env, { passo: Number(r.passo) || 0, ficha: r.ficha || {} }, 'rascunho:' + c.id);
    const grava = [env.DB.prepare('INSERT INTO fichas (atendimento_id, rascunho, atualizado_em) VALUES (?1, ?2, ?3) ON CONFLICT(atendimento_id) DO UPDATE SET rascunho = excluded.rascunho, atualizado_em = excluded.atualizado_em').bind(c.id, cifrado, agora)];
    if (c.etapa === 'enviado') {
      hist.push({ em: agora, txt: 'Abriu a ficha e começou a preencher.' });
      const { id, etapa, token: _t, ficha: _f, rascunho: _r, ...resto } = c; resto.historico = hist;
      grava.push(env.DB.prepare("UPDATE atendimentos SET etapa = 'preenchendo', dados = ?1, atualizado_em = ?2 WHERE id = ?3 AND etapa = 'enviado'").bind(JSON.stringify(resto), agora, c.id));
    }
    await env.DB.batch(grava);
    return json({ ok: true });
  }
  if (parte === 'enviar') {
    const st = corpo.ficha;
    R.conferirFicha(st);
    const cifrada = await cifrar(env, st, 'ficha:' + c.id);
    hist.push({ em: agora, txt: 'Ficha enviada pelo candidato.' });
    const { id, etapa, token: _t, ficha: _f, rascunho: _r, ...resto } = c; resto.historico = hist;
    const res = await env.DB.batch([
      env.DB.prepare('UPDATE links SET usado_em = ?1 WHERE token_hash = ?2 AND usado_em IS NULL').bind(agora, l.token_hash),
      /* assinatura: data e hora (enviado_em), IP e navegador de quem enviou */
      env.DB.prepare('INSERT INTO fichas (atendimento_id, ficha, rascunho, enviado_em, atualizado_em, assinatura_ip, assinatura_agente) VALUES (?1, ?2, NULL, ?3, ?3, ?4, ?5) ON CONFLICT(atendimento_id) DO UPDATE SET ficha = excluded.ficha, rascunho = NULL, enviado_em = excluded.enviado_em, atualizado_em = excluded.atualizado_em, assinatura_ip = excluded.assinatura_ip, assinatura_agente = excluded.assinatura_agente')
        .bind(c.id, cifrada, agora, ip(req), R.texto(req.headers.get('user-agent'), 300)),
      env.DB.prepare("UPDATE atendimentos SET etapa = 'recebida', dados = ?1, atualizado_em = ?2 WHERE id = ?3 AND etapa IN ('enviado', 'preenchendo')").bind(JSON.stringify(resto), agora, c.id)
    ]);
    if (res[0].meta.changes === 0) return erro('Esta ficha já foi enviada.', 409);
    return json({ ok: true });
  }
  return erro('Não encontrado.', 404);
}

/* ---------- roteador ---------- */
async function rotaApi(req, env) {
  const url = new URL(req.url), p = url.pathname;
  if (req.method === 'POST' && !mesmaOrigem(req)) return erro('Origem não permitida.', 403);
  if (p === '/api/saude') return json({ ok: true });
  if (p === '/api/entrar' && req.method === 'POST') return entrar(env, req);
  if (p === '/api/sair' && req.method === 'POST') return sair(env, req);
  const mf = p.match(/^\/api\/ficha\/([^/]+)(?:\/(rascunho|enviar))?$/);
  if (mf) return ficha(env, req, decodeURIComponent(mf[1]), mf[2] || '');

  const u = await usuarioDaSessao(env, req);
  if (!u) return erro('Entre de novo.', 401);
  if (p === '/api/eu') return json({ perfil: perfilPublico(u) });
  if (p === '/api/estado' && req.method === 'GET') return json({ estado: await estadoPara(env, u) });
  if (p === '/api/acao' && req.method === 'POST') {
    if (!(await limite(env, 'acao-u:' + u.id, 240, 60))) return erro('Muitas ações seguidas. Espere um minuto.', 429);
    return acao(env, req, u);
  }
  return erro('Não encontrado.', 404);
}

const ARQUIVOS_FORA = /^\/(servidor|testes|node_modules|\.git|\.wrangler)(\/|$)|\.(md|sql|mjs|jsonc)$|^\/(package(-lock)?\.json|\.dev\.vars|\.gitignore|\.assetsignore)$/;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/')) return await rotaApi(req, env);
      if (url.pathname === '/crm/modo.js') return new Response("window.NEXUS_SERVIDOR = true;\ndocument.documentElement.classList.add('modo-servidor');\n", { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
      if (ARQUIVOS_FORA.test(url.pathname)) return new Response('Não encontrado', { status: 404 });
      return env.ASSETS.fetch(req);
    } catch (e) {
      if (e && e.publica) return erro(e.message, e.status || 400);
      console.error(e && e.stack || e);
      return erro('Erro interno. Tente de novo.', 500);
    }
  }
};
