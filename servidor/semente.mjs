/* Nexus Safe · dados iniciais do banco, tirados da própria demonstração (crm/dados.js e crm/contas.js).
   Gera servidor/.semente.sql (fora do Git): agências, empresas, funções, atendimentos com a ficha já cifrada,
   automações, mensagens, chamados e as contas com senha em PBKDF2.
   É só para teste: os dados são fictícios. Agência e contas de verdade entram pelo servidor/conta.mjs.

   Uso:   node servidor/semente.mjs                 (senha das contas: 123, só para teste local)
          NEXUS_SENHA='...' node servidor/semente.mjs
   Depois: npx wrangler d1 execute nexus-safe --local --file servidor/.semente.sql

   A chave das fichas vem de FICHA_CHAVE (variável de ambiente) ou do arquivo .dev.vars. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, carregarScripts, b64url, aleatorio, sha256, hashSenha, cifrar, insercao } from './ferramentas.mjs';

const LINK_DIAS = 7;
const ctx = carregarScripts();
const demo = ctx.Nexus.restaurar();
const contas = ctx.Contas.restaurar();
const USUARIOS = ctx.Contas.USUARIOS;

const linhas = [];
const inserir = (tabela, o) => linhas.push(insercao(tabela, o));
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
  const { id, etapa, token: _t, ficha, rascunho, versao: _v, expiraEm: _x, ...resto } = c;
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
