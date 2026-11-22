// ===== 日历模块 =====
// 日历渲染、月计划、周计划

class CalendarManager {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.currentMonth = new Date().getMonth();
        this.currentWeekStart = null;
    }

    init() {
        // 订阅数据变化
        eventBus.on('tasks:change', () => this.renderCalendar());
        eventBus.on('tasks:change', () => this.renderWeekBoard());
    }

    // ============ 日历 ============
    renderCalendar() {
        const grid = document.getElementById('calendar-grid');
        if (!grid) return;

        const year = this.currentYear;
        const month = this.currentMonth;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDay = new Date(year, month, 1).getDay();
        
        const cells = [];
        
        // 前一个月的天数
        const prevMonthDays = daysInMonth + startDay;
        for (let i = prevMonthDays; i > 0; i--) {
            const day = daysInMonth - i + 1;
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            const dateStr = formatDate(prevYear, prevMonth + 1, day);
            cells.push({ date: dateStr, isCurrentMonth: false });
        }
        
        // 当前月的天数
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = formatDate(year, month + 1, day);
            cells.push({ date: dateStr, isCurrentMonth: true });
        }
        
        // 下个月的填充
        const remaining = 42 - cells.length;
        for (let i = 0; i < remaining; i++) {
            const day = i + 1;
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            const dateStr = formatDate(nextYear, nextMonth + 1, day);
            cells.push({ date: dateStr, isCurrentMonth: false });
        }
        
        const html = cells.map(cell => {
            const isToday = cell.date === getTodayString();
            const tasks = this._getTasksForDay(cell.date);
            
            return `
                <div class="day-box ${isToday ? 'is-today' : ''}" data-date="${cell.date}">
                    <div class="day-number">
                        ${cell.isCurrentMonth ? day : ''}
                        ${isToday ? '<span class="today-badge">今天</span>' : ''}
                    </div>
                    ${tasks.length > 0 ? this._renderMiniTasks(tasks) : ''}
                </div>
            `;
        }).join('');
        
        grid.innerHTML = html;
        
        // 绑定点击事件
        grid.querySelectorAll('.day-box').forEach(box => {
            box.addEventListener('click', () => {
                const date = box.dataset.date;
                if (date) {
                    // 这里可以跳转到日计划视图
                    console.log('Clicked day:', date);
                }
            });
        });
    }

    _getTasksForDay(date) {
        return (appData && appData.tasks || []).filter(t => t.date === date && t.status !== 'done');
    }

    _renderMiniTasks(tasks) {
        if (tasks.length === 0) return '';
        
        return tasks.slice(0, 3).map(task => {
            const type = task.type === 'learning' ? 'cal-task-learning' : 'cal-task-other';
            const text = task.title.length > 20 ? task.title.substring(0, 20) + '...' : task.title;
            return `<span class="cal-task-chip ${type}">${escapeHtml(text)}</span>`;
        }).join('');
    }

    changeMonth(delta) {
        this.currentMonth += delta;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.renderCalendar();
    }

    changeYear(delta) {
        this.currentYear += delta;
        this.renderCalendar();
    }

    // ============ 周计划 ============
    renderWeekBoard() {
        const board = document.getElementById('week-board');
        if (!board) return;

        // 计算本周的日期范围
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayOfWeek);
        
        const cells = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateStr = formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
            const isToday = dateStr === getTodayString();
            
            cells.push({
                date: dateStr,
                isToday,
                tasks: this._getTasksForDay(dateStr)
            });
        }
        
        const html = cells.map(cell => {
            const columnClass = cell.isToday ? 'today-col' : '';
            const header = cell.isToday ? '<span class="week-grid-header today-col">今天</span>' : `<span class="week-grid-header">${cell.date.split('-')[2]}</span>`;
            
            return `
                <div class="week-column ${columnClass}" data-date="${cell.date}">
                    ${header}
                    ${cell.isToday ? '<span class="week-today-badge">📍 今天</span>' : ''}
                    ${this._renderWeekTasks(cell.tasks)}
                </div>
            `;
        }).join('');
        
        board.innerHTML = html;
        
        // 绑定拖拽事件
        this._bindWeekDrag();
    }

    _renderWeekTasks(tasks) {
        if (tasks.length === 0) return '';
        
        return tasks.map(task => {
            const isLearning = task.type === 'learning';
            return `
                <div class="task-item ${isLearning ? 'lecture-task' : 'count-task'}" data-id="${task.id}">
                    ${isLearning ? '<input type="checkbox" onchange="window.updateTaskStatus(\'' + task.id + '\', this.checked)">' : ''}
                    <span class="task-text">${escapeHtml(task.title)}</span>
                </div>
            `;
        }).join('');
    }

    _bindWeekDrag() {
        const columns = document.querySelectorAll('.week-column');
        columns.forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                col.classList.add('drag-over');
            });
            col.addEventListener('dragleave', () => {
                col.classList.remove('drag-over');
            });
            col.addEventListener('drop', (e) => {
                e.preventDefault();
                col.classList.remove('drag-over');
                const id = e.dataTransfer.getData('text/plain');
                const task = appData.tasks.find(t => t.id === id);
                if (task) {
                    const newDate = col.dataset.date;
                    this.updateTask(id, { date: newDate });
                }
            });
        });
    }

    changeWeek(delta) {
        const dayOfWeek = new Date().getDay();
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - dayOfWeek);
        weekStart.setDate(weekStart.getDate() + (7 * delta));
        
        const newDate = formatDate(weekStart.getFullYear(), weekStart.getMonth() + 1, weekStart.getDate());
        this.currentWeekStart = newDate;
        
        // 重新渲染周计划
        this.renderWeekBoard();
    }

    // ============ 内部方法 ============
    _subscribers = new Set();
    _notify(data) {
        this._subscribers.forEach(cb => cb(data));
    }
}

// 导出
window.CalendarManager = CalendarManager;
window.calendarManager = new CalendarManager;

// 渲染函数别名（供 tasks.js 和 core.js 调用）
function renderCalendarView() {
    const calendarManager = new CalendarManager();
    if (typeof calendarManager.renderCalendar === 'function') {
        calendarManager.renderCalendar();
    }
}
export { renderCalendarView };
