/* Nexus Safe · backup cifrado do banco, com teste de restauração.

   node servidor/backup.mjs fazer [--remote] [--pasta DIR]
       Exporta o banco (local, ou o da Cloudflare com --remote), cifra com a senha de backup e grava
       DIR/nexus-safe-AAAAMMDD-HHMM.nsbak (padrão: ~/Backups/Nexus Safe). O arquivo leva junto
       quantos registros cada tabela tinha, para o teste conferir.
   node servidor/backup.mjs testar <arquivo.nsbak>
       Decifra, restaura num banco descartável e confere tabela por tabela. Não toca no banco de verdade.
   node servidor/backup.mjs abrir <arquivo.nsbak> <saida.sql>
       Só decifra, para uma restauração de verdade (passo a passo em SEGURANCA.md).

   A senha de backup vem de NEXUS_BACKUP_SENHA (pelo menos 16 caracteres). Ela não fica em lugar nenhum:
   sem ela, o backup não abre. As fichas, lá dentro, continuam cifradas também com a FICHA_CHAVE. */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { consultar, exportar, wrangler, alvoDosArgumentos } from './ferramentas.mjs';

const MAGICO = 'NEXUS-SAFE-BACKUP v1';
const SCRYPT = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

function sair(msg) { console.error('Erro: ' + msg); process.exit(1); }
function senha() {
  const s = process.env.NEXUS_BACKUP_SENHA || '';
  if (s.length < 16) sair('defina NEXUS_BACKUP_SENHA com pelo menos 16 caracteres (veja SEGURANCA.md).');
  return s;
}
function pastaTemp() { return mkdtempSync(join(tmpdir(), 'nexus-backup-')); }

/* Quantos registros cada tabela tem (as tabelas internas do SQLite e do D1 ficam de fora). */
function contagens(alvo) {
  const tabelas = consultar("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name", alvo).map(t => t.name);
  if (!tabelas.length) return {};
  /* uma linha só, uma coluna por tabela (o D1 limita quantos SELECT cabem num UNION) */
  return consultar('SELECT ' + tabelas.map(t => `(SELECT COUNT(*) FROM "${t}") AS "${t}"`).join(', '), alvo)[0];
}

function cifrar(dados, cabecalho) {
  const sal = randomBytes(16), iv = randomBytes(12);
  const cab = JSON.stringify({ ...cabecalho, kdf: { nome: 'scrypt', N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, sal: sal.toString('base64') }, iv: iv.toString('base64') });
  const c = createCipheriv('aes-256-gcm', scryptSync(senha(), sal, 32, SCRYPT), iv);
  c.setAAD(Buffer.from(cab)); /* mexer no cabeçalho também invalida o arquivo */
  const corpo = Buffer.concat([c.update(dados), c.final(), c.getAuthTag()]);
  return Buffer.concat([Buffer.from(MAGICO + '\n' + cab + '\n'), corpo]);
}
function decifrar(arquivo) {
  if (!existsSync(arquivo)) sair('arquivo não encontrado: ' + arquivo);
  const b = readFileSync(arquivo);
  const f1 = b.indexOf(10), f2 = b.indexOf(10, f1 + 1);
  if (f1 < 0 || f2 < 0 || b.subarray(0, f1).toString() !== MAGICO) sair('isto não é um backup do Nexus Safe.');
  const cab = b.subarray(f1 + 1, f2).toString(), h = JSON.parse(cab);
  const corpo = b.subarray(f2 + 1), tag = corpo.subarray(corpo.length - 16);
  const d = createDecipheriv('aes-256-gcm', scryptSync(senha(), Buffer.from(h.kdf.sal, 'base64'), 32, { N: h.kdf.N, r: h.kdf.r, p: h.kdf.p, maxmem: SCRYPT.maxmem }), Buffer.from(h.iv, 'base64'));
  d.setAAD(Buffer.from(cab)); d.setAuthTag(tag);
  try { return { h, sql: Buffer.concat([d.update(corpo.subarray(0, corpo.length - 16)), d.final()]) }; }
  catch { sair('senha errada ou arquivo alterado.'); }
}

function fazer(argv) {
  senha();
  const alvo = alvoDosArgumentos(argv);
  const i = argv.indexOf('--pasta');
  const pasta = i >= 0 ? argv[i + 1] : join(homedir(), 'Backups', 'Nexus Safe');
  if (!pasta) sair('informe a pasta depois de --pasta.');
  mkdirSync(pasta, { recursive: true, mode: 0o700 });
  const tmp = pastaTemp();
  try {
    const n = contagens(alvo);
    const sqlArq = join(tmp, 'banco.sql');
    exportar(sqlArq, alvo);
    const agora = new Date();
    const carimbo = agora.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(/[-:]/g, '').replace(' ', '-').slice(0, 13);
    const saida = join(pasta, `nexus-safe-${carimbo}.nsbak`);
    writeFileSync(saida, cifrar(readFileSync(sqlArq), { criadoEm: agora.toISOString(), origem: alvo.remoto ? 'cloudflare' : 'local', contagens: n }), { mode: 0o600 });
    console.log(`Backup gravado: ${saida}`);
    console.log('Registros: ' + Object.entries(n).map(([t, c]) => `${t} ${c}`).join(', '));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

function testar(arquivo) {
  const { h, sql } = decifrar(arquivo);
  const tmp = pastaTemp();
  try {
    const sqlArq = join(tmp, 'banco.sql');
    writeFileSync(sqlArq, sql, { mode: 0o600 });
    const alvo = { persistir: join(tmp, 'banco') };
    wrangler(['d1', 'execute', 'nexus-safe', '--local', '--persist-to', alvo.persistir, '--yes', '--file', sqlArq]);
    const n = contagens(alvo);
    const erradas = Object.keys({ ...h.contagens, ...n }).filter(t => h.contagens[t] !== n[t]);
    console.log(`Backup de ${new Date(h.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (${h.origem}), restaurado num banco descartável.`);
    for (const t of Object.keys(h.contagens)) console.log(`  ${h.contagens[t] === n[t] ? 'ok   ' : 'FALHA'} ${t}: ${h.contagens[t]} no backup, ${n[t] ?? 'nenhum'} restaurado(s)`);
    if (erradas.length) sair('a restauração não bate com o backup: ' + erradas.join(', '));
    console.log('Restauração conferida.');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

function abrir(arquivo, saida) {
  if (!saida) sair('informe o arquivo de saída: node servidor/backup.mjs abrir backup.nsbak banco.sql');
  if (existsSync(saida)) sair('o arquivo de saída já existe: ' + saida);
  writeFileSync(saida, decifrar(arquivo).sql, { mode: 0o600 });
  console.log(`Decifrado em ${saida}. Apague esse arquivo assim que terminar: ele tem o banco inteiro.`);
}

const [cmd, a1, a2] = process.argv.slice(2);
if (cmd === 'fazer') fazer(process.argv);
else if (cmd === 'testar' && a1) testar(a1);
else if (cmd === 'abrir' && a1) abrir(a1, a2);
else { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\* ?/, '')); process.exit(cmd ? 1 : 0); }
