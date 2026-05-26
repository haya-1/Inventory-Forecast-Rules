import fs from 'node:fs/promises';

const [port, url, outPath] = process.argv.slice(2);
if (!port || !url || !outPath) throw new Error('Usage: node cdp-columns-check.mjs <port> <url> <outPath>');

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

await client.send('Runtime.evaluate', { expression: `document.getElementById('btn-rule-add').click()` });
await new Promise((resolve) => setTimeout(resolve, 300));

const state = await client.send('Runtime.evaluate', {
  expression: `(() => {
    const clickTab = (label) => {
      const btn = Array.from(document.querySelectorAll('.drawer-tab')).find((el) => el.textContent.trim() === label);
      if (btn) btn.click();
    };
    clickTab('安全库存天数');
    const safetyHeaders = Array.from(document.querySelectorAll('#drawer-tab-safety .config-table thead tr:first-child th')).map((th) => th.textContent.trim());
    const safetyToggles = document.querySelectorAll('#drawer-tab-safety .safety-category-enabled').length;
    const safetyRowToggles = document.querySelectorAll('#drawer-tab-safety .safety-condition-enabled').length;
    clickTab('物流时效');
    const logisticsHeaders = Array.from(document.querySelectorAll('#drawer-tab-logistics .config-table thead tr:first-child th')).map((th) => th.textContent.trim());
    const siteToggles = document.querySelectorAll('#drawer-tab-logistics .site-enabled').length;
    const methodToggles = document.querySelectorAll('#drawer-tab-logistics .method-enabled').length;
    return JSON.stringify({
      activeTab: document.querySelector('.drawer-tab.active')?.textContent.trim(),
      safetyHeaders,
      safetyToggles,
      safetyRowToggles,
      logisticsHeaders,
      siteToggles,
      methodToggles
    });
  })()`,
  returnByValue: true
});

const screenshot = await client.send('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false
});
await fs.writeFile(outPath, Buffer.from(screenshot.data, 'base64'));
console.log(state.result.value);

try {
  await client.send('Browser.close');
} catch {}
