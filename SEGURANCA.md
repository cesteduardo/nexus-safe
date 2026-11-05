# Segurança do servidor

O site tem dois modos, com as mesmas telas e as mesmas regras (`crm/regras.js`):

- **Demonstração** (GitHub Pages): tudo no `localStorage` do navegador, dados fictícios, senha 123.
- **Servidor** (Cloudflare Worker + banco D1, `servidor/index.js`): os dados ficam no banco, e é o servidor que decide o que cada perfil recebe. O Worker entrega um `crm/modo.js` próprio, que liga esse modo e esconde o que só vale para a demonstração.

## O que o servidor garante

**Quem vê o quê.** A permissão é conferida no servidor, não só escondida na tela.
- Recepção: cadastro, etapa, agenda e ASO. Nunca a ficha nem o rascunho.
- Equipe médica: tudo da recepção e a ficha decifrada, enquanto o exame está em andamento (ficha recebida, agendado, atendido).
- RH da empresa: só os funcionários da própria empresa, sem ficha e sem histórico. Pode pedir exame, e só para a própria empresa.
- Administração da Nexus Safe: agências, contagens do mês e chamados. Nenhum atendimento, nenhuma resposta de saúde.

**Senha e sessão.**
- Senha com PBKDF2-SHA256, 100 mil voltas e sal próprio. A senha nunca é gravada.
- Sessão num cookie `__Host-ns` com HttpOnly, Secure e SameSite=Strict. Vale 12 horas. O banco guarda só o hash do token.
- Cinco senhas erradas bloqueiam a conta por 15 minutos. Também há limite de tentativas por IP.
- Toda gravação precisa vir do próprio site (o cabeçalho Origin é conferido), o que barra pedidos forjados de outro site.

**Link da ficha.**
- O token tem 32 bytes aleatórios. O banco guarda o hash, mais uma cópia cifrada para a recepção poder reenviar o mesmo link.
- O link expira em 7 dias, trava depois do envio e tem limite de acessos por IP.
- O rascunho é salvo no servidor a cada campo alterado, para o candidato continuar de onde parou.

**Ficha cifrada.** A ficha e o rascunho são gravados com AES-GCM. A chave `FICHA_CHAVE` fica fora do código e do banco. Cada registro é amarrado ao próprio atendimento, então uma ficha copiada para outro atendimento não abre.

**Trilha.** A tabela `auditoria` registra login, login errado e cada vez que a equipe médica abre uma ficha. Uma tentativa barrada não conta como ficha aberta.

**Arquivos internos.** O Worker responde 404 para código do servidor, `.dev.vars`, configuração, `.md`, `.sql`, testes e `node_modules`. O `.assetsignore` também impede que esses arquivos subam.

Tudo isso é conferido pelo `npm run test:servidor` (veja abaixo).

## Rodar no computador

```
npm install
node -e "console.log('FICHA_CHAVE=' + require('crypto').randomBytes(32).toString('base64'))" > .dev.vars
npx wrangler d1 execute nexus-safe --local --file servidor/esquema.sql
node servidor/semente.mjs
npx wrangler d1 execute nexus-safe --local --file servidor/.semente.sql
npx wrangler dev --port 8790 --ip 127.0.0.1
```

Depois é só abrir http://127.0.0.1:8790/crm/entrar.html. As contas são as da demonstração (`clinica`, `medico`, `admin`, `rh.metalurgica`...), com senha 123. A semente mostra os links de ficha em aberto.

Teste, com o `wrangler dev` rodando em outro terminal:

```
CHROME=/caminho/do/chrome npm run test:servidor
```

O teste zera o banco **local** com os dados da demonstração. Ele se recusa a rodar contra um endereço que não seja 127.0.0.1 ou localhost.

## Publicar na Cloudflare (quando houver piloto)

Ainda não foi publicado. Para subir:

```
npx wrangler d1 create nexus-safe          # copie o database_id para o wrangler.jsonc
npx wrangler d1 execute nexus-safe --remote --file servidor/esquema.sql
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" | npx wrangler secret put FICHA_CHAVE
npx wrangler deploy
```

Guarde a `FICHA_CHAVE` num lugar seguro fora do computador. Sem ela, nenhuma ficha gravada volta a abrir.

## O que ainda falta antes de dado real

1. **Contas reais.** A `semente.mjs` só serve para teste: ela usa os dados fictícios. Falta uma forma de cadastrar a agência piloto, as empresas, as funções e as contas com senha de cada pessoa.
2. **Backup diário cifrado fora da Cloudflare**, com teste de restauração (o plano promete). O D1 tem o Time Travel de 30 dias, mas isso não substitui o backup.
3. **Guarda de 20 anos (NR-7).** Nada é apagado hoje, mas falta a regra de arquivamento e de quem acessa a ficha arquivada depois do ASO.
4. **WhatsApp de verdade.** As mensagens só entram na fila da tabela `mensagens`. Nada é enviado.
5. **Assinatura da ficha com IP.** O plano pede data, hora e IP no fechamento. Hoje o servidor grava a data do envio, mas não o IP junto da ficha.
6. **Troca da chave das fichas** (rotação), sem perder as fichas antigas.
7. **Domínio próprio e HTTPS**: a Cloudflare dá o HTTPS, mas o domínio ainda não existe.
8. Revisão do texto da LGPD e do questionário pelo médico do trabalho da agência piloto (decisão em aberto nº 3 do plano).
