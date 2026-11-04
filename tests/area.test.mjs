import assert from 'node:assert/strict';
import { normArea, listAreas, groupByArea } from '../src/renderer/services/areas.js';

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

// 全都没分区 → 只有一组 null；空列表 → 没有组
assert.deepEqual(groupByArea([mk('1')]).map(s => s.area), [null]);
assert.deepEqual(groupByArea([]), []);

console.log('area tests passed');
