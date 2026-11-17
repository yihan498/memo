import assert from 'node:assert/strict';
import { normArea, listAreas, groupByArea, clearArea } from '../src/renderer/services/areas.js';

const mk = (text, area) => ({ id: text, text, area });

// 规范化
assert.equal(normArea('  产品 '), '产品');
assert.equal(normArea('   '), null);
assert.equal(normArea(undefined), null);

// 候选去重
assert.deepEqual(listAreas([mk('a', 'B'), mk('b', ' B'), mk('c', null), mk('d', 'A')]), ['A', 'B']);

// 分组：有分区的在前（按名字），未分区的在最后；组内保持原顺序
const g = groupByArea([mk('1', null), mk('2', 'work'), mk('3', 'alpha'), mk('4', 'work '), mk('5', '')]);
assert.deepEqual(g.map(s => s.area), ['alpha', 'work', null]);
assert.deepEqual(g.map(s => s.tasks.map(t => t.text)), [['3'], ['2', '4'], ['1', '5']]);

// 全部完成的分区沉底（排在未分区之后）；未分区全完成也沉底
const d = (text, area, completed) => ({ id: text, text, area, completed });
const g2 = groupByArea([d('1', 'alpha', true), d('2', 'alpha', true), d('3', 'beta', false), d('4', 'beta', true), d('5', null, false), d('6', 'gamma', true)]);
assert.deepEqual(g2.map(s => [s.area, s.done]), [['beta', false], [null, false], ['alpha', true], ['gamma', true]]);
assert.deepEqual(g2[2].tasks.map(t => t.text), ['1', '2']); // 组内顺序不变
assert.deepEqual(groupByArea([d('1', null, true), d('2', 'x', false)]).map(s => s.area), ['x', null]);

// 全都没分区 → 只有一组 null；空列表 → 没有组
assert.deepEqual(groupByArea([mk('1')]).map(s => s.area), [null]);
assert.deepEqual(groupByArea([]), []);

// 删除分区：只去掉这个分区的标签，条目保留；可按条件只改一类；不改原数组
const src = [{ id: '1', area: 'work', type: 'daily' }, { id: '2', area: ' work', type: 'todo' }, { id: '3', area: 'alpha', type: 'daily' }];
const c1 = clearArea(src, 'work');
assert.deepEqual(c1.map(t => t.area), [null, null, 'alpha']);
assert.equal(c1.length, 3);
assert.equal(src[0].area, 'work');
assert.deepEqual(clearArea(src, 'work', t => t.type === 'daily').map(t => t.area), [null, ' work', 'alpha']);
assert.deepEqual(clearArea(src, '  '), src);

console.log('area tests passed');
