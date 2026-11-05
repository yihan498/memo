import { groupIdeasByDay, ideaTime, filterIdeas, countByStatus, statusOf, IDEA_STATUS } from '../services/ideas.js';
import { listAreas, normArea } from '../services/areas.js';
import { escapeHtml } from '../utils/helpers.js';

const CONFIRM_MS = 3000;
const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6v12M15 6v12"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg>',
    todo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>'
};
const esc = (s) => escapeHtml(s).replace(/"/g, '&quot;');
const md = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };

// 想法页：底部一句话回车就存（可带分区）；顶部按状态切换（待处理 / 已落实 / 搁置）+ 按分区筛选
// 左边圆圈 = 落实；悬停：搁置 / 转待办 / 删除（点两次）；双击改正文和分区
export class Ideas {
    constructor(getState, callbacks) {
        this.getState = getState;          // () => ({ ideas, tasks })
        this.callbacks = callbacks;
        this.list = document.getElementById('ideasList');
        this.input = document.getElementById('ideaInput');
        this.areaInput = document.getElementById('ideaAreaInput');
        this.areaFilter = document.getElementById('ideaAreaFilter');
        this.status = 'open';
        this.area = null;                  // 分区筛选，null = 全部
        this.confirmId = null;
        this.editingId = null;

        const submit = () => {
            const text = this.input.value.trim();
            if (!text) return;
            // 分区：输入框 > 当前筛选的分区；保留不清空，连续记同一类更顺手
            this.callbacks.onAdd(text, normArea(this.areaInput.value) || this.area);
            this.input.value = '';
            if (this.status !== 'open') this.setStatus('open');
            this.input.focus();
        };
        [this.input, this.areaInput].forEach(i => i.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(); }
        }));
        document.getElementById('ideaAddBtn').addEventListener('click', submit);

        document.querySelectorAll('.idea-seg').forEach(b => b.addEventListener('click', () => this.setStatus(b.dataset.status)));
        this.areaFilter.addEventListener('change', () => { this.area = this.areaFilter.value || null; this.render(); });

        this.list.addEventListener('click', (e) => {
            const row = e.target.closest('[data-idea-id]');
            if (!row) return;
            const id = row.dataset.ideaId;
            const idea = this.getState().ideas.find(i => i.id === id);
            if (!idea) return;
            const st = statusOf(idea);
            if (e.target.closest('.idea-check')) this.callbacks.onStatus(id, st === 'done' ? 'open' : 'done');
            else if (e.target.closest('.idea-shelve')) this.callbacks.onStatus(id, st === 'shelved' ? 'open' : 'shelved');
            else if (e.target.closest('.idea-del')) this.requestDelete(id);
            else if (e.target.closest('.idea-todo')) this.callbacks.onToTodo(idea);
            else if (e.target.closest('.idea-area')) { this.area = normArea(idea.area); this.render(); }
        });
        this.list.addEventListener('dblclick', (e) => {
            const row = e.target.closest('[data-idea-id]');
            if (row && !e.target.closest('button')) this.startEdit(row.dataset.ideaId);
        });
    }

    get isEditing() { return !!this.editingId; }

    setStatus(status) {
        this.status = status;
        this.render();
    }

    render() {
        if (this.editingId) return;   // 编辑中不重绘，免得打断
        const { ideas, tasks } = this.getState();
        const areas = listAreas(ideas);
        if (this.area && !areas.includes(this.area)) this.area = null;

        // 顶部：状态切换（带数量）+ 分区筛选（有分区才出现）
        const counts = countByStatus(ideas, this.area);
        document.querySelectorAll('.idea-seg').forEach(b => {
            b.classList.toggle('active', b.dataset.status === this.status);
            b.innerHTML = `${IDEA_STATUS[b.dataset.status]}<span class="seg-n">${counts[b.dataset.status] || ''}</span>`;
        });
        this.areaFilter.classList.toggle('hidden', areas.length === 0);
        const opts = '<option value="">全部分区</option>' + areas.map(a => `<option value="${esc(a)}">${escapeHtml(a)}</option>`).join('');
        if (opts !== this.lastOpts) { this.areaFilter.innerHTML = opts; this.lastOpts = opts; }
        this.areaFilter.value = this.area || '';

        // 分区候选：想法和任务用过的分区都给
        const cand = listAreas([...ideas, ...tasks]).map(a => `<option value="${esc(a)}"></option>`).join('');
        if (cand !== this.lastCand) { document.getElementById('ideaAreaList').innerHTML = cand; this.lastCand = cand; }

        const shown = filterIdeas(ideas, { status: this.status, area: this.area });
        const empty = document.getElementById('ideasEmpty');
        empty.classList.toggle('hidden', shown.length > 0);
        const emptyText = {
            open: ['还没有待处理的想法', '在下方随手记一句，回车就存；任何地方按 Ctrl+Alt+I 直接来这里'],
            done: ['还没有落实的想法', '做成了就点想法左边的圆圈'],
            shelved: ['没有搁置的想法', '暂时不做又舍不得删的，悬停点 ‖ 搁置']
        }[this.status];
        empty.innerHTML = `<p>${emptyText[0]}</p><p class="sub">${emptyText[1]}</p>`;

        this.list.innerHTML = groupIdeasByDay(shown).map(g => `
            <div class="group-label">${g.label} · ${g.items.length}</div>
            ${g.items.map(i => this.itemHtml(i)).join('')}
        `).join('');
        document.getElementById('taskCount').textContent = `待处理 ${countByStatus(ideas).open} / 共 ${ideas.length} 条想法`;
    }

    itemHtml(i) {
        const st = statusOf(i);
        const area = normArea(i.area);
        const meta = [
            area && !this.area ? `<button class="tag idea-area" title="只看这个分区">#${escapeHtml(area)}</button>` : '',
            st !== 'open' && i.statusAt ? `<span>${IDEA_STATUS[st]} ${md(i.statusAt)}</span>` : ''
        ].filter(Boolean).join('');
        const confirm = i.id === this.confirmId;
        return `
            <div class="task idea ${st}" data-idea-id="${i.id}">
                <button class="idea-check" title="${st === 'done' ? '改回待处理' : '标记为已落实'}">${ICON.check}</button>
                <div class="task-body">
                    <p class="task-text">${escapeHtml(i.text)}</p>
                    ${meta ? `<div class="meta">${meta}</div>` : ''}
                </div>
                <span class="idea-time">${ideaTime(i)}</span>
                <button class="delete-btn idea-shelve" title="${st === 'shelved' ? '恢复为待处理' : '搁置（暂时不做）'}">${st === 'shelved' ? ICON.undo : ICON.pause}</button>
                <button class="delete-btn idea-todo" title="转成待办（打开表单，想法保留）">${ICON.todo}</button>
                <button class="delete-btn idea-del${confirm ? ' confirm' : ''}" title="删除（点两次）">${confirm ? '确认删除' : ICON.del}</button>
            </div>`;
    }

    requestDelete(id) {
        clearTimeout(this.confirmTimer);
        if (this.confirmId === id) {
            this.confirmId = null;
            this.callbacks.onDelete(id);
            return;
        }
        this.confirmId = id;
        this.render();
        this.confirmTimer = setTimeout(() => { this.confirmId = null; this.render(); }, CONFIRM_MS);
    }

    // 双击：改正文 + 分区（回车 / 点别处保存，Esc 取消）
    startEdit(id) {
        const idea = this.getState().ideas.find(i => i.id === id);
        const body = this.list.querySelector(`[data-idea-id="${id}"] .task-body`);
        if (!idea || !body) return;
        this.editingId = id;
        body.innerHTML = '<div class="edit-row"><input class="edit-input" type="text"><input class="edit-input edit-area" type="text" list="ideaAreaList" placeholder="分区"></div>';
        const [inp, areaInp] = body.querySelectorAll('input');
        inp.value = idea.text;
        areaInp.value = idea.area || '';
        inp.focus();
        const finish = (save) => {
            if (this.editingId !== id) return;
            this.editingId = null;
            if (save) this.callbacks.onEdit(id, inp.value, areaInp.value);
            else this.render();
        };
        [inp, areaInp].forEach(el => el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); finish(true); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
        }));
        // 焦点在两个框之间切换不算离开
        body.addEventListener('focusout', (e) => { if (!body.contains(e.relatedTarget)) finish(true); });
    }

    focus() { this.input.focus(); }
}
