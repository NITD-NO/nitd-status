// UU-skanning (axe-core) av alle HTML-sider i dist/, i lyst og mørkt tema.
// Kopiert fra norskitdrift.no (scripts/qa/axe-scan.mjs) og tilpasset statussiden.
// Bruk: node scripts/qa/axe-scan.mjs [baseUrl]   (standard http://localhost:8080)
// Miljø: AXE_FAIL_ON=critical,serious  -> feiler jobben ved brudd med disse alvorlighetsgradene
//        (tom = kun rapport). Skriver sammendrag til $GITHUB_STEP_SUMMARY når den finnes.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readdirSync, statSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const DIST = 'dist';
const FAIL_ON = (process.env.AXE_FAIL_ON || '').split(',').map(s => s.trim()).filter(Boolean);
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const THEMES = ['light', 'dark'];

function htmlFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return name.endsWith('.html') ? [relative(DIST, p).split('\\').join('/')] : [];
  });
}

const pages = htmlFiles(DIST).sort();
const browser = await chromium.launch();
const results = [];

for (const theme of THEMES) {
  // Redusert bevegelse: .reveal-elementer vises ferdig, ikke midt i inntoningen (ga falske kontrastfunn).
  const context = await browser.newContext({ reducedMotion: 'reduce', colorScheme: theme });
  // Sett tema før sidens egne skript kjører (js/theme.js leser localStorage). colorScheme over dekker systemvalget.
  await context.addInitScript(t => {
    try { localStorage.setItem('nitd_theme', t); } catch {}
    document.documentElement?.setAttribute('data-theme', t);
  }, theme);
  const page = await context.newPage();
  for (const file of pages) {
    const url = `${BASE}/${file}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
      const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      for (const v of r.violations) {
        results.push({ page: file, theme, id: v.id, impact: v.impact || 'unknown',
          help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.length,
          targets: v.nodes.slice(0, 5).map(n => n.target.join(' ')) });
      }
    } catch (e) {
      results.push({ page: file, theme, id: 'load-error', impact: 'critical', help: String(e.message).slice(0, 200), nodes: 0, targets: [] });
    }
  }
  await context.close();
}
await browser.close();

mkdirSync('qa-report', { recursive: true });
writeFileSync('qa-report/axe.json', JSON.stringify({ base: BASE, pages: pages.length, themes: THEMES, results }, null, 2));

// Sammendrag
const order = ['critical', 'serious', 'moderate', 'minor', 'unknown'];
const byImpact = Object.fromEntries(order.map(k => [k, 0]));
const byRule = {};
for (const r of results) {
  byImpact[r.impact] = (byImpact[r.impact] || 0) + Math.max(r.nodes, 1);
  const key = `${r.impact}|${r.id}`;
  byRule[key] ??= { impact: r.impact, id: r.id, help: r.help, helpUrl: r.helpUrl, pages: new Set(), nodes: 0, themes: new Set() };
  byRule[key].pages.add(r.page); byRule[key].themes.add(r.theme); byRule[key].nodes += r.nodes;
}
const rules = Object.values(byRule).sort((a, b) => order.indexOf(a.impact) - order.indexOf(b.impact) || b.pages.size - a.pages.size);
const affectedPages = new Set(results.map(r => r.page)).size;

let md = `## UU-skanning (axe-core, WCAG 2.2 AA)\n\n`;
md += `${pages.length} sider × ${THEMES.length} tema. Sider med brudd: **${affectedPages}**.\n\n`;
md += `| Alvorlighet | Forekomster |\n|---|---|\n` + order.filter(k => byImpact[k]).map(k => `| ${k} | ${byImpact[k]} |`).join('\n') + '\n\n';
if (rules.length) {
  md += `| Alvorlighet | Regel | Sider | Tema | Forekomster |\n|---|---|---|---|---|\n`;
  md += rules.map(r => `| ${r.impact} | [${r.id}](${r.helpUrl || '#'}) – ${r.help.replace(/\|/g, '/')} | ${r.pages.size} | ${[...r.themes].join('/')} | ${r.nodes} |`).join('\n') + '\n';
  // Elementer som går igjen på mange sider er som regel felles komponenter (header, footer, kort).
  md += `\n### Vanligste elementer per regel\n`;
  for (const r of rules) {
    const count = {};
    for (const x of results) if (x.id === r.id && x.impact === r.impact)
      for (const t of x.targets) { const k = `${x.theme}: \`${t.slice(0, 120)}\``; (count[k] ??= []).push(x.page); }
    const top = Object.entries(count).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
    md += `\n**${r.id}**\n` + top.map(([k, p]) => `- ${k} – ${p.length} sider` + (p.length <= 3 ? ` (${p.join(', ')})` : '')).join('\n') + '\n';
  }
} else md += 'Ingen brudd funnet. ✅\n';
writeFileSync('qa-report/axe-summary.md', md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);

const blocking = results.filter(r => FAIL_ON.includes(r.impact));
if (blocking.length) {
  console.error(`\n${blocking.length} brudd med alvorlighet ${FAIL_ON.join('/')} – stopper.`);
  process.exit(1);
}
