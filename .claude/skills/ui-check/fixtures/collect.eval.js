// 模拟收集模式：主进程轮询剪贴板后发来的 3 段（第 3 段与已有想法重复，应不收）
const app = window.todoWidget;
app.electronAPI = window.electronAPI;
app.handleCollect(true);
app.handleClipIdea('第一条：一个选题灵感', true);
app.handleClipIdea('第二条 https://mp.weixin.qq.com/s/xyz', true);
app.handleClipIdea('做个番茄钟', true);
document.querySelector('.ideas-footer, footer, #ideasCount')?.setAttribute('data-n', app.collected);
document.title = 'collected=' + app.collected;
app.handleCollect(false);
