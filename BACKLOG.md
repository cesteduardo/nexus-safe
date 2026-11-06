# Backlog

Em ordem de prioridade. A cada rodada, pegue o **primeiro item sem marcar**, faça, teste,
marque com `[x]` e anote em `HISTORICO.md`. Item grande demais para uma hora: divida em
subitens aqui mesmo e faça só o primeiro. Itens com **(aguarda o dono)** não se fazem sozinhos: pule.

## Rumo (plano de 04/11)

O modelo já mostra o caminho inteiro, do link ao ASO. Agora ele precisa mostrar duas coisas
para quem vai comprar:

1. **A recepção trabalha pelo quadro.** Ao abrir o CRM, a pessoa vê o que fazer agora e faz
   com um toque: cobrar quem não preencheu, agendar, confirmar, emitir o ASO.
2. **O que o plano promete existe de verdade.** Link que expira, trilha de acesso, visão do RH,
   agenda, impressão. Cada promessa do `index.html` precisa ter uma tela que a prove.

Por isso a ordem é: base da ficha, depois o trabalho da recepção, depois as promessas do plano,
e por último o texto e as imagens do plano.

## Mercado (pesquisa de 05/11, ver PESQUISA.md)
- [x] Admissão prevista no cadastro, aviso de admissão em risco ou atrasada, S-2220 com prazo, aba de periódicos (avisar o RH e convocar), demissional dispensável pela NR-7, ordem de chegada na agenda.
- [x] Chamados com metas de resposta e solução por prioridade, fila ordenada, conversa nos dois sentidos, aguardando a clínica, responsável, canal, avaliação e reabertura.
- [x] Guia de encaminhamento em PDF para o RH entregar ao funcionário (empresa, função, exames do protocolo, preparo, endereço da clínica).
- [x] Chamados: pausar o relógio do prazo enquanto o chamado aguarda a clínica, e mostrar isso no cartão.
- [x] Chamados: escalonar para segundo nível, com motivo, e indicador de quantos foram escalonados.
- [x] S-2220: gerar o XML do evento a partir do ASO (modelo, sem transmitir), com download.
- [x] Retorno ao trabalho: no cadastro, pedir a data de início do afastamento e avisar se for menos de 30 dias (não precisa do exame).

## Perfis
- [x] Login de verdade no modelo (`crm/entrar.html`): contas admin, clinica (recepção), medico e uma de RH por empresa, senha 123; páginas protegidas, Sair, RH preso à própria empresa. Painéis abrem em pop-up no centro (folha de baixo no celular).
- [x] Três perfis com tela de entrada (`crm/entrar.html`): administração da Nexus Safe (agências, contrato, uso, chamados de TI), clínica (o CRM, com aba de suporte) e RH da empresa (só os próprios funcionários, pedido de exame e ASO). Nenhum dos dois de fora vê dado de saúde.
- [x] Perfis dentro da clínica: recepção vê cadastro, etapa e agenda; só a equipe médica vê a ficha e os pontos de atenção. Trocar o botão "Equipe médica / Empresa cliente" do painel pelo perfil de quem entrou.
- [x] Administração no celular: a tabela de agências vira uma lista de cartões até 600 px.
- [x] Administração: cadastrar agência nova (nome, cidade, contato com telefone no padrão, serviços, situação).
- [x] Plano (index.html): seção curta "Três perfis" com o que cada um vê, ligando para `crm/entrar.html`.

## Correções e base
- [x] Ficha: salvar o rascunho a cada campo alterado (hoje só salva ao avançar de passo), para não perder nada se o candidato fechar o navegador no meio.
- [x] Ficha: validar CPF do contato e data de nascimento (não aceitar data futura nem idade abaixo de 14 anos) com mensagem clara.
- [x] Ficha: máscara de telefone no contato de emergência, igual à do cadastro no CRM.
- [x] Formulários no padrão GR Brands 2 (`crm/campos.js`): nome só com letras, telefone sem +55 e com DDD 55 preservado, CPF com dígito verificador, limpeza ao digitar e ao colar, erro junto ao campo e foco no primeiro inválido.
- [x] Painel do atendimento: prender o foco do teclado dentro do painel aberto e devolver o foco ao cartão ao fechar (acessibilidade).
- [x] Ficha: texto completo do consentimento LGPD num "ler termo completo" que abre e fecha, sem sair da ficha.

## A recepção trabalha pelo quadro
- [x] Faixa "Para fazer agora" no topo do quadro: cobrar a ficha (link enviado antes de hoje), agendar exame, exames até amanhã, emitir ASO. Cada uma filtra o quadro. As 6 colunas cabem na tela a partir de 1200 px.
- [x] Guardar `etapaDesde` em cada atendimento (data em que entrou na etapa atual; subir a versão em `CHAVE` e `versao`) e mostrar no cartão "Parado há N dias" em âmbar quando passar de 2 dias na mesma etapa.
- [x] Botão "Cobrar no WhatsApp" no próprio cartão de quem está na tarefa "Cobrar a ficha", com a mensagem "falta terminar sua ficha" pronta. Ao clicar, registra no histórico e entra na fila de mensagens.
- [x] No painel, "Próximo passo" de quem está agendado para hoje ou amanhã: botão "Confirmar presença no WhatsApp" com o horário e o preparo.
- [x] No celular (até 600 px), o quadro vira uma lista por etapa com abas no topo (Link enviado, Preenchendo...), sem rolagem lateral dentro do quadro.
- [x] Quadro: filtro por tipo de exame (admissional, periódico, retorno, mudança de riscos, demissional).

## Mostrar o que o plano promete
- [x] Link da ficha com validade de 7 dias: guardar `expiraEm`, mostrar "Link expirado, peça outro à clínica" e, no CRM, botão "Gerar novo link" que invalida o anterior.
- [x] Trilha de acesso simulada: registrar no histórico quando a visão médica abre a ficha ("Ficha aberta por Dra. Camila Rocha") e mostrar isso na visão médica.
- [x] Visão do RH da empresa cliente: página `crm/empresa.html?e=ID` listando só os atendimentos daquela empresa, com etapa e botão do ASO, sem nenhum dado de saúde. Também pede exame.
- [x] Agenda do dia: aba "Agenda" com os exames agendados por horário e o preparo de cada um.
- [x] Versão para imprimir da ficha preenchida (só na visão médica), no mesmo padrão do ASO.
- [x] Automações: botão "Rodar automações agora" que gera na fila o lembrete da véspera para quem tem exame amanhã e o aviso de periódico para ASO vencendo em 30 dias.
- [x] Cadastros: permitir criar empresa e função (com riscos e protocolo de exames) no modelo, guardando no localStorage.

## Plano (index.html)
- [ ] Seção "Veja por dentro" com 3 imagens reais do modelo (quadro com a faixa "Para fazer agora", ficha no celular, ASO), geradas por captura de tela do próprio site e salvas em `assets/telas/`.
- [ ] Revisar o texto do plano inteiro: frases longas, repetição, termos técnicos sem explicação. Sem travessões.

## Servidor (antes de dado real, ver SEGURANCA.md)
Estes mexem em `servidor/`: rode também o `npm run test:servidor`.
- [ ] Troca de senha pela própria pessoa: rota `/api/senha` (pede a senha atual, mínimo de 12 caracteres, derruba as outras sessões, registra na auditoria) e um formulário "Trocar senha" nas três telas protegidas, ao lado do Sair. Na demonstração, o formulário avisa que a troca só vale no servidor.
- [ ] Troca da chave das fichas (rotação): aceitar uma chave nova (`FICHA_CHAVE`) e a antiga (`FICHA_CHAVE_ANTIGA`) ao mesmo tempo, com o número da chave gravado na cifra (`v2:`), e um script `servidor/chave.mjs` que recifra fichas, rascunhos e tokens com a chave nova. Teste: ficha antiga abre depois da troca e, sem a chave antiga, continua abrindo.
- [ ] **(aguarda o dono)** Escolher onde o backup fica fora do computador (HD externo ou outro serviço de nuvem) e ligar o backup diário das 3h (comandos do systemd no SEGURANCA.md, seção Backup). Testar a restauração uma vez por mês com `node servidor/backup.mjs testar`.
- [ ] **(aguarda o dono)** Publicar na Cloudflare (SEGURANCA.md, seção "Publicar na Cloudflare"): `npx wrangler login`, criar o banco (`npx wrangler d1 create nexus-safe`) e pôr o `database_id` no `wrangler.jsonc`, aplicar as migrações com `--remote`, criar a `FICHA_CHAVE` com `wrangler secret put` e guardá-la fora do computador, e `npx wrangler deploy`.
- [ ] **(aguarda o dono)** Agência piloto e médico do trabalho que valida a ficha e o texto da LGPD (decisão em aberto nº 3 do plano). Com isso em mãos: copiar `servidor/piloto.exemplo.json` (fora do Git), preencher com os dados reais e rodar `node servidor/conta.mjs cadastro piloto.json --remote`. Entregar cada senha à pessoa por um caminho seguro.
- [ ] **(aguarda o dono)** Domínio próprio para o servidor.

## Esperando decisão do dono
- [x] Logo: o dono pediu para melhorar o NS de traço contínuo (04/11). A diagonal agora vira a base do S em curva, o miolo do N abriu e as curvas passam um pouco da linha. Trocado em todos os lugares, com og.png e apple-touch-icon novos.
- [ ] **(aguarda o dono)** Questionário configurável por agência (decisão em aberto nº 2 do plano).
- [ ] **(aguarda o dono)** Valores do comercial.
