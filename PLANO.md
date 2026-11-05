# Nexus Safe: plano

Plano de 03/11/2026. Nome: Nexus Safe. A versão visual deste plano e o modelo do CRM estão em index.html e crm/ (publicados no GitHub Pages).

Duas coisas andam juntas:

1. **Serviço de TI para agências de SST** (clínicas e consultorias de segurança e saúde do trabalho): consertar impressora, ajustar sistema, automatizar WhatsApp.
2. **Um produto web pequeno**: o candidato preenche a ficha admissional no celular antes do exame e ela chega pronta para a clínica. Por cima, um "CRMzinho" para acompanhar cada candidato até o ASO.

O produto abre a porta do cliente. O serviço de TI paga as contas enquanto o produto cresce.

---

## 1. De onde parte

O sistema que já está na máquina é o **WKSF** (`~/Downloads/WKSF`, mexido por último em 23/08). Ele é um ERP completo: mais de 100 tabelas, PGR, PCMSO, PPP, eSocial, CIPA, APR/PT, portais, IA. Grande demais para vender a uma clínica pequena, e nele a anamnese é só um campo de texto livre (`prontuario_clinico.anamnese`), sem questionário.

**Decisão:** projeto novo e enxuto. Do WKSF a gente **copia peças**, mas não faz fork:

| Peça do WKSF | Para quê |
|---|---|
| `lib/auth.js`, `lib/tenant.js`, `lib/permissoes.js` | login, uma agência por tenant, quem vê o quê |
| `lib/db.js` + `better-sqlite3`, `helmet`, `express-rate-limit`, `express-session` | a mesma base que você já conhece |
| `routes/psicossocial-publico.js` e o `portal_token` | o modelo de **link público com token**, que é exatamente o link da ficha |
| `lib/pdf.js` | PDF da ficha e do ASO |
| Lista de exames em `routes/exames.js` | catálogo inicial de exames complementares |
| `Testes/SOC/` (seus estudos do SOC e concorrentes) | saber o que as clínicas já usam e onde o Nexus Safe se encaixa |

---

## 2. Como funciona (o fluxo)

```
RH da empresa ou recepção da clínica
  cadastra o candidato: nome, CPF, celular, empresa, função
        │
        ▼
Sistema gera um link único  ──►  vai pelo WhatsApp
        │
        ▼
Candidato preenche no celular (10 a 15 min, salva rascunho, pode voltar)
  dados pessoais, histórico de trabalho, saúde, declaração + aceite
        │
        ▼
Clínica recebe a ficha pronta
  já com os exames que a função pede (ex.: altura → acuidade visual, ECG...)
  agenda o exame
        │
        ▼
No dia, o médico abre a ficha em uma tela
  respostas "sim" em destaque, cruzadas com os riscos da função
  complementa, examina, decide apto ou inapto
        │
        ▼
ASO em PDF  ──►  empresa recebe só o status e o ASO
```

### O CRMzinho

Um quadro (kanban) por candidato, uma coluna por etapa:

**Link enviado → Preenchendo → Ficha recebida → Agendado → Atendido → ASO emitido**

Mais três cadastros simples: **empresas clientes**, **funções** (com os riscos e os exames de cada uma) e **profissionais** (médico, enfermagem, recepção). Nada de PGR completo, GHE, eSocial nessa primeira versão.

### Perfis

Três perfis, cada um vendo só o que é dele:

| Perfil | Quem é | O que vê |
|---|---|---|
| Administração | A Nexus Safe, que oferece o serviço | Agências clientes, serviços contratados, uso do mês, chamados de TI. Nunca abre ficha nem resposta de saúde. |
| Clínica | A agência de SST, cliente da Nexus Safe | Quadro de atendimentos, ficha, visão médica, ASO, automações e pedidos de suporte. |
| RH da empresa | O cliente da agência | Os próprios funcionários: etapa, data do exame, pedido de exame e ASO, sem diagnóstico. |

---

## 3. O que vai na ficha

Uma página por bloco no celular, com barra de progresso. Perguntas fechadas sempre que der (sim/não, lista), com campo "detalhe" que só abre quando a resposta é "sim".

**Vem preenchido pelo link (o candidato só confere):** empresa, função, setor, data prevista de admissão, tipo de exame (admissional).

1. **Dados pessoais:** nome, nome social, CPF, RG/CIN, nascimento, sexo, estado civil, escolaridade, celular, e-mail, endereço, contato de emergência, PcD (qual).
2. **Histórico de trabalho:** empregos anteriores (empresa, função, período) e, em cada um, a que esteve exposto: ruído, poeira, produto químico, calor, frio, vibração, radiação, agente biológico, altura, espaço confinado, eletricidade. Usava EPI? Já sofreu acidente de trabalho? Teve CAT? Afastamento pelo INSS? Doença ocupacional? Foi readaptado?
3. **Saúde atual e passada:** pressão alta, diabetes, coração, asma/bronquite, convulsão/epilepsia, desmaio, labirintite/tontura, coluna, LER/DORT, hérnia, varizes, audição, visão (usa óculos/lente), problemas de pele, saúde mental, outras. Cirurgias, internações, fraturas, alergias, remédios de uso contínuo.
4. **Hábitos:** cigarro (quanto, há quanto tempo), álcool, atividade física, sono.
5. **Família:** doenças de pais e irmãos (pressão, diabetes, coração, câncer).
6. **Blocos que só aparecem conforme a função** (vêm do cadastro da função):
   - Ruído: exposição a som alto nas últimas 14 h (orientação de repouso auditivo para a audiometria), zumbido, infecção de ouvido.
   - Altura (NR-35): medo de altura, tontura, convulsão, remédio que dá sono.
   - Espaço confinado (NR-33): falta de ar, claustrofobia.
   - Eletricidade (NR-10), motorista (CNH e categoria), manipulação de alimentos.
7. **Anexos (opcional):** exames anteriores, carteira de vacinação.
8. **Fechamento:** declaração de que as informações são verdadeiras, aceite do tratamento dos dados (texto LGPD), assinatura com o dedo na tela, data, hora e IP gravados.

**O que a ficha NÃO pergunta, por lei:** teste ou declaração de gravidez e esterilização (Lei 9.029/95) e teste de HIV (Portaria MTE 1.927/2014). Se o médico precisar saber algo da saúde da mulher, ele pergunta na consulta, fora do formulário.

**Antes de lançar:** o questionário passa pela mão de um **médico do trabalho** da agência piloto. Cada clínica tem a sua ficha em papel; a primeira coisa a fazer é pedir a delas e montar a versão padrão a partir disso. Melhor ainda: deixar cada agência ligar e desligar perguntas.

---

## 4. Regras que não podem falhar

- **Dado de saúde é dado sensível (LGPD, art. 11).** As respostas de saúde só são vistas pela equipe médica da clínica. A empresa cliente e o RH veem **só** o cadastro, a etapa e o ASO (apto ou inapto, sem diagnóstico). Isso é permissão no servidor, não só tela escondida.
- **O formulário não substitui o médico.** A NR-7 diz que a anamnese faz parte do exame clínico. A ficha é um pré-preenchimento que o médico confere, completa e assina. Escrever isso no produto e no contrato.
- **Guarda:** prontuário fica no mínimo 20 anos após o desligamento (NR-7). Nada se apaga de verdade; registro antigo é arquivado.
- **Link seguro:** token longo e aleatório, vale só para aquela ficha, expira (ex.: 7 dias) e trava depois de enviada. Limite de tentativas por IP.
- **Trilha:** quem abriu qual ficha e quando (o WKSF já tem `lib/log.js` e a tabela `auditoria` para copiar o padrão).
- **Backup diário criptografado**, fora do servidor, com teste de restauração.

---

## 5. Fases

### Fase 0: validar (1 semana)
- Conversar com 2 ou 3 agências. Perguntar: como a ficha é preenchida hoje, quanto tempo leva na recepção, onde trava, que sistema usam (SOC, outro, planilha).
- Pegar as fichas em papel e o modelo de ASO delas.
- Fechar **uma agência piloto** que aceita testar de graça ou com desconto.

### Fase 1: a ficha (MVP, 2 a 3 semanas)
- Login da clínica, cadastro de empresa, função e candidato.
- Geração do link + botão "mandar no WhatsApp" (link `wa.me` com a mensagem pronta; a pessoa da recepção só toca em enviar).
- A ficha no celular, com rascunho salvo, blocos condicionais e assinatura.
- Tela do médico com a ficha resumida e os "sim" em destaque.
- PDF da ficha.
- **Pronto quando:** a piloto faz 10 admissionais reais por ele sem voltar ao papel.

### Fase 2: o CRMzinho (2 semanas)
- Quadro por etapa, filtros por empresa e por data.
- Exames por função gerados sozinhos, agenda simples.
- Emissão do ASO em PDF com os dados da ficha.
- Acesso da empresa cliente: vê a etapa e baixa o ASO.

### Fase 3: WhatsApp de verdade e periódicos
- WhatsApp Cloud API oficial (Meta): link enviado sozinho, lembrete "falta terminar sua ficha", confirmação de horário, ASO entregue. Usar a API oficial, que tem custo por conversa e exige empresa verificada; bibliotecas não oficiais (Baileys, whatsapp-web.js) arriscam banir o número do cliente.
- Ficha de **periódico, retorno ao trabalho, mudança de função e demissional** reaproveitando a mesma ficha.
- Aviso de ASO vencendo.

### Fase 4: só se pedirem
- Exportar o S-2220 do eSocial.
- Importar e exportar para o SOC ou o sistema que a agência usar.
- Aqui pode voltar a reaproveitar mais coisa do WKSF.

---

## 6. O serviço de TI para as agências

Clínica de SST costuma ter: impressora de etiqueta e de ASO dando problema, computador lento na recepção, sistema (SOC e parecidos) mal configurado, backup que ninguém testou, WhatsApp atendido na mão.

**O que oferecer:**

| Serviço | Exemplo |
|---|---|
| Suporte | impressora, rede, Wi-Fi, computador, e-mail profissional, backup |
| Ajuste de sistema | configurar o sistema que eles já usam, modelos de ASO e relatórios, usuários e permissões |
| Automação de WhatsApp | confirmação de agendamento, lembrete de exame na véspera, envio de ASO, aviso de periódico vencendo, cobrança |
| Nexus Safe | o produto deste plano, mensalidade por agência |

**Formato comercial (para você definir os valores):**
- **Visita/diagnóstico** de entrada, que já levanta o que está quebrado e vira proposta.
- **Avulso** por chamado.
- **Plano mensal** com horas de suporte + automações + Nexus Safe incluída. Esse é o que fideliza.

A proposta segue o modelo da GR Brands (HTML autocontido, ver memória do modelo de proposta).

---

## 7. Técnica

- **Stack:** Node + Express + SQLite (`better-sqlite3`), a mesma do WKSF. HTML/CSS/JS puro no front, sem framework.
- **Ficha no celular primeiro:** botões grandes, uma pergunta por linha, funciona em 3G, salva a cada bloco. Segue os padrões obrigatórios da GR Brands (responsivo e formulários).
- **Multi-agência:** um tenant por agência, as empresas clientes dentro dela.
- **Hospedagem:** VPS pequena com HTTPS, backup diário criptografado para fora. O `HOSPEDAGEM.md` do SST antigo serve de ponto de partida.
- **Testes:** `node --test` como no WKSF, cobrindo principalmente: empresa **não** consegue ler resposta de saúde; link expirado ou já enviado não abre; agência A não vê dado da agência B.

---

## 8. Decisões em aberto

1. **Quem manda o link:** o RH da empresa cliente, a recepção da clínica ou os dois?
2. **Questionário fixo ou configurável por agência** já na Fase 1? (Configurável dá mais trabalho mas vende melhor.)
3. **Agência piloto:** qual é, e ela tem médico do trabalho próprio para validar a ficha?
4. **Valores** do diagnóstico, do avulso e do plano mensal.
