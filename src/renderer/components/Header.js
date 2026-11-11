export class Header {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.alwaysOnTopBtn = document.getElementById('alwaysOnTopBtn');
        this.mainContentArea = document.getElementById('mainContentArea');
        this.dateEl = document.getElementById('brandDate');
        this.isCompact = false;

        document.getElementById('closeBtn').addEventListener('click', () => window.electronAPI.minimizeWindow());
        document.getElementById('compactBtn').addEventListener('click', () => this.toggleCompactMode());
        document.getElementById('themeBtn').addEventListener('click', () => this.callbacks.onThemeToggle && this.callbacks.onThemeToggle());
        this.alwaysOnTopBtn.addEventListener('click', async () => {
            this.updateAlwaysOnTopButton(await window.electronAPI.toggleAlwaysOnTop());
        });

        this.updateDate();
        setInterval(() => this.updateDate(), 60 * 1000);
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
