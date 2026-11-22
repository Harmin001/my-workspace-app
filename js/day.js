// ===== 日计划模块 =====
// 日计划、待办、反思

class DayManager {
    constructor() {
        this.today = getTodayString();
    }

    init() {
        // 订阅数据变化
        eventBus.on('tasks:change', () => this.renderDay());
        eventBus.on('tasks:change', () => this.renderTodoSection());
    }

    renderDay() {
        const grid = document.getElementById('day-panels-grid');
        if (!grid) return;

        const todayTasks = (appData.tasks || []).filter(t => t.date === this.today && t.status !== 'done');
        
        // 主任务面板
        const mainPanel = document.createElement('div');
        mainPanel.className = 'section-box span-full';
        mainPanel.innerHTML = `
            <div class="panel-header">
                <h2>📋 主任务</h2>
                <div class="panel-controls"></div>
            </div>
            <div class="panel-content">
                <div id="main-tasks-list"></div>
            </div>
        `;
        grid.appendChild(mainPanel);

        // 待办池面板
        const todoPanel = document.createElement('div');
        todoPanel.className = 'section-box';
        todoPanel.innerHTML = `
            <div class="panel-header">
                <h2>📌 待办池</h2>
                <div class="panel-controls"></div>
            </div>
            <div class="panel-content">
                <div id="todo-pool"></div>
            </div>
        `;
        grid.appendChild(todoPanel);

        // 练习池面板
        const exercisePanel = document.createElement('div');
        exercisePanel.className = 'section-box';
        exercisePanel.innerHTML = `
            <div class="panel-header">
                <h2>🏃 练习池</h2>
                <div class="panel-controls"></div>
            </div>
            <div class="panel-content">
                <div id="exercise-pool"></div>
            </div>
        `;
        grid.appendChild(exercisePanel);

        // 渲染主任务
        this.renderMainTasks();
        // 渲染待办池
        this.renderTodoSection();
        // 渲染练习池
        this.renderExerciseSection();
    }

    renderMainTasks() {
        const container = document.getElementById('main-tasks-list');
        if (!container) return;

        const tasks = (appData.tasks || []).filter(t => t.date === this.today && t.status !== 'done');
        
        if (tasks.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-muted);">📭 今日暂无任务</div>`;
            return;
        }

        const html = tasks.map(task => {
            const isLearning = task.type === 'learning';
            return `
                <div class="main-task-item ${isLearning ? 'count-only-task' : 'todo-task-item'}" data-id="${task.id}">
                    <div class="main-task-header">
                        <div class="main-task-top-row">
                            <div class="main-task-title-area">
                                <input type="checkbox" ${task.status === 'done' ? 'checked' : ''} onchange="window.updateTaskStatus('${task.id}', this.checked)">
                                <span class="task-text" ondblclick="window.openTaskDetail('${task.id}')">${escapeHtml(task.title)}</span>
                            </div>
                            <div class="task-right-group">
                                ${isLearning ? '<span class="task-badge">📚 学习</span>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }

    renderTodoSection() {
        const pool = document.getElementById('todo-pool');
        if (!pool) return;

        // 从待办池获取任务
        const todoTasks = (appData.tasks || []).filter(t => t.type === 'todo' && t.date === this.today && t.status !== 'done');
        
        if (todoTasks.length === 0) {
            pool.innerHTML = `<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:var(--font-hint);">📭 待办池为空</div>`;
            return;
        }

        const html = todoTasks.map(task => `
            <div class="task-item todo-pool-item" data-id="${task.id}" draggable="true">
                <input type="checkbox" ${task.status === 'done' ? 'checked' : ''} onchange="window.updateTaskStatus('${task.id}', this.checked)">
                <span class="task-text">${escapeHtml(task.title)}</span>
                <span class="task-tag todo-kind">待办</span>
                <span class="ex-del-btn" onclick="window.deleteTask('${task.id}')" title="删除">✕</span>
            </div>
        `).join('');
        
        pool.innerHTML = html;
    }

    renderExerciseSection() {
        const pool = document.getElementById('exercise-pool');
        if (!pool) return;

        // 从练习中获取今日任务
        const exerciseTasks = (appData && appData.exercises || []).filter(e => e.date === this.today && e.status !== 'done');
        
        if (exerciseTasks.length === 0) {
            pool.innerHTML = `<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:var(--font-hint);">📭 练习池为空</div>`;
            return;
        }

        const html = exerciseTasks.map(task => `
            <div class="exercise-capsule" data-id="${task.id}" draggable="true">
                <input type="checkbox" ${task.status === 'done' ? 'checked' : ''} onchange="window.updateExerciseStatus('${task.id}', this.checked)">
                <span>${escapeHtml(task.title)}</span>
                <span class="ex-del-btn" onclick="window.deleteExercise('${task.id}')" title="删除">✕</span>
            </div>
        `).join('');
        
        pool.innerHTML = html;
    }

    // ============ 工具方法 ============
    getTasksForDay(date) {
        return (appData.tasks || []).filter(t => t.date === date && t.status !== 'done');
    }
}

// 导出
window.DayManager = DayManager;
window.dayManager = new DayManager();
