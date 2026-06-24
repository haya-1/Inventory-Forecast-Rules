(function () {
  'use strict';

  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

  var CHECK_INTERVAL_MS = 5 * 60 * 1000;
  var baselineSignature = null;
  var checkInFlight = false;
  var updateDetected = false;

  function fingerprint(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function latestPageUrl() {
    var url = new URL(location.href);
    url.hash = '';
    url.searchParams.set('__prototype_update_check', String(Date.now()));
    return url.toString();
  }

  function fetchLatestSignature() {
    return fetch(latestPageUrl(), {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-cache' }
    }).then(function (response) {
      if (!response.ok) throw new Error('Update check failed: ' + response.status);
      return response.text();
    }).then(fingerprint);
  }

  function reloadLatestVersion() {
    var url = new URL(location.href);
    url.searchParams.delete('__prototype_update_check');
    url.searchParams.set('__prototype_version', String(Date.now()));
    location.replace(url.toString());
  }

  function showUpdateNotice() {
    if (updateDetected) return;
    updateDetected = true;

    var style = document.createElement('style');
    style.id = 'prototype-update-style';
    style.textContent =
      '#prototype-update-notice{' +
        'position:fixed;right:24px;bottom:24px;z-index:2147483647;' +
        'display:flex;align-items:center;gap:16px;max-width:460px;' +
        'padding:14px 16px;background:#fff;border:1px solid #dcdfe6;' +
        'border-radius:6px;box-shadow:0 8px 28px rgba(0,0,0,.18);' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;' +
        'color:#303133;font-size:14px;line-height:1.5}' +
      '#prototype-update-notice .prototype-update-message{flex:1;min-width:0}' +
      '#prototype-update-notice strong{display:block;margin-bottom:2px;font-size:14px}' +
      '#prototype-update-notice span{color:#606266;font-size:13px}' +
      '#prototype-update-notice button{flex:0 0 auto;border:0;border-radius:4px;' +
        'padding:8px 14px;background:#409eff;color:#fff;font-size:13px;cursor:pointer}' +
      '#prototype-update-notice button:hover{background:#66b1ff}' +
      '@media(max-width:640px){#prototype-update-notice{left:12px;right:12px;bottom:12px;max-width:none}}';
    document.head.appendChild(style);

    var notice = document.createElement('div');
    notice.id = 'prototype-update-notice';
    notice.setAttribute('role', 'status');
    notice.innerHTML =
      '<div class="prototype-update-message">' +
        '<strong>发现新版本</strong>' +
        '<span>原型已更新，刷新后可查看最新内容。</span>' +
      '</div>' +
      '<button type="button">立即刷新</button>';
    notice.querySelector('button').addEventListener('click', reloadLatestVersion);
    document.body.appendChild(notice);
  }

  function checkForUpdate() {
    if (checkInFlight || updateDetected) return;
    checkInFlight = true;
    fetchLatestSignature().then(function (signature) {
      if (baselineSignature === null) {
        baselineSignature = signature;
      } else if (signature !== baselineSignature) {
        showUpdateNotice();
      }
    }).catch(function () {
      // Network interruptions should not affect normal prototype usage.
    }).finally(function () {
      checkInFlight = false;
    });
  }

  function start() {
    checkForUpdate();
    window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    window.addEventListener('focus', checkForUpdate);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
