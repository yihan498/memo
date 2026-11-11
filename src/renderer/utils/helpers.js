export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}

export function generateId() {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch (e) {
        // ignore
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.floor(Math.random() * 16);
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/** 快捷键文字按平台显示：Mac 上 Ctrl → ⌘（Ctrl+Tab 例外，Mac 上仍是 ⌃），Alt → ⌥。和 main.js 的 keyLabel 保持一致 */
export function keyLabel(text, platform = (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.platform)) {
    if (platform !== 'darwin' || !text) return text;
    return String(text).replace(/Ctrl(?=[ +]\(?(Shift\)? )?Tab)/g, '⌃').replace(/Ctrl/g, '⌘').replace(/Alt/g, '⌥');
}

/** 启动时把页面里写死的快捷键提示（title、kbd、帮助面板）换成本平台的写法 */
export function localizeKeys(root = document) {
    if (!window.electronAPI || window.electronAPI.platform !== 'darwin') return;
    root.querySelectorAll('[title]').forEach(el => { el.title = keyLabel(el.title); });
    root.querySelectorAll('kbd, .help-row span').forEach(el => {
        el.childNodes.forEach(n => { if (n.nodeType === 3) n.textContent = keyLabel(n.textContent); });
    });
}
