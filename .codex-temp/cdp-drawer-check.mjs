import fs from 'node:fs/promises';

const [port, url, outPath] = process.argv.slice(2);
if (!port || !url || !outPath) {
  throw new Error('Usage: node cdp-drawer-check.mjs <port> <url> <outPath>');
}

async function waitForTarget() {
  const endpoint = `http://127.0.0.1:${port}/json/list`;
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      const res = await fetch(endpoint);
      const list = await res.json();
      const page = list.find((item) => item.type === 'page') || list[0];
      if (page && page.webSocketDebuggerUrl) return page;
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Chrome DevTools target was not ready');
}

function createClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  const listeners = new Map();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result || {});
      return;
    }
    if (msg.method && listeners.has(msg.method)) {
      listeners.get(msg.method).forEach((listener) => listener(msg.params || {}));
    }
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

  function once(method) {
    return new Promise((resolve) => {
      const handler = (params) => {
        listeners.set(
          method,
          (listeners.get(method) || []).filter((listener) => listener !== handler)
        );
        resolve(params);
      };
      listeners.set(method, [...(listeners.get(method) || []), handler]);
    });
  }

  return { opened, send, once };
}

const target = await waitForTarget();
const client = createClient(target.webSocketDebuggerUrl);
await client.opened;
await client.send('Page.enable');
await client.send('Runtime.enable');

const loaded = client.once('Page.loadEventFired');
await client.send('Page.navigate', { url });
await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 5000))]);

await client.send('Runtime.evaluate', {
  expression: "document.getElementById('btn-rule-add').click()",
  awaitPromise: true
});
await new Promise((resolve) => setTimeout(resolve, 500));

const state = await client.send('Runtime.evaluate', {
  expression: `JSON.stringify({
    title: document.title,
    drawerOpen: document.getElementById('rule-drawer')?.classList.contains('open'),
    sectionHeads: Array.from(document.querySelectorAll('.drawer-section-head')).map((el) => el.textContent.trim()),
    safetyCategories: Array.from(document.querySelectorAll('.safety-category-card')).map((el) => ({
      key: el.getAttribute('data-category-key'),
      title: el.querySelector('.tag')?.textContent?.trim(),
      rows: el.querySelectorAll('tbody tr[data-condition-code]').length
    })),
    hasTrialOrRoundText: /试算|取整|全部父体|指定父体/.test(document.body.innerText),
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth
  })`,
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
} catch (err) {}
