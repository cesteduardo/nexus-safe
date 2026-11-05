/* Nexus Safe · cadastro de verdade: agência, empresas, funções (com o protocolo do PCMSO) e contas.

   node servidor/conta.mjs cadastro <arquivo.json> [--remote]
       Cria ou atualiza o que está no arquivo (modelo: servidor/piloto.exemplo.json).
       Conta nova ganha uma senha aleatória, mostrada só nesta tela. Conta que já existe não muda de senha.
   node servidor/conta.mjs senha <login> [--remote]       senha nova, desbloqueia e derruba as sessões abertas
   node servidor/conta.mjs desativar <login> [--remote]   a conta para de entrar e as sessões caem
   node servidor/conta.mjs reativar <login> [--remote]

   Sem --remote, mexe no banco local do wrangler dev. */
import { readFileSync } from 'node:fs';
import { carregarScripts, hashSenha, senhaAleatoria, insercao, consultar, executarLinhas, alvoDosArgumentos } from './ferramentas.mjs';

const ctx = carregarScripts();
const R = ctx.NexusRegras, N = ctx.Nexus;
const AUTOMACOES = N.restaurar().automacoes; /* as mesmas da demonstração, todas ligadas */

const [cmd, arg] = process.argv.slice(2).filter(a => !a.startsWith('--'));
let alvo;
try { alvo = alvoDosArgumentos(process.argv); } catch (e) { sair(e.message); }

function sair(msg) { console.error('Erro: ' + msg); process.exit(1); }
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/, LOGIN = /^[a-z0-9][a-z0-9._-]{2,59}$/;

function cnpjValido(v) {
  const d = R.digitos(v); if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = n => { const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const s = p.reduce((t, x, i) => t + x * Number(d[i]), 0) % 11; return s < 2 ? 0 : 11 - s; };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}
const mascaraCnpj = v => R.digitos(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

/* Confere o arquivo inteiro antes de gravar qualquer coisa. Devolve a lista de problemas. */
function conferir(d, existentes) {
  const erros = [], e = (onde, msg) => erros.push(`${onde}: ${msg}`);
  const txt = (v, onde, campo, max = 160) => { if (!R.texto(v, max)) e(onde, `falta ${campo}`); };
  const empresasArquivo = new Set();
  if (d.agencia) {
    const a = d.agencia, o = 'agencia';
    if (!ID.test(a.id || '')) e(o, 'id com letras minúsculas, números e hífen');
    txt(a.nome, o, 'nome'); txt(a.cidade, o, 'cidade'); txt(a.contato, o, 'contato'); txt(a.endereco, o, 'endereço', 300); txt(a.horario, o, 'horário', 300);
    if (!R.telValido(a.tel)) e(o, 'telefone inválido');
    if (!['implantacao', 'ativa', 'teste'].includes(a.situacao || 'implantacao')) e(o, 'situação deve ser implantacao, ativa ou teste');
    if (!Array.isArray(a.servicos) || !a.servicos.length || a.servicos.some(s => !ctx.Contas.SERVICOS[s])) e(o, 'serviços: ' + Object.keys(ctx.Contas.SERVICOS).join(', '));
    const p = a.pcmso || {};
    txt(p.coordenador, o + '.pcmso', 'médico coordenador'); txt(p.crm, o + '.pcmso', 'CRM do coordenador');
    if (!p.aprovadoEm || isNaN(new Date(p.aprovadoEm))) e(o + '.pcmso', 'data de aprovação do PCMSO (AAAA-MM-DD)');
    (d.empresas || []).forEach((m, i) => {
      const oe = `empresas[${i}]`;
      if (!ID.test(m.id || '')) e(oe, 'id com letras minúsculas, números e hífen');
      if (empresasArquivo.has(m.id)) e(oe, 'id repetido');
      empresasArquivo.add(m.id);
      txt(m.nome, oe, 'nome'); txt(m.contato, oe, 'contato');
      if (!cnpjValido(m.cnpj)) e(oe, 'CNPJ inválido');
      if (!R.telValido(m.tel)) e(oe, 'telefone inválido');
      if (![1, 2, 3, 4].includes(m.grauRisco)) e(oe, 'grau de risco de 1 a 4 (NR-4)');
      if (!Array.isArray(m.funcoes) || !m.funcoes.length) e(oe, 'pelo menos uma função');
      (m.funcoes || []).forEach((f, j) => {
        const of = `${oe}.funcoes[${j}]`;
        if (!ID.test(f.id || '')) e(of, 'id com letras minúsculas, números e hífen');
        txt(f.nome, of, 'nome'); txt(f.setor, of, 'setor');
        if (!Array.isArray(f.riscos) || f.riscos.some(r => !N.RISCOS[r])) e(of, 'riscos: ' + Object.keys(N.RISCOS).join(', '));
        /* o exame vem do protocolo do PCMSO, escrito aqui pela clínica; nunca é deduzido do risco */
        if (!Array.isArray(f.exames) || !f.exames.length || f.exames.some(x => !R.CATALOGO[x])) e(of, 'exames do protocolo: ' + Object.keys(R.CATALOGO).join(', '));
        else if (!f.exames.includes('clinico')) e(of, 'o protocolo precisa ter o exame clínico (NR-7)');
        if (!Number.isInteger(f.periodicidade) || f.periodicidade < 1 || f.periodicidade > 24) e(of, 'periodicidade em meses, de 1 a 24');
      });
    });
  } else if ((d.empresas || []).length) e('empresas', 'empresa precisa vir junto da agência');
  const logins = new Set();
  (d.usuarios || []).forEach((u, i) => {
    const ou = `usuarios[${i}]`;
    if (!LOGIN.test(u.login || '')) e(ou, 'login de 3 a 60 caracteres: letras minúsculas, números, ponto, hífen');
    if (logins.has(u.login)) e(ou, 'login repetido');
    logins.add(u.login);
    txt(u.nome, ou, 'nome', 120);
    if (!['admin', 'clinica', 'rh'].includes(u.tipo)) e(ou, 'tipo: admin, clinica ou rh');
    if (u.tipo === 'clinica') {
      if (!d.agencia) e(ou, 'conta da clínica precisa vir junto da agência');
      if (!['recepcao', 'medico'].includes(u.papel)) e(ou, 'papel: recepcao ou medico');
      if (u.papel === 'medico' && !/^CRM-[A-Z]{2} \d{4,7}$/.test(u.crm || '')) e(ou, 'CRM no formato CRM-SP 123456');
    }
    if (u.tipo === 'rh' && !empresasArquivo.has(u.empresa) && !existentes.empresas.has(u.empresa)) e(ou, 'empresa do RH não encontrada');
  });
  return erros;
}

async function cadastro(arquivo) {
  if (!arquivo) sair('informe o arquivo: node servidor/conta.mjs cadastro piloto.json');
  let d; try { d = JSON.parse(readFileSync(arquivo, 'utf8')); } catch (e) { sair('não consegui ler o JSON: ' + e.message); }
  const existentes = {
    empresas: new Set(consultar('SELECT id FROM empresas', alvo).map(x => x.id)),
    usuarios: new Map(consultar('SELECT login, tipo, agencia_id, empresa_id FROM usuarios', alvo).map(x => [x.login, x])),
    agencias: new Set(consultar('SELECT id FROM agencias', alvo).map(x => x.id))
  };
  const erros = conferir(d, existentes);
  if (erros.length) { console.error('Nada foi gravado. Corrija o arquivo:'); erros.forEach(x => console.error('  - ' + x)); process.exit(1); }

  const L = [], agora = new Date().toISOString(), novas = [];
  if (d.agencia) {
    const a = d.agencia;
    /* empresa de outra agência com o mesmo id: não deixa mudar de dono */
    for (const m of d.empresas || []) if (existentes.empresas.has(m.id)) {
      const dono = consultar(`SELECT agencia_id FROM empresas WHERE id = '${m.id}'`, alvo)[0];
      if (dono && dono.agencia_id !== a.id) sair(`a empresa ${m.id} já é de outra agência (${dono.agencia_id}).`);
    }
    L.push(insercao('agencias', { id: a.id, nome: R.texto(a.nome, 160), cidade: R.texto(a.cidade, 160), contato: R.texto(a.contato, 160), tel: R.mascaraTel(a.tel), situacao: a.situacao || 'implantacao', servicos: JSON.stringify(a.servicos), endereco: R.texto(a.endereco, 300), horario: R.texto(a.horario, 300), pcmso: JSON.stringify({ coordenador: R.texto(a.pcmso.coordenador, 160), crm: R.texto(a.pcmso.crm, 40), aprovadoEm: new Date(a.pcmso.aprovadoEm).toISOString() }), criado_em: agora },
      'ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, cidade = excluded.cidade, contato = excluded.contato, tel = excluded.tel, situacao = excluded.situacao, servicos = excluded.servicos, endereco = excluded.endereco, horario = excluded.horario, pcmso = excluded.pcmso'));
    if (!existentes.agencias.has(a.id)) AUTOMACOES.forEach((x, i) => L.push(insercao('automacoes', { agencia_id: a.id, id: x.id, nome: x.nome, quando: x.quando, para: x.para, ativo: 1, ordem: i })));
    for (const m of d.empresas || []) {
      L.push(insercao('empresas', { id: m.id, agencia_id: a.id, nome: R.texto(m.nome, 160), cnpj: mascaraCnpj(m.cnpj), contato: R.texto(m.contato, 160), tel: R.mascaraTel(m.tel), grau_risco: m.grauRisco },
        'ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, cnpj = excluded.cnpj, contato = excluded.contato, tel = excluded.tel, grau_risco = excluded.grau_risco'));
      for (const f of m.funcoes) L.push(insercao('funcoes', { id: f.id, empresa_id: m.id, nome: R.texto(f.nome, 160), setor: R.texto(f.setor, 160), riscos: JSON.stringify(f.riscos), exames: JSON.stringify(f.exames), periodicidade: f.periodicidade },
        'ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, setor = excluded.setor, riscos = excluded.riscos, exames = excluded.exames, periodicidade = excluded.periodicidade'));
    }
  }
  for (const u of d.usuarios || []) {
    const campos = { nome: R.texto(u.nome, 120), tipo: u.tipo, papel: u.tipo === 'clinica' ? u.papel : '', crm: u.papel === 'medico' ? u.crm : '', agencia_id: u.tipo === 'clinica' ? d.agencia.id : null, empresa_id: u.tipo === 'rh' ? u.empresa : null };
    if (existentes.usuarios.has(u.login)) {
      const x = existentes.usuarios.get(u.login);
      if (x.tipo !== campos.tipo || (x.agencia_id || null) !== campos.agencia_id || (x.empresa_id || null) !== campos.empresa_id) sair(`a conta ${u.login} já existe com outro vínculo (${x.tipo}, ${x.agencia_id || x.empresa_id || 'Nexus Safe'}). Use outro login.`);
      L.push(`UPDATE usuarios SET ${Object.entries(campos).map(([k, v]) => `${k} = ${v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`}`).join(', ')} WHERE login = '${u.login}';`);
    } else {
      const senha = senhaAleatoria();
      L.push(insercao('usuarios', { login: u.login, ...campos, senha: await hashSenha(senha) }));
      novas.push([u.login, senha]);
    }
  }
  executarLinhas(L, alvo);
  console.log(`Gravado no banco ${alvo.remoto ? 'da Cloudflare' : 'local'}: ${d.agencia ? `agência ${d.agencia.id}, ${(d.empresas || []).length} empresa(s), ${(d.empresas || []).reduce((t, m) => t + m.funcoes.length, 0)} função(ões), ` : ''}${(d.usuarios || []).length} conta(s).`);
  if (novas.length) {
    console.log('\nSenhas das contas novas (aparecem só agora; entregue cada uma à pessoa, em mãos ou por mensagem que some):');
    for (const [l, s] of novas) console.log(`  ${l}: ${s}`);
  }
}

async function senha(login) {
  const u = consultar(`SELECT id FROM usuarios WHERE login = '${String(login).replace(/'/g, "''")}'`, alvo)[0];
  if (!u) sair('conta não encontrada: ' + login);
  const nova = senhaAleatoria();
  executarLinhas([`UPDATE usuarios SET senha = '${await hashSenha(nova)}', falhas = 0, bloqueado_ate = NULL WHERE id = ${u.id};`, `DELETE FROM sessoes WHERE usuario_id = ${u.id};`, `INSERT INTO auditoria (em, usuario_id, acao, alvo, ip) VALUES ('${new Date().toISOString()}', ${u.id}, 'senha-trocada', 'linha de comando', '');`], alvo);
  console.log(`Senha nova de ${login} (aparece só agora): ${nova}\nAs sessões abertas dessa conta caíram.`);
}

function ativo(login, valor) {
  const u = consultar(`SELECT id FROM usuarios WHERE login = '${String(login).replace(/'/g, "''")}'`, alvo)[0];
  if (!u) sair('conta não encontrada: ' + login);
  executarLinhas([`UPDATE usuarios SET ativo = ${valor} WHERE id = ${u.id};`, `DELETE FROM sessoes WHERE usuario_id = ${u.id};`, `INSERT INTO auditoria (em, usuario_id, acao, alvo, ip) VALUES ('${new Date().toISOString()}', ${u.id}, '${valor ? 'conta-reativada' : 'conta-desativada'}', 'linha de comando', '');`], alvo);
  console.log(valor ? `${login} pode entrar de novo.` : `${login} não entra mais. As sessões abertas caíram.`);
}

if (cmd === 'cadastro') await cadastro(arg);
else if (cmd === 'senha' && arg) await senha(arg);
else if (cmd === 'desativar' && arg) ativo(arg, 0);
else if (cmd === 'reativar' && arg) ativo(arg, 1);
else { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\* ?/, '')); process.exit(cmd ? 1 : 0); }
