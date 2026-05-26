import fs from 'node:fs/promises';

const [port, url, outPath] = process.argv.slice(2);
if (!port || !url || !outPath) throw new Error('Usage: node cdp-md-viewer-check.mjs <port> <url> <outPath>');

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
await new Promise((resolve) => setTimeout(resolve, 2500));

const state = await client.send('Runtime.evaluate', {
  expression: `(() => {
    const text = document.body.innerText;
    const sample = text.includes('备货规则配置页面用于配置补货建议量');
    const hasMojibake = /澶囪揣|閰嶇疆|�/.test(text);
    const firstTable = document.querySelector('table');
    return JSON.stringify({
      title: document.title,
      h1: document.querySelector('h1')?.textContent.trim(),
      tocLinks: document.querySelectorAll('.toc-link').length,
      tables: document.querySelectorAll('table').length,
      codeBlocks: document.querySelectorAll('pre code').length,
      mathBlocks: document.querySelectorAll('.math-block').length,
      sample,
      hasMojibake,
      bodyOverflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      firstTableScrollable: firstTable ? firstTable.scrollWidth >= firstTable.clientWidth : false,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    });
  })()`,
  returnByValue: true,
});

const screenshot = await client.send('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false,
});
await fs.writeFile(outPath, Buffer.from(screenshot.data, 'base64'));
console.log(state.result.value);

try {
  await client.send('Browser.close');
} catch {}
