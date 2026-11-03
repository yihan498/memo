import { generateId } from '../utils/helpers.js';

export function createTask(state = {}, text) {
  if (typeof text !== 'string') throw new Error('text must be a string');
  const trimmed = text.trim();
  if (!trimmed) throw new Error('text is required');

  const task = {
    id: generateId(),
    text: trimmed,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null
  };

  const tasks = [task].concat(Array.isArray(state.tasks) ? state.tasks : []);

  return Object.assign({}, state, { tasks });
}

export function toggleTask(state = {}, id) {
  if (!Array.isArray(state.tasks)) return state;
  const tasks = state.tasks.map(t => {
    if (t.id !== id) return t;
    const completed = !t.completed;
    return Object.assign({}, t, {
      completed,
      completedAt: completed ? new Date().toISOString() : null
    });
  });
  return Object.assign({}, state, { tasks });
}

export function updateTask(state = {}, id, attrs = {}) {
  if (!Array.isArray(state.tasks)) return state;
  const tasks = state.tasks.map(t => {
    if (t.id !== id) return t;
    const updated = Object.assign({}, t, attrs);
    if (typeof updated.text === 'string') updated.text = updated.text.trim();
    return updated;
  });
  return Object.assign({}, state, { tasks });
}

export function deleteTask(state = {}, id) {
  if (!Array.isArray(state.tasks)) return state;
  const tasks = state.tasks.filter(t => t.id !== id);
  return Object.assign({}, state, { tasks });
}

export function listTasks(state = {}, filter = {}) {
  const tasks = Array.isArray(state.tasks) ? state.tasks.slice() : [];
  if (filter.completed === true) return tasks.filter(t => t.completed);
  if (filter.completed === false) return tasks.filter(t => !t.completed);
  return tasks;
}
