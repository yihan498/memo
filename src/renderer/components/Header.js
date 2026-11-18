import { keyLabel } from '../utils/helpers.js';

export class Header {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.alwaysOnTopBtn = document.getElementById('alwaysOnTopBtn');
        this.mainContentArea = document.getElementById('mainContentArea');
        this.dateEl = document.getElementById('brandDate');
        this.isCompact = false;

        document.getElementById('closeBtn').addEventListener('click', () => window.electronAPI.minimizeWindow());
        this.setupCompactButton();
        this.setupSelfDrag();
        this.setupDock();
        document.getElementById('themeBtn').addEventListener('click', () => this.callbacks.onThemeToggle && this.callbacks.onThemeToggle());
        this.alwaysOnTopBtn.addEventListener('click', async () => {
            this.updateAlwaysOnTopButton(await window.electronAPI.toggleAlwaysOnTop());
        });

        this.updateDate();
        setInterval(() => this.updateDate(), 60 * 1000);
    }

    // 收起键：左键 = 收起 / 展开，按下就生效；右键 = 贴到屏幕右边。
    // 不用双击贴边：同一个键单双击做两件事，要么单击得等着确认不是双击，要么双击时先收起再撤回，总有一样别扭
    setupCompactButton() {
        const btn = document.getElementById('compactBtn');
        btn.addEventListener('click', () => this.toggleCompactMode());
        btn.addEventListener('contextmenu', (e) => { e.preventDefault(); this.toggleDock(); });
    }

    // 标题栏空白处：按住拖动 = 挪窗口，双击 = 收起 / 展开。
    // Memo 是透明窗口，系统拖动区（-webkit-app-region: drag）的双击到不了页面，所以标题栏改由页面自己拖
    setupSelfDrag() {
        const bar = document.querySelector('.titlebar');
        bar.classList.remove('drag');
        bar.classList.add('self-drag');
        const isBlank = el => !el.closest('button, input, textarea, select, a, .controls > *, [contenteditable]');
        let drag = null, raf = 0, next = null;
        bar.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 || !isBlank(e.target)) return;
            // 宽高在按下时记住，挪的时候原样带上（只给位置的话，Windows 缩放屏上每挪一次宽度都会被取整放大一点）
            drag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY, w: window.outerWidth, h: window.outerHeight };
            bar.setPointerCapture(e.pointerId);
        });
        bar.addEventListener('pointermove', (e) => {
            if (!drag) return;
            next = [Math.round(drag.wx + e.screenX - drag.sx), Math.round(drag.wy + e.screenY - drag.sy), drag.w, drag.h];
            if (!raf) raf = requestAnimationFrame(() => { raf = 0; window.electronAPI.moveWindow(...next); });
        });
        const end = (e) => { if (drag) { drag = null; try { bar.releasePointerCapture(e.pointerId); } catch {} } };
        bar.addEventListener('pointerup', end);
        bar.addEventListener('pointercancel', end);
        bar.addEventListener('dblclick', (e) => { if (isBlank(e.target)) this.toggleCompactMode(); });
    }

    // 贴边收起：主进程把窗口缩成屏幕右边缘的竖条；页面这边换成竖条的样子。
    // 点竖条 = 展开；按住上下拖 = 沿屏幕右边挪位置（挪过 3px 才算拖，松手不展开）
    setupDock() {
        const tab = this.dockTab = document.getElementById('dockTab');
        this.isDocked = false;
        let tabDrag = null;
        tab.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            tabDrag = { sy: e.screenY, wy: window.screenY, moved: false };
            tab.setPointerCapture(e.pointerId);
        });
        tab.addEventListener('pointermove', (e) => {
            if (!tabDrag) return;
            const dy = e.screenY - tabDrag.sy;
            if (!tabDrag.moved && Math.abs(dy) < 3) return;
            tabDrag.moved = true;
            tab.classList.add('dragging');
            window.electronAPI.dockMove(Math.round(tabDrag.wy + dy));
        });
        const end = (e, click) => {
            if (!tabDrag) return;
            const moved = tabDrag.moved;
            tabDrag = null;
            tab.classList.remove('dragging');
            try { tab.releasePointerCapture(e.pointerId); } catch {}
            if (click && !moved) this.toggleDock();
        };
        tab.addEventListener('pointerup', (e) => end(e, true));
        tab.addEventListener('pointercancel', (e) => end(e, false));
        window.electronAPI.onDocked?.((on) => {
            this.isDocked = !!on;
            document.body.classList.toggle('docked', this.isDocked);
            if (this.isDocked) { if (document.activeElement) document.activeElement.blur(); this.renderDockTab(); }
        });
        setInterval(() => this.renderDockTab(), 5000); // 计时开始 / 停止时 app 也会调，这里兜底
    }

    toggleDock() { window.electronAPI.toggleDock(); }

    // 竖条上的状态：有计时在跑 → 闪动的小橙点，悬停看是哪些
    renderDockTab() {
        if (!this.isDocked) return;
        const timing = (this.callbacks.getRunning ? this.callbacks.getRunning() : []);
        this.dockTab.classList.toggle('timing', timing.length > 0);
        this.dockTab.title = (timing.length ? `计时中：${timing.join('、')}\n\n` : '') + keyLabel('点一下展开（Ctrl+Alt+H），按住上下拖可以挪位置');
    }

    updateDate() {
        const d = new Date();
        const week = '日一二三四五六'[d.getDay()];
        this.dateEl.textContent = `${d.getMonth() + 1}/${d.getDate()} 周${week}`;
    }

    async toggleCompactMode() {
        this.isCompact = !this.isCompact;
        this.mainContentArea.classList.toggle('hidden', this.isCompact);
        // 收起时让出焦点：否则焦点留在被藏起来的输入框或刚点的折叠键上，按键会被它吞掉
        if (this.isCompact && document.activeElement) document.activeElement.blur();
        // 收起时窗口高度由 app 按「正在计时的项目数」决定（见 app.syncCompact）
        if (this.callbacks.onCompactChange) this.callbacks.onCompactChange(this.isCompact);
        else await window.electronAPI.setCompactMode(this.isCompact);
    }

    updateAlwaysOnTopButton(on) {
        this.alwaysOnTopBtn.classList.toggle('on', !!on);
        this.alwaysOnTopBtn.title = on ? '已置顶（点击取消）' : '置顶';
    }

    applyTheme(theme) {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }
}
