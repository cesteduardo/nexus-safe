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

## Correções e base
- [x] Ficha: salvar o rascunho a cada campo alterado (hoje só salva ao avançar de passo), para não perder nada se o candidato fechar o navegador no meio.
- [x] Ficha: validar CPF do contato e data de nascimento (não aceitar data futura nem idade abaixo de 14 anos) com mensagem clara.
- [x] Ficha: máscara de telefone no contato de emergência, igual à do cadastro no CRM.
- [x] Formulários no padrão GR Brands 2 (`crm/campos.js`): nome só com letras, telefone sem +55 e com DDD 55 preservado, CPF com dígito verificador, limpeza ao digitar e ao colar, erro junto ao campo e foco no primeiro inválido.
- [ ] Painel do atendimento: prender o foco do teclado dentro do painel aberto e devolver o foco ao cartão ao fechar (acessibilidade).
- [ ] Ficha: texto completo do consentimento LGPD num "ler termo completo" que abre e fecha, sem sair da ficha.

## A recepção trabalha pelo quadro
- [x] Faixa "Para fazer agora" no topo do quadro: cobrar a ficha, agendar exame, exames até amanhã, emitir ASO. Cada uma filtra o quadro. As 6 colunas cabem na tela a partir de 1200 px.
- [ ] Guardar `etapaDesde` em cada atendimento (data em que entrou na etapa atual; subir a versão em `CHAVE` e `versao`) e mostrar no cartão "Parado há N dias" em âmbar quando passar de 2 dias na mesma etapa.
- [ ] Botão "Cobrar no WhatsApp" no próprio cartão de quem está na tarefa "Cobrar a ficha", com a mensagem "falta terminar sua ficha" pronta. Ao clicar, registra no histórico e entra na fila de mensagens.
- [ ] No painel, "Próximo passo" de quem está agendado para hoje ou amanhã: botão "Confirmar presença no WhatsApp" com o horário e o preparo.
- [ ] No celular (até 600 px), o quadro vira uma lista por etapa com abas no topo (Link enviado, Preenchendo...), sem rolagem lateral dentro do quadro.
- [ ] Quadro: filtro por tipo de exame (admissional, periódico, retorno, mudança de riscos, demissional).

## Mostrar o que o plano promete
- [ ] Link da ficha com validade de 7 dias: guardar `expiraEm`, mostrar "Link expirado, peça outro à clínica" e, no CRM, botão "Gerar novo link" que invalida o anterior.
- [ ] Trilha de acesso simulada: registrar no histórico quando a visão médica abre a ficha ("Ficha aberta por Dra. Camila Rocha") e mostrar isso na visão médica.
- [ ] Visão do RH da empresa cliente: página `crm/empresa.html?e=ID` listando só os atendimentos daquela empresa, com etapa e botão do ASO, sem nenhum dado de saúde.
- [ ] Agenda do dia: aba "Agenda" com os exames agendados por horário e o preparo de cada um.
- [ ] Versão para imprimir da ficha preenchida (só na visão médica), no mesmo padrão do ASO.
- [ ] Automações: botão "Rodar automações agora" que gera na fila o lembrete da véspera para quem tem exame amanhã e o aviso de periódico para ASO vencendo em 30 dias.
- [ ] Cadastros: permitir criar empresa e função (com riscos e protocolo de exames) no modelo, guardando no localStorage.

## Plano (index.html)
- [ ] Seção "Veja por dentro" com 3 imagens reais do modelo (quadro com a faixa "Para fazer agora", ficha no celular, ASO), geradas por captura de tela do próprio site e salvas em `assets/telas/`.
- [ ] Revisar o texto do plano inteiro: frases longas, repetição, termos técnicos sem explicação. Sem travessões.

## Esperando decisão do dono
- [x] Logo: o dono pediu para melhorar o NS de traço contínuo (04/11). A diagonal agora vira a base do S em curva, o miolo do N abriu e as curvas passam um pouco da linha. Trocado em todos os lugares, com og.png e apple-touch-icon novos.
- [ ] **(aguarda o dono)** Questionário configurável por agência (decisão em aberto nº 2 do plano).
- [ ] **(aguarda o dono)** Valores do comercial.
