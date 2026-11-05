# Pesquisa de mercado (05/11/2026)

O que clínicas de medicina do trabalho e as empresas que as contratam reclamam, e o que
foi levado para o modelo do CRM. As fontes são blogs de fornecedores, reclamações públicas
e materiais de curso: servem para orientar, não são estudo com números. Antes de vender,
confirmar com 2 ou 3 agências (Fase 0 do PLANO.md).

## O que dói

| Dor | Quem sente | Fonte |
|---|---|---|
| ASO atrasado trava a contratação; demissional atrasado trava a rescisão | RH da empresa | [Climec](https://climec.com.br/blog/como-escolher-uma-clinica-de-medicina-ocupacional/) |
| Agendamento demora dias e não há prazo combinado para cobrar | RH da empresa | [Climec](https://climec.com.br/blog/como-escolher-uma-clinica-de-medicina-ocupacional/), [Portal da Queixa](https://portaldaqueixa.com/brands/interprev/complaints/interprev-seguranca-e-saude-do-trabalho-sa-reclamacao-falta-de-resposta-e-atraso-na-marcacao-de-consultas-de-medicina-do-trabalho-143141225) |
| Evento S-2220 do eSocial fica pendente por dias | RH e contabilidade | [Climec](https://climec.com.br/blog/como-escolher-uma-clinica-de-medicina-ocupacional/), [b2bstack](https://www.b2bstack.com.br/compare/softclinica-vs-soc-software-de-saude-e-seguranca-do-trabalho) |
| A clínica só faz o periódico quando a empresa lembra; ASO vence sem aviso | RH da empresa | [Climec](https://climec.com.br/blog/como-escolher-uma-clinica-de-medicina-ocupacional/) |
| Horário marcado não é cumprido; muitas clínicas atendem por ordem de chegada | Candidato | [Reclame Aqui](https://www.reclameaqui.com.br/servimet-servico-de-medicina-do-trabalho/agendam-horario-e-nao-atendem-no-horario-agendado_Hw4GjwD3vcMJVpR4/), [UEL](https://sites.uel.br/sebec/wp-content/uploads/2024/09/INSTRUCAO_SERVICO_CONJUNTA_SEBEC_PRORH_004_2024.pdf) |
| Portal do cliente é diferencial de concorrente (Madu); agendamento online integrado ao SOC ainda é procurado | Clínica | [b2bstack](https://www.b2bstack.com.br/compare/madu-vs-soc-software-de-saude-e-seguranca-do-trabalho), [Workana](https://www.workana.com/pt/job/desenvolvimento-de-sistema-de-agendamento-online-integrado-ao-soc) |

## Regras que o sistema pode conferir sozinho

- **Demissional dispensável (NR-7):** último exame há menos de 135 dias (grau de risco 1 e 2) ou 90 dias (grau 3 e 4). Fonte: [Senior](https://www.senior.com.br/blog/exame-demissional), [CRC-CE](https://www.crc-ce.org.br/crcnovo/files/CURSOSSTCRCCE.pdf).
- **S-2220:** até o dia 15 do mês seguinte ao ASO. Fonte: [CRC-CE](https://www.crc-ce.org.br/crcnovo/files/CURSOSSTCRCCE.pdf). Conferir no manual do eSocial antes de lançar.
- **Retorno ao trabalho:** afastamento de 30 dias ou mais por doença ou acidente. Mesma fonte.

## Suporte de TI (chamados)

Boas práticas de help desk que valem para uma equipe pequena: prioridade na abertura com
meta própria; tempo de primeira resposta medido separado do tempo de solução; fila que mostra
o que está perto de estourar; escalonar o que o primeiro nível não resolve; revisar os números.
Fontes: [eesel](https://www.eesel.ai/pt/blog/melhores-praticas-sla-suporte), [Freshworks](https://www.freshworks.com/br/helpdesk/sla/), [Rework](https://resources.rework.com/pt/guides/customer-support-specialist-playbooks/ticket-triage-prioritizing-queue), [InvGate](https://blog.invgate.com/pt/gestao-de-chamados).

## O que entrou no modelo

- **Admissão prevista** no cadastro (clínica e RH). O cartão avisa "Admite 07/11" quando faltam 2 dias sem ASO e "Admissão atrasada" quando passou. Tarefa "Admissão em risco" na faixa do quadro.
- **S-2220:** todo ASO emitido abre a pendência com o prazo. Tarefa "Enviar S-2220", bloco no painel e situação na página do RH.
- **Periódicos:** aba nova com os ASOs que vencem em 90 dias, "Avisar o RH" e "Convocar periódico" (cria o atendimento e manda o link).
- **Demissional:** o painel diz se pode ser dispensado pela NR-7, com o grau de risco da empresa e a data do último ASO.
- **Agenda:** horário marcado ou ordem de chegada.
- **Chamados:** prioridade urgente, normal ou baixa com metas de resposta e solução (valores de exemplo), relógio do prazo no cartão, fila ordenada (fora do prazo, urgente, mais antigo), conversa nos dois sentidos, "pedir informação" deixa o chamado aguardando a clínica, responsável, canal de entrada, avaliação no fim e reabertura.

## Ficou para depois (no BACKLOG.md)

- Guia de encaminhamento impressa ou em PDF para o RH entregar ao funcionário.
- XML do S-2220 de verdade (hoje o envio é só marcado).
- Pausar o relógio do chamado enquanto ele aguarda a clínica.
- Escalonar chamado para um segundo nível.
