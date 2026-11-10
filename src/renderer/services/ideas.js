// 想法：随手记下的小念头。和任务分开存（store key: ideas），不参与提醒 / 记录页统计
// 结构：{ id, text, createdAt (ISO), area: string|null, status: 'open'|'done'|'shelved', statusAt?, updatedAt?, source?: 'clipboard' }
//   open 待处理（默认）/ done 已落实 / shelved 搁置（暂时不做，但不删）
import { normArea } from './areas.js';

export const IDEA_STATUS = {
    open: '待处理',
    done: '已落实',
    shelved: '搁置'
};

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const statusOf = (idea) => (IDEA_STATUS[idea.status] ? idea.status : 'open');

// 句子里的「#分区」拿出来当分区，其余是正文；只取第一个
export function splitArea(text) {
    let area = null;
    const rest = String(text || '').replace(/(?:^|\s)#(\S+)/, (m, a) => { area = a; return ' '; });
    return { text: rest.replace(/\s+/g, ' ').trim(), area };
}

export function addIdea(ideas, text, now = new Date(), area = null) {
    const p = splitArea(text);
    if (!p.text) return ideas;
    const id = `idea-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
    return [{ id, text: p.text, area: normArea(p.area || area), status: 'open', createdAt: now.toISOString() }, ...ideas];
}

/**
 * 剪贴板收集（Ctrl+Alt+V，手机发到微信文件传输助手 → 电脑微信复制 → 收进来）
 * 原样收下：不解析「#分区」（微信文字里的 #话题 不该变成分区）；和已有想法同文时不重复收
 * 返回 { ideas, added }
 */
export function captureIdea(ideas, text, now = new Date()) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t || ideas.some(i => i.text === t)) return { ideas, added: false };
    const id = `idea-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
    return { ideas: [{ id, text: t, area: null, status: 'open', source: 'clipboard', createdAt: now.toISOString() }, ...ideas], added: true };
}

// 改正文和分区；正文改成空 = 不改（删除走 ✕）
export function editIdea(ideas, id, text, now = new Date(), area) {
    const p = splitArea(text);
    if (!p.text) return ideas;
    return ideas.map(i => {
        if (i.id !== id) return i;
        const next = { ...i, text: p.text, updatedAt: now.toISOString() };
        if (p.area || area !== undefined) next.area = normArea(p.area || area);
        return next;
    });
}

export function setIdeaStatus(ideas, id, status, now = new Date()) {
    if (!IDEA_STATUS[status]) return ideas;
    return ideas.map(i => (i.id === id ? { ...i, status, statusAt: now.toISOString() } : i));
}

export function removeIdea(ideas, id) {
    return ideas.filter(i => i.id !== id);
}

/** 每种状态有几条（分区筛选后） */
export function countByStatus(ideas, area = null) {
    const c = { open: 0, done: 0, shelved: 0 };
    ideas.filter(i => !area || normArea(i.area) === area).forEach(i => { c[statusOf(i)]++; });
    return c;
}

/** 按状态 + 分区筛选；area 为 null = 全部分区 */
export function filterIdeas(ideas, { status = 'open', area = null } = {}) {
    return ideas.filter(i => statusOf(i) === status && (!area || normArea(i.area) === area));
}

// 按天分组，新的在上：今天 / 昨天 / 11/3 周一（跨年加年份）
export function groupIdeasByDay(ideas, now = new Date()) {
    const today = dayKey(now);
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const yesterday = dayKey(y);
    const sorted = [...ideas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const groups = [];
    for (const idea of sorted) {
        const d = new Date(idea.createdAt);
        const key = dayKey(d);
        let g = groups[groups.length - 1];
        if (!g || g.key !== key) {
            const label = key === today ? '今天' : key === yesterday ? '昨天'
                : `${d.getFullYear() !== now.getFullYear() ? d.getFullYear() + '/' : ''}${d.getMonth() + 1}/${d.getDate()} 周${'日一二三四五六'[d.getDay()]}`;
            g = { key, label, items: [] };
            groups.push(g);
        }
        g.items.push(idea);
    }
    return groups;
}

export function ideaTime(idea) {
    const d = new Date(idea.createdAt);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
