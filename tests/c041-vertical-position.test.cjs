/**
 * C041 回归：搜索框垂直位置可调（距页面顶部/底部留白，0–100%，仅无组件时生效）。
 * 行为断言直接 require 真实发货模块（helpers/load-ts 即时转译），
 * 布局与控件接线断言读取源码。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('./helpers/load-ts.cjs');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('C041: 搜索外观模型提供垂直位置默认值 50% 与 0–100 范围', () => {
  const types = require('../src/services/storage/types.ts');
  assert.equal(types.DEFAULT_SEARCH_POSITION, 50);
  assert.equal(types.SEARCH_POSITION_MIN, 0);
  assert.equal(types.SEARCH_POSITION_MAX, 100);
  assert.equal(types.DEFAULT_SEARCH_APPEARANCE.verticalPosition, 50);
});

test('C041: resolveSearchPosition 缺省回落 50、越界钳制、合法值取整', () => {
  const { resolveSearchPosition, SEARCH_POSITION_MIN, SEARCH_POSITION_MAX } = require('../src/utils/searchAppearance.ts');
  assert.equal(resolveSearchPosition(undefined), 50);
  assert.equal(resolveSearchPosition(null), 50);
  assert.equal(resolveSearchPosition({}), 50);
  assert.equal(resolveSearchPosition({ verticalPosition: Number.NaN }), 50);
  assert.equal(resolveSearchPosition({ verticalPosition: Infinity }), 50);
  assert.equal(resolveSearchPosition({ verticalPosition: -10 }), SEARCH_POSITION_MIN);
  assert.equal(resolveSearchPosition({ verticalPosition: 120 }), SEARCH_POSITION_MAX);
  assert.equal(resolveSearchPosition({ verticalPosition: 42.6 }), 43);
  assert.equal(resolveSearchPosition({ verticalPosition: 75 }), 75);
});

test('C041: 无组件时 App 用上下按比例伸缩的占位层定位搜索框', () => {
  const src = read('src/App.tsx');
  assert.ok(src.includes('resolveSearchPosition'), 'App 须解析垂直位置');
  assert.ok(src.includes('flexGrow: searchVerticalPosition'), '上占位层须按垂直位置伸缩');
  assert.ok(src.includes('flexGrow: 100 - searchVerticalPosition'), '下占位层须按剩余比例伸缩');
  assert.ok(!src.includes('top-[calc(50%-15px)]'), '旧的固定居中偏移须移除');
  assert.ok(src.includes('fixed inset-0'), '无组件时须使用视口内固定容器');
  assert.ok(src.includes('searchGaps={searchVerticalGaps}'), '须把实测上下间距传给外观抽屉');
});

test('C041: 小钟绝对定位在搜索框上方，不参与垂直定位计算', () => {
  const src = read('src/components/search/SearchBar.tsx');
  assert.ok(src.includes('absolute bottom-full'), 'topSlot 须绝对定位在搜索框上方');
});

test('C041: 外观设置提供垂直位置滑块与实测上下间距提示', () => {
  const src = read('src/components/settings/AppearanceDrawer.tsx');
  assert.ok(src.includes('垂直位置'), '搜索分段须有垂直位置控件');
  assert.ok(src.includes('SEARCH_POSITION_MIN') && src.includes('SEARCH_POSITION_MAX'), '滑块范围须引用统一常量');
  assert.ok(src.includes('onUpdateSearch({ verticalPosition:'), '垂直位置须接入搜索外观更新回调');
  assert.ok(src.includes('resolveSearchPosition(search)'), '面板须展示钳制后的真实位置');
  assert.ok(src.includes('距顶部') && src.includes('距底部'), '面板须显示实测距顶/距底像素');
  assert.ok(src.includes('searchGaps'), '面板须接收 App 实测的上下间距');
});
