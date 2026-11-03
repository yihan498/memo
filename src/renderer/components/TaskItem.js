import { escapeHtml } from '../utils/helpers.js';

export function createTaskElement(task) {
    const wrapper = document.createElement('div');
    wrapper.className = 'task-item bg-white/10 dark:bg-black/10 rounded-lg p-3 border border-white/20 dark:border-white/5 hover:border-white/40 dark:hover:border-white/10 transition-all group';
    wrapper.setAttribute('data-task-id', task.id);

    const inner = document.createElement('div');
    inner.className = 'flex items-start space-x-3';

    const label = document.createElement('label');
    label.className = 'flex items-center cursor-pointer pt-0.5';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox sr-only';
    if (task.completed) checkbox.checked = true;

    const visual = document.createElement('div');
    visual.className = 'w-5 h-5 rounded-full border-2 border-gray-400 dark:border-gray-500 flex items-center justify-center transition-all';
    if (task.completed) {
        visual.classList.add('bg-green-500', 'border-green-500');
        visual.innerHTML = '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    }

    label.appendChild(checkbox);
    label.appendChild(visual);

    const textContainer = document.createElement('div');
    textContainer.className = 'flex-1 min-w-0 task-text-container cursor-text';
    textContainer.title = 'Double-click to edit';

    const p = document.createElement('p');
    p.className = 'text-sm text-gray-800 dark:text-gray-200 break-words leading-relaxed';
    if (task.completed) p.style.textDecoration = 'line-through';
    p.innerHTML = escapeHtml(task.text);

    textContainer.appendChild(p);

    if (task.completed && task.completedAt) {
        const small = document.createElement('p');
        small.className = 'text-xs text-gray-500 dark:text-gray-400 mt-1';
        small.textContent = 'Completed ' + new Date(task.completedAt).toLocaleString();
        textContainer.appendChild(small);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all';
    deleteBtn.title = 'Delete task';
    deleteBtn.innerHTML = '<svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>';

    inner.appendChild(label);
    inner.appendChild(textContainer);
    inner.appendChild(deleteBtn);
    wrapper.appendChild(inner);

    return wrapper;
}
