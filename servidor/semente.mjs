/* Nexus Safe · dados iniciais do banco, tirados da própria demonstração (crm/dados.js e crm/contas.js).
   Gera servidor/.semente.sql (fora do Git): agências, empresas, funções, atendimentos com a ficha já cifrada,
   automações, mensagens, chamados e as contas com senha em PBKDF2.

   Uso:   node servidor/semente.mjs                 (senha das contas: 123, só para teste local)
          NEXUS_SENHA='...' node servidor/semente.mjs
   Depois: npx wrangler d1 execute nexus-safe --local --file servidor/.semente.sql

   A chave das fichas vem de FICHA_CHAVE (variável de ambiente) ou do arquivo .dev.vars. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { webcrypto as crypto } from 'node:crypto';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const LINK_DIAS = 7;

/* ---------- carrega os scripts do navegador num contexto isolado ---------- */
const ctx = { console, Date, Math, JSON, URL, URLSearchParams, setTimeout, clearTimeout };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['crm/regras.js', 'crm/dados.js', 'crm/contas.js']) vm.runInContext(readFileSync(join(RAIZ, f), 'utf8'), ctx, { filename: f });
const demo = ctx.Nexus.restaurar();
const contas = ctx.Contas.restaurar();
const USUARIOS = ctx.Contas.USUARIOS;

/* ---------- chave e cripto (mesmo formato do servidor/index.js) ---------- */
function lerChave() {
  if (process.env.FICHA_CHAVE) return process.env.FICHA_CHAVE.trim();
  try { const m = readFileSync(join(RAIZ, '.dev.vars'), 'utf8').match(/^FICHA_CHAVE=(.+)$/m); if (m) return m[1].trim(); } catch { /* sem arquivo */ }
  throw new Error('Defina FICHA_CHAVE ou crie o .dev.vars (veja SEGURANCA.md).');
}
const enc = new TextEncoder();
const b64 = buf => Buffer.from(buf).toString('base64');
const b64url = buf => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const aleatorio = n => crypto.getRandomValues(new Uint8Array(n));
const sha256 = async txt => b64url(await crypto.subtle.digest('SHA-256', enc.encode(txt)));
const bruta = Buffer.from(lerChave(), 'base64');
if (bruta.length !== 32) throw new Error('FICHA_CHAVE precisa ter 32 bytes em base64.');
const chave = await crypto.subtle.importKey('raw', bruta, 'AES-GCM', false, ['encrypt']);
async function cifrar(obj, ad) {
  const iv = aleatorio(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(ad) }, chave, enc.encode(JSON.stringify(obj)));
  return `v1:${b64(iv)}:${b64(ct)}`;
}
async function hashSenha(senha, iter = 100000) {
  const sal = aleatorio(16);
  const k = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iter }, k, 256);
  return `pbkdf2$${iter}$${b64(sal)}$${b64(bits)}`;
}

/* ---------- SQL ---------- */
const q = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const linhas = [];
const inserir = (tabela, o) => linhas.push(`INSERT INTO ${tabela} (${Object.keys(o).join(', ')}) VALUES (${Object.values(o).map(q).join(', ')});`);
const agora = new Date().toISOString();
const AG = 'a1'; /* a agência com o CRM ao vivo na demonstração */

for (const t of ['limites', 'auditoria', 'sessoes', 'chamados', 'mensagens', 'automacoes', 'links', 'fichas', 'atendimentos', 'usuarios', 'funcoes', 'empresas', 'agencias']) linhas.push(`DELETE FROM ${t};`);

for (const a of contas.agencias) {
  const vivo = a.id === AG;
  inserir('agencias', {
    id: a.id, nome: a.nome, cidade: a.cidade || '', contato: a.contato || '', tel: a.tel || '', situacao: a.situacao, servicos: JSON.stringify(a.servicos || []),
    endereco: vivo ? demo.endereco : '', horario: vivo ? demo.horario : '', pcmso: JSON.stringify(vivo ? demo.pcmso : {}), criado_em: a.desde || agora
  });
}
for (const e of demo.empresas) inserir('empresas', { id: e.id, agencia_id: AG, nome: e.nome, cnpj: e.cnpj, contato: e.contato, tel: e.tel, grau_risco: e.grauRisco });
for (const f of demo.funcoes) inserir('funcoes', { id: f.id, empresa_id: f.empresaId, nome: f.nome, setor: f.setor, riscos: JSON.stringify(f.riscos), exames: JSON.stringify(f.exames), periodicidade: f.periodicidade });

const senhaPadrao = !process.env.NEXUS_SENHA;
const senha = process.env.NEXUS_SENHA || '123';
for (const [login, u] of Object.entries(USUARIOS)) {
  inserir('usuarios', {
    login, nome: u.nome, tipo: u.tipo, papel: u.papel || '', crm: u.papel === 'medico' ? 'CRM-SP 123456' : '',
    agencia_id: u.tipo === 'clinica' ? AG : null, empresa_id: u.tipo === 'rh' ? u.empresaId : null, senha: await hashSenha(senha)
  });
}

const abertos = [];
for (const c of demo.candidatos) {
  const { id, etapa, token: _t, ficha, rascunho, versao: _v, ...resto } = c;
  inserir('atendimentos', { id, agencia_id: AG, empresa_id: c.empresaId, funcao_id: c.funcaoId, etapa, criado_em: c.criadoEm, atualizado_em: agora, dados: JSON.stringify(resto) });
  const tk = b64url(aleatorio(32));
  const aberto = etapa === 'enviado' || etapa === 'preenchendo';
  inserir('links', {
    token_hash: await sha256(tk), atendimento_id: id, token_cifrado: await cifrar({ t: tk }, 'token:' + id), criado_em: c.criadoEm,
    expira_em: new Date(Date.now() + LINK_DIAS * 86400000).toISOString(), usado_em: aberto ? null : (ficha && ficha.enviadoEm) || c.criadoEm, revogado: 0
  });
  if (aberto) abertos.push([c.nome, tk]);
  if (ficha) {
    const enviado = ficha.enviadoEm || c.criadoEm;
    inserir('fichas', { atendimento_id: id, ficha: await cifrar(ficha, 'ficha:' + id), rascunho: null, enviado_em: enviado, atualizado_em: enviado });
  } else if (rascunho) {
    inserir('fichas', { atendimento_id: id, ficha: null, rascunho: await cifrar({ passo: Number(rascunho.passo) || 0, ficha: rascunho.ficha || {} }, 'rascunho:' + id), enviado_em: null, atualizado_em: agora });
  }
}
demo.automacoes.forEach((a, i) => inserir('automacoes', { agencia_id: AG, id: a.id, nome: a.nome, quando: a.quando, para: a.para, ativo: a.ativo ? 1 : 0, ordem: i }));
for (const m of demo.mensagens) inserir('mensagens', { agencia_id: AG, em: m.em, automacao: m.automacao, para: m.para, texto: m.texto });
for (const k of contas.chamados) inserir('chamados', { id: k.id, agencia_id: k.agenciaId, situacao: k.situacao, aberto_em: k.abertoEm, dados: JSON.stringify(k) });

const saida = join(RAIZ, 'servidor/.semente.sql');
writeFileSync(saida, linhas.join('\n') + '\n', { mode: 0o600 });
console.log(`Gerado ${saida}: ${linhas.length} linhas, ${Object.keys(USUARIOS).length} contas, ${demo.candidatos.length} atendimentos.`);
if (senhaPadrao) console.log('Senha das contas: 123 (só para teste local; para o banco de verdade use NEXUS_SENHA).');
console.log('Links de ficha em aberto (caminho /crm/ficha.html?t=...):');
for (const [nome, tk] of abertos) console.log(`  ${nome}: ${tk}`);
