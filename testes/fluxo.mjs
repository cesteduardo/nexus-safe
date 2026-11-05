// Teste de ponta a ponta do modelo do CRM e da ficha.
// Uso: npm test   (sobe um servidor estático próprio na porta 4861)
// Sai com código 1 se qualquer verificação falhar ou se houver erro de JS na página.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = 4861;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arq = path.join(RAIZ, p);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
});
await new Promise(r => servidor.listen(PORTA, r));
const B = `http://localhost:${PORTA}/`;

const falhas = [];
const ok = (cond, msg) => { if (!cond) falhas.push(msg); console.log((cond ? 'ok   ' : 'FALHA') + ' ' + msg); };

const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } });
const erros = [];
ctx.on('page', p => p.on('pageerror', e => erros.push(e.message)));
const page = await ctx.newPage();
page.on('pageerror', e => erros.push(e.message));
// bloqueia fontes externas para o teste não depender de rede
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());

try {
  await page.goto(B); await page.waitForTimeout(300);
  ok(await page.locator('h1').count() > 0, 'plano abre com título');

  await page.goto(B + 'crm/'); await page.waitForTimeout(300);
  ok(await page.locator('.coluna').count() === 6, 'quadro tem 6 colunas');
  const ultima = await page.locator('.coluna').last().boundingBox();
  ok(ultima && ultima.x + ultima.width <= 1366, 'as 6 colunas cabem na tela de 1366 px');
  ok(await page.locator('.agora__item').count() === 4, 'faixa "para fazer agora" tem 4 tarefas');
  await page.click('[data-tarefa="cobrar"]'); await page.waitForTimeout(150);
  const cobrar = await page.locator('.card b').allInnerTexts();
  ok(cobrar.length === 3 && !cobrar.includes('Ana Beatriz Moreira') && cobrar.includes('Carlos Eduardo Lima'), 'tarefa "cobrar a ficha" filtra só os links parados');
  await page.click('.agora__filtro [data-tarefa=""]'); await page.waitForTimeout(150);
  ok(await page.locator('.card').count() >= 8, 'ver todos devolve o quadro inteiro');

  // atendimento com ficha: visão médica x empresa
  await page.click('text=Lucas Henrique Souza'); await page.waitForTimeout(350);
  ok(await page.locator('.atencao .forte').count() > 0, 'visão médica mostra pontos de atenção');
  await page.click('[data-ver="empresa"]'); await page.waitForTimeout(150);
  ok(await page.locator('.atencao').count() === 0 && await page.locator('.bloco--trava').count() === 1, 'visão da empresa esconde respostas de saúde');
  await page.click('[data-ver="medico"]');

  // agendar, atender, emitir ASO com restrição
  await page.click('[data-agendar]'); await page.waitForTimeout(150);
  await page.click('[data-atendido]'); await page.waitForTimeout(150);
  await page.selectOption('[data-aso-resultado]', 'Apto com restrição');
  await page.fill('[data-aso-restricoes]', 'Não trabalhar em altura por 90 dias');
  await page.click('[data-emitir]'); await page.waitForTimeout(250);
  const aso = await page.locator('[data-aso-conteudo]').innerText();
  ok(/APTO COM RESTRIÇÃO/.test(aso) && /altura por 90 dias/.test(aso) && /periódico até/.test(aso), 'ASO traz aptidão, restrição e validade');
  await page.click('[data-fechar-aso]');
  await page.click('[data-fechar]'); await page.waitForTimeout(300);

  // novo atendimento e ficha no celular
  await page.click('[data-novo]');
  // padrão de formulário: nada vazio, nome só letras, telefone sem +55, CPF válido
  await page.click('text=Cadastrar e gerar link'); await page.waitForTimeout(150);
  ok(await page.locator('[data-form-novo] .campo__erro').count() === 3, 'cadastro vazio não envia e marca os 3 campos');
  await page.type('[name=nome]', 'Eduardo123 Gonçalves');
  const n1 = await page.inputValue('[name=nome]');
  await page.fill('[name=nome]', ''); await page.type('[name=nome]', 'Edu@rdo');
  ok(n1 === 'Eduardo Gonçalves' && await page.inputValue('[name=nome]') === 'Edurdo', 'nome não aceita número nem símbolo ao digitar');
  await page.fill('[name=nome]', '');
  await page.type('[name=celular]', 'abc17999998888');
  ok(await page.inputValue('[name=celular]') === '(17) 99999-8888', 'telefone ignora letras e aplica a máscara');
  const colar = async (sel, txt) => { await page.fill(sel, ''); await page.focus(sel); await page.evaluate(([sel, txt]) => { const dt = new DataTransfer(); dt.setData('text', txt); document.querySelector(sel).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, [sel, txt]); return page.inputValue(sel); };
  ok(await colar('[name=celular]', '+55 17 99999-9999') === '(17) 99999-9999', 'colar +55 remove o código do país');
  ok(await colar('[name=celular]', '5517999999999') === '(17) 99999-9999', 'colar 55 + DDD + número remove o 55');
  ok(await colar('[name=celular]', '55999999999') === '(55) 99999-9999', 'DDD 55 é preservado');
  ok(await colar('[name=nome]', 'Eduardo123 Gonçalves') === 'Eduardo Gonçalves', 'colar nome limpa os números');
  await page.fill('[name=nome]', 'Teste da Silva');
  await page.fill('[name=cpf]', '11122233344');
  await page.fill('[name=celular]', '17999998888');
  await page.click('text=Cadastrar e gerar link'); await page.waitForTimeout(150);
  ok(/CPF inválido/.test(await page.locator('[data-form-novo]').innerText()), 'CPF com dígito errado é recusado');
  await page.fill('[name=cpf]', '52998224725');
  await page.selectOption('[data-sel-empresa]', 'e2');
  await page.click('text=Cadastrar e gerar link'); await page.waitForTimeout(350);
  const link = await page.inputValue('.link-ficha input');
  ok(/ficha\.html\?t=/.test(link), 'cadastro gera link da ficha');

  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(link); await m.waitForTimeout(250);
  await m.click('button[type=submit]');
  await m.click('button[type=submit]');
  ok(/Faltam \d+ itens/.test(await m.locator('[data-erro]').innerText()), 'ficha bloqueia avanço com campos vazios');
  await m.fill('[name=nascimento]', '2030-01-01');
  await m.click('button[type=submit]'); await m.waitForTimeout(100);
  ok(/futuro/.test(await m.locator('.campo__erro').first().innerText()), 'ficha recusa nascimento no futuro');
  await m.fill('[name=nascimento]', '2020-01-01');
  await m.click('button[type=submit]'); await m.waitForTimeout(100);
  ok(/14 anos/.test(await m.locator('form').innerText()), 'ficha recusa idade abaixo de 14 anos');
  await m.fill('[name=nascimento]', '1998-03-02');
  await m.selectOption('[name=sexo]', 'Masculino');
  await m.selectOption('[name=estado_civil]', 'Solteiro(a)');
  await m.selectOption('[name=escolaridade]', 'Ensino médio completo');
  await m.fill('[name=endereco]', 'Rua A, 1');
  await m.fill('[name=emergencia_nome]', 'Joana (mãe) 2');
  ok(await m.inputValue('[name=emergencia_nome]') === 'Joana mãe ', 'contato de emergência aceita só letras');
  await m.fill('[name=emergencia_nome]', 'Joana Lima');
  await m.selectOption('[name=emergencia_parentesco]', 'Mãe');
  await m.fill('[name=emergencia_tel]', '17 99999 0000');
  ok(await m.inputValue('[name=emergencia_tel]') === '(17) 99999-0000', 'telefone de emergência ganha a máscara');
  const rasc = await m.evaluate(() => {
    const c = window.Nexus.carregar().candidatos.filter((x) => x.rascunho)[0];
    return c && c.rascunho.ficha.pessoais;
  });
  ok(rasc && rasc.endereco === 'Rua A, 1' && rasc.emergencia_tel === '(17) 99999-0000' && rasc.emergencia_parentesco === 'Mãe', 'ficha salva o rascunho a cada campo, sem avançar de passo');
  await m.click('[data-sn=pcd] label:has-text("Não")');
  await m.click('button[type=submit]');
  await m.fill('[name=t0_empresa]', 'Obra X'); await m.fill('[name=t0_funcao]', 'Ajudante'); await m.fill('[name=t0_tempo]', '1 ano');
  await m.click('[data-radio=t0_epi] label:has-text("Sim")');
  for (const k of ['acidente', 'inss', 'ocupacional']) await m.click(`[data-sn=${k}] label:has-text("Não")`);
  await m.click('button[type=submit]');
  await m.click('[data-nenhum]');
  await m.click('[data-sn=s_convulsao] label:has-text("Sim")');
  await m.fill('[name=s_convulsao__det]', 'Uma vez em 2019');
  await m.click('[data-radio=oculos] label:has-text("Não")');
  await m.click('button[type=submit]');
  await m.click('[data-radio=fuma] label:has-text("Não")');
  await m.click('[data-radio=alcool] label:has-text("Socialmente")');
  await m.click('[data-radio=atividade] label:has-text("Sim")');
  await m.click('button[type=submit]');
  const sns = await m.locator('[data-sn^="e_"]').count();
  for (let i = 0; i < sns; i++) await m.locator('[data-sn^="e_"]').nth(i).locator('label:has-text("Não")').click();
  await m.click('button[type=submit]');
  await m.check('[name=declaro]'); await m.check('[name=lgpd]');
  const bx = await m.locator('[data-assinatura]').boundingBox();
  await m.mouse.move(bx.x + 30, bx.y + 100); await m.mouse.down();
  for (let i = 0; i < 20; i++) await m.mouse.move(bx.x + 30 + i * 12, bx.y + 100 + Math.sin(i) * 25);
  await m.mouse.up();
  await m.click('button[type=submit]'); await m.waitForTimeout(250);
  ok(/Ficha enviada/.test(await m.locator('h1').innerText()), 'ficha é enviada');

  await page.bringToFront(); await page.waitForTimeout(300);
  const estado = await page.evaluate(() => {
    const d = window.Nexus.carregar();
    const c = d.candidatos.find(x => x.nome === 'Teste da Silva');
    return { etapa: c.etapa, fortes: window.Nexus.alertas(c.ficha, window.Nexus.funcao(c.funcaoId)).fortes };
  });
  ok(estado.etapa === 'recebida', 'atendimento vai para "Ficha recebida"');
  ok(estado.fortes.some(t => /altura.*convuls/i.test(t)), 'alerta cruza função em altura com convulsão');

  // link inválido
  await m.goto(B + 'crm/ficha.html?t=naoexiste'); await m.waitForTimeout(150);
  ok(/Link inválido/.test(await m.locator('h1').innerText()), 'link inválido mostra aviso');

  // celular sem rolagem lateral
  for (const u of ['', 'crm/', 'crm/#/cadastros', 'crm/#/automacoes', 'marca/']) {
    await m.goto(B + u); await m.waitForTimeout(250);
    const [sw, iw] = await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    ok(sw <= iw, `sem rolagem lateral no celular: /${u}`);
  }
} catch (e) {
  falhas.push('exceção: ' + e.message);
  console.log('FALHA exceção: ' + e.message);
}

ok(erros.length === 0, 'nenhum erro de JS' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
servidor.close();
console.log(falhas.length ? `\n${falhas.length} falha(s).` : '\nTudo certo.');
process.exit(falhas.length ? 1 : 0);
