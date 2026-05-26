
    function initSidebarMenu() {
      var appLayout = document.querySelector('.app-layout');
      var backdrop = document.getElementById('sidebar-backdrop');
      var replenishTrigger = document.querySelector('.primary-item[data-submenu="replenish"]');
      var protoTrigger = document.querySelector('.primary-item[data-submenu="proto"]');
      var systemTrigger = document.querySelector('.primary-item[data-submenu="system"]');
      var replenishPanel = document.getElementById('replenish-submenu');
      var protoPanel = document.getElementById('proto-submenu');
      var systemPanel = document.getElementById('system-submenu');
      if (!appLayout || !backdrop) return;

      function closeAllSubmenus() {
        appLayout.classList.remove('submenu-open');
        [replenishPanel, protoPanel, systemPanel].forEach(function(panel) {
          if (panel) panel.classList.remove('open');
        });
      }

      function bindToggle(trigger, panel) {
        if (!trigger || !panel) return;
        trigger.addEventListener('click', function(e) {
          e.preventDefault();
          var willOpen = !panel.classList.contains('open');
          closeAllSubmenus();
          if (willOpen) {
            panel.classList.add('open');
            appLayout.classList.add('submenu-open');
          }
        });
      }

      bindToggle(replenishTrigger, replenishPanel);
      bindToggle(protoTrigger, protoPanel);
      bindToggle(systemTrigger, systemPanel);
      backdrop.addEventListener('click', closeAllSubmenus);

      document.querySelectorAll('.sidebar-submenu-panel a.submenu-item').forEach(function(a) {
        a.addEventListener('click', closeAllSubmenus);
      });

      document.querySelectorAll('.primary-item[href="#"]:not([data-submenu])').forEach(function(item) {
        item.addEventListener('click', function(e) {
          e.preventDefault();
        });
      });
    }

    initSidebarMenu();

    (function initStockingRulePage() {
      var RULE_STORAGE_KEY = 'stocking_rule_config_rules_v2';
      var PARENT_STORAGE_KEY = 'sf_replenish_parent_list_v1';
      var editingRuleId = null;
      var selectedParents = [];
      var parentPickCodes = new Set();

      var drawer = document.getElementById('rule-drawer');
      var drawerMask = document.getElementById('rule-drawer-mask');
      var parentModal = document.getElementById('sf-modal-parent-pick');
      var parentDisplay = document.getElementById('rule-parent-display');
      var confirmModal = document.getElementById('sf-confirm-modal');
      var pendingConfirmAction = null;
      var drawerBaseline = '';
      var toastTimer = null;

      function defaultParentList() {
        return [
          { code: 'LFT00002261', asin: 'B083J69DSQ', platform: 'Amazon', site: '美国', store: 'noorkie Inc-US', spu: 'ST18106', owner: '陈柏宏', days: '0/0' },
          { code: 'LFT00002260', asin: 'B09K799DH7', platform: 'Amazon', site: '美国', store: 'STQWALKING_sandbox-US', spu: 'ST210808', owner: '黄国阳', days: '0/0' },
          { code: 'LFT00000784', asin: 'B07NV7QK7H', platform: 'Amazon', site: '英国', store: 'STEP QUEEN INC-UK', spu: 'HK1839', owner: '黄利萍', days: '0/0' },
          { code: 'LFT00000783', asin: 'B0F8GGJ7LK', platform: 'Amazon', site: '英国', store: 'STEP QUEEN INC-UK', spu: 'STK2527157', owner: '余滢', days: '0/0' },
          { code: 'LFT00000778', asin: 'B0F8GTKXQK', platform: 'Amazon', site: '德国', store: 'STEP QUEEN INC-DE', spu: 'STK2527157', owner: '余滢', days: '0/0' },
          { code: 'LFT00000755', asin: 'B0GLNK47Y9', platform: 'Amazon', site: '美国', store: 'STQ Inc-US', spu: 'WT82527258', owner: '黄利萍', days: '0/5' }
        ];
      }

      function getParentList() {
        try {
          var raw = localStorage.getItem(PARENT_STORAGE_KEY);
          var parsed = raw ? JSON.parse(raw) : null;
          if (Array.isArray(parsed) && parsed.length) return parsed;
        } catch (err) {}
        var list = defaultParentList();
        try {
          localStorage.setItem(PARENT_STORAGE_KEY, JSON.stringify(list));
        } catch (err) {}
        return list;
      }

      function escapeHtml(value) {
        return String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function showPageMessage(message, type) {
        var toast = document.getElementById('page-toast');
        if (!toast) return;
        window.clearTimeout(toastTimer);
        toast.textContent = message;
        toast.className = 'page-toast show ' + (type || '');
        toastTimer = window.setTimeout(function() {
          toast.className = 'page-toast ' + (type || '');
        }, 2600);
      }

      function showConfirm(options) {
        options = options || {};
        if (!confirmModal) return;
        document.getElementById('sf-confirm-title').textContent = options.title || '确认操作';
        document.getElementById('sf-confirm-message').textContent = options.message || '确认继续？';
        var okBtn = document.getElementById('sf-confirm-ok');
        okBtn.textContent = options.confirmText || '确认';
        okBtn.className = 'btn ' + (options.danger ? 'btn-danger-outline' : 'btn-primary');
        pendingConfirmAction = typeof options.onConfirm === 'function' ? options.onConfirm : null;
        confirmModal.classList.add('show');
        confirmModal.setAttribute('aria-hidden', 'false');
      }

      function closeConfirm() {
        if (!confirmModal) return;
        confirmModal.classList.remove('show');
        confirmModal.setAttribute('aria-hidden', 'true');
        pendingConfirmAction = null;
      }

      function toInt(value, fallback) {
        var n = parseInt(value, 10);
        if (Number.isNaN(n)) return fallback || 0;
        return n;
      }

      function formatNow() {
        var d = new Date();
        var pad = function(n) {
          return n < 10 ? '0' + n : String(n);
        };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      }

      function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
      }

      function getDefaultFormState() {
        return {
          ruleCode: '',
          name: '',
          enabled: true,
          parentCodes: [],
          procurement: {
            purchaseLead: 30,
            purchaseFrequency: 15,
            pickupPrep: 7,
            qualityInspection: 2
          },
          fbaSafetyDays: 28,
          safetyAdjustments: [
            { key: 'levelA', label: 'A - 爆款', enabled: true, days: 45 },
            { key: 'levelB', label: 'B - 旺款', enabled: true, days: 28 },
            { key: 'levelC', label: 'C - 利润款', enabled: true, days: 20 },
            { key: 'newProduct', label: '新品', enabled: true, days: 45 },
            { key: 'mainColor', label: '主颜色', enabled: true, days: 45 },
            { key: 'subColor', label: '次颜色', enabled: true, days: 28 },
            { key: 'organicTraffic', label: 'OR 自然流量 ASIN', enabled: true, days: 45 },
            { key: 'adTraffic', label: 'AD 广告流量 ASIN', enabled: true, days: 28 }
          ],
          logisticsSites: [
            {
              key: 'northAmerica',
              name: '北美站',
              shipFrequencyDays: 7,
              methods: [
                { key: 'fastShip', name: '快船', enabled: true, leadTimeDays: 35 },
                { key: 'slowShip', name: '慢船', enabled: true, leadTimeDays: 55 }
              ]
            },
            {
              key: 'europe',
              name: '欧洲站',
              shipFrequencyDays: 7,
              methods: [
                { key: 'fastShip', name: '快船', enabled: true, leadTimeDays: 40 },
                { key: 'slowShip', name: '慢船', enabled: true, leadTimeDays: 60 }
              ]
            }
          ],
          calculation: {
            deductStockoutSales: true
          }
        };
      }

      function procurementTotal(procurement) {
        procurement = procurement || {};
        return toInt(procurement.purchaseLead, 0) + toInt(procurement.purchaseFrequency, 0) + toInt(procurement.pickupPrep, 0) + toInt(procurement.qualityInspection, 0);
      }

      function parentLabelFromCodes(codes) {
        if (!codes || !codes.length) return '未选择父体';
        return codes.join('、');
      }

      function parentSummaryHtml(codes) {
        codes = Array.isArray(codes) ? codes : [];
        if (!codes.length) return '<span class="muted-text">未选择父体</span>';
        var html = codes.slice(0, 2).map(function(code) {
          return '<span class="parent-code-chip">' + escapeHtml(code) + '</span>';
        }).join('');
        if (codes.length > 2) {
          html += '<span class="parent-count">共 ' + codes.length + ' 个</span>';
        }
        return html;
      }

      function normalizeForm(form) {
        var d = getDefaultFormState();
        form = form || {};
        var merged = Object.assign(d, form);
        merged.procurement = Object.assign(d.procurement, form.procurement || {});
        merged.calculation = Object.assign(d.calculation, form.calculation || {});
        merged.parentCodes = Array.isArray(form.parentCodes) ? form.parentCodes : [];
        merged.safetyAdjustments = d.safetyAdjustments.map(function(row) {
          var found = (form.safetyAdjustments || []).filter(function(x) { return x.key === row.key; })[0];
          return Object.assign({}, row, found || {});
        });
        merged.logisticsSites = d.logisticsSites.map(function(site) {
          var foundSite = (form.logisticsSites || []).filter(function(x) { return x.key === site.key; })[0] || {};
          return {
            key: site.key,
            name: site.name,
            shipFrequencyDays: foundSite.shipFrequencyDays != null ? foundSite.shipFrequencyDays : site.shipFrequencyDays,
            methods: site.methods.map(function(method) {
              var foundMethod = (foundSite.methods || []).filter(function(x) { return x.key === method.key; })[0];
              return Object.assign({}, method, foundMethod || {});
            })
          };
        });
        return merged;
      }

      function makeSeedRule(id, name, enabled, parentCodes, formEdits, time) {
        var form = normalizeForm(Object.assign(getDefaultFormState(), formEdits || {}));
        form.ruleCode = id;
        form.name = name;
        form.enabled = enabled;
        form.parentCodes = parentCodes;
        return {
          id: id,
          name: name,
          enabled: enabled,
          parentLabel: parentLabelFromCodes(parentCodes),
          createdBy: '系统',
          createdTime: time,
          updatedBy: '系统',
          updatedTime: time,
          form: form
        };
      }

      function seedRules() {
        var time = '2026-05-21 15:40';
        return [
          makeSeedRule(
            'BR20260521001',
            '北美站标准备货规则',
            true,
            ['LFT00002261', 'LFT00002260'],
            {},
            time
          ),
          makeSeedRule(
            'BR20260521002',
            '欧洲站稳态备货规则',
            true,
            ['LFT00000784', 'LFT00000783'],
            {
              procurement: { purchaseLead: 35, purchaseFrequency: 14, pickupPrep: 7, qualityInspection: 2 },
              fbaSafetyDays: 30
            },
            time
          )
        ];
      }

      function loadRules() {
        try {
          var raw = localStorage.getItem(RULE_STORAGE_KEY);
          var parsed = raw ? JSON.parse(raw) : null;
          if (Array.isArray(parsed) && parsed.length) {
            return parsed.map(function(rule) {
              rule.form = normalizeForm(rule.form || {});
              rule.name = rule.name || rule.form.name || '';
              rule.enabled = rule.enabled !== false;
              rule.parentLabel = parentLabelFromCodes(rule.form.parentCodes);
              return rule;
            });
          }
        } catch (err) {}
        var rules = seedRules();
        saveRules(rules);
        return rules;
      }

      function saveRules(rules) {
        try {
          localStorage.setItem(RULE_STORAGE_KEY, JSON.stringify(rules));
        } catch (err) {}
      }

      function generateRuleId(rules) {
        var d = new Date();
        var pad = function(n) {
          return n < 10 ? '0' + n : String(n);
        };
        var prefix = 'BR' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
        var max = 0;
        (rules || []).forEach(function(rule) {
          if (rule.id && rule.id.indexOf(prefix) === 0) {
            max = Math.max(max, toInt(rule.id.slice(prefix.length), 0));
          }
        });
        return prefix + String(max + 1).padStart(3, '0');
      }

      function renderRuleList() {
        var tbody = document.getElementById('rule-list-tbody');
        var countEl = document.getElementById('rule-list-count');
        if (!tbody) return;
        var keyword = (document.getElementById('filter-name').value || '').trim().toLowerCase();
        var status = document.getElementById('filter-status').value;
        var rules = loadRules().filter(function(rule) {
          var hitName = !keyword || (rule.name || '').toLowerCase().indexOf(keyword) !== -1;
          var hitStatus = !status || (status === 'enabled' ? rule.enabled !== false : rule.enabled === false);
          return hitName && hitStatus;
        });
        tbody.innerHTML = '';
        if (!rules.length) {
          var empty = document.createElement('tr');
          empty.innerHTML = '<td class="empty-row" colspan="10">暂无数据</td>';
          tbody.appendChild(empty);
        } else {
          rules.forEach(function(rule) {
            var form = normalizeForm(rule.form || {});
            var procurement = procurementTotal(form.procurement);
            var siteNames = form.logisticsSites.map(function(site) { return site.name; }).join('、');
            var parentTitle = parentLabelFromCodes(form.parentCodes);
            var tr = document.createElement('tr');
            tr.innerHTML =
              '<td class="mono-cell">' + escapeHtml(rule.id) + '</td>' +
              '<td><div class="rule-name-main">' + escapeHtml(rule.name) + '</div><div class="rule-name-sub">' + escapeHtml(rule.updatedTime || '-') + '</div></td>' +
              '<td><span class="tag ' + (rule.enabled === false ? 'tag-info' : 'tag-success') + '">' + (rule.enabled === false ? '停用' : '启用') + '</span></td>' +
              '<td><div class="parent-summary" title="' + escapeHtml(parentTitle) + '">' + parentSummaryHtml(form.parentCodes) + '</div></td>' +
              '<td class="numeric-cell"><span class="metric-value">' + procurement + '</span> 天</td>' +
              '<td class="numeric-cell"><span class="metric-value">' + toInt(form.fbaSafetyDays, 0) + '</span> 天</td>' +
              '<td>' + escapeHtml(siteNames) + '</td>' +
              '<td>' + escapeHtml(rule.createdBy || '-') + '</td>' +
              '<td>' + escapeHtml(rule.updatedTime || '-') + '</td>' +
              '<td><div class="table-actions">' +
                '<button type="button" class="btn-text" data-action="edit" data-id="' + escapeHtml(rule.id) + '">编辑</button>' +
                '<button type="button" class="btn-text btn-danger" data-action="delete" data-id="' + escapeHtml(rule.id) + '">删除</button>' +
              '</div></td>';
            tbody.appendChild(tr);
          });
        }
        if (countEl) countEl.textContent = '共 ' + rules.length + ' 条';
      }

      function updateParentDisplay() {
        if (!parentDisplay) return;
        if (!selectedParents.length) {
          parentDisplay.value = '';
          parentDisplay.placeholder = '未选择父体';
          parentDisplay.removeAttribute('title');
          return;
        }
        var codes = selectedParents.map(function(parent) { return parent.code; });
        parentDisplay.value = codes.length > 2 ? codes.slice(0, 2).join('、') + ' 等，共 ' + codes.length + ' 个' : codes.join('、');
        parentDisplay.title = codes.join('、');
        clearFieldError(parentDisplay);
      }

      function setInputValue(id, value) {
        var el = document.getElementById(id);
        if (el) el.value = value == null ? '' : value;
      }

      function setChecked(id, value) {
        var el = document.getElementById(id);
        if (el) el.checked = !!value;
      }

      function getErrorWrap(input) {
        return input ? (input.closest('.drawer-field') || input.closest('td') || input.parentElement) : null;
      }

      function clearFieldError(input) {
        if (!input) return;
        input.classList.remove('is-error');
        var wrap = getErrorWrap(input);
        if (!wrap) return;
        var error = wrap.querySelector('.field-error');
        if (error) error.remove();
      }

      function clearFieldErrors() {
        document.querySelectorAll('.is-error').forEach(function(input) {
          input.classList.remove('is-error');
        });
        document.querySelectorAll('.field-error').forEach(function(error) {
          error.remove();
        });
      }

      function setFieldError(input, message) {
        if (!input) return;
        clearFieldError(input);
        input.classList.add('is-error');
        var wrap = getErrorWrap(input);
        if (!wrap) return;
        var error = document.createElement('div');
        error.className = 'field-error';
        error.textContent = message;
        wrap.appendChild(error);
      }

      function getNumberInputLabel(input) {
        if (!input) return '天数';
        if (input.id === 'fba-safety-days') return '默认安全天数';
        if (input.classList.contains('site-frequency-input')) return 'CN 仓发货频率';
        if (input.classList.contains('safety-days')) {
          var safetyRow = input.closest('tr');
          return (safetyRow && safetyRow.getAttribute('data-label') ? safetyRow.getAttribute('data-label') : '安全库存') + '安全天数';
        }
        var row = input.closest('tr');
        if (row && row.cells && row.cells.length) return row.cells[0].textContent.trim() || '天数';
        return '天数';
      }

      function serializeFormState(form) {
        return JSON.stringify(normalizeForm(form || collectFormState()));
      }

      function markDrawerClean() {
        drawerBaseline = serializeFormState(collectFormState());
        clearFieldErrors();
      }

      function isDrawerDirty() {
        return drawer.classList.contains('open') && drawerBaseline && serializeFormState(collectFormState()) !== drawerBaseline;
      }

      function updateProcurementSummary() {
        var lead = toInt(document.getElementById('purchase-lead').value, 0);
        var freq = toInt(document.getElementById('purchase-frequency').value, 0);
        var pickup = toInt(document.getElementById('pickup-prep').value, 0);
        var qc = toInt(document.getElementById('quality-inspection').value, 0);
        document.getElementById('procurement-total').textContent = lead + freq + pickup + qc;
        document.getElementById('procurement-formula').textContent = lead + ' + ' + freq + ' + ' + pickup + ' + ' + qc;
      }

      function collectSafetyAdjustments() {
        return Array.from(document.querySelectorAll('#safety-adjust-tbody tr')).map(function(row) {
          return {
            key: row.getAttribute('data-safety-key'),
            label: row.getAttribute('data-label'),
            enabled: row.querySelector('.safety-enabled').checked,
            days: toInt(row.querySelector('.safety-days').value, 0)
          };
        });
      }

      function collectLogisticsSites() {
        return Array.from(document.querySelectorAll('.site-card')).map(function(card) {
          return {
            key: card.getAttribute('data-site-key'),
            name: card.querySelector('.tag').textContent.trim(),
            shipFrequencyDays: toInt(card.querySelector('.site-frequency-input').value, 0),
            methods: Array.from(card.querySelectorAll('tbody tr')).map(function(row) {
              return {
                key: row.getAttribute('data-method-key'),
                name: row.cells[0].textContent.trim(),
                enabled: row.querySelector('.method-enabled').checked,
                leadTimeDays: toInt(row.querySelector('.method-lead').value, 0)
              };
            })
          };
        });
      }

      function collectFormState() {
        return normalizeForm({
          ruleCode: document.getElementById('rule-code-input').value,
          name: document.getElementById('rule-name-input').value,
          enabled: document.getElementById('rule-enabled-input').checked,
          parentCodes: selectedParents.map(function(parent) { return parent.code; }),
          procurement: {
            purchaseLead: toInt(document.getElementById('purchase-lead').value, 0),
            purchaseFrequency: toInt(document.getElementById('purchase-frequency').value, 0),
            pickupPrep: toInt(document.getElementById('pickup-prep').value, 0),
            qualityInspection: toInt(document.getElementById('quality-inspection').value, 0)
          },
          fbaSafetyDays: toInt(document.getElementById('fba-safety-days').value, 0),
          safetyAdjustments: collectSafetyAdjustments(),
          logisticsSites: collectLogisticsSites(),
          calculation: {
            deductStockoutSales: document.getElementById('deduct-stockout-sales').checked
          }
        });
      }

      function applySafetyAdjustments(rows) {
        var map = {};
        (rows || []).forEach(function(row) {
          map[row.key] = row;
        });
        document.querySelectorAll('#safety-adjust-tbody tr').forEach(function(row) {
          var key = row.getAttribute('data-safety-key');
          var data = map[key] || {};
          row.querySelector('.safety-enabled').checked = data.enabled !== false;
          row.querySelector('.safety-days').value = data.days != null ? data.days : 0;
        });
      }

      function applyLogisticsSites(sites) {
        var map = {};
        (sites || []).forEach(function(site) {
          map[site.key] = site;
        });
        document.querySelectorAll('.site-card').forEach(function(card) {
          var site = map[card.getAttribute('data-site-key')] || {};
          card.querySelector('.site-frequency-input').value = site.shipFrequencyDays != null ? site.shipFrequencyDays : 0;
          var methodMap = {};
          (site.methods || []).forEach(function(method) {
            methodMap[method.key] = method;
          });
          card.querySelectorAll('tbody tr').forEach(function(row) {
            var method = methodMap[row.getAttribute('data-method-key')] || {};
            row.querySelector('.method-enabled').checked = method.enabled !== false;
            row.querySelector('.method-lead').value = method.leadTimeDays != null ? method.leadTimeDays : 0;
          });
        });
      }

      function applyFormState(form) {
        form = normalizeForm(form);
        setInputValue('rule-code-input', form.ruleCode || '');
        setInputValue('rule-name-input', form.name || '');
        setChecked('rule-enabled-input', form.enabled !== false);
        setInputValue('purchase-lead', form.procurement.purchaseLead);
        setInputValue('purchase-frequency', form.procurement.purchaseFrequency);
        setInputValue('pickup-prep', form.procurement.pickupPrep);
        setInputValue('quality-inspection', form.procurement.qualityInspection);
        setInputValue('fba-safety-days', form.fbaSafetyDays);
        setChecked('deduct-stockout-sales', form.calculation.deductStockoutSales !== false);
        selectedParents = (form.parentCodes || []).map(function(code) {
          var found = getParentList().filter(function(parent) { return parent.code === code; })[0];
          return found || { code: code, asin: '', platform: '', site: '', store: '', spu: '', owner: '', days: '' };
        });
        updateParentDisplay();
        applySafetyAdjustments(form.safetyAdjustments);
        applyLogisticsSites(form.logisticsSites);
        updateProcurementSummary();
      }

      function showDrawer() {
        drawerMask.classList.add('show');
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
      }

      function closeDrawer() {
        drawerMask.classList.remove('show');
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        editingRuleId = null;
        drawerBaseline = '';
        clearFieldErrors();
      }

      function requestCloseDrawer() {
        if (!isDrawerDirty()) {
          closeDrawer();
          return;
        }
        showConfirm({
          title: '放弃未保存修改？',
          message: '当前抽屉内的配置尚未提交，关闭后本次修改不会保存。',
          confirmText: '放弃修改',
          danger: true,
          onConfirm: closeDrawer
        });
      }

      function beginNewRule() {
        editingRuleId = null;
        selectedParents = [];
        applyFormState(getDefaultFormState());
        markDrawerClean();
        showDrawer();
      }

      function beginEditRule(ruleId) {
        var rule = loadRules().filter(function(item) { return item.id === ruleId; })[0];
        if (!rule) return;
        editingRuleId = ruleId;
        var form = normalizeForm(rule.form || {});
        form.ruleCode = rule.id;
        form.name = rule.name;
        form.enabled = rule.enabled !== false;
        applyFormState(form);
        markDrawerClean();
        showDrawer();
      }

      function findRuleOwningParent(rules, code, excludeId) {
        if (!code) return null;
        for (var i = 0; i < rules.length; i++) {
          var rule = rules[i];
          if (!rule || rule.id === excludeId) continue;
          var codes = rule.form && rule.form.parentCodes ? rule.form.parentCodes : [];
          if (codes.indexOf(code) !== -1) return rule;
        }
        return null;
      }

      function validateNonNegativeInteger(selector, label) {
        var ok = true;
        document.querySelectorAll(selector).forEach(function(input) {
          var value = input.value;
          if (value === '' || !/^\d+$/.test(String(value))) {
            setFieldError(input, getNumberInputLabel(input) + '必须为大于等于 0 的整数');
            if (ok) input.focus();
            ok = false;
          }
        });
        return ok;
      }

      function submitRule() {
        clearFieldErrors();
        var form = collectFormState();
        var name = (form.name || '').trim();
        var valid = true;
        var nameInput = document.getElementById('rule-name-input');
        if (!name) {
          setFieldError(nameInput, '请输入规则名称');
          nameInput.focus();
          valid = false;
        }
        form.name = name;
        if (!form.parentCodes || !form.parentCodes.length) {
          setFieldError(parentDisplay, '请选择适用父体');
          if (valid) document.getElementById('rule-parent-pick').focus();
          valid = false;
        }
        if (!validateNonNegativeInteger('input[type="number"]', '天数')) valid = false;

        var rules = loadRules();
        for (var i = 0; i < form.parentCodes.length; i++) {
          var other = findRuleOwningParent(rules, form.parentCodes[i], editingRuleId);
          if (other) {
            setFieldError(parentDisplay, '父体 ' + form.parentCodes[i] + ' 已绑定其他规则：' + other.id + ' ' + (other.name || '') + '。一个父体只能被一条备货规则占用。');
            valid = false;
            break;
          }
        }

        if (!valid) {
          showPageMessage('请先修正标红字段', 'error');
          return;
        }

        var now = formatNow();
        var id = editingRuleId || generateRuleId(rules);
        var wasEditing = !!editingRuleId;
        form.ruleCode = id;
        var nextRule = {
          id: id,
          name: name,
          enabled: form.enabled !== false,
          parentLabel: parentLabelFromCodes(form.parentCodes),
          createdBy: '当前用户',
          createdTime: now,
          updatedBy: '当前用户',
          updatedTime: now,
          form: form
        };

        if (editingRuleId) {
          var idx = -1;
          rules.forEach(function(rule, index) {
            if (rule.id === editingRuleId) idx = index;
          });
          if (idx >= 0) {
            nextRule.createdBy = rules[idx].createdBy || nextRule.createdBy;
            nextRule.createdTime = rules[idx].createdTime || nextRule.createdTime;
            rules[idx] = nextRule;
          }
        } else {
          rules.unshift(nextRule);
        }

        saveRules(rules);
        renderRuleList();
        drawerBaseline = serializeFormState(form);
        closeDrawer();
        showPageMessage(wasEditing ? '备货规则已更新' : '备货规则已新增', 'success');
      }

      function deleteRule(ruleId) {
        var rules = loadRules();
        var rule = rules.filter(function(item) { return item.id === ruleId; })[0];
        if (!rule) return;
        showConfirm({
          title: '删除备货规则',
          message: '确认删除备货规则「' + rule.name + '」？删除后列表将不再显示该规则。',
          confirmText: '删除',
          danger: true,
          onConfirm: function() {
            saveRules(rules.filter(function(item) { return item.id !== ruleId; }));
            renderRuleList();
            showPageMessage('备货规则已删除', 'success');
          }
        });
      }

      function getFilteredParents() {
        var code = (document.getElementById('sf-pf-code').value || '').trim().toLowerCase();
        var asin = (document.getElementById('sf-pf-asin').value || '').trim().toLowerCase();
        var site = document.getElementById('sf-pf-site').value;
        var owner = (document.getElementById('sf-pf-owner').value || '').trim().toLowerCase();
        return getParentList().filter(function(parent) {
          var hitCode = !code || (parent.code || '').toLowerCase().indexOf(code) !== -1;
          var hitAsin = !asin || (parent.asin || '').toLowerCase().indexOf(asin) !== -1;
          var hitSite = !site || parent.site === site;
          var hitOwner = !owner || (parent.owner || '').toLowerCase().indexOf(owner) !== -1;
          return hitCode && hitAsin && hitSite && hitOwner;
        });
      }

      function updateParentPickCount() {
        var count = document.getElementById('sf-parent-pick-count');
        if (count) count.textContent = String(parentPickCodes.size);
        var visible = Array.from(document.querySelectorAll('#sf-parent-pick-tbody .sf-parent-pick-cb:not(:disabled)'));
        var master = document.getElementById('sf-parent-pick-all');
        if (master) {
          master.checked = visible.length > 0 && visible.every(function(cb) { return cb.checked; });
        }
      }

      function renderParentPickRows() {
        var tbody = document.getElementById('sf-parent-pick-tbody');
        if (!tbody) return;
        var rows = getFilteredParents();
        tbody.innerHTML = '';
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#909399;padding:24px;">暂无数据</td></tr>';
          updateParentPickCount();
          return;
        }
        var rules = loadRules();
        rows.forEach(function(parent) {
          var owner = findRuleOwningParent(rules, parent.code, editingRuleId);
          var occupied = !!owner;
          if (occupied) parentPickCodes.delete(parent.code);
          var tr = document.createElement('tr');
          if (occupied) tr.className = 'parent-row-disabled';
          tr.innerHTML =
            '<td><input type="checkbox" class="sf-parent-pick-cb" data-code="' + escapeHtml(parent.code) + '"' + (parentPickCodes.has(parent.code) ? ' checked' : '') + (occupied ? ' disabled' : '') + ' /></td>' +
            '<td>' + escapeHtml(parent.code) + '</td>' +
            '<td><div class="parent-pick-status">' + (occupied ? '<span class="tag tag-warning">已占用</span><span class="occupied-owner">' + escapeHtml(owner.id) + '</span>' : '<span class="tag tag-info">可选择</span>') + '</div></td>' +
            '<td>' + escapeHtml(parent.asin) + '</td>' +
            '<td>' + escapeHtml(parent.platform) + '</td>' +
            '<td>' + escapeHtml(parent.site) + '</td>' +
            '<td>' + escapeHtml(parent.store) + '</td>' +
            '<td>' + escapeHtml(parent.spu) + '</td>' +
            '<td>' + escapeHtml(parent.owner) + '</td>' +
            '<td>' + escapeHtml(parent.days) + '</td>';
          tbody.appendChild(tr);
        });
        tbody.querySelectorAll('.sf-parent-pick-cb').forEach(function(cb) {
          cb.addEventListener('change', function() {
            if (cb.disabled) return;
            var code = cb.getAttribute('data-code');
            if (cb.checked) parentPickCodes.add(code);
            else parentPickCodes.delete(code);
            updateParentPickCount();
          });
        });
        updateParentPickCount();
      }

      function openParentModal() {
        parentPickCodes = new Set(selectedParents.map(function(parent) { return parent.code; }));
        renderParentPickRows();
        parentModal.classList.add('show');
      }

      function closeParentModal() {
        parentModal.classList.remove('show');
      }

      function confirmParentPick() {
        var list = getParentList();
        var rules = loadRules();
        selectedParents = Array.from(parentPickCodes).map(function(code) {
          return list.filter(function(parent) { return parent.code === code; })[0];
        }).filter(function(parent) {
          return parent && !findRuleOwningParent(rules, parent.code, editingRuleId);
        });
        updateParentDisplay();
        closeParentModal();
      }

      document.getElementById('btn-rule-add').addEventListener('click', beginNewRule);
      document.getElementById('rule-drawer-cancel').addEventListener('click', requestCloseDrawer);
      document.getElementById('rule-drawer-submit').addEventListener('click', submitRule);
      drawerMask.addEventListener('click', requestCloseDrawer);
      document.getElementById('rule-parent-pick').addEventListener('click', openParentModal);
      document.getElementById('sf-parent-modal-x').addEventListener('click', closeParentModal);
      document.getElementById('sf-parent-cancel').addEventListener('click', closeParentModal);
      document.getElementById('sf-parent-confirm').addEventListener('click', confirmParentPick);
      document.getElementById('sf-parent-search').addEventListener('click', renderParentPickRows);
      document.getElementById('sf-parent-reset').addEventListener('click', function() {
        document.getElementById('sf-pf-code').value = '';
        document.getElementById('sf-pf-asin').value = '';
        document.getElementById('sf-pf-site').value = '';
        document.getElementById('sf-pf-owner').value = '';
        renderParentPickRows();
      });
      document.getElementById('sf-parent-pick-all').addEventListener('change', function(e) {
        document.querySelectorAll('#sf-parent-pick-tbody .sf-parent-pick-cb:not(:disabled)').forEach(function(cb) {
          cb.checked = e.target.checked;
          var code = cb.getAttribute('data-code');
          if (e.target.checked) parentPickCodes.add(code);
          else parentPickCodes.delete(code);
        });
        updateParentPickCount();
      });
      parentModal.addEventListener('click', function(e) {
        if (e.target === parentModal) closeParentModal();
      });
      document.getElementById('sf-confirm-cancel').addEventListener('click', closeConfirm);
      document.getElementById('sf-confirm-ok').addEventListener('click', function() {
        var action = pendingConfirmAction;
        closeConfirm();
        if (action) action();
      });
      confirmModal.addEventListener('click', function(e) {
        if (e.target === confirmModal) closeConfirm();
      });

      document.getElementById('rule-list-tbody').addEventListener('click', function(e) {
        var btn = e.target.closest('button[data-action]');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        if (btn.getAttribute('data-action') === 'edit') beginEditRule(id);
        if (btn.getAttribute('data-action') === 'delete') deleteRule(id);
      });

      document.getElementById('btn-search').addEventListener('click', renderRuleList);
      document.getElementById('btn-reset').addEventListener('click', function() {
        document.getElementById('filter-name').value = '';
        document.getElementById('filter-status').value = '';
        renderRuleList();
      });
      document.querySelectorAll('.procurement-input').forEach(function(input) {
        input.addEventListener('input', updateProcurementSummary);
      });
      document.querySelectorAll('.drawer-input, .drawer-select').forEach(function(input) {
        input.addEventListener('input', function() {
          clearFieldError(input);
        });
        input.addEventListener('change', function() {
          clearFieldError(input);
        });
      });
      document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (confirmModal.classList.contains('show')) {
          closeConfirm();
          return;
        }
        if (parentModal.classList.contains('show')) {
          closeParentModal();
          return;
        }
        if (drawer.classList.contains('open')) requestCloseDrawer();
      });

      renderRuleList();
    })();
  
