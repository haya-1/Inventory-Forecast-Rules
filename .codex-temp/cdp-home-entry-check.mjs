import fs from 'node:fs/promises';

const [port, url, outPath] = process.argv.slice(2);
if (!port || !url || !outPath) throw new Error('Usage: node cdp-home-entry-check.mjs <port> <url> <outPath>');

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
await new Promise((resolve) => setTimeout(resolve, 800));

const homeState = await client.send('Runtime.evaluate', {
  expression: `(() => {
    const link = document.querySelector('a[href*="%E5%A4%87%E8%B4%A7%E8%A7%84%E5%88%99%E9%85%8D%E7%BD%AE"]');
    return JSON.stringify({
      title: document.title,
      hasEntry: !!link,
      entryText: link?.textContent.trim(),
      cardTitle: link?.closest('.home-card')?.querySelector('h1')?.textContent.trim(),
      cardCount: document.querySelectorAll('.home-card').length
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

await client.send('Runtime.evaluate', {
  expression: `document.querySelector('a[href*="%E5%A4%87%E8%B4%A7%E8%A7%84%E5%88%99%E9%85%8D%E7%BD%AE"]').click()`,
});
await new Promise((resolve) => setTimeout(resolve, 1200));

const docState = await client.send('Runtime.evaluate', {
  expression: `(() => JSON.stringify({
    title: document.title,
    h1: document.querySelector('h1')?.textContent.trim(),
    url: location.href,
    hasMojibake: /澶囪揣|閰嶇疆|�/.test(document.body.innerText)
  }))()`,
  returnByValue: true,
});

console.log(JSON.stringify({
  home: JSON.parse(homeState.result.value),
  document: JSON.parse(docState.result.value),
}));

try {
  await client.send('Browser.close');
} catch {}
