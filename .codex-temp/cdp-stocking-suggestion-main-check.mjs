import fs from 'node:fs/promises';

const [port, url, outPath] = process.argv.slice(2);
if (!port || !url || !outPath) throw new Error('Usage: node cdp-stocking-suggestion-main-check.mjs <port> <url> <outPath>');

async function waitForTarget() {
  const endpoint = `http://127.0.0.1:${port}/json/list`;
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      const list = await (await fetch(endpoint)).json();
      const page = list.find((item) => item.type === 'page') || list[0];
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Chrome DevTools target was not ready');
}

function createClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message || JSON.stringify(msg.error))) : resolve(msg.result || {});
  });
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  function send(method, params = {}) {
    const id = ++seq;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }
  return { opened, send };
}

const target = await waitForTarget();
const client = createClient(target.webSocketDebuggerUrl);
await client.opened;
await client.send('Page.enable');
await client.send('Runtime.enable');
await client.send('Page.navigate', { url });
await new Promise((resolve) => setTimeout(resolve, 1000));

const mainState = await client.send('Runtime.evaluate', {
  expression: `(() => {
    const main = document.querySelector('.main-content');
    const mainText = main ? main.innerText : '';
    return JSON.stringify({
      title: document.title,
      activeSubmenu: document.querySelector('#replenish-submenu .submenu-item.active')?.textContent.trim(),
      rowCount: document.querySelectorAll('#suggestion-tbody tr[data-id]').length,
      headers: Array.from(document.querySelectorAll('.data-table thead th')).map((th) => th.textContent.trim()),
      metricLabels: Array.from(document.querySelectorAll('.metric-label')).map((el) => el.textContent.trim()),
      sectionNote: document.querySelector('.section-head .section-note')?.textContent.trim(),
      mainHasRiskText: mainText.includes('风险'),
      mainHasActionText: mainText.includes('建议动作')
    });
  })()`,
  returnByValue: true
});

await client.send('Runtime.evaluate', {
  expression: `(() => {
    const firstDetail = document.querySelector('#suggestion-tbody [data-action="detail"]');
    if (firstDetail) firstDetail.click();
  })()`
});
await new Promise((resolve) => setTimeout(resolve, 450));

const drawerState = await client.send('Runtime.evaluate', {
  expression: `(() => JSON.stringify({
    drawerOpen: document.getElementById('detail-drawer')?.classList.contains('open'),
    drawerHasRisk: document.getElementById('detail-drawer')?.innerText.includes('风险'),
    drawerHasAction: document.getElementById('detail-drawer')?.innerText.includes('建议动作'),
    projectionRows: document.querySelectorAll('#projection-tbody tr').length,
    calcBlocks: document.querySelectorAll('#calc-detail .formula-block').length
  }))()`,
  returnByValue: true
});

const screenshot = await client.send('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false
});
await fs.writeFile(outPath, Buffer.from(screenshot.data, 'base64'));
console.log(JSON.stringify({
  main: JSON.parse(mainState.result.value),
  drawer: JSON.parse(drawerState.result.value)
}));

try {
  await client.send('Browser.close');
} catch {}
