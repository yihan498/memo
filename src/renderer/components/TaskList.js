import { createTaskElement } from './TaskItem.js';

const CONFIRM_MS = 3000;

export class TaskList {
    constructor(containerId, callbacks = {}) {
        this.container = document.getElementById(containerId);
        this.callbacks = callbacks;
        this.selectedId = null;
        this.confirmId = null;   // 正在等待二次确认删除的任务
        this.confirmTimer = null;
        this.addingArea = null;  // 正在哪个分区框里直接添加（框内输入行）
        this.container.addEventListener('click', (e) => this.handleEvent(e));
        this.container.addEventListener('dblclick', (e) => this.handleEvent(e));
    }

    /**
     * @param sections [{ area, tasks }]：有 area 的画成一个框，area 为 null 的直接平铺
     * @param groupOf 可选：task => { key, label }，相邻 key 变化时插入分组标题（每个框内重新计）
     * @param ctx 传给每个任务项的上下文（如 late）；ctx.view 决定框内添加行的样式（daily / todo）
     */
    render(sections, groupOf = null, ctx = {}) {
        this.view = ctx.view || 'daily';
        if (this.addingArea && !sections.some(s => s.area === this.addingArea)) this.addingArea = null;
        let addRowBox = null;
        this.ids = sections.flatMap(s => s.tasks.map(t => t.id));
        if (this.selectedId && !this.ids.includes(this.selectedId)) this.selectedId = null;
        this.container.innerHTML = '';
        const frag = document.createDocumentFragment();
        sections.forEach(({ area, tasks, done }) => {
            let parent = frag;
            if (area) {
                const box = document.createElement('section');
                box.className = 'area-box' + (done ? ' done' : '');
                const left = tasks.filter(t => !t.completed).length;
                box.dataset.area = area;
                box.innerHTML = `<div class="area-head"><span class="area-name"></span><span class="area-right"><span class="area-count">${left ? `剩 ${left}` : '全部完成'}</span><button type="button" class="area-add" title="直接在这个分区里添加">+</button></span></div>`;
                box.querySelector('.area-name').textContent = area;
                if (area === this.addingArea) addRowBox = box;
                frag.appendChild(box);
                parent = box;
            }
            let lastKey = null;
            tasks.forEach(task => {
                if (groupOf) {
                    const g = groupOf(task);
                    if (g.key !== lastKey) {
                        const h = document.createElement('div');
                        h.className = `group-label ${g.key}`;
                        h.textContent = g.label;
                        parent.appendChild(h);
                        lastKey = g.key;
                    }
                }
                const el = createTaskElement(task, ctx);
                if (task.id === this.selectedId) el.classList.add('selected');
                if (task.id === this.confirmId) this.markConfirm(el);
                parent.appendChild(el);
            });
        });
        this.container.appendChild(frag);
        if (addRowBox) this.mountAddRow(addRowBox, this.addingArea);
    }

    // --- 分区框内直接添加：点框头的 + → 框里出现输入行，回车即加到这个分区 ---

    toggleAddRow(area) {
        this.addingArea = this.addingArea === area ? null : area;
        this.callbacks.onRerender();
    }

    mountAddRow(box, area) {
        const row = document.createElement('div');
        row.className = 'area-add-row';
        row.innerHTML = this.view === 'daily'
            ? `<input type="text" class="edit-input aa-text">
               <button type="button" class="cd-toggle" title="倒计时：时间用完自动停止并提醒（不选 = 正计时，达标提醒）">倒</button>
               <input type="number" class="edit-input edit-min aa-min" min="1" max="1440" placeholder="分钟" title="想计时就填目标分钟数，留空 = 普通勾选">`
            : `<input type="text" class="edit-input aa-text" title="回车后自动识别时间 / 优先级 / 提醒，打开表单核对后再保存">`;
        const text = row.querySelector('.aa-text');
        text.placeholder = this.view === 'daily' ? '添加到这里，回车' : '一句话添加到这里，回车';
        const min = row.querySelector('.aa-min');
        const cd = row.querySelector('.cd-toggle');
        if (cd) {
            cd.addEventListener('mousedown', (e) => e.preventDefault());
            cd.addEventListener('click', () => cd.classList.toggle('on'));
        }
        const close = () => { if (this.addingArea === area) { this.addingArea = null; this.callbacks.onRerender(); } };
        row.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') { close(); return; }
            if (e.key !== 'Enter' || e.isComposing) return;
            e.preventDefault();
            const v = text.value.trim();
            if (this.view === 'daily') {
                if (!v) { close(); return; }
                // 加完行保持打开，方便连续添加；render 会重建并重新聚焦
                this.callbacks.onAreaAdd(area, v, min.value ? Number(min.value) : null, cd.classList.contains('on'));
            } else {
                this.addingArea = null;
                this.callbacks.onAreaQuick(area, v);
            }
        });
        row.addEventListener('focusout', (e) => {
            if (!row.contains(e.relatedTarget) && !text.value.trim()) setTimeout(close, 0);
        });
        box.querySelector('.area-head').after(row);
        text.focus();
    }

    updateEmptyState(count) {
        document.getElementById('emptyState').classList.toggle('hidden', count !== 0);
        this.container.classList.toggle('hidden', count === 0);
    }

    // --- 删除二次确认：第一次点 → 按钮变「确认删除」，3 秒内再点才删 ---

    markConfirm(el) {
        const btn = el.querySelector('.delete-btn');
        btn.classList.add('confirm');
        btn.textContent = '确认删除';
    }

    requestDelete(id) {
        if (this.confirmId === id) {
            this.clearConfirm();
            this.callbacks.onDelete(id);
            return;
        }
        this.clearConfirm();
        this.confirmId = id;
        const el = this.container.querySelector(`[data-task-id="${id}"]`);
        if (el) this.markConfirm(el);
        this.confirmTimer = setTimeout(() => { this.clearConfirm(); this.callbacks.onRerender(); }, CONFIRM_MS);
    }

    clearConfirm() {
        clearTimeout(this.confirmTimer);
        this.confirmId = null;
    }

    handleEvent(e) {
        const target = e.target;
        const addBtn = e.type === 'click' && target.closest('.area-add');
        if (addBtn) { this.toggleAddRow(addBtn.closest('.area-box').dataset.area); return; }
        const taskEl = target.closest('[data-task-id]');
        if (!taskEl) return;
        const id = taskEl.getAttribute('data-task-id');
        this.select(id, false);

        if (e.type === 'click' && target.classList.contains('task-checkbox')) {
            this.callbacks.onToggle(id);
            return;
        }
        if (e.type === 'click' && target.closest('.delete-btn')) {
            this.requestDelete(id);
            return;
        }
        if (e.type === 'click' && target.closest('.timer-btn')) {
            this.callbacks.onTimer(id);
            return;
        }
        if (e.type === 'dblclick' && target.closest('.task-text-container')) {
            this.callbacks.onEditStart(id);
        }
    }

    // --- 键盘选中 ---

    select(id, scroll = true) {
        this.selectedId = id;
        this.container.querySelectorAll('.task.selected').forEach(x => x.classList.remove('selected'));
        const el = id && this.container.querySelector(`[data-task-id="${id}"]`);
        if (el) {
            el.classList.add('selected');
            if (scroll) el.scrollIntoView({ block: 'nearest' });
        }
    }

    move(delta) {
        if (!this.ids || !this.ids.length) return;
        const i = this.ids.indexOf(this.selectedId);
        const next = i === -1 ? (delta > 0 ? 0 : this.ids.length - 1) : Math.max(0, Math.min(this.ids.length - 1, i + delta));
        this.select(this.ids[next]);
    }

    // 每日常规的行内编辑：名称 + 分区（可空）+ 计时目标（分钟，可空）
    enableEditing(taskId, currentText, targetMin, area, countdown) {
        const el = this.container.querySelector(`[data-task-id="${taskId}"] .task-text-container`);
        if (!el) return;
        el.innerHTML = `
            <div class="edit-row">
                <input type="text" class="edit-input" value="">
                <input type="text" class="edit-input edit-area" list="areaList" placeholder="分区" title="分区（如 产品），留空 = 不分区">
                <button type="button" class="cd-toggle ${countdown ? 'on' : ''}" title="倒计时：时间用完自动停止并提醒（不选 = 正计时，达标提醒）">倒</button>
                <input type="number" class="edit-input edit-min" min="1" max="1440" placeholder="分钟" title="计时目标（分钟），留空 = 不计时">
            </div>`;
        const [input, areaInput, minInput] = el.querySelectorAll('input');
        const cdBtn = el.querySelector('.cd-toggle');
        cdBtn.addEventListener('mousedown', (e) => e.preventDefault()); // 点它不让输入框失焦（否则会提前保存）
        cdBtn.addEventListener('click', () => cdBtn.classList.toggle('on'));
        input.value = currentText;
        areaInput.value = area || '';
        minInput.value = targetMin || '';
        input.focus();
        input.select();
        let done = false;
        const save = () => {
            if (done) return; done = true;
            this.callbacks.onEditSave(taskId, input.value, minInput.value, areaInput.value, cdBtn.classList.contains('on'));
        };
        el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) save(); });
        el.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') save();
            else if (e.key === 'Escape') { done = true; this.callbacks.onEditCancel(); }
        });
    }
}
