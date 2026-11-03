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
        this.dateEl.textContent = `${d.getMonth() + 1}月${d.getDate()}日 周${week}`;
    }

    async toggleCompactMode() {
        this.isCompact = !this.isCompact;
        this.mainContentArea.classList.toggle('hidden', this.isCompact);
        await window.electronAPI.setCompactMode(this.isCompact);
    }

    updateAlwaysOnTopButton(on) {
        this.alwaysOnTopBtn.classList.toggle('on', !!on);
        this.alwaysOnTopBtn.title = on ? '已置顶（点击取消）' : '置顶';
    }

    applyTheme(theme) {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }
}
