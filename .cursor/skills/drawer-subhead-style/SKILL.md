---
name: drawer-subhead-style
description: >-
  Defines the secondary subheading pattern for the 销量预测规则 drawer (and
  similar OMS-style drawers): light blue vertical bar + muted label text, weaker
  than drawer-section-head. Use when adding sub-blocks under a numbered section
  (e.g. 日销权重、促销销量、季节/市场系数、同比销售系数) or when the user asks for
  headings to match 促销销量 / 影响系数子标题样式.
---

# 抽屉内二级小标题（与「促销销量」一致）

在 `销量预测规则.html` 等抽屉表单中，**主节标题**使用 `.drawer-section-head`（如「2. 日均销量规则」「3. 影响系数」）。其下的**子功能块标题**（弱一级、与「促销销量」视觉同级）按下述规范实现。

## 视觉规范

- **结构**：横向 flex，左侧 **3px × 13px** 圆角竖条，颜色 `#a0cfff`；右侧文案 **13px / 字重 500 / 颜色 `#606266`**，`letter-spacing: 0.02em`。
- **间距**：子标题块 `margin-bottom: 10px`（与现有日销权重、促销销量一致）。
- **层级**：不得使用与 `.drawer-section-head` 相同的 15px 粗标题或整宽底边框，避免与主节混淆。
- **说明文案**：子块下的提示使用 `.sf-rule-hint`（12px、`#909399`）。

## HTML 模板

按功能选用 **语义化前缀**，三组 class 必须同时加入样式表中的**分组选择器**（见下节）。

```html
<div class="sf-{域}-subhead" role="heading" aria-level="3">
  <span class="sf-{域}-subhead-bar" aria-hidden="true"></span>
  <span class="sf-{域}-subhead-text">{标题文案}</span>
</div>
```

**已有前缀示例**（`销量预测规则.html`）：

| 区块           | 容器 class            |
|----------------|------------------------|
| 日销权重       | `sf-daily-subhead`     |
| 促销销量       | `sf-promo-subhead`     |
| 影响系数子项   | `sf-coeff-subhead`     |

新增同类子标题时：复制上述结构，将 `{域}` 换为简短英文前缀（如 `yoy`、`lifecycle`），并**把新 class 追加进 CSS 分组**，不要单独写一套尺寸颜色。

## CSS 要求（单一数据源）

在 `销量预测规则.html` 的 `<style>` 中，下列选择器必须**成组维护**（避免子标题样式漂移）：

```css
.sf-daily-subhead,
.sf-promo-subhead,
.sf-coeff-subhead {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.sf-daily-subhead-bar,
.sf-promo-subhead-bar,
.sf-coeff-subhead-bar {
  width: 3px;
  height: 13px;
  border-radius: 2px;
  background: #a0cfff;
  flex-shrink: 0;
}

.sf-daily-subhead-text,
.sf-promo-subhead-text,
.sf-coeff-subhead-text {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  letter-spacing: 0.02em;
}
```

添加新子域时：**只增加三行选择器**（各组末尾追加 `, .sf-新域-subhead` 等），勿复制整段规则。

## 与影响系数子块的组合

- 每个系数子块外层可用 `.sf-coeff-block` 控制与上一块的间距。
- **不要**在子标题行右侧放「启用/停用」类开关，除非产品明确要求；本仓库抽屉内影响系数子标题当前为**纯标题**。

## 自检清单

- [ ] 子标题三组 class 已加入上述分组选择器  
- [ ] 未使用 15px + `#303133` + 左侧 `#409eff` 粗条作为主节样式冒充子标题  
- [ ] 说明文字使用 `.sf-rule-hint`  
