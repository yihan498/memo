import assert from 'node:assert/strict';
import { addIdea, editIdea, removeIdea, setIdeaStatus, splitArea, filterIdeas, countByStatus, statusOf, groupIdeasByDay, ideaTime } from '../src/renderer/services/ideas.js';

const now = new Date(2026, 10, 5, 15, 30);   // 2026-11-05 周四

// 添加：去空白、空的不加、新的在最前、默认待处理
let list = addIdea([], '  做个番茄钟  ', new Date(2026, 10, 5, 9, 5));
assert.equal(list.length, 1);
assert.equal(list[0].text, '做个番茄钟');
assert.equal(list[0].status, 'open');
assert.equal(list[0].area, null);
assert.equal(addIdea(list, '   ').length, 1);
assert.equal(addIdea(list, '#产品').length, 1);   // 只有分区没有正文 = 不加
list = addIdea(list, '第二个', new Date(2026, 10, 5, 10, 0));
assert.equal(list[0].text, '第二个');
assert.notEqual(list[0].id, list[1].id);
assert.equal(ideaTime(list[1]), '09:05');

// 分区：输入框填的 / 句子里 #xx（句子里的优先）
assert.deepEqual(splitArea('周报导出 #产品 每周日'), { text: '周报导出 每周日', area: '产品' });
assert.deepEqual(splitArea('#自媒体 选题'), { text: '选题', area: '自媒体' });
assert.deepEqual(splitArea('C#很好用'), { text: 'C#很好用', area: null });   // 词中间的 # 不算
assert.equal(addIdea([], '选题', now, ' 自媒体 ')[0].area, '自媒体');
assert.equal(addIdea([], '选题 #产品', now, '自媒体')[0].area, '产品');

// 编辑：空内容不改；area 传 undefined = 不动分区，传 '' = 清掉
const id = list[1].id;
list = editIdea(list, id, '番茄钟', now, '产品');
assert.equal(list.find(i => i.id === id).area, '产品');
assert.equal(editIdea(list, id, '番茄钟 + 白噪音').find(i => i.id === id).area, '产品');
assert.equal(editIdea(list, id, '番茄钟', now, '').find(i => i.id === id).area, null);
assert.equal(editIdea(list, id, '  ').find(i => i.id === id).text, '番茄钟');

// 状态：落实 / 搁置 / 改回；非法状态忽略；旧数据没有 status = 待处理
list = setIdeaStatus(list, id, 'done', now);
assert.equal(statusOf(list.find(i => i.id === id)), 'done');
assert.equal(setIdeaStatus(list, id, 'xx').find(i => i.id === id).status, 'done');
assert.equal(statusOf({ id: 'old', text: 'a' }), 'open');
assert.deepEqual(countByStatus(list), { open: 1, done: 1, shelved: 0 });
assert.deepEqual(countByStatus(list, '产品'), { open: 0, done: 1, shelved: 0 });
assert.deepEqual(filterIdeas(list, { status: 'open' }).map(i => i.text), ['第二个']);
assert.deepEqual(filterIdeas(list, { status: 'done', area: '学习' }), []);

// 删除
assert.equal(removeIdea(list, id).length, 1);

// 分组：今天 / 昨天 / 具体日期，跨年带年份，组内新的在上
list = addIdea([], '做个番茄钟', new Date(2026, 10, 5, 9, 5));
list = addIdea(list, '第二个', new Date(2026, 10, 5, 10, 0));
list = addIdea(list, '昨天的', new Date(2026, 10, 4, 22, 0));
list = addIdea(list, '上周的', new Date(2026, 9, 26, 8, 0));
list = addIdea(list, '去年的', new Date(2025, 11, 31, 8, 0));
const g = groupIdeasByDay(list, now);
assert.deepEqual(g.map(x => x.label), ['今天', '昨天', '10/26 周一', '2025/12/31 周三']);
assert.deepEqual(g[0].items.map(i => i.text), ['第二个', '做个番茄钟']);

console.log('ideas tests passed');

// 剪贴板收集（Ctrl+Alt+V）：原样收下，不把「#话题」当分区；同样内容不重复收
{
    const { captureIdea } = await import('../src/renderer/services/ideas.js');
    let r = captureIdea([], '  好文章 #AI\n https://example.com/a#b  ', new Date(2026, 10, 10, 9));
    assert.equal(r.added, true);
    assert.equal(r.ideas[0].text, '好文章 #AI https://example.com/a#b');
    assert.equal(r.ideas[0].area, null);
    assert.equal(r.ideas[0].source, 'clipboard');
    const again = captureIdea(r.ideas, '好文章 #AI https://example.com/a#b');
    assert.equal(again.added, false);
    assert.equal(again.ideas.length, 1);
    assert.equal(captureIdea(r.ideas, '   ').added, false);
    console.log('captureIdea ok');
}
