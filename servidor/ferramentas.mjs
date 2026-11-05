/* Nexus Safe · peças comuns dos scripts de linha de comando (semente, conta, backup).
   Mesmo formato de senha e de cifra do servidor/index.js. */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { webcrypto as crypto } from 'node:crypto';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Roda os scripts do navegador num contexto isolado e devolve o que eles expõem. */
export function carregarScripts(arquivos = ['crm/regras.js', 'crm/dados.js', 'crm/contas.js']) {
  const ctx = { console, Date, Math, JSON, URL, URLSearchParams, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of arquivos) vm.runInContext(readFileSync(join(RAIZ, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

/* ---------- cripto ---------- */
const enc = new TextEncoder();
export const b64 = buf => Buffer.from(buf).toString('base64');
export const b64url = buf => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const aleatorio = n => crypto.getRandomValues(new Uint8Array(n));
export const sha256 = async txt => b64url(await crypto.subtle.digest('SHA-256', enc.encode(txt)));

export async function hashSenha(senha, iter = 100000) {
  const sal = aleatorio(16);
  const k = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iter }, k, 256);
  return `pbkdf2$${iter}$${b64(sal)}$${b64(bits)}`;
}
/* Senha de 16 letras e números sem os que se confundem (0/O, 1/l/I). */
export function senhaAleatoria(n = 16) {
  const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const teto = 256 - (256 % c.length); /* descarta o resto para não pender para as primeiras letras */
  let s = '';
  while (s.length < n) for (const v of aleatorio(n)) if (v < teto && s.length < n) s += c[v % c.length];
  return s;
}

export function lerChaveFicha() {
  if (process.env.FICHA_CHAVE) return process.env.FICHA_CHAVE.trim();
  try { const m = readFileSync(join(RAIZ, '.dev.vars'), 'utf8').match(/^FICHA_CHAVE=(.+)$/m); if (m) return m[1].trim(); } catch { /* sem arquivo */ }
  throw new Error('Defina FICHA_CHAVE ou crie o .dev.vars (veja SEGURANCA.md).');
}
let chaveCache = null;
export async function cifrar(obj, ad) {
  if (!chaveCache) {
    const bruta = Buffer.from(lerChaveFicha(), 'base64');
    if (bruta.length !== 32) throw new Error('FICHA_CHAVE precisa ter 32 bytes em base64.');
    chaveCache = await crypto.subtle.importKey('raw', bruta, 'AES-GCM', false, ['encrypt']);
  }
  const iv = aleatorio(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(ad) }, chaveCache, enc.encode(JSON.stringify(obj)));
  return `v1:${b64(iv)}:${b64(ct)}`;
}

/* ---------- SQL ---------- */
export const q = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
export const insercao = (tabela, o, fim = '') => `INSERT INTO ${tabela} (${Object.keys(o).join(', ')}) VALUES (${Object.values(o).map(q).join(', ')})${fim ? ' ' + fim : ''};`;

/* ---------- banco ---------- */
/* alvo: { remoto: true } para o banco da Cloudflare; { persistir: pasta } para um banco local avulso. */
function argsAlvo(alvo = {}) {
  if (alvo.remoto) return ['--remote'];
  return ['--local'].concat(alvo.persistir ? ['--persist-to', alvo.persistir] : []);
}
export function wrangler(args, { silencioso = true } = {}) {
  try {
    return execFileSync('npx', ['wrangler', ...args], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', silencioso ? 'pipe' : 'inherit'], env: { ...process.env, CI: 'true' }, maxBuffer: 256 * 1024 * 1024 });
  } catch (e) {
    /* só a mensagem que importa, sem o despejo inteiro do wrangler */
    const txt = String(e.stderr || '') + String(e.stdout || '');
    const m = txt.match(/"text":\s*"([^"]+)"/) || txt.match(/ERROR\S*\s*(.+)/);
    const err = new Error('wrangler ' + args.slice(0, 2).join(' ') + ': ' + (m ? m[1].replace(/\x1B\[[0-9;]*m/g, '').trim() : 'falhou'));
    err.saida = txt; throw err;
  }
}
export function consultar(sql, alvo) {
  return JSON.parse(wrangler(['d1', 'execute', 'nexus-safe', ...argsAlvo(alvo), '--json', '--yes', '--command', sql]))[0].results;
}
/* Executa várias instruções de uma vez, por um arquivo temporário que só o dono lê e que some no fim. */
export function executarLinhas(linhas, alvo) {
  const pasta = mkdtempSync(join(tmpdir(), 'nexus-'));
  const arq = join(pasta, 'lote.sql');
  try {
    writeFileSync(arq, linhas.join('\n') + '\n', { mode: 0o600 });
    wrangler(['d1', 'execute', 'nexus-safe', ...argsAlvo(alvo), '--yes', '--file', arq]);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
}
export function aplicarMigracoes(alvo) { wrangler(['d1', 'migrations', 'apply', 'nexus-safe', ...argsAlvo(alvo)]); }
export function exportar(arquivo, alvo) { wrangler(['d1', 'export', 'nexus-safe', ...argsAlvo(alvo), '--skip-confirmation', '--output', arquivo]); }

export function alvoDosArgumentos(argv) {
  const remoto = argv.includes('--remote');
  if (remoto) {
    const cfg = readFileSync(join(RAIZ, 'wrangler.jsonc'), 'utf8');
    if (/"database_id":\s*"0{8}-/.test(cfg)) throw new Error('O wrangler.jsonc ainda está com o database_id de exemplo. Crie o banco primeiro (SEGURANCA.md).');
  }
  return { remoto };
}
