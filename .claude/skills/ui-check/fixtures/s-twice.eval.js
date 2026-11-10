const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const app = window.todoWidget;
app.taskList.select('b');
key('s');   // 停 B
const afterFirst = { sel: app.taskList.selectedId, run: app.state.tasks.filter(t => t.runningSince).map(t => t.id) };
key('s');   // 应该停 A，而不是重开 B
const afterSecond = { sel: app.taskList.selectedId, run: app.state.tasks.filter(t => t.runningSince).map(t => t.id) };
document.title = JSON.stringify({ afterFirst, afterSecond });
console.log('RESULT', document.title);
