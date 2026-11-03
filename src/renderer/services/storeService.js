export async function loadTasks() {
    try {
        return await window.electronAPI.getStoreValue('tasks', []);
    } catch (error) {
        console.error('Error loading tasks:', error);
        return [];
    }
}

export async function saveTasks(tasks) {
    try {
        await window.electronAPI.setStoreValue('tasks', tasks);
    } catch (error) {
        console.error('Error saving tasks:', error);
    }
}

export async function loadTheme() {
    try {
        return await window.electronAPI.getStoreValue('theme', 'dark');
    } catch (error) {
        console.error('Error loading theme:', error);
        return 'dark';
    }
}

export async function saveTheme(theme) {
    try {
        await window.electronAPI.setStoreValue('theme', theme);
    } catch (error) {
        console.error('Error saving theme:', error);
    }
}

export async function loadAlwaysOnTop() {
    try {
        return await window.electronAPI.getStoreValue('alwaysOnTop', true);
    } catch (error) {
        console.error('Error loading alwaysOnTop:', error);
        return true;
    }
}
