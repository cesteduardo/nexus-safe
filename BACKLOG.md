# Backlog

Em ordem de prioridade. A cada rodada, pegue o **primeiro item sem marcar**, faça, teste,
marque com `[x]` e anote em `HISTORICO.md`. Item grande demais para uma hora: divida em
subitens aqui mesmo e faça só o primeiro. Itens com **(aguarda o dono)** não se fazem sozinhos: pule.

## Correções e base
- [ ] Ficha: salvar o rascunho a cada campo alterado (hoje só salva ao avançar de passo), para não perder nada se o candidato fechar o navegador no meio.
- [ ] Ficha: validar CPF do contato e data de nascimento (não aceitar data futura nem idade abaixo de 14 anos) com mensagem clara.
- [ ] Ficha: máscara de telefone no contato de emergência, igual à do cadastro no CRM.
- [ ] Painel do atendimento: prender o foco do teclado dentro do painel aberto e devolver o foco ao cartão ao fechar (acessibilidade).
- [ ] Ficha: texto completo do consentimento LGPD num "ler termo completo" que abre e fecha, sem sair da ficha.

## Mostrar o que o plano promete
- [ ] Link da ficha com validade de 7 dias: guardar `expiraEm`, mostrar "Link expirado, peça outro à clínica" e, no CRM, botão "Gerar novo link" que invalida o anterior.
- [ ] Trilha de acesso simulada: registrar no histórico quando a visão médica abre a ficha ("Ficha aberta por Dra. Camila Rocha") e mostrar isso na visão médica.
- [ ] Versão para imprimir da ficha preenchida (só na visão médica), no mesmo padrão do ASO.
- [ ] Visão do RH da empresa cliente: página `crm/empresa.html?e=ID` listando só os atendimentos daquela empresa, com etapa e botão do ASO, sem nenhum dado de saúde.
- [ ] Agenda do dia: aba "Agenda" com os exames agendados por horário e o preparo de cada um.
- [ ] Automações: botão "Rodar automações agora" que gera na fila o lembrete da véspera para quem tem exame amanhã e o aviso de periódico para ASO vencendo em 30 dias.
- [ ] Cadastros: permitir criar empresa e função (com riscos e protocolo de exames) no modelo, guardando no localStorage.
- [ ] Quadro: filtro por tipo de exame e um resumo no topo (quantos em cada etapa, quantos com ponto de atenção).

## Plano (index.html)
- [ ] Seção "Veja por dentro" com 3 imagens reais do modelo (quadro, ficha no celular, ASO), geradas por captura de tela do próprio site e salvas em `assets/telas/`.
- [ ] Revisar o texto do plano inteiro: frases longas, repetição, termos técnicos sem explicação. Sem travessões.

## Esperando decisão do dono
- [ ] **(aguarda o dono)** Trocar a logo pela opção escolhida em `marca/` (topo, CRM, ficha, ASO, favicon, apple-touch-icon, og.png).
- [ ] **(aguarda o dono)** Questionário configurável por agência (decisão em aberto nº 2 do plano).
- [ ] **(aguarda o dono)** Valores do comercial.
