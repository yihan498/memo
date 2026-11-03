import { loadTasks, saveTasks, loadTheme, saveTheme, loadAlwaysOnTop } from './services/storeService.js';
import { createTask, toggleTask, updateTask, deleteTask, listTasks } from './services/taskManager.js';
import { Header } from './components/Header.js';
import { TaskList } from './components/TaskList.js';
import { TaskInput } from './components/TaskInput.js';

class AppState {
    constructor() {
        this.tasks = [];
        this.currentTheme = 'dark';
        this.isAlwaysOnTop = true;
    }
}

class TodoWidgetApp {
    constructor() {
        this.state = new AppState();
        this.header = null;
        this.taskList = null;
        this.taskInput = null;

        this.init();
    }

    async init() {
        // 1. Load initial data
        this.state.currentTheme = await loadTheme();
        this.state.isAlwaysOnTop = await loadAlwaysOnTop();
        const savedTasks = await loadTasks();
        this.state.tasks = savedTasks || [];

        // 2. Initialize Components
        this.header = new Header({
            onThemeToggle: () => this.toggleTheme(),
            getTaskCount: () => this.state.tasks.filter(t => !t.completed).length
        });

        this.taskList = new TaskList('tasksList', {
            onToggle: (id) => this.handleToggleTask(id),
            onDelete: (id) => this.handleDeleteTask(id),
            onEditStart: (id) => this.handleEditStart(id),
            onEditSave: (id, newText) => this.handleEditSave(id, newText),
            onEditCancel: () => this.updateUI() // just re-render to revert
        });

        this.taskInput = new TaskInput({
            onAddTask: (text) => this.handleAddTask(text),
            onClearCompleted: () => this.handleClearCompleted()
        });

        // 3. Setup Global Keyboard shortcuts
        this.setupKeyboardShortcuts();

        // 4. Initial Render
        this.updateUI();
        this.header.applyTheme(this.state.currentTheme);
        this.header.updateAlwaysOnTopButton(this.state.isAlwaysOnTop);

        // Auto-focus on app activation
        window.addEventListener('focus', () => {
            this.taskInput.focus();
        });
        window.addEventListener('load', () => {
            this.taskInput.focus();
        });
    }

    // --- Actions ---

    handleAddTask(text) {
        try {
            this.state = createTask(this.state, text);
            this.persistTasks();
            this.updateUI();
            
            // Animation for new task
            setTimeout(() => {
                const newTask = this.state.tasks[0]; // createTask puts it at the beginning
                if (newTask) {
                    const el = document.querySelector(`[data-task-id="${newTask.id}"]`);
                    if (el) el.classList.add('slide-in');
                }
            }, 10);
        } catch (error) {
            console.warn('Invalid task:', error.message);
        }
    }

    handleToggleTask(id) {
        this.state = toggleTask(this.state, id);
        this.persistTasks();

        // Animation for completion
        const task = this.state.tasks.find(t => t.id === id);
        const taskElement = document.querySelector(`[data-task-id="${id}"]`);
        if (taskElement && task && task.completed) {
            taskElement.classList.add('task-complete');
            setTimeout(() => {
                if (taskElement) taskElement.classList.remove('task-complete');
            }, 300);
        }
        
        this.updateUI();
    }

    handleDeleteTask(id) {
        const taskElement = document.querySelector(`[data-task-id="${id}"]`);
        if (taskElement) {
            taskElement.classList.add('fade-out');
            setTimeout(() => {
                this.state = deleteTask(this.state, id);
                this.persistTasks();
                this.updateUI();
            }, 200);
        } else {
            this.state = deleteTask(this.state, id);
            this.persistTasks();
            this.updateUI();
        }
    }

    handleEditStart(id) {
        const task = this.state.tasks.find(t => t.id === id);
        if (task) {
            this.taskList.enableEditing(id, task.text);
        }
    }

    handleEditSave(id, newText) {
        if (newText.trim() !== '') {
            this.state = updateTask(this.state, id, { text: newText });
            this.persistTasks();
        }
        this.updateUI();
    }

    handleClearCompleted() {
        const completedTasks = this.state.tasks.filter(t => t.completed);
        if (completedTasks.length === 0) return;

        completedTasks.forEach(task => {
            const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
            if (taskElement) taskElement.classList.add('fade-out');
        });

        setTimeout(() => {
            completedTasks.forEach(task => {
                this.state = deleteTask(this.state, task.id);
            });
            this.persistTasks();
            this.updateUI();
        }, 200);
    }

    async toggleTheme() {
        this.state.currentTheme = this.state.currentTheme === 'dark' ? 'light' : 'dark';
        await saveTheme(this.state.currentTheme);
        this.header.applyTheme(this.state.currentTheme);
    }

    // --- Core Updates ---

    updateUI() {
        this.taskList.render(this.state.tasks);
        this.taskList.updateEmptyState(this.state.tasks.length);
        this.taskInput.updateStats(this.state.tasks);
    }

    async persistTasks() {
        await saveTasks(this.state.tasks);
    }

    // --- Shortcuts ---

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + N: Focus on input
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.taskInput.focus();
            }

            // Escape: Clear input
            if (e.key === 'Escape') {
                const inputEl = document.getElementById('taskInput');
                if (inputEl && inputEl.value) {
                    inputEl.value = '';
                }
            }

            // Ctrl/Cmd + Shift + C: Clear completed tasks
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                this.handleClearCompleted();
            }

            // Ctrl/Cmd + T: Toggle theme
            if ((e.ctrlKey || e.metaKey) && e.key === 't') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.todoWidget = new TodoWidgetApp();
});
