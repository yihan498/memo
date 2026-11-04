// 分区（area）：把同一类事项（如「产品」「学习」）框在一起。纯函数，可直接用 node 测试。
// 任务字段 area：字符串，null / 空 = 未分区。每日常规和零碎待办都可以有。

/** 规范化分区名：去首尾空格，空串 → null */
export function normArea(s) {
    return (typeof s === 'string' ? s.trim() : '') || null;
}

/** 所有已用过的分区名（去重、按名字排序），给输入框做候选 */
export function listAreas(tasks) {
    const set = new Set((tasks || []).map(t => normArea(t.area)).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

/**
 * 按分区分组。顺序：还有没做完的分区（按名字）→ 未分区 → 已全部完成的分区（按名字）。
 * 未分区那组如果也全做完了，同样沉到最底。组内保持传入顺序（调用方先排好序再分组）。
 * @returns [{ area: string|null, tasks: [], done: boolean }]
 */
export function groupByArea(tasks) {
    const order = listAreas(tasks);
    const map = new Map(order.map(a => [a, []]));
    const rest = [];
    (tasks || []).forEach(t => {
        const a = normArea(t.area);
        if (a) map.get(a).push(t); else rest.push(t);
    });
    const sections = order.map(a => ({ area: a, tasks: map.get(a) }));
    if (rest.length) sections.push({ area: null, tasks: rest });
    sections.forEach(s => { s.done = s.tasks.every(t => t.completed); });
    // 稳定排序：没做完的在前，内部保持「分区按名字、未分区在后」
    return sections.filter(s => !s.done).concat(sections.filter(s => s.done));
}
