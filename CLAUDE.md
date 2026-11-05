# Nexus Safe: regras do projeto

Site estático publicado no GitHub Pages a partir da branch `main`
(https://cesteduardo.github.io/nexus-safe/). Cada push na `main` vai direto para o ar.

O mesmo site também roda como servidor (Cloudflare Worker + D1, ainda não publicado): `servidor/index.js`,
`servidor/esquema.sql`, `servidor/semente.mjs` e `wrangler.jsonc`. O `crm/modo.js` diz em qual modo a página está.
Detalhes, passo a passo e o que falta em `SEGURANCA.md`.

## O que é
- `index.html`: o plano (serviços de TI, automações de WhatsApp e a plataforma) para agências de SST.
- `crm/`: modelo funcional do CRM. Tudo em `localStorage`, dados fictícios.
  - `regras.js`: as ações do atendimento (criar, agendar, emitir ASO...) com validação. As mesmas no navegador e no servidor: mudança de regra entra aqui, nunca só na tela.
  - `dados.js`: catálogos, perguntas, dados de demonstração, regras de alerta. Toda mudança passa por `Nexus.acao()`, que grava no navegador ou chama a API. Se mudar o formato dos dados salvos, suba a versão em `CHAVE` e em `versao`.
  - `app.js`: quadro, painel do atendimento (visão médica x empresa), ASO, cadastros, automações.
  - `ficha.html` + `ficha.js`: ficha que o candidato preenche no celular.
  - `entrar.html`: login do modelo (senha 123 para todas as contas; lista em `contas.js`, USUARIOS). Cada página protegida confere o perfil no `<head>` e em JS. Três perfis:
    - **Administração** (`admin.html` + `admin.js`): a Nexus Safe, quem oferece o serviço. Agências clientes, contrato, uso do mês e chamados de TI.
    - **Clínica** (`index.html` + `app.js`): a agência de SST, cliente da Nexus Safe. Quadro, ficha, ASO, automações e aba de suporte. Conta `clinica` é a recepção (sem dado de saúde); conta `medico` vê a ficha e emite o ASO.
    - **RH da empresa** (`empresa.html?e=ID` + `empresa.js`): cliente da agência. Só os próprios funcionários, etapa, pedido de exame e ASO.
  - `contas.js`: perfis, agências e chamados com metas de prazo (chave própria no localStorage). `campos.js`: regras dos formulários. `movimento.js`: pílula que desliza nas abas.
- `PESQUISA.md`: o que o mercado pede, com fontes, e o que já entrou no modelo.
- `marca/`: outras direções de logo, só como referência.
- `crm/campos.js`: regras de nome, telefone e CPF (padrão GR Brands 2).
- `PLANO.md`: o plano em texto. `BACKLOG.md`: o que fazer. `HISTORICO.md`: o que foi feito.

## Regras que não se quebram
1. **Português do Brasil, sem travessões** (`—`). Reescreva a frase em vez de trocar por vírgula.
2. **A logo é o Elo** (`assets/simbolo.svg`): dois cantos que se encaixam em volta de um quadrado, verde e verde-escuro. Trocada em 05/11 a pedido do dono (o NS de traço fino foi reprovado). Nos HTML ela é o SVG `.ns` com `.ns__a`, `.ns__b` e `.ns__c`. Não muda sem pedido dele.
3. **Não decidir pelo dono:** preços, nome, e as "Decisões em aberto" do plano ficam como estão.
4. **Dado de saúde é sensível (LGPD art. 11):** nem a administração da Nexus Safe nem o RH da empresa veem resposta de saúde. A administração vê contagens; o RH vê cadastro, etapa e ASO. A ficha nunca pergunta gravidez, esterilização ou HIV.
5. **Exame vem do protocolo do PCMSO**, nunca direto do risco.
6. **Dados sempre fictícios.** Nada de empresa, pessoa ou CNPJ real.
7. **Sem cara de site feito em IA:** nada de selos pulsando, ícones girando, rótulos com bolinha, gradiente chamativo. Mudanças visuais pequenas, uma peça por vez.
8. **Sem dependências no site:** HTML, CSS e JS puro. Bibliotecas só para testes.
9. **Celular primeiro:** nada pode criar rolagem lateral de 320 a 1920 px.
10. **Movimento igual ao do GR Vagas:** botões sobem 1 px no hover e afundam no clique, com `--saida`, `--ease` e `--mola` de `assets/base.css`. Animar não é redesenhar: movimento novo não traz cor nem ícone novo.
11. **Formulários no padrão GR Brands 2:** campo de nome, telefone ou CPF usa `data-campo="nome|tel|cpf"` e `crm/campos.js`; o envio passa por `Campos.validar(form)`.

## Como testar
```
npm install
npx playwright install --with-deps chromium   # se o navegador não estiver instalado
npm test
```
Se o Chromium do Playwright não instalar, use um que já exista: `CHROME=/caminho/do/chrome npm test`.

O teste sobe um servidor próprio, percorre plano, quadro, visão médica e da empresa, ASO,
ficha completa no celular e confere a rolagem lateral. Se acrescentar uma função nova, acrescente
uma verificação em `testes/fluxo.mjs`.

Mexeu em `crm/regras.js`, `crm/dados.js`, `crm/contas.js`, `crm/ficha.js` ou `servidor/`? Rode também o teste do servidor
(passo a passo em `SEGURANCA.md`): `npx wrangler dev --port 8790 --ip 127.0.0.1` num terminal e `npm run test:servidor` no outro.

## Commits
Mensagem curta em português dizendo o que mudou. Terminar com:
`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
