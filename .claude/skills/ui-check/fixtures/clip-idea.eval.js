// 模拟 Ctrl+Alt+V 收到的剪贴板文字（全局快捷键本身没法在测试里按）
const app = window.todoWidget;
app.handleClipIdea('这篇讲 Agent 记忆的文章值得看 #AI\nhttps://mp.weixin.qq.com/s/abcdefg1234567');
app.handleClipIdea('这篇讲 Agent 记忆的文章值得看 #AI https://mp.weixin.qq.com/s/abcdefg1234567'); // 重复，应不收
