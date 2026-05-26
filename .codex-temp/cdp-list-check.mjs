import fs from 'node:fs/promises';

const [port, url, outPath] = process.argv.slice(2);
if (!port || !url || !outPath) throw new Error('Usage: node cdp-list-check.mjs <port> <url> <outPath>');

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

await client.send('Runtime.evaluate', {
  expression: `(() => {
    const cell = document.querySelector('#rule-list-tbody tr td:nth-child(4)');
    if (!cell || cell.querySelector('.parent-codes-wrap')) return;
    cell.innerHTML = '<span class="parent-codes-wrap" tabindex="0" data-parent-codes="LFT00000001\\nLFT00000002\\nLFT00000003\\nLFT00000004\\nLFT00000005\\nLFT00000006"><span class="parent-codes-text">LFT00000001、LFT00000002、LFT00000003、LFT00000004</span><span class="tag tag-info parent-more">+2</span></span>';
  })()`
});

const widthBefore = await client.send('Runtime.evaluate', {
  expression: `document.body.scrollWidth`,
  returnByValue: true
});
await client.send('Runtime.evaluate', {
  expression: `(() => {
    const target = document.querySelector('.parent-codes-wrap');
    target && target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  })()`
});
await new Promise((resolve) => setTimeout(resolve, 120));

const state = await client.send('Runtime.evaluate', {
  expression: `JSON.stringify({
    title: document.title,
    headers: Array.from(document.querySelectorAll('.data-table thead th')).map((th) => th.textContent.trim()),
    editButtons: Array.from(document.querySelectorAll('#rule-list-tbody [data-action="edit"]')).map((el) => el.textContent.trim()),
    actionTexts: Array.from(document.querySelectorAll('#rule-list-tbody td:last-child')).map((td) => td.textContent.trim()),
    disabledTagColor: getComputedStyle(Array.from(document.querySelectorAll('.tag')).find((el) => el.textContent.trim() === '停用') || document.body).color,
    popoverVisible: document.getElementById('parent-popover')?.classList.contains('show'),
    popoverZIndex: getComputedStyle(document.getElementById('parent-popover')).zIndex,
    widthBeforeHover: ${widthBefore.result.value},
    widthAfterHover: document.body.scrollWidth,
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
} catch {}
