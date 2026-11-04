// 「记录」页：月历。每格看当天常规完成情况 + 待办小圆点；点某天看明细，也能给那天加待办。
// 下面是本月统计（完成率、计时、每项常规）。
import { escapeHtml } from '../utils/helpers.js';
import { buildMonth, dayDetail, shiftMonth, fmtMin } from '../services/records.js';
import { dateKey } from '../services/dailyManager.js';

const hm = iso => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const KIND = { done: '完成', due: '截止', overdue: '逾期', planned: '计划' };

export class Records {
    constructor(getState, callbacks = {}) {
        this.getState = getState;
        this.callbacks = callbacks;
        this.title = document.getElementById('calTitle');
        this.body = document.getElementById('recBody');
        this.goToday();
        document.getElementById('calPrev').addEventListener('click', () => this.shift(-1));
        document.getElementById('calNext').addEventListener('click', () => this.shift(1));
        document.getElementById('calToday').addEventListener('click', () => { this.goToday(); this.render(); });
        this.body.addEventListener('click', (e) => {
            const cell = e.target.closest('.cal-cell');
            if (cell) { this.select(cell.dataset.key); return; }
            if (e.target.closest('.cal-add')) this.callbacks.onAddOnDate && this.callbacks.onAddOnDate(this.sel);
        });
    }

    goToday() {
        this.sel = dateKey(new Date());
        this.ym = this.sel.slice(0, 7);
    }

    /** 翻月：选中日跟着到新月份的同一天（没有就月末） */
    shift(n) {
        this.ym = shiftMonth(this.ym, n);
        const [y, m] = this.ym.split('-').map(Number);
        const day = Math.min(Number(this.sel.slice(8)), new Date(y, m, 0).getDate());
        this.sel = `${this.ym}-${String(day).padStart(2, '0')}`;
        this.render();
    }

    select(key) {
        this.sel = key;
        this.ym = key.slice(0, 7);
        this.render();
    }

    // 兼容旧快捷键 Ctrl+L：回到今天
    cyclePreset() { this.goToday(); this.render(); }

    render() {
        const state = this.getState();
        const mo = buildMonth(state, this.ym);
        const [y, m] = this.ym.split('-');
        this.title.textContent = `${y} 年 ${Number(m)} 月`;
        this.body.innerHTML = this.gridHtml(mo) + this.detailHtml(dayDetail(state, this.sel)) + this.statsHtml(mo);
    }

    gridHtml(mo) {
        const head = '一二三四五六日'.split('').map(w => `<span class="cal-w">${w}</span>`).join('');
        const cells = mo.cells.map(c => {
            const r = c.routine;
            let st = '', mark = '';
            if (r && r.total) {
                const all = r.done === r.total;
                if (r.today) { st = all ? 'st-ok' : ''; mark = `${r.done}/${r.total}`; }
                else { st = all ? 'st-ok' : 'st-miss'; mark = all ? '✓' : `${r.done}/${r.total}`; }
            }
            const dots = c.todos.slice(0, 4).map(t => `<i class="${t.kind}"></i>`).join('') + (c.todos.length > 4 ? '<b>+</b>' : '');
            const cls = ['cal-cell', st, c.inMonth ? '' : 'out', c.isToday ? 'today' : '', c.key === this.sel ? 'sel' : ''].filter(Boolean).join(' ');
            const tip = [r && r.total ? `常规 ${r.done}/${r.total}` : '', ...c.todos.map(t => `${KIND[t.kind]} ${t.text}`)].filter(Boolean).join('\n');
            return `<button type="button" class="${cls}" data-key="${c.key}" title="${escapeHtml(tip)}">
                <span class="cal-d">${c.day}</span><span class="cal-m">${mark}</span><span class="cal-dots">${dots}</span></button>`;
        }).join('');
        return `<div class="cal-grid">${head}${cells}</div>
            <div class="cal-legend"><span><i class="sw ok"></i>全部完成</span><span><i class="sw miss"></i>有漏</span><span><i class="dot due"></i>截止</span><span><i class="dot overdue"></i>逾期</span><span><i class="dot planned"></i>计划</span><span><i class="dot done"></i>完成</span></div>`;
    }

    detailHtml(d) {
        const r = d.routine;
        let status = '';
        if (r && r.total) {
            const all = r.done === r.total;
            status = d.today ? `<span class="day-st">进行中 ${r.done}/${r.total}</span>` : `<span class="day-st ${all ? 'ok' : 'bad'}">${all ? '全部完成' : `${r.done}/${r.total}`}</span>`;
        }
        const chips = r && r.items ? r.items.map(i => {
            const cls = i.done ? 'ok' : (d.today ? '' : 'bad');
            let extra = '';
            if (i.targetMin) {
                extra = ` <em>${i.minutes}/${i.targetMin}分</em>`;
                if (i.sessions && i.sessions.length) extra += `<small>${i.sessions.map(x => `${hm(x.start)}–${hm(x.end)}`).join(' ')}</small>`;
            }
            return `<span class="chip ${cls}">${escapeHtml(i.text)}${extra}</span>`;
        }).join('') : r ? (r.missed || []).map(x => `<span class="chip bad">${escapeHtml(x)}</span>`).join('') : '';
        const todos = d.todos.map(t => `<div class="cal-todo ${t.kind}"><span class="tag">${KIND[t.kind]}${t.time ? ' ' + t.time : ''}</span><span class="txt">${escapeHtml(t.text)}</span></div>`).join('');
        const empty = !chips && !todos ? `<p class="cal-none">${d.future ? '这天还没有安排' : '这天没有记录'}</p>` : '';
        return `<div class="cal-detail">
            <div class="day-head"><b>${d.key.slice(5).replace('-', '/')} ${d.week}${d.today ? ' · 今天' : ''}</b>${status}</div>
            ${chips ? `<div class="chips">${chips}</div>` : ''}
            ${todos ? `<div class="cal-todos">${todos}</div>` : ''}
            ${empty}
            <button type="button" class="link-btn cal-add">+ 给这天添加待办</button>
        </div>`;
    }

    statsHtml(mo) {
        const s = mo.summary;
        const rate = s.rate === null ? '—' : s.rate + '%';
        const cards = `
            <div class="rec-h">本月统计</div>
            <div class="cards">
                <div class="card"><b>${rate}</b><span>常规完成率<br>${s.itemDone}/${s.itemTotal} 项次</span></div>
                <div class="card"><b>${s.perfectDays}<small>/${s.days}</small></b><span>全部完成的天数</span></div>
                <div class="card"><b>${fmtMin(s.minutes)}</b><span>累计计时</span></div>
                <div class="card"><b>${s.todoDone}</b><span>完成待办${s.todoWithDue ? `<br>按时 ${s.todoOnTime}/${s.todoWithDue}` : ''}</span></div>
            </div>`;
        const per = mo.perTask.length ? `
            <div class="rec-h">每项常规（本月）</div>
            ${mo.perTask.map(p => {
                const pct = Math.round((p.done / p.total) * 100);
                return `<div class="per">
                    <span class="per-name">${escapeHtml(p.text)}</span>
                    <span class="per-bar"><i class="${pct >= 80 ? 'ok' : pct < 50 ? 'bad' : ''}" style="width:${pct}%"></i></span>
                    <span class="per-num">${p.done}/${p.total}${p.timed ? ` · 均 ${Math.round(p.minutes / p.total)} 分` : ''}</span>
                </div>`;
            }).join('')}` : '';
        return cards + per;
    }
}
