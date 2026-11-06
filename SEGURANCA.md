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
- No envio, o servidor grava a assinatura: data e hora do relógio dele, IP e navegador de quem enviou. A equipe médica vê a data e o IP junto da ficha.

**Ficha cifrada.** A ficha e o rascunho são gravados com AES-GCM. A chave `FICHA_CHAVE` fica fora do código e do banco. Cada registro é amarrado ao próprio atendimento, então uma ficha copiada para outro atendimento não abre.

**Trilha.** A tabela `auditoria` registra login, login errado e cada vez que a equipe médica abre uma ficha. Uma tentativa barrada não conta como ficha aberta.

**Arquivos internos.** O Worker responde 404 para código do servidor, `.dev.vars`, configuração, `.md`, `.sql`, testes e `node_modules`. O `.assetsignore` também impede que esses arquivos subam.

Tudo isso é conferido pelo `npm run test:servidor` (veja abaixo).

## Rodar no computador

```
npm install
node -e "console.log('FICHA_CHAVE=' + require('crypto').randomBytes(32).toString('base64'))" > .dev.vars
npx wrangler d1 migrations apply nexus-safe --local
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
npx wrangler d1 migrations apply nexus-safe --remote
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" | npx wrangler secret put FICHA_CHAVE
npx wrangler deploy
```

Guarde a `FICHA_CHAVE` num lugar seguro fora do computador. Sem ela, nenhuma ficha gravada volta a abrir.

Mudança de tabela depois de publicado: crie `servidor/migracoes/000N_o-que-muda.sql` e rode `npx wrangler d1 migrations apply nexus-safe --remote`. Nunca edite uma migração que já foi aplicada.

## Cadastrar a agência piloto e as contas

Copie `servidor/piloto.exemplo.json`, troque pelos dados reais da agência, das empresas, das funções (riscos e exames do protocolo do PCMSO) e das pessoas, e rode:

```
node servidor/conta.mjs cadastro piloto.json --remote
```

- O script confere o arquivo inteiro antes de gravar: CNPJ com dígito, telefone, CRM, riscos e exames que o sistema conhece, exame clínico em todo protocolo (NR-7). Com qualquer erro, nada é gravado.
- Cada conta nova ganha uma senha aleatória de 16 caracteres, que aparece **só nessa tela**. Entregue cada uma à pessoa por um caminho seguro e não guarde em arquivo.
- Rodar o mesmo arquivo de novo atualiza nomes, empresas e protocolos, mas não troca senha. Uma conta que já existe não muda de agência nem de empresa.
- Guarde o JSON da agência fora do Git: ele tem nome, CNPJ e telefone de cliente.

Senha esquecida, saída de funcionário e volta:

```
node servidor/conta.mjs senha <login> --remote       # senha nova; as sessões abertas caem
node servidor/conta.mjs desativar <login> --remote   # não entra mais
node servidor/conta.mjs reativar <login> --remote
```

Tudo isso fica na tabela `auditoria`.

## Backup

```
read -sx NEXUS_BACKUP_SENHA                       # no fish; no bash: read -rs NEXUS_BACKUP_SENHA; export NEXUS_BACKUP_SENHA
node servidor/backup.mjs fazer --remote            # grava ~/Backups/Nexus Safe/nexus-safe-AAAAMMDD-HHMM.nsbak
node servidor/backup.mjs testar <arquivo.nsbak>    # restaura num banco descartável e confere tabela por tabela
```

- O arquivo sai cifrado com AES-256-GCM, com a chave tirada da senha de backup (scrypt). Senha errada ou arquivo alterado: não abre.
- Dentro dele, as fichas continuam cifradas também com a `FICHA_CHAVE`. Para restaurar uma ficha são precisas **as duas**: a senha do backup e a `FICHA_CHAVE`. Guarde as duas, separadas uma da outra e longe dos backups.
- O cabeçalho do arquivo mostra, sem cifra, a data e quantos registros cada tabela tinha. Nenhum nome, nenhuma resposta.
- Restauração de verdade: `node servidor/backup.mjs abrir <arquivo.nsbak> banco.sql`, depois `npx wrangler d1 execute nexus-safe --remote --file banco.sql` num banco novo, e apague o `banco.sql` em seguida.

Para rodar todo dia, um temporizador do systemd do próprio usuário (comandos para você rodar; o script não mexe no sistema). O caminho do Node é o desta máquina (`which node`):

```
mkdir -p ~/.config/systemd/user
printf '[Service]\nType=oneshot\nWorkingDirectory=%h/www/Nexus Safe\nEnvironmentFile=%h/.config/nexus-safe-backup.env\nEnvironment=PATH=%h/.local/lib/node/bin:/usr/bin:/bin\nExecStart=%h/.local/lib/node/bin/node servidor/backup.mjs fazer --remote\n' > ~/.config/systemd/user/nexus-backup.service
printf '[Timer]\nOnCalendar=*-*-* 03:00\nPersistent=true\n[Install]\nWantedBy=timers.target\n' > ~/.config/systemd/user/nexus-backup.timer
printf 'NEXUS_BACKUP_SENHA=troque-por-uma-senha-longa\n' > ~/.config/nexus-safe-backup.env && chmod 600 ~/.config/nexus-safe-backup.env
systemctl --user daemon-reload && systemctl --user enable --now nexus-backup.timer
```

Isso grava no computador. Para ficar **fora** dele também, a pasta `~/Backups/Nexus Safe` precisa ir para um segundo lugar (HD externo, outro serviço de nuvem). Essa escolha é sua.

## Troca da chave das fichas

Cada ficha, rascunho e token guarda o número da chave que o cifrou (`v2:NUMERO:...`). A chave atual é `FICHA_CHAVE` (número em `FICHA_CHAVE_NUM`, padrão 1). Na troca, a anterior fica em `FICHA_CHAVE_ANTIGA` (número em `FICHA_CHAVE_ANTIGA_NUM`, padrão o da atual menos 1), só para abrir o que ainda não foi recifrado. Registros no formato antigo (`v1:`) abrem com qualquer uma das duas.

1. `node servidor/chave.mjs nova` imprime a chave nova. Guarde-a fora do computador, como a primeira.
2. No servidor: `wrangler secret put FICHA_CHAVE_ANTIGA` (a que estava em uso) e `wrangler secret put FICHA_CHAVE` (a nova); ponha `FICHA_CHAVE_NUM=2` e `FICHA_CHAVE_ANTIGA_NUM=1` nas variáveis do `wrangler.jsonc` e rode `npx wrangler deploy`. Daqui em diante tudo que for gravado já usa a chave nova.
3. No computador, com as mesmas quatro variáveis no ambiente: `node servidor/chave.mjs recifrar --remote`. Ele abre cada registro com a chave certa e grava com a nova. Se algum não abrir, nada é alterado.
4. Abra uma ficha na tela para conferir. Só então apague `FICHA_CHAVE_ANTIGA` do servidor e guarde a antiga por mais um tempo junto dos backups antigos (eles ainda dependem dela).

## O que ainda falta antes de dado real

1. **Onde o backup fica fora do computador** e quem testa a restauração todo mês (o script já faz backup e teste; falta escolher o segundo lugar e ligar o temporizador).
2. **A pessoa trocar a própria senha** pela tela. Hoje a troca é pelo `conta.mjs senha`, feita pela Nexus Safe.
3. **Guarda de 20 anos (NR-7).** Nada é apagado hoje, mas falta a regra de arquivamento e de quem acessa a ficha arquivada depois do ASO.
4. **WhatsApp de verdade.** As mensagens só entram na fila da tabela `mensagens`. Nada é enviado.
5. **Domínio próprio e HTTPS**: a Cloudflare dá o HTTPS, mas o domínio ainda não existe.
7. Revisão do texto da LGPD e do questionário pelo médico do trabalho da agência piloto (decisão em aberto nº 3 do plano).
