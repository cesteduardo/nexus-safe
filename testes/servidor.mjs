// Teste do servidor (Cloudflare Worker + D1) rodando no wrangler dev.
// Uso:  npx wrangler dev --port 8790 --ip 127.0.0.1   (em outro terminal)
//       CHROME=/caminho/do/chrome npm run test:servidor
// Zera o banco LOCAL com os dados da demonstração antes de começar. Nunca aponte para o banco de produção.
// Sai com código 1 se qualquer verificação falhar.
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, rmSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = (process.env.NEXUS_URL || 'http://127.0.0.1:8790').replace(/\/$/, '');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(B)) { console.error('Este teste zera o banco: só roda contra o wrangler dev local.'); process.exit(1); }

const falhas = [];
const ok = (cond, msg) => { if (!cond) falhas.push(msg); console.log((cond ? 'ok   ' : 'FALHA') + ' ' + msg); };
const sh = (cmd, args, env = {}) => execFileSync(cmd, args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: 'true', ...env } });
const shFalha = (cmd, args, env) => { try { sh(cmd, args, env); return ''; } catch (e) { return String(e.stderr || '') + String(e.stdout || ''); } };
const sql = q => JSON.parse(sh('npx', ['wrangler', 'd1', 'execute', 'nexus-safe', '--local', '--json', '--command', q]))[0].results;

// banco zerado com a demonstração; guarda os links abertos que a semente imprime
const saida = sh('node', ['servidor/semente.mjs']);
sh('npx', ['wrangler', 'd1', 'migrations', 'apply', 'nexus-safe', '--local']);
sh('npx', ['wrangler', 'd1', 'execute', 'nexus-safe', '--local', '--file', 'servidor/.semente.sql']);
const LINKS = Object.fromEntries([...saida.matchAll(/^ {2}(.+): ([A-Za-z0-9_-]{40,})$/gm)].map(m => [m[1], m[2]]));
ok(Object.keys(LINKS).length === 6, 'semente gera o banco com 6 links de ficha em aberto');

/* ---------- API ---------- */
async function chamar(caminho, { corpo, cookie, origem = B, metodo } = {}) {
  const h = {};
  if (corpo !== undefined) h['content-type'] = 'application/json';
  if (origem) h.origin = origem;
  if (cookie) h.cookie = cookie;
  const r = await fetch(B + caminho, { method: metodo || (corpo !== undefined ? 'POST' : 'GET'), headers: h, body: corpo !== undefined ? JSON.stringify(corpo) : undefined, redirect: 'manual' });
  let j = {}; try { j = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, j, cookie: (r.headers.get('set-cookie') || '').split(';')[0], setCookie: r.headers.get('set-cookie') || '' };
}
async function entrar(usuario, senha = '123') { const r = await chamar('/api/entrar', { corpo: { usuario, senha } }); return r.status === 200 ? r.cookie : ''; }
const estado = async ck => (await chamar('/api/estado', { cookie: ck })).j.estado;
const acao = (ck, nome, alvo, dados) => chamar('/api/acao', { cookie: ck, corpo: { acao: nome, alvo: alvo || '', dados: dados || {} } });
const temSaude = obj => /"saude"|"pessoais"|"habitos"|"especificas"/.test(JSON.stringify(obj));

ok((await chamar('/api/saude')).status === 200, 'servidor responde');
for (const arq of ['/servidor/index.js', '/.dev.vars', '/wrangler.jsonc', '/package.json', '/SEGURANCA.md', '/servidor/.semente.sql', '/node_modules/playwright/package.json'])
  ok((await chamar(arq)).status === 404, `arquivo interno não sai: ${arq}`);
const modo = await (await fetch(B + '/crm/modo.js')).text();
ok(/NEXUS_SERVIDOR = true/.test(modo), 'o Worker entrega o modo.js do servidor');

// login
ok((await chamar('/api/entrar', { corpo: { usuario: 'medico', senha: '999' } })).status === 401, 'senha errada: 401');
ok((await chamar('/api/entrar', { corpo: { usuario: 'medico', senha: '123' }, origem: 'https://outro-site.example' })).status === 403, 'login vindo de outro site é barrado (CSRF)');
ok((await chamar('/api/estado')).status === 401, 'sem sessão, a API não entrega dados');
const rLogin = await chamar('/api/entrar', { corpo: { usuario: 'clinica', senha: '123' } });
ok(/HttpOnly/.test(rLogin.setCookie) && /Secure/.test(rLogin.setCookie) && /SameSite=Strict/.test(rLogin.setCookie) && /^__Host-ns=/.test(rLogin.setCookie), 'cookie de sessão HttpOnly, Secure e SameSite=Strict');
const recepcao = rLogin.cookie, medico = await entrar('medico'), rh = await entrar('rh.metalurgica'), admin = await entrar('admin');
ok(recepcao && medico && rh && admin, 'as quatro contas entram');

const banco = sql("SELECT login, senha FROM usuarios WHERE login = 'medico'")[0];
ok(/^pbkdf2\$100000\$/.test(banco.senha) && !/123/.test(banco.senha.split('$')[3]), 'senha guardada com PBKDF2, nunca em texto');

// quem vê o quê
const eRec = await estado(recepcao), eMed = await estado(medico), eRh = await estado(rh), eAdm = await estado(admin);
ok(eRec.candidatos.length === 12 && !temSaude(eRec.candidatos), 'recepção vê os 12 atendimentos, sem nenhuma resposta de saúde');
const lucas = eMed.candidatos.find(c => c.nome === 'Lucas Henrique Souza');
ok(lucas && lucas.ficha && lucas.ficha.saude && lucas.ficha.saude.labirintite.sim === true, 'médico recebe a ficha decifrada de quem está em andamento');
ok(eRh.candidatos.length > 0 && eRh.candidatos.every(c => c.empresaId === 'e1') && eRh.empresas.length === 1, 'RH vê só a própria empresa');
ok(!temSaude(eRh.candidatos) && eRh.candidatos.every(c => !c.historico), 'RH não recebe saúde nem histórico');
ok(!eAdm.candidatos && eAdm.contas && eAdm.contas.agencias.length >= 3 && !temSaude(eAdm), 'administração recebe só agências, contagens e chamados');

// permissões nas ações
const diego = eRec.candidatos.find(c => c.nome === 'Diego Santos Pereira');
const jose = eRec.candidatos.find(c => c.nome === 'José Roberto Nunes');
ok((await acao(rh, 'agendar', lucas.id, { quando: new Date().toISOString() })).status === 403, 'RH não agenda exame');
ok((await acao(rh, 'criar', '', { tipoExame: 'periodico', nome: 'Teste Outra Empresa', cpf: '529.982.247-25', celular: '(17) 99999-1111', empresaId: 'e2', funcaoId: 'f3' })).status === 403, 'RH não pede exame para outra empresa');
ok((await acao(recepcao, 'emitirAso', jose.id, { resultado: 'Apto' })).status === 403, 'recepção não emite ASO');
ok((await acao(recepcao, 'abrirFicha', lucas.id)).status === 403, 'recepção não abre ficha');
ok((await acao(admin, 'atendido', jose.id)).status === 403, 'administração não mexe em atendimento');
ok((await chamar('/api/acao', { cookie: medico, corpo: { acao: 'atendido', alvo: jose.id, dados: {} }, origem: 'https://outro-site.example' })).status === 403, 'ação vinda de outro site é barrada (CSRF)');
const aso = await acao(medico, 'emitirAso', jose.id, { resultado: 'Apto' });
ok(aso.status === 200 && aso.j.estado.candidatos.find(c => c.id === jose.id).etapa === 'aso', 'médico emite o ASO');
ok((await acao(medico, 'emitirAso', jose.id, { resultado: 'Apto' })).status === 400, 'ASO não sai duas vezes');
await acao(medico, 'abrirFicha', lucas.id);
ok(sql(`SELECT COUNT(*) AS n FROM auditoria WHERE acao = 'ficha-aberta' AND alvo = '${lucas.id}'`)[0].n === 1, 'abertura da ficha fica na auditoria');
ok(diego && !diego.ficha, 'rascunho do candidato não sai para a recepção');

// link da ficha
const tkAna = LINKS['Ana Beatriz Moreira'];
const fAna = await chamar('/api/ficha/' + tkAna);
ok(fAna.status === 200 && fAna.j.estado.candidatos[0].nome === 'Ana Beatriz Moreira' && fAna.j.estado.candidatos.length === 1, 'link abre só a ficha daquela pessoa');
ok((await chamar('/api/ficha/' + 'x'.repeat(43))).status === 404, 'link inventado: 404');
ok((await chamar(`/api/ficha/${tkAna}/rascunho`, { corpo: { rascunho: { passo: 1, ficha: { pessoais: { endereco: 'Rua B, 2' } } } }, origem: 'https://outro-site.example' })).status === 403, 'rascunho vindo de outro site é barrado');
ok((await chamar(`/api/ficha/${tkAna}/rascunho`, { corpo: { rascunho: { passo: 1, ficha: { pessoais: { endereco: 'Rua B, 2' } } } } })).status === 200, 'rascunho é salvo no servidor');
ok((await chamar('/api/ficha/' + tkAna)).j.estado.candidatos[0].rascunho.ficha.pessoais.endereco === 'Rua B, 2', 'rascunho volta ao reabrir o link');
ok((await chamar(`/api/ficha/${tkAna}/enviar`, { corpo: { ficha: { pessoais: {} } } })).status === 400, 'ficha incompleta é recusada');
const fichaOk = { pessoais: { nascimento: '1990-01-01', sexo: 'Feminino', estado_civil: 'Solteiro(a)', escolaridade: 'Superior completo', endereco: 'Rua B, 2', emergencia_nome: 'Rosa Moreira', emergencia_parentesco: 'Mãe', emergencia_tel: '(17) 99888-7777' }, saude: { pressao: { sim: true, detalhe: 'Controlada' } }, aceite: true };
ok((await chamar(`/api/ficha/${tkAna}/enviar`, { corpo: { ficha: fichaOk } })).status === 200, 'ficha completa é enviada');
ok((await chamar(`/api/ficha/${tkAna}/enviar`, { corpo: { ficha: fichaOk } })).status === 409, 'a mesma ficha não é enviada duas vezes');
const guardada = sql(`SELECT f.ficha FROM fichas f JOIN atendimentos a ON a.id = f.atendimento_id WHERE a.dados LIKE '%Ana Beatriz%'`)[0].ficha;
ok(/^v1:/.test(guardada) && !/Rua B|pressao|Controlada/.test(guardada), 'ficha fica cifrada no banco');
const ass = sql(`SELECT f.assinatura_ip, f.assinatura_agente, f.enviado_em FROM fichas f JOIN atendimentos a ON a.id = f.atendimento_id WHERE a.dados LIKE '%Ana Beatriz%'`)[0];
ok(ass.assinatura_ip && ass.enviado_em && ass.assinatura_agente !== null, 'assinatura da ficha grava data, hora, IP e navegador');
const anaMed = (await estado(medico)).candidatos.find(c => c.nome === 'Ana Beatriz Moreira');
ok(anaMed.etapa === 'recebida' && anaMed.ficha.saude.pressao.detalhe === 'Controlada', 'médico recebe a ficha enviada');
ok(anaMed.fichaAssinatura && anaMed.fichaAssinatura.ip === ass.assinatura_ip, 'médico vê de que IP a ficha foi assinada');
ok(!temSaude((await estado(recepcao)).candidatos.find(c => c.nome === 'Ana Beatriz Moreira')), 'recepção continua sem ver a ficha enviada');

// sair e bloqueio por tentativas
await chamar('/api/sair', { cookie: admin, corpo: {} });
ok((await chamar('/api/estado', { cookie: admin })).status === 401, 'depois de sair, a sessão não vale mais');
for (let i = 0; i < 5; i++) await chamar('/api/entrar', { corpo: { usuario: 'rh.transportes', senha: 'errada' } });
ok((await chamar('/api/entrar', { corpo: { usuario: 'rh.transportes', senha: '123' } })).status === 429, 'cinco senhas erradas bloqueiam a conta por 15 minutos');

/* ---------- cadastro de verdade (servidor/conta.mjs) ---------- */
const cad = sh('node', ['servidor/conta.mjs', 'cadastro', 'servidor/piloto.exemplo.json']);
const SENHAS = Object.fromEntries([...cad.matchAll(/^ {2}([a-z0-9._-]+): ([A-Za-z0-9]{16})$/gm)].map(m => [m[1], m[2]]));
ok(Object.keys(SENHAS).length === 4, 'cadastro do piloto cria 4 contas com senha aleatória de 16 caracteres');
ok(!/[A-Za-z0-9]{16}/.test(sh('node', ['servidor/conta.mjs', 'cadastro', 'servidor/piloto.exemplo.json']).split('\n').filter(l => /^ {2}/.test(l)).join('')), 'rodar o cadastro de novo não troca senha de ninguém');
const recPiloto = await entrar('recepcao.piloto', SENHAS['recepcao.piloto']), rhCer = await entrar('rh.ceramica', SENHAS['rh.ceramica']);
const ePil = recPiloto && await estado(recPiloto);
ok(ePil && ePil.clinica === 'Clínica Exemplo Ocupacional (fictícia)' && ePil.candidatos.length === 0 && ePil.empresas.length === 2 && ePil.automacoes.length === 6, 'recepção do piloto entra e vê só a própria agência, com as automações');
ok(!(await estado(recepcao)).empresas.some(e => /^piloto-/.test(e.id)), 'a clínica da demonstração não vê as empresas do piloto');
const novoPil = await acao(rhCer, 'criar', '', { tipoExame: 'admissional', nome: 'Pedro Teste Lima', cpf: '529.982.247-25', celular: '(17) 99777-1212', empresaId: 'piloto-ceramica', funcaoId: 'piloto-forneiro', admissaoEm: new Date(Date.now() + 5 * 864e5).toISOString() });
ok(novoPil.status === 200 && (await estado(recPiloto)).candidatos.some(c => c.nome === 'Pedro Teste Lima') && !(await estado(recepcao)).candidatos.some(c => c.nome === 'Pedro Teste Lima'), 'pedido do RH do piloto chega só à clínica do piloto');
ok((await acao(rhCer, 'criar', '', { tipoExame: 'periodico', nome: 'Outro Teste Lima', cpf: '529.982.247-25', celular: '(17) 99777-1212', empresaId: 'piloto-laticinio', funcaoId: 'piloto-ordenha' })).status === 403, 'RH da cerâmica não pede exame para o laticínio');
const ruim = join(tmpdir(), `nexus-ruim-${process.pid}.json`);
writeFileSync(ruim, JSON.stringify({ agencia: { ...JSON.parse(readFileSync(join(RAIZ, 'servidor/piloto.exemplo.json'), 'utf8')).agencia, id: 'outra' }, empresas: [], usuarios: [{ login: 'clinica', nome: 'Tomada', tipo: 'clinica', papel: 'recepcao' }] }));
ok(/outro vínculo/.test(shFalha('node', ['servidor/conta.mjs', 'cadastro', ruim])) && sql("SELECT agencia_id FROM usuarios WHERE login = 'clinica'")[0].agencia_id === 'a1', 'conta de uma agência não passa para outra pelo cadastro');
writeFileSync(ruim, JSON.stringify({ agencia: { ...JSON.parse(readFileSync(join(RAIZ, 'servidor/piloto.exemplo.json'), 'utf8')).agencia, id: 'outra' }, empresas: [{ id: 'x1', nome: 'X', cnpj: '11.111.111/1111-11', contato: 'Y', tel: '(17) 99999-0000', grauRisco: 2, funcoes: [{ id: 'x1f', nome: 'Z', setor: 'W', riscos: ['ruido'], exames: ['audiometria'], periodicidade: 12 }] }], usuarios: [] }));
const errCad = shFalha('node', ['servidor/conta.mjs', 'cadastro', ruim]);
ok(/CNPJ inválido/.test(errCad) && /exame clínico/.test(errCad) && sql("SELECT COUNT(*) AS n FROM agencias WHERE id = 'outra'")[0].n === 0, 'cadastro com erro não grava nada e diz o que corrigir');
rmSync(ruim, { force: true });
const troca = sh('node', ['servidor/conta.mjs', 'senha', 'rh.ceramica']).match(/: ([A-Za-z0-9]{16})/)[1];
ok((await chamar('/api/estado', { cookie: rhCer })).status === 401 && !(await entrar('rh.ceramica', SENHAS['rh.ceramica'])) && await entrar('rh.ceramica', troca), 'senha nova derruba a sessão aberta e a antiga para de valer');
sh('node', ['servidor/conta.mjs', 'desativar', 'dp.laticinio']);
ok(!(await entrar('dp.laticinio', SENHAS['dp.laticinio'])), 'conta desativada não entra');
sh('node', ['servidor/conta.mjs', 'reativar', 'dp.laticinio']);
ok(!!(await entrar('dp.laticinio', SENHAS['dp.laticinio'])), 'conta reativada volta a entrar');

/* ---------- backup cifrado (servidor/backup.mjs) ---------- */
const pastaBk = mkdtempSync(join(tmpdir(), 'nexus-bk-teste-'));
try {
  const SENHA_BK = { NEXUS_BACKUP_SENHA: 'senha-de-backup-so-do-teste' };
  ok(/16 caracteres/.test(shFalha('node', ['servidor/backup.mjs', 'fazer', '--pasta', pastaBk], { NEXUS_BACKUP_SENHA: 'curta' })), 'backup recusa senha curta');
  sh('node', ['servidor/backup.mjs', 'fazer', '--pasta', pastaBk], SENHA_BK);
  const arqBk = join(pastaBk, readdirSync(pastaBk).find(f => f.endsWith('.nsbak')));
  const bruto = readFileSync(arqBk, 'latin1');
  ok(statSync(arqBk).mode % 0o1000 === 0o600 && !/Lucas Henrique|Pedro Teste|pbkdf2|Rua B/.test(bruto), 'backup sai cifrado e só o dono lê o arquivo');
  ok(/Restauração conferida/.test(sh('node', ['servidor/backup.mjs', 'testar', arqBk], SENHA_BK)), 'backup restaura num banco descartável e confere tabela por tabela');
  ok(/senha errada/.test(shFalha('node', ['servidor/backup.mjs', 'testar', arqBk], { NEXUS_BACKUP_SENHA: 'senha-errada-do-teste-xx' })), 'backup não abre com a senha errada');
  const alterado = join(pastaBk, 'alterado.nsbak'), b = readFileSync(arqBk); b[b.length - 40] ^= 1; writeFileSync(alterado, b);
  ok(/arquivo alterado/.test(shFalha('node', ['servidor/backup.mjs', 'testar', alterado], SENHA_BK)), 'backup alterado é recusado');
} finally { rmSync(pastaBk, { recursive: true, force: true }); }

/* ---------- navegador ---------- */
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } });
const erros = [];
ctx.on('page', p => p.on('pageerror', e => erros.push(e.message)));
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const page = await ctx.newPage();
page.on('pageerror', e => erros.push(e.message));
const logar = async (pg, usuario, senha = '123') => {
  await pg.goto(B + '/crm/entrar.html'); await pg.waitForTimeout(200);
  await pg.fill('[name=usuario]', usuario); await pg.fill('[name=senha]', senha);
  await pg.click('[data-form-login] button[type=submit]'); await pg.waitForTimeout(700);
};
try {
  await page.goto(B + '/crm/entrar.html'); await page.waitForTimeout(200);
  ok(!(await page.locator('.contas').isVisible()) && !(await page.locator('.demo-faixa').isVisible()), 'no servidor, a entrada não mostra contas de demonstração nem a faixa');
  await logar(page, 'clinica', '999');
  ok(/incorretos/.test(await page.locator('[data-erro-login]').innerText()), 'senha errada avisa na tela');
  await logar(page, 'clinica');
  ok(/\/crm\/(#.*)?$/.test(page.url()) && await page.locator('.card').count() >= 12, 'recepção entra e vê o quadro vindo do banco');
  ok(!(await page.locator('[data-restaurar]').isVisible()), 'no servidor, não há "Restaurar a demonstração"');

  // recepção cadastra; candidato preenche no celular; médico recebe
  await page.click('text=Novo atendimento'); await page.waitForTimeout(200);
  await page.fill('[data-form-novo] [name=nome]', 'Teste Servidor Silva');
  await page.fill('[data-form-novo] [name=cpf]', '529.982.247-25');
  await page.fill('[data-form-novo] [name=celular]', '(17) 99111-2222');
  await page.fill('[data-form-novo] [name=admissaoEm]', new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10));
  await page.selectOption('[data-sel-empresa]', 'e2');
  await page.click('text=Cadastrar e gerar link'); await page.waitForTimeout(900);
  const link = await page.inputValue('.link-ficha input');
  ok(/ficha\.html\?t=[A-Za-z0-9_-]{40,}$/.test(link) && link.startsWith(B), 'cadastro grava no banco e gera link longo');

  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(link); await m.waitForTimeout(600);
  await m.click('button[type=submit]');
  await m.fill('[name=nascimento]', '1998-03-02');
  await m.selectOption('[name=sexo]', 'Masculino');
  await m.selectOption('[name=estado_civil]', 'Solteiro(a)');
  await m.selectOption('[name=escolaridade]', 'Ensino médio completo');
  await m.fill('[name=endereco]', 'Rua A, 1');
  await m.fill('[name=emergencia_nome]', 'Joana Lima');
  await m.selectOption('[name=emergencia_parentesco]', 'Mãe');
  await m.fill('[name=emergencia_tel]', '17 99999 0000');
  await m.click('[data-sn=pcd] label:has-text("Não")');
  await m.waitForTimeout(1000);
  await m.reload(); await m.waitForTimeout(700);
  ok(await m.inputValue('[name=endereco]').catch(() => '') === 'Rua A, 1', 'rascunho volta do servidor ao recarregar a ficha');
  await m.click('button[type=submit]');
  await m.fill('[name=t0_empresa]', 'Obra X'); await m.fill('[name=t0_funcao]', 'Ajudante'); await m.fill('[name=t0_tempo]', '1 ano');
  await m.click('[data-radio=t0_epi] label:has-text("Sim")');
  for (const k of ['acidente', 'inss', 'ocupacional']) await m.click(`[data-sn=${k}] label:has-text("Não")`);
  await m.click('button[type=submit]');
  await m.click('[data-nenhum]');
  await m.click('[data-sn=s_convulsao] label:has-text("Sim")');
  await m.fill('[name=s_convulsao__det]', 'Uma vez em 2019');
  await m.click('[data-radio=oculos] label:has-text("Não")');
  await m.click('button[type=submit]');
  await m.click('[data-radio=fuma] label:has-text("Não")');
  await m.click('[data-radio=alcool] label:has-text("Socialmente")');
  await m.click('[data-radio=atividade] label:has-text("Sim")');
  await m.click('button[type=submit]');
  const sns = await m.locator('[data-sn^="e_"]').count();
  for (let i = 0; i < sns; i++) await m.locator('[data-sn^="e_"]').nth(i).locator('label:has-text("Não")').click();
  await m.click('button[type=submit]');
  await m.check('[name=declaro]'); await m.check('[name=lgpd]');
  const bx = await m.locator('[data-assinatura]').boundingBox();
  await m.mouse.move(bx.x + 30, bx.y + 100); await m.mouse.down();
  for (let i = 0; i < 20; i++) await m.mouse.move(bx.x + 30 + i * 12, bx.y + 100 + Math.sin(i) * 25);
  await m.mouse.up();
  await m.click('button[type=submit]'); await m.waitForTimeout(1000);
  ok(/Ficha enviada/.test(await m.locator('h1').innerText()), 'candidato envia a ficha pelo celular');
  await m.goto(link); await m.waitForTimeout(600);
  ok(!(await m.locator('[name=nascimento]').count()), 'link usado não reabre o formulário');

  await page.locator('[data-sair]').first().click({ force: true }).catch(() => {}); await page.waitForTimeout(500);
  await logar(page, 'medico');
  const card = page.locator('.card', { hasText: 'Teste Servidor Silva' });
  ok(await card.count() === 1, 'médico vê o novo atendimento');
  await card.click(); await page.waitForTimeout(700);
  ok(/convuls/i.test(await page.locator('[data-painel]').innerText()), 'médico lê a ficha que o candidato enviou');

  await page.locator('[data-sair]').first().click({ force: true }).catch(() => {}); await page.waitForTimeout(500);
  await logar(page, 'rh.construtora');
  const txtRh = await page.locator('main').innerText();
  ok(/Teste Servidor Silva/.test(txtRh) && !/convuls/i.test(txtRh) && !/Lucas Henrique/.test(txtRh), 'RH da construtora vê o funcionário sem a ficha e sem outras empresas');
  await page.goto(B + '/crm/'); await page.waitForTimeout(700);
  ok(!/\/crm\/(#.*)?$/.test(page.url()) || await page.locator('.card').count() === 0, 'RH não abre o CRM da clínica');
} finally {
  ok(erros.length === 0, 'nenhum erro de JS' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
}

console.log(falhas.length ? `\n${falhas.length} falha(s).` : '\nTudo certo.');
process.exit(falhas.length ? 1 : 0);
