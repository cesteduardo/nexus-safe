/* Nexus Safe · troca da chave das fichas (rotação).
   Uso:  node servidor/chave.mjs nova                 imprime uma chave nova (32 bytes em base64)
         node servidor/chave.mjs recifrar [--remote]  recifra fichas, rascunhos e tokens com a chave atual
   Antes de recifrar, o ambiente precisa ter as duas chaves:
     FICHA_CHAVE=<a nova>  FICHA_CHAVE_NUM=<número da nova, ex. 2>
     FICHA_CHAVE_ANTIGA=<a que estava em uso>  FICHA_CHAVE_ANTIGA_NUM=<número dela, ex. 1; se faltar, vale o número da nova menos 1>
   Passo a passo completo em SEGURANCA.md, seção "Troca da chave das fichas". */
import { randomBytes } from 'node:crypto';
import { consultar, executarLinhas, alvoDosArgumentos, decifrar, cifrar, numChaveAtual, q } from './ferramentas.mjs';

const [, , cmd, ...resto] = process.argv;
function sair(msg) { console.error('Erro: ' + msg); process.exit(1); }

if (cmd === 'nova') {
  console.log(randomBytes(32).toString('base64'));
} else if (cmd === 'recifrar') {
  const alvo = alvoDosArgumentos(resto);
  const prefixo = `v2:${numChaveAtual()}:`;
  const linhas = [];
  let feitos = 0, jaNovos = 0;
  /* abre com a chave que servir e grava com a atual; o que já está na chave atual fica como está */
  const refazer = async (txt, ad) => {
    if (!txt) return null;
    if (txt.startsWith(prefixo)) { jaNovos++; return null; }
    const novo = await cifrar(await decifrar(txt, ad), ad);
    feitos++;
    return novo;
  };
  try {
    for (const f of consultar('SELECT atendimento_id, ficha, rascunho FROM fichas', alvo)) {
      const ficha = await refazer(f.ficha, 'ficha:' + f.atendimento_id), rasc = await refazer(f.rascunho, 'rascunho:' + f.atendimento_id);
      if (ficha) linhas.push(`UPDATE fichas SET ficha = ${q(ficha)} WHERE atendimento_id = ${q(f.atendimento_id)};`);
      if (rasc) linhas.push(`UPDATE fichas SET rascunho = ${q(rasc)} WHERE atendimento_id = ${q(f.atendimento_id)};`);
    }
    for (const l of consultar('SELECT token_hash, atendimento_id, token_cifrado FROM links', alvo)) {
      const t = await refazer(l.token_cifrado, 'token:' + l.atendimento_id);
      if (t) linhas.push(`UPDATE links SET token_cifrado = ${q(t)} WHERE token_hash = ${q(l.token_hash)};`);
    }
  } catch (e) { sair('não abriu um registro (' + e.message + '). Nada foi alterado. Confira se FICHA_CHAVE_ANTIGA é a chave que estava em uso.'); }
  if (linhas.length) executarLinhas(linhas, alvo);
  console.log(`Recifrados com a chave ${numChaveAtual()}: ${feitos}. Já estavam nela: ${jaNovos}.`);
  console.log('Confira abrindo uma ficha na tela. Só depois tire a FICHA_CHAVE_ANTIGA do servidor.');
} else sair('use "nova" ou "recifrar [--remote]".');
