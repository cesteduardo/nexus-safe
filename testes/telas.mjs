// Gera as 3 capturas de tela de assets/telas/ a partir do próprio modelo.
// Uso: node testes/telas.mjs   (CHROME=/caminho/do/chrome se preciso)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = 4862;
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
const SAIDA = path.join(RAIZ, 'assets', 'telas');
fs.mkdirSync(SAIDA, { recursive: true });

const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const page = await ctx.newPage();
try {
  await page.goto(B + 'crm/entrar.html'); await page.waitForTimeout(200);
  await page.fill('[name=usuario]', 'medico'); await page.fill('[name=senha]', '123');
  await page.click('[data-form-login] button[type=submit]'); await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SAIDA, 'quadro.png') });

  // ASO de quem já foi atendido
  await page.locator('.card', { hasText: 'Patrícia Gomes Ribeiro' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-ver-aso]').first().click(); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SAIDA, 'aso.png') });

  // ficha no celular, com o link de quem ainda não preencheu
  const tk = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('nexus-safe-demo-v6')); return d.candidatos.find(c => c.nome === 'Carlos Eduardo Lima').token; });
  const m = await ctx.newPage(); await m.setViewportSize({ width: 390, height: 780 });
  await m.goto(B + 'crm/ficha.html?t=' + tk); await m.waitForTimeout(400);
  await m.screenshot({ path: path.join(SAIDA, 'ficha.png') });
} finally { await b.close(); servidor.close(); }
console.log('capturas salvas em assets/telas/');
