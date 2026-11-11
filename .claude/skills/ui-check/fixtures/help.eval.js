// 打开快捷键帮助面板（看 Mac 上是否显示成 ⌘ ⌥）。先让出输入框焦点，否则 ? 会被当成打字
if (document.activeElement) document.activeElement.blur();
document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
