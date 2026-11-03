# Nexus Safe: regras do projeto

Site estático publicado no GitHub Pages a partir da branch `main`
(https://cesteduardo.github.io/nexus-safe/). Cada push na `main` vai direto para o ar.

## O que é
- `index.html`: o plano (serviços de TI, automações de WhatsApp e a plataforma) para agências de SST.
- `crm/`: modelo funcional do CRM. Tudo em `localStorage`, dados fictícios.
  - `dados.js`: catálogos, perguntas, dados de demonstração, regras de alerta. Se mudar o formato dos dados salvos, suba a versão em `CHAVE` e em `versao`.
  - `app.js`: quadro, painel do atendimento (visão médica x empresa), ASO, cadastros, automações.
  - `ficha.html` + `ficha.js`: ficha que o candidato preenche no celular.
- `marca/`: opções de logo esperando escolha do dono.
- `PLANO.md`: o plano em texto. `BACKLOG.md`: o que fazer. `HISTORICO.md`: o que foi feito.

## Regras que não se quebram
1. **Português do Brasil, sem travessões** (`—`). Reescreva a frase em vez de trocar por vírgula.
2. **A logo não muda** até o dono escolher uma das opções em `marca/`. Não escolha por ele.
3. **Não decidir pelo dono:** preços, nome, e as "Decisões em aberto" do plano ficam como estão.
4. **Dado de saúde é sensível (LGPD art. 11):** a visão da empresa cliente nunca mostra resposta de saúde, só cadastro, etapa e ASO. A ficha nunca pergunta gravidez, esterilização ou HIV.
5. **Exame vem do protocolo do PCMSO**, nunca direto do risco.
6. **Dados sempre fictícios.** Nada de empresa, pessoa ou CNPJ real.
7. **Sem cara de site feito em IA:** nada de selos pulsando, ícones girando, rótulos com bolinha, gradiente chamativo. Mudanças visuais pequenas, uma peça por vez.
8. **Sem dependências no site:** HTML, CSS e JS puro. Bibliotecas só para testes.
9. **Celular primeiro:** nada pode criar rolagem lateral em 390 px.

## Como testar
```
npm install
npx playwright install --with-deps chromium   # se o navegador não estiver instalado
npm test
```
O teste sobe um servidor próprio, percorre plano, quadro, visão médica e da empresa, ASO,
ficha completa no celular e confere a rolagem lateral. Se acrescentar uma função nova, acrescente
uma verificação em `testes/fluxo.mjs`.

## Commits
Mensagem curta em português dizendo o que mudou. Terminar com:
`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
