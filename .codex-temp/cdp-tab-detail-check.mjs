import fs from 'node:fs/promises';

const [port, url, outPath] = process.argv.slice(2);
if (!port || !url || !outPath) throw new Error('Usage: node cdp-tab-detail-check.mjs <port> <url> <outPath>');

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

const state = await client.send('Runtime.evaluate', {
  expression: `(() => {
    window.__lastAlert = '';
    window.alert = (msg) => { window.__lastAlert = String(msg); };
    const clickTab = (label) => {
      const btn = Array.from(document.querySelectorAll('.drawer-tab')).find((el) => el.textContent.trim() === label);
      if (btn) btn.click();
    };
    const setValue = (id, value) => {
      const el = document.getElementById(id);
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    document.querySelector('#rule-list-tbody [data-action="edit"]').click();
    setValue('purchase-lead', 10);
    setValue('purchase-frequency', 2);
    setValue('pickup-prep', 3);
    setValue('quality-inspection', 4);
    const procurementSummary = document.getElementById('procurement-total').textContent.trim();
    const hasProcurementHint = document.body.textContent.includes('采购时效合计：');

    clickTab('安全库存天数');
    const fbaWidth = Math.round(document.getElementById('fba-safety-days').getBoundingClientRect().width);
    const firstSafetyCard = document.querySelector('.safety-category-card');
    const firstSafetyRowsBefore = firstSafetyCard.querySelectorAll('tbody tr[data-condition-code]').length;
    const addSafetyBtn = firstSafetyCard.querySelector('.safety-condition-add');
    const addSafetyDisabled = addSafetyBtn.disabled;
    addSafetyBtn.click();
    const firstSafetyRowsAfter = firstSafetyCard.querySelectorAll('tbody tr[data-condition-code]').length;
    document.getElementById('rule-drawer-submit').click();
    const duplicateAlert = window.__lastAlert;

    clickTab('物流时效');
    const firstSite = document.querySelector('.site-card');
    const frequencyWidth = Math.round(firstSite.querySelector('.site-frequency-input').getBoundingClientRect().width);
    const logisticsRowsBefore = firstSite.querySelectorAll('.logistics-method-tbody tr').length;
    firstSite.querySelector('.logistics-method-add').click();
    const addedRow = firstSite.querySelector('.logistics-method-tbody tr:last-child');
    addedRow.querySelector('.method-name-input').value = '空运';
    addedRow.querySelector('.method-lead').value = '12';
    const logisticsRowsAfterAdd = firstSite.querySelectorAll('.logistics-method-tbody tr').length;
    addedRow.querySelector('.logistics-method-delete').click();
    const logisticsRowsAfterDelete = firstSite.querySelectorAll('.logistics-method-tbody tr').length;

    clickTab('计算设置');
    const tabLabels = Array.from(document.querySelectorAll('.drawer-tab')).map((el) => el.textContent.trim());
    const annual = document.getElementById('source-annual-plan');
    const forecast = document.getElementById('source-forecast-sales');
    return JSON.stringify({
      procurementSummary,
      hasProcurementHint,
      fbaWidth,
      firstSafetyRowsBefore,
      addSafetyDisabled,
      firstSafetyRowsAfter,
      duplicateAlert,
      frequencyWidth,
      logisticsRowsBefore,
      logisticsRowsAfterAdd,
      logisticsRowsAfterDelete,
      tabLabels,
      activeTab: document.querySelector('.drawer-tab.active')?.textContent.trim(),
      annualChecked: annual.checked,
      annualDisabled: annual.disabled,
      forecastChecked: forecast.checked
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
