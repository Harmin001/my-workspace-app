// ===== 任务管理模块 =====
// 任务 CRUD、渲染、拖拽

class TaskManager {
    constructor() {
        this.tasks = appData.tasks || [];
        this.currentView = 'all'; // 'all' | 'today' | 'overdue' | 'learning' | 'other'
    }

    init() {
        // 订阅数据变化
        this._subscribers = [];
        eventBus.on('tasks:change', (data) => {
            this._notify(data);
        });
    }

    _notify(data) {
        this.currentView = 'all'; // 重置视图
        this.render();
    }

    // ============ CRUD ============
    addTask(task) {
        const newTask = {
            id: crypto.randomUUID(),
            ...task,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.tasks.unshift(newTask);
        this.save();
        return newTask;
    }

    updateTask(id, updates) {
        const idx = this.tasks.findIndex(t => t.id === id);
        if (idx === -1) return null;
        
        const oldTask = this.tasks[idx];
        const newTask = {
            ...oldTask,
            ...updates,
            updatedAt: Date.now()
        };
        this.tasks[idx] = newTask;
        this.save();
        return newTask;
    }

    deleteTask(id) {
        const idx = this.tasks.findIndex(t => t.id === id);
        if (idx === -1) return false;
        this.tasks.splice(idx, 1);
        this.save();
        return true;
    }

    getTask(id) {
        return this.tasks.find(t => t.id === id) || null;
    }

    // ============ 筛选 ============
    getFilteredTasks() {
        const now = Date.now();
        const today = getTodayString();
        const tomorrow = formatDate(new Date(Date.now() + 86400000).getUTCFullYear(), new Date(Date.now() + 86400000).getUTCMonth() + 1, new Date(Date.now() + 86400000).getUTCDate());
        
        switch (this.currentView) {
            case 'today':
                return this.tasks.filter(t => t.date === today);
            case 'overdue':
                return this.tasks.filter(t => t.status !== 'done' && t.date < today);
            case 'learning':
                return this.tasks.filter(t => t.type === 'learning');
            case 'other':
                return this.tasks.filter(t => t.type !== 'learning');
            default:
                return this.tasks;
        }
    }

    setView(view) {
        this.currentView = view;
    }

    // ============ 渲染 ============
    render() {
        const container = document.getElementById('task-pool');
        if (!container) return;

        const tasks = this.getFilteredTasks();
        
        if (tasks.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-muted);font-size:var(--font-content);">
                <div style="font-size:3em;margin-bottom:12px;">📭</div>
                暂无任务
            </div>`;
            return;
        }

        const html = tasks.map(task => this._taskHtml(task)).join('');
        container.innerHTML = html;

        // 绑定拖拽事件
        this._bindDragEvents();
    }

    _taskHtml(task) {
        const isToday = task.date === getTodayString();
        const isOverdue = task.status !== 'done' && task.date < getTodayString();
        const isLearning = task.type === 'learning';
        
        return `
            <div class="task-item todo-pool-item" data-id="${task.id}" draggable="true">
                <input type="checkbox" ${task.status === 'done' ? 'checked' : ''} onchange="window.updateTaskStatus('${task.id}', this.checked)">
                <span class="task-text" ondblclick="window.openTaskDetail('${task.id}')">
                    ${escapeHtml(task.title)}
                </span>
                ${isLearning ? '<span class="task-tag todo-kind">📚 学习</span>' : ''}
                ${isToday ? '<span class="task-tag today">📅 今日</span>' : ''}
                ${isOverdue ? '<span class="task-tag overdue">⏰ 逾期</span>' : ''}
                <span class="ex-del-btn" onclick="window.deleteTask('${task.id}')" title="删除">✕</span>
            </div>
        `;
    }

    _bindDragEvents() {
        const items = document.querySelectorAll('.task-item[data-id]');
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.id);
                item.style.opacity = '0.5';
            });
            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
            });
        });

        const pool = document.getElementById('task-pool');
        if (pool) {
            pool.addEventListener('dragover', (e) => {
                e.preventDefault();
                const rect = pool.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const before = this._findBeforeElement(pool, x, y);
                const id = e.dataTransfer.getData('text/plain');
                const task = this.getTask(id);
                if (task && before) {
                    this.updateTask(id, { position: before.dataset.id });
                }
            });
        }
    }

    _findBeforeElement(container, x, y) {
        const children = Array.from(container.children);
        let before = null;
        
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const rect = child.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                before = child;
                break;
            }
        }
        
        return before;
    }

    // ============ 保存 ============
    save() {
        saveDataToFile({ tasks: this.tasks });
    }

    // ============ 内部方法 ============
    _subscribers = new Set();
    _notify(data) {
        this._subscribers.forEach(cb => cb(data));
    }
}

// 导出
window.TaskManager = TaskManager;
window.taskManager = new TaskManager();
