/* ===== FIX-INJECT-BEGIN: events-top-guard ===== */
/* ------------------------------------------------------------------
 * 修复注入①：getElementById 空元素保护
 * 背景：3-templates.js 的模板延迟注入，7-events.js 顶部存在
 *       document.getElementById('month-summary-textarea').addEventListener(...)
 *       之类直接调用，元素不存在 → 抛错 → 后续所有 window 函数、拖拽、
 *       初始化全部不执行 → 表现为「所有按钮点击失效」。
 * 方案：脚本同步执行期间，getElementById 未命中时返回占位对象，使
 *       .addEventListener() 静默忽略；脚本执行完后（DOMContentLoaded /
 *       setTimeout 0）自动还原，用户交互时一切正常。
 * 影响面：仅覆盖本次同步执行阶段，不改变其他模块行为。
 * ------------------------------------------------------------------ */
(function installGetElementByIdGuard() {
    if (window.__eventsTopGuardInstalled) return;
    window.__eventsTopGuardInstalled = true;

    var DocProto = (typeof Document !== 'undefined') ? Document.prototype : null;
    if (!DocProto || typeof DocProto.getElementById !== 'function') return;

    var origGet = DocProto.getElementById;
    window.__origGetElementById = origGet;
    window.__eventsTopGuardActive = true;

    /* 占位对象：任何 addEventListener / 属性读写都静默忽略 */
    var stub = {
        addEventListener: function () {},
        removeEventListener: function () {},
        setAttribute: function () {},
        getAttribute: function () { return null; },
        hasAttribute: function () { return false; },
        removeAttribute: function () {},
        classList: {
            add: function () {}, remove: function () {}, toggle: function () {},
            contains: function () { return false; }, replace: function () {}
        },
        style: {}, dataset: {},
        innerText: '', innerHTML: '', textContent: '',
        value: '', checked: false, disabled: false,
        focus: function () {}, blur: function () {}, click: function () {},
        appendChild: function () {}, removeChild: function () {}, insertBefore: function () {},
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        closest: function () { return null; },
        scrollIntoView: function () {},
        getBoundingClientRect: function () {
            return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
        },
        offsetParent: null
    };

    DocProto.getElementById = function (id) {
        var el = origGet.call(this, id);
        if (el) return el;
        if (!window.__eventsTopGuardActive) return el;
        return stub;
    };

    function restore() {
        if (!window.__eventsTopGuardActive) return;
        window.__eventsTopGuardActive = false;
        DocProto.getElementById = origGet;
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', restore, { once: true });
    }
    setTimeout(restore, 0);
    setTimeout(restore, 200);
})();
/* ===== FIX-INJECT-END: events-top-guard ===== */

window.enableTaskEdit = function(span, taskId, subId) {
    if (locks[taskId]) return showMiniToast('对方正在编辑该任务', '#eb5757');
    acquireLock(taskId);
    if (span.dataset.editing === '1') return;
    span.dataset.editing = '1';
    const orig = span.innerText;
    const input = document.createElement('input');
    input.type = 'text'; input.value = orig;
    input.style.cssText = 'font:inherit;padding:2px 6px;border:1px solid var(--accent-color);border-radius:4px;width:100%;max-width:360px;background:var(--bg-input);color:var(--text-main);outline:none;';
    span.style.display = 'none'; span.parentNode.insertBefore(input, span.nextSibling);
    input.focus(); input.select();
    let fin = false;
    let typingTimer = null;
    input.addEventListener('input', () => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            if (subId) { const t = appData.tasks.find(t => t.id === taskId); const s = t && t.subTasks.find(s => s.id === subId); if (s) s.text = input.value; }
            else { const t = appData.tasks.find(t => t.id === taskId); if (t) t.text = input.value; }
            saveDataToFile(appData);
        }, 800);
    });
    const finish = (save) => {
        if (fin) return; fin = true;
        releaseLock(taskId);
        clearTimeout(typingTimer);
        const nv = input.value.trim();
        if (save && nv && nv !== orig) {
            if (subId) { const t = appData.tasks.find(t => t.id === taskId); const s = t && t.subTasks.find(s => s.id === subId); if (s) s.text = nv; }
            else { const t = appData.tasks.find(t => t.id === taskId); if (t) t.text = nv; }
            if (input.parentNode) input.parentNode.removeChild(input);
            renderDayPlan(); renderTaskPool(); renderWeekBoard(); saveDataToFile(appData); refreshDetailModalIfOpen();
            return;
        }
        if (input.parentNode) input.parentNode.removeChild(input);
        span.style.display = ''; span.dataset.editing = '';
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
};
window.enableExerciseTaskEdit = function(span, exId, sid) {
    const lockKey = 'ex_' + exId + '_' + sid;
    if (locks[lockKey]) return showMiniToast('对方正在编辑', '#eb5757');
    acquireLock(lockKey);
    if (span.dataset.editing === '1') return;
    span.dataset.editing = '1';
    const orig = span.innerText;
    const input = document.createElement('input');
    input.type = 'text'; input.value = orig;
    input.style.cssText = 'font:inherit;padding:2px 6px;border:1px solid var(--accent-color);border-radius:4px;width:100%;max-width:360px;background:var(--bg-input);color:var(--text-main);outline:none;';
    span.style.display = 'none'; span.parentNode.insertBefore(input, span.nextSibling);
    input.focus(); input.select();
    let fin = false;
    let typingTimer = null;
    input.addEventListener('input', () => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            const ex = appData.exercises.find(e => e.id === exId);
            if (ex) { const s = ex.subTasks.find(sub => sub.id === sid); if (s) s.text = input.value; ex._lastModified = Date.now(); }
            saveDataToFile(appData);
        }, 800);
    });
    const finish = (save) => {
        if (fin) return; fin = true;
        releaseLock(lockKey);
        clearTimeout(typingTimer);
        const nv = input.value.trim();
        if (save && nv && nv !== orig) {
            const ex = appData.exercises.find(e => e.id === exId);
            if (ex) { const s = ex.subTasks.find(sub => sub.id === sid); if (s) s.text = nv; ex._lastModified = Date.now(); }
            if (input.parentNode) input.parentNode.removeChild(input);
            renderDayExercises(); renderWeekBoard(); saveDataToFile(appData);
            return;
        }
        if (input.parentNode) input.parentNode.removeChild(input);
        span.style.display = ''; span.dataset.editing = '';
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
};
window.setTaskEstimate = function(taskId) {
    const t = appData.tasks.find(t => t.id === taskId);
    if (!t) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的任务不能设置属性，拖入学习/其他后再设置'); return; }
    const v = prompt('预计完成时长：', t.estimate || '');
    if (v !== null) { if (v.trim()) t.estimate = v.trim(); else delete t.estimate; renderDayPlan(); renderTaskPool(); renderWeekBoard(); saveDataToFile(appData); refreshDetailModalIfOpen(); }
};
window.setSubTaskEstimate = function(taskId, subId) {
    const t = appData.tasks.find(t => t.id === taskId);
    if (!t || !t.subTasks) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的任务不能设置属性'); return; }
    const s = t.subTasks.find(s => s.id === subId);
    if (!s) return;
    const v = prompt(`设置【${s.text}】预计完成时长：`, s.estimate || '');
    if (v !== null) { if (v.trim()) s.estimate = v.trim(); else delete s.estimate; renderDayPlan(); renderTaskPool(); renderWeekBoard(); saveDataToFile(appData); refreshDetailModalIfOpen(); }
};
window.toggleSubFold = function(taskId, ev) {
    if (ev) ev.stopPropagation();
    if (expandedSubTasks.has(taskId)) expandedSubTasks.delete(taskId); else expandedSubTasks.add(taskId);
    renderDayPlan();
    if (currentTaskModalCategory) renderTaskListModalContent(currentTaskModalCategory);
};
window.refreshDetailModalIfOpen = function() {
    if (!currentDetailTaskId) return;
    const modal = document.getElementById('task-detail-modal');
    if (!modal || !modal.classList.contains('active')) return;
    const t = appData.tasks.find(x => x.id === currentDetailTaskId);
    if (!t) { closeTaskDetailModal(); return; }
    const body = document.getElementById('task-detail-modal-body');
    if (!body) return;
    const isExpanded = expandedSubTasks.has(currentDetailTaskId);
    if (!isExpanded) expandedSubTasks.add(currentDetailTaskId);
    body.innerHTML = '';
    body.appendChild(generateTaskDOM(t, appData.selectedDate, { showSubTasks: true }));
    if (!isExpanded) expandedSubTasks.delete(currentDetailTaskId);
};
window.openTaskDetailModal = function(taskId) {
    const t = appData.tasks.find(t => t.id === taskId);
    if (!t) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的任务没有详情，把它拖入学习/其他后再查看'); return; }
    currentDetailTaskId = taskId;
    const ds = appData.selectedDate;
    document.getElementById('task-detail-modal-title').innerText = `🔍 任务详情`;
    const body = document.getElementById('task-detail-modal-body');
    body.innerHTML = '';
    const isExpanded = expandedSubTasks.has(taskId);
    if (!isExpanded) expandedSubTasks.add(taskId);
    const div = generateTaskDOM(t, ds, { showSubTasks: true });
    body.appendChild(div);
    if (!isExpanded) expandedSubTasks.delete(taskId);
    document.getElementById('task-detail-modal').classList.add('active');
};
window.closeTaskDetailModal = function() {
    currentDetailTaskId = null;
    document.getElementById('task-detail-modal').classList.remove('active');
    const body = document.getElementById('task-detail-modal-body');
    if (body) body.innerHTML = '';
};
document.addEventListener('click', (e) => {
    if (!e.target.closest('.more-menu-container')) document.querySelectorAll('.more-menu').forEach(menu => menu.classList.remove('active'));
    if (!e.target.closest('.sub-more-container')) document.querySelectorAll('.sub-more-menu').forEach(menu => menu.classList.remove('active'));
});
window.toggleMoreMenu = function(btn, ev) {
    ev.stopPropagation();
    const menu = btn.nextElementSibling;
    const isActive = menu.classList.contains('active');
    document.querySelectorAll('.more-menu').forEach(m => m.classList.remove('active'));
    if (!isActive) menu.classList.add('active');
};
window.toggleSubMore = function(btn, ev) {
    ev.stopPropagation();
    const menu = btn.nextElementSibling;
    const isActive = menu.classList.contains('active');
    document.querySelectorAll('.sub-more-menu').forEach(m => m.classList.remove('active'));
    if (!isActive) menu.classList.add('active');
};
window.editTaskNote = function(taskId, el) {
    if (el.dataset.editing === '1') return;
    el.dataset.editing = '1';
    const t = appData.tasks.find(t => t.id === taskId);
    if (!t) return;
    const orig = t.note || '';
    const textarea = document.createElement('textarea');
    textarea.value = orig;
    textarea.style.cssText = 'width:100%; min-height:60px; padding:6px; font-size:var(--font-hint); border:1px solid var(--accent-color); border-radius:4px; background:var(--bg-input); color:var(--text-main); outline:none; resize:vertical;';
    el.innerHTML = '';
    el.appendChild(textarea);
    textarea.focus();
    let fin = false;
    const finish = (save) => {
        if (fin) return; fin = true;
        const nv = textarea.value.trim();
        if (save && nv !== orig) { if (nv) t.note = nv; else delete t.note; saveDataToFile(appData); }
        el.dataset.editing = '0';
        renderDayPlan(); renderTaskPool();
        if (currentTaskModalCategory) renderTaskListModalContent(currentTaskModalCategory);
    };
    textarea.addEventListener('blur', () => finish(true));
    textarea.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
};
const SUB_FOLD_THRESHOLD = 3;
function renderSubTaskHtml(task, sub, ds) {
    const ecBadge = (sub.energyCost !== undefined && sub.energyCost !== null) ? `<span class="sub-badge sub-badge-energy" title="精力消耗">⚡${sub.energyCost}</span>` : '';
    const estBadge = sub.estimate ? `<span class="sub-badge sub-badge-estimate" title="预计时长">⏱${escapeHtml(sub.estimate)}</span>` : '';
    if (sub.countOnly) {
        return `
            <div class="sub-task-item" data-sub-id="${sub.id}">
                <div class="sub-task-left"><span style="font-size:1em;">🔄</span><span class="${sub.countEnded ? 'task-completed' : ''}" ondblclick="enableTaskEdit(this, '${task.id}', '${sub.id}')" title="双击编辑" style="cursor:text;">${escapeHtml(sub.text)}</span></div>
                <div class="sub-actions">${ecBadge}${estBadge}<span class="count-display">累计 <b>${sub.countTotal || 0}</b> 次</span><button class="btn-count-plus" style="padding:2px 8px;font-size:var(--font-small);" onclick="incrementSubCount('${task.id}', '${sub.id}')">+1</button><span class="btn-icon btn-count-end" title="结束此子任务" onclick="endSubCount('${task.id}', '${sub.id}')" style="font-weight:bold;">🏁</span><span class="btn-sub-count" title="转回普通子任务" onclick="toggleSubCountOnly('${task.id}', '${sub.id}')">↩️ 普通</span><span class="btn-sub-delete" title="删除" onclick="deleteSubTask('${task.id}', '${sub.id}')" style="cursor:pointer;color:var(--text-muted);padding:0 2px;">🗑️</span></div>
            </div>`;
    }
    const sp = getSubTaskProgress(sub, ds, task);
    const done = isSubTaskDone(sub, ds);
    const isCount = sub.target > 0;
    const pct = isCount ? Math.min(100, Math.round((sp.done / sp.total) * 100)) : 0;
    const defEC = sub.target ? 1 : 5;
    const ec = sub.energyCost !== undefined ? sub.energyCost : defEC;
    const estLabel = sub.estimate ? `⏱ ${sub.estimate}` : '⏱';
    const progBadge = isCount ? `<span class="sub-badge" title="进度" style="background:#e3f2fd;color:#1976d2;border-color:#90caf9;">🎯 ${sp.done}/${sp.total}</span>` : '';
    return `
        <div class="sub-task-item" data-sub-id="${sub.id}">
            <div class="sub-task-left"><input type="checkbox" class="task-checkbox" ${done ? 'checked' : ''} onchange="toggleSubTask('${task.id}', '${sub.id}')"><span class="${done ? 'task-completed' : ''}" ondblclick="enableTaskEdit(this, '${task.id}', '${sub.id}')" title="双击编辑" style="cursor:text;">${escapeHtml(sub.text)}</span></div>
            <div class="sub-actions">${ecBadge}${estBadge}${progBadge}
                ${isCount ? `<div class="sub-prog-container"><div class="sub-prog-bar-bg"><div class="sub-prog-bar-fill" style="width:${pct}%;"></div></div>${!done ? `<button class="btn-sub-plus" onclick="decrementSubTaskProgress('${task.id}', '${sub.id}')" title="减少一次">-1</button><button class="btn-sub-plus" onclick="incrementSubTaskProgress('${task.id}', '${sub.id}')" title="增加一次">+1</button>` : ''}</div>` : ''}
                <span class="btn-sub-count" title="转为累计计数任务" onclick="toggleSubCountOnly('${task.id}', '${sub.id}')">🔄 计数</span>
                <div class="sub-more-container"><span class="sub-more-btn" onclick="toggleSubMore(this, event)" title="更多操作">⋮</span><div class="sub-more-menu"><div class="sub-more-item" onclick="setSubTaskEstimate('${task.id}', '${sub.id}')">${estLabel} 预计时长</div><div class="sub-more-item" onclick="setSubTaskEnergyCost('${task.id}', '${sub.id}')">⚡ 精力消耗 (${ec})</div><div class="sub-more-item" onclick="setSubTaskTarget('${task.id}', '${sub.id}')"># 设置次数</div><div class="sub-more-item" onclick="deleteSubTask('${task.id}', '${sub.id}')" style="color:var(--danger-color);">🗑️ 删除</div></div></div>
            </div>
        </div>`;
}
function generateTodoTaskDOM(task) {
    const div = document.createElement('div');
    div.className = 'main-task-item todo-task-item';
    div.dataset.taskId = task.id;
    if (locks[task.id]) div.classList.add('locked-by-remote');
    let html = `<div class="main-task-header"><div class="main-task-top-row"><div class="main-task-title-area"><span style="font-size:1.2em;">📋</span><span class="task-text" ondblclick="enableTaskEdit(this, '${task.id}')" title="双击编辑" style="cursor:text;font-weight:600;">${escapeHtml(task.text)}</span><span class="task-badge" style="color:#7e22ce;background:#f3e8ff;border-color:#d8b4fe;">拖入学习/其他开始处理</span></div><div class="task-right-group"><div class="task-meta"><span class="btn-icon btn-delete-task" title="删除" onclick="deleteTask('${task.id}')">🗑️</span></div></div></div></div>`;
    if (task.subTasks && task.subTasks.length > 0) {
        html += `<div class="todo-sub-list" style="margin-left:24px;margin-top:8px;padding-left:12px;border-left:2px solid var(--border-color);display:flex;flex-direction:column;gap:4px;">`;
        task.subTasks.forEach(s => { html += `<div class="todo-sub-item" style="display:flex;align-items:center;justify-content:space-between;padding:2px 6px;font-size:var(--font-hint);color:var(--text-main);border-radius:4px;"><div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;"><span style="color:var(--text-muted);font-size:10px;">◦</span><span ondblclick="enableTaskEdit(this, '${task.id}', '${s.id}')" title="双击编辑" style="cursor:text;word-break:break-all;">${escapeHtml(s.text)}</span></div><span onclick="deleteSubTask('${task.id}', '${s.id}')" title="删除" style="cursor:pointer;color:var(--text-muted);padding:0 4px;opacity:.6;flex-shrink:0;">🗑️</span></div>`; });
        html += `</div>`;
    }
    html += `<input type="text" class="add-sub-task-input" id="input-${task.id}" placeholder="步骤 (支持 *数字)..." onkeypress="addSubTask(event, '${task.id}')"><div style="margin-top:8px;"><span class="action-pill-btn" onclick="showSubInput('${task.id}', this)">➕ 步骤</span></div>`;
    div.innerHTML = html;
    return div;
}
function generateTaskDOM(task, ds, options = {}) {
    if (task.type === 'todo') return generateTodoTaskDOM(task);
    const showSubTasks = !!options.showSubTasks;
    const div = document.createElement('div');
    div.className = `main-task-item ${task.pinned ? 'pinned-task' : ''} ${task.countOnly ? 'count-only-task' : ''}`;
    div.dataset.taskId = task.id;
    if (locks[task.id]) div.classList.add('locked-by-remote');
    if (task.countOnly) {
        div.innerHTML = `
            <div class="main-task-header"><div class="main-task-top-row"><div class="main-task-title-area"><span style="font-size:1.2em;">🔄</span><span class="task-text" ondblclick="enableTaskEdit(this, '${task.id}')" title="双击编辑" style="cursor:text;font-weight:600;">${escapeHtml(task.text)}</span></div><div class="task-right-group"><div class="task-badges-inline"><span class="task-badge" style="color:#1976d2;background:#e3f2fd;border-color:#90caf9;">累计 ${task.countTotal || 0} 次</span></div><div class="task-meta"><button class="btn-count-minus" onclick="decrementCountTask('${task.id}')" title="撤销一次">-1</button><button class="btn-count-plus" onclick="incrementCountTask('${task.id}')" title="累计一次">+1</button><span class="btn-icon btn-count-end" title="结束此任务" onclick="endCountTask('${task.id}')" style="font-weight:bold;font-size:1em;">🏁</span><span class="btn-icon btn-delete-task" title="删除" onclick="deleteTask('${task.id}')">🗑️</span><div class="more-menu-container"><span class="btn-icon" onclick="toggleMoreMenu(this, event)" title="更多操作" style="font-weight:bold;">⋮</span><div class="more-menu"><div class="more-menu-item" onclick="toggleCountOnly('${task.id}')">↩️ 转为普通任务</div><div class="more-menu-item" onclick="setTaskEnergyCost('${task.id}')">⚡ 精力消耗</div><div class="more-menu-item" onclick="deleteTask('${task.id}')">🗑️ 删除</div></div></div></div></div></div></div>
            <div class="task-note-area ${task.note ? 'has-note' : ''}" id="note-area-${task.id}" onclick="editTaskNote('${task.id}', this)">${task.note ? escapeHtml(task.note) : '📝 点击添加备注...'}</div>`;
        return div;
    }
    const taskDone = isTaskDone(task, ds);
    const hasSub = task.subTasks && task.subTasks.length > 0;
    const mp = getTaskProgress(task, ds);
    const mainCb = `<input type="checkbox" class="task-checkbox" ${taskDone ? 'checked' : ''} onchange="toggleMainTask('${task.id}')">`;
    const editT = `<span class="task-text ${taskDone ? 'task-completed' : ''}" ondblclick="enableTaskEdit(this, '${task.id}')" title="双击编辑" style="cursor:text;">${escapeHtml(task.text)}</span>`;
    const loopL = task.recurringType ? `<span class="loop-label">${task.recurringType}</span>` : '';
    let badgesHtml = '';
    if (task.recurringType) badgesHtml += `<span class="task-badge">🔁 ${task.recurringType}</span>`;
    if (task.estimate) badgesHtml += `<span class="task-badge">⏱ ${escapeHtml(task.estimate)}</span>`;
    const defEC = task.target ? 1 : 10;
    if (task.energyCost !== undefined && task.energyCost !== defEC) badgesHtml += `<span class="task-badge">⚡ ${task.energyCost}</span>`;
    if (task.target && !hasSub) badgesHtml += `<span class="task-badge">🎯 目标 ${mp.total} 次</span>`;
    if (task.deadline) {
        const dlDate = new Date(task.deadline + 'T00:00:00');
        const dsDate = new Date(ds + 'T00:00:00');
        const diffDays = Math.round((dlDate - dsDate) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) badgesHtml += `<span class="task-badge urgent">⚠️ 已逾期 ${Math.abs(diffDays)} 天</span>`;
        else if (diffDays === 0) badgesHtml += `<span class="task-badge urgent">📅 今天截止</span>`;
        else if (diffDays <= 3) badgesHtml += `<span class="task-badge warning">📅 剩 ${diffDays} 天</span>`;
        else badgesHtml += `<span class="task-badge">📅 剩 ${diffDays} 天</span>`;
    }
    const cbSet = new Set(appData.commonBtns);
    let btnsHtml = '', moreBtnsHtml = '';
    const canSkip = !!(task.deadline || task.recurringType);
    const allBtns = [
        { key: 'skip', icon: '⏭️', title: '今天暂不完成', cls: 'btn-skip-task', action: `onclick="skipTaskForToday('${task.id}')"`, show: canSkip },
        { key: 'estimate', icon: '⏱', title: '预计时长', action: `onclick="setTaskEstimate('${task.id}')"` },
        { key: 'energy', icon: '⚡', title: '精力消耗', action: `onclick="setTaskEnergyCost('${task.id}')"` },
        { key: 'pin', icon: '📌', title: '置顶', cls: task.pinned ? 'active' : '', action: `onclick="togglePinTask('${task.id}')"` },
        { key: 'target', icon: '#', title: '次数', action: `onclick="setTaskTarget('${task.id}')"` },
        { key: 'loop', icon: '🔁', title: '循环', cls: task.recurringType ? 'active' : '', action: `onclick="toggleRecurring('${task.id}')"` },
        { key: 'count', icon: '🔄', title: '转为计数任务', action: `onclick="toggleCountOnly('${task.id}')"` },
        { key: 'deadline', icon: '📅', title: '设置截止日期', action: `onclick="setDeadline('${task.id}', prompt('设置截止日期 (YYYY-MM-DD，留空取消)：', '${task.deadline || ''}'))"` },
        { key: 'delete', icon: '🗑️', title: '删除', cls: 'btn-delete-task', action: `onclick="deleteTask('${task.id}')"` }
    ];
    allBtns.forEach(btn => {
        if (btn.show === false) return;
        const fullBtn = `<span class="btn-icon ${btn.cls||''}" ${btn.action} ${btn.title ? `title="${btn.title}"` : ''} style="font-weight:bold;">${btn.icon}</span>`;
        if (cbSet.has(btn.key)) btnsHtml += fullBtn;
        else moreBtnsHtml += `<div class="more-menu-item" ${btn.action}>${btn.icon} ${btn.title}</div>`;
    });
    let moreMenuHtml = '';
    if (moreBtnsHtml) moreMenuHtml = `<div class="more-menu-container"><span class="btn-icon" onclick="toggleMoreMenu(this, event)" title="更多操作" style="font-weight:bold;">⋮</span><div class="more-menu">${moreBtnsHtml}</div></div>`;
    let headerHtml = `<div class="main-task-top-row"><div class="main-task-title-area">${mainCb}<div class="task-text-wrap">${editT}</div>${loopL}</div><div class="task-right-group">${badgesHtml ? `<div class="task-badges-inline">${badgesHtml}</div>` : ''}<div class="task-meta">${btnsHtml}${moreMenuHtml}</div></div></div>`;
    let progressRowHtml = '';
    if (task.target || hasSub || true) {
        const pct = Math.min(100, Math.round((mp.done / mp.total) * 100));
        const isCountOnly = task.target && !hasSub;
        let leftActionsHtml = '';
        if (hasSub && !showSubTasks) leftActionsHtml += `<span class="action-pill-btn" onclick="openTaskDetailModal('${task.id}')">📋 子计划 ${task.subTasks.length}</span>`;
        leftActionsHtml += `<span class="action-pill-btn" onclick="showSubInput('${task.id}', this)">➕ 步骤</span>`;
        progressRowHtml = `<div class="progress-row"><div class="progress-actions-left">${leftActionsHtml}</div><div class="progress-right"><div class="progress-task-bar-bg"><div class="progress-task-bar-fill" style="width:${pct}%;"></div></div><span class="progress-text">${mp.done}/${mp.total}</span>${isCountOnly && !taskDone ? `<button class="btn-minus-one" onclick="decrementTaskProgress('${task.id}')">-1</button><button class="btn-plus-one" onclick="incrementTaskProgress('${task.id}')">+1</button>` : ''}</div></div>`;
    }
    let html = `<div class="main-task-header">${headerHtml}${progressRowHtml}</div>`;
    if (hasSub && showSubTasks) {
        html += `<div class="sub-task-list" data-task-id="${task.id}">`;
        const isExpanded = expandedSubTasks.has(task.id);
        const activeSubs = task.subTasks.filter(s => !isSubTaskDone(s, ds));
        const doneSubs = task.subTasks.filter(s => isSubTaskDone(s, ds));
        const totalActive = activeSubs.length;
        let visibleSubs = activeSubs;
        let hasHidden = false;
        if (!isExpanded && totalActive > SUB_FOLD_THRESHOLD) { visibleSubs = activeSubs.slice(0, SUB_FOLD_THRESHOLD); hasHidden = true; }
        visibleSubs.forEach(s => { html += renderSubTaskHtml(task, s, ds); });
        if (hasHidden) html += `<div class="sub-fold-btn" onclick="toggleSubFold('${task.id}', event)">▼ 展开剩余 ${totalActive - SUB_FOLD_THRESHOLD} 个</div>`;
        else if (isExpanded && totalActive > SUB_FOLD_THRESHOLD) html += `<div class="sub-fold-btn" onclick="toggleSubFold('${task.id}', event)">▲ 收起</div>`;
        if (doneSubs.length > 0) {
            html += `<details class="completed-tasks-section" style="margin-top:6px;padding-top:6px;"><summary>已完成 (${doneSubs.length})</summary><div class="sub-completed-list">`;
            doneSubs.forEach(s => { html += renderSubTaskHtml(task, s, ds); });
            html += `</div></details>`;
        }
        html += `</div>`;
    }
    html += `<input type="text" class="add-sub-task-input" id="input-${task.id}" placeholder="步骤 (支持 *数字)..." onkeypress="addSubTask(event, '${task.id}')"><div class="task-note-area ${task.note ? 'has-note' : ''}" id="note-area-${task.id}" onclick="editTaskNote('${task.id}', this)">${task.note ? escapeHtml(task.note) : '📝 点击添加备注...'}</div>`;
    div.innerHTML = html;
    if (!showSubTasks) {
        div.classList.add('clickable-for-detail');
        div.addEventListener('click', function(e) {
            const interactive = e.target.closest('input, button, textarea, select, a, .btn-icon, .more-menu-container, .task-meta, .task-note-area, .btn-add-sub, .add-sub-task-input, .progress-task-container, .sub-task-list, .btn-count-plus, .btn-count-minus, .btn-count-end, .action-pill-btn');
            if (interactive) return;
            openTaskDetailModal(task.id);
        });
    }
    return div;
}
window.skipTaskForToday = function(taskId) {
    const t = appData.tasks.find(x => x.id === taskId);
    if (!t) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的任务不能跳过'); return; }
    const ds = appData.selectedDate;
    if (!t.skipDates) t.skipDates = {};
    t.skipDates[ds] = true;
    saveDataToFile(appData);
    renderDayPlan(); renderCalendar(); renderTaskPool(); updateFixedProgressBars();
    showMiniToast('⏭️ 今天已跳过该任务');
};
window.toggleCountOnly = function(taskId) {
    const t = appData.tasks.find(x => x.id === taskId);
    if (!t) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的任务不能转为计数任务，拖入学习/其他后再设置'); return; }
    if (t.countOnly) { delete t.countOnly; delete t.countTotal; delete t.countEnded; showMiniToast('已转为普通任务'); }
    else {
        const initVal = prompt('转为纯计数任务？会从输入的初始值开始累计。\n请输入初始累计次数 (取消则不转换)：', '0');
        if (initVal === null) return;
        const initNum = parseInt(initVal);
        t.countOnly = true; t.countTotal = isNaN(initNum) ? 0 : initNum; t.countEnded = false;
        delete t.completed; delete t.completions; delete t.target; delete t.current; delete t.currents; delete t.recurringType;
        showMiniToast('🔄 已转为计数任务');
    }
    renderDayPlan(); renderTaskPool(); renderWeekBoard(); updateFixedProgressBars();
    saveDataToFile(appData);
    refreshDetailModalIfOpen();
};
window.incrementCountTask = function(taskId) {
    const t = appData.tasks.find(x => x.id === taskId);
    if (!t || !t.countOnly) return;
    if (t.type === 'todo') return;
    t.countTotal = (t.countTotal || 0) + 1;
    const ec = t.energyCost || 1;
    adjustTodayEnergy(ec); adjustExp(ec);
    logTaskAction(getTodayString(), t.id, t.text, 'count', 1);
    renderEnergyAndRPG(); updateFixedProgressBars(); saveDataToFile(appData);
    renderDayPlan(); renderWeekBoard(); renderCalendar(); refreshDetailModalIfOpen();
};
window.decrementCountTask = function(taskId) {
    const t = appData.tasks.find(x => x.id === taskId);
    if (!t || !t.countOnly) return;
    if (t.type === 'todo') return;
    if ((t.countTotal || 0) <= 0) { showMiniToast('已经没有可撤销的计数了'); return; }
    t.countTotal = t.countTotal - 1;
    const ec = t.energyCost || 1;
    const today = getTodayString();
    appData.dailyEnergy[today] = (appData.dailyEnergy[today] || 0) - ec;
    appData.rpg.exp = Math.max(0, appData.rpg.exp - Math.floor(ec * appData.expRatio));
    logTaskAction(today, t.id, t.text, 'count', -1);
    renderEnergyAndRPG(); updateFixedProgressBars(); saveDataToFile(appData);
    renderDayPlan(); renderWeekBoard(); renderCalendar(); refreshDetailModalIfOpen();
};
window.endCountTask = function(taskId) {
    const t = appData.tasks.find(x => x.id === taskId);
    if (!t || !t.countOnly) return;
    if (t.type === 'todo') return;
    if (!confirm(`结束【${t.text}】？累计 ${t.countTotal || 0} 次。`)) return;
    t.countEnded = true;
    adjustAttr(t.type, 1); updateStreak();
    logTaskAction(getTodayString(), t.id, t.text, 'complete');
    renderEnergyAndRPG(); updateFixedProgressBars(); saveDataToFile(appData);
    renderDayPlan(); renderTaskPool(); renderCalendar(); refreshDetailModalIfOpen();
    showMiniToast(`🏁 已结束，累计 ${t.countTotal || 0} 次`);
};
window.toggleSubCountOnly = function(tid, sid) {
    const t = appData.tasks.find(x => x.id === tid);
    if (!t || !t.subTasks) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的子任务不能转换类型'); return; }
    const s = t.subTasks.find(x => x.id === sid);
    if (!s) return;
    if (s.countOnly) { delete s.countOnly; delete s.countTotal; delete s.countEnded; showMiniToast('子任务已转为普通任务'); }
    else {
        const initVal = prompt('转为纯计数子任务？\n请输入初始累计次数 (取消则不转换)：', '0');
        if (initVal === null) return;
        const initNum = parseInt(initVal);
        s.countOnly = true; s.countTotal = isNaN(initNum) ? 0 : initNum; s.countEnded = false;
        delete s.completed; delete s.completions; delete s.target; delete s.current; delete s.currents;
        showMiniToast('🔄 子任务已转为计数任务');
    }
    syncParentTaskStatus(t, appData.selectedDate);
    saveDataToFile(appData);
    renderDayPlan(); renderCalendar(); updateFixedProgressBars(); refreshDetailModalIfOpen();
};
window.incrementSubCount = function(tid, sid) {
    const t = appData.tasks.find(x => x.id === tid);
    if (!t || !t.subTasks) return;
    if (t.type === 'todo') return;
    const s = t.subTasks.find(x => x.id === sid);
    if (!s || !s.countOnly) return;
    s.countTotal = (s.countTotal || 0) + 1;
    const ec = s.energyCost || 1;
    adjustTodayEnergy(ec); adjustExp(ec);
    logTaskAction(getTodayString(), s.id, s.text, 'count', 1);
    renderEnergyAndRPG(); updateFixedProgressBars(); saveDataToFile(appData);
    renderDayPlan(); renderCalendar(); refreshDetailModalIfOpen();
};
window.endSubCount = function(tid, sid) {
    const t = appData.tasks.find(x => x.id === tid);
    if (!t || !t.subTasks) return;
    if (t.type === 'todo') return;
    const s = t.subTasks.find(x => x.id === sid);
    if (!s || !s.countOnly) return;
    if (!confirm(`结束【${s.text}】？累计 ${s.countTotal || 0} 次。`)) return;
    s.countEnded = true;
    adjustAttr(t.type, 1);
    const wt = isTaskDone(t, appData.selectedDate);
    syncParentTaskStatus(t, appData.selectedDate);
    const newT = isTaskDone(t, appData.selectedDate);
    if (!wt && newT) { adjustAttr('focus', 1); updateStreak(); }
    logTaskAction(getTodayString(), s.id, s.text, 'complete');
    renderEnergyAndRPG(); updateFixedProgressBars(); saveDataToFile(appData);
    renderDayPlan(); renderCalendar(); refreshDetailModalIfOpen();
    showMiniToast(`🏁 已结束，累计 ${s.countTotal || 0} 次`);
};
function getTodoTasks() { return appData.tasks.filter(t => t.type === 'todo'); }
function renderTodoList() {
    const container = document.getElementById('todo-list');
    if (!container) return;
    container.innerHTML = '';
    const tasks = getTodoTasks();
    tasks.forEach(t => container.appendChild(generateTaskDOM(t, appData.selectedDate)));
    if (tasks.length === 0) container.innerHTML = '<div style="color:var(--text-muted);font-size:var(--font-hint);text-align:center;padding:16px 8px;line-height:1.6;">📋 这里可以放一些「想法」<br>拖入学习 / 其他开始正式处理</div>';
}
function renderDayPlan() {
    ensureEnergyData();
    document.getElementById('day-title').innerText = `📝 日计划 (${getDateLabel(appData.selectedDate)})`;
    const ll = document.getElementById('learning-list'), ol = document.getElementById('other-list');
    const lc = document.getElementById('learning-completed'), oc = document.getElementById('other-completed');
    ll.innerHTML = ''; ol.innerHTML = ''; lc.innerHTML = ''; oc.innerHTML = '';
    const ds = appData.selectedDate;
    const dt = getTasksForDate(ds);
    const aL = dt.filter(t => t.type === 'learning' && !isTaskDone(t, ds)).sort((a, b) => (a.pinned && !b.pinned ? -1 : (!a.pinned && b.pinned ? 1 : 0)));
    const dL = dt.filter(t => t.type === 'learning' && isTaskDone(t, ds));
    const aO = dt.filter(t => t.type === 'other' && !isTaskDone(t, ds)).sort((a, b) => (a.pinned && !b.pinned ? -1 : (!a.pinned && b.pinned ? 1 : 0)));
    const dO = dt.filter(t => t.type === 'other' && isTaskDone(t, ds));
    const MAX_VISIBLE = appData.maxVisible || 5;
    function renderList(el, tasks, type) {
        tasks.slice(0, MAX_VISIBLE).forEach(t => el.appendChild(generateTaskDOM(t, ds)));
        if (tasks.length > MAX_VISIBLE) {
            const btn = document.createElement('button');
            btn.className = 'view-all-btn';
            btn.innerText = `查看全部 (共 ${tasks.length} 项)`;
            btn.onclick = () => openTaskListModal(type);
            el.appendChild(btn);
        }
    }
    renderList(ll, aL, 'learning'); renderList(ol, aO, 'other');
    [['learning', dL, lc], ['other', dO, oc]].forEach(([_, list, container]) => {
        if (list.length > 0) {
            container.innerHTML = `<details class="completed-tasks-section"><summary>已完成 (${list.length})</summary><div class="completed-tasks-list"></div></details>`;
            const box = container.querySelector('.completed-tasks-list');
            list.forEach(t => box.appendChild(generateTaskDOM(t, ds)));
        }
    });
    const rt = document.getElementById('daily-reflection-textarea');
    const rDetails = document.getElementById('day-summary-details');
    if (rt) {
        const val = appData.dailyReflections[ds] || '';
        rt.value = val;
        if (rDetails) rDetails.open = !!val;
    }
    renderTodoList(); renderDayExercises(); updateFixedProgressBars(); saveDataToFile(appData);
    if (currentTaskModalCategory) renderTaskListModalContent(currentTaskModalCategory);
    setTimeout(initTaskAndSubTaskDrag, 0);
}
function getCategoryTasks(type) {
    const ds = appData.selectedDate;
    const dt = getTasksForDate(ds).filter(t => t.type === type);
    const active = dt.filter(t => !isTaskDone(t, ds)).sort((a, b) => (a.pinned && !b.pinned ? -1 : (!a.pinned && b.pinned ? 1 : 0)));
    return { active, done: dt.filter(t => isTaskDone(t, ds)) };
}
window.openTaskListModal = function(type) {
    currentTaskModalCategory = type;
    document.getElementById('task-list-modal-title').innerText = type === 'learning' ? '📚 全部学习任务' : '🧺 全部其他任务';
    renderTaskListModalContent(type);
    document.getElementById('task-list-modal').classList.add('active');
};
window.closeTaskListModal = function() {
    currentTaskModalCategory = null;
    document.getElementById('task-list-modal').classList.remove('active');
    const body = document.getElementById('task-list-modal-body');
    if (body) body.innerHTML = '';
};
function renderTaskListModalContent(type) {
    const body = document.getElementById('task-list-modal-body');
    const { active, done } = getCategoryTasks(type);
    body.innerHTML = '';
    if (active.length === 0 && done.length === 0) { body.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">暂无任务</div>'; return; }
    const ds = appData.selectedDate;
    active.forEach(t => body.appendChild(generateTaskDOM(t, ds, { showSubTasks: true })));
    if (done.length > 0) {
        const d = document.createElement('details');
        d.className = 'completed-tasks-section';
        d.innerHTML = `<summary>已完成 (${done.length})</summary><div class="completed-tasks-list"></div>`;
        const box = d.querySelector('.completed-tasks-list');
        done.forEach(t => box.appendChild(generateTaskDOM(t, ds, { showSubTasks: true })));
        body.appendChild(d);
    }
    setTimeout(initTaskAndSubTaskDrag, 0);
}
function initTaskAndSubTaskDrag() {
    document.querySelectorAll('.task-drop-zone').forEach(zone => {
        if (zone._sortable) { try { zone._sortable.destroy(); } catch(e) {} zone._sortable = null; }
        const isCompletedZone = zone.dataset.completed === 'true';
        const groupConfig = isCompletedZone ? { name: 'shared-tasks', pull: true, put: false } : 'shared-tasks';
        zone._sortable = new Sortable(zone, {
            group: groupConfig, animation: 150, ghostClass: 'sortable-ghost', draggable: '.main-task-item',
            onStart: function() { isDraggingActive = true; },
            onEnd: function(evt) {
                isDraggingActive = false;
                const item = evt.item, taskId = item.dataset.taskId;
                if (!taskId) { setTimeout(renderDayPlan, 30); return; }
                const task = appData.tasks.find(t => t.id === taskId);
                if (!task) { setTimeout(renderDayPlan, 30); return; }
                const fromType = task.type || '';
                const toType = evt.to && evt.to.dataset ? evt.to.dataset.type : null;
                const toCompleted = evt.to && evt.to.dataset ? evt.to.dataset.completed === 'true' : false;
                const validTypes = ['todo', 'learning', 'other'];
                if (!toType || !validTypes.includes(toType) || toCompleted) { setTimeout(renderDayPlan, 30); return; }
                if (toType === 'todo') {
                    if (fromType !== 'todo') {
                        task.todoKind = (fromType === 'other') ? 'other' : 'learning';
                        task.type = 'todo'; task.date = 'pool';
                        delete task.timeSlot; if (task.timeSlots) task.timeSlots = [];
                        delete task.pinned;
                        task.completed = false; if (task.completions) delete task.completions;
                        if (task.recurringEndedDate) delete task.recurringEndedDate;
                        if (task.subTasks) task.subTasks.forEach(s => { s.completed = false; if (s.completions) delete s.completions; });
                    }
                } else if (fromType === 'todo') {
                    task.type = toType; task.date = appData.selectedDate;
                    delete task.todoKind; delete task.completed;
                    if (task.completions) delete task.completions;
                    if (task.recurringEndedDate) delete task.recurringEndedDate;
                    if (task.subTasks) task.subTasks.forEach(s => { s.completed = false; if (s.completions) delete s.completions; });
                } else {
                    task.type = toType;
                    if (isTaskDone(task, appData.selectedDate)) setTaskDone(task, appData.selectedDate, false);
                }
                const newOrderIds = Array.from(evt.to.querySelectorAll('.main-task-item')).map(el => el.dataset.taskId).filter(Boolean);
                appData.tasks = appData.tasks.filter(t => t.id !== taskId);
                const insertIndex = appData.tasks.findIndex(t => newOrderIds.includes(t.id));
                if (insertIndex !== -1) appData.tasks.splice(insertIndex, 0, task);
                else appData.tasks.push(task);
                saveDataToFile(appData);
                setTimeout(renderDayPlan, 30);
            }
        });
    });
    document.querySelectorAll('.sub-task-list').forEach(list => {
        if (list._sortable) { try { list._sortable.destroy(); } catch(e) {} list._sortable = null; }
        list._sortable = new Sortable(list, {
            group: 'subtasks', animation: 150, ghostClass: 'sortable-ghost', draggable: '.sub-task-item',
            onStart: function() { isDraggingActive = true; },
            onEnd: function(evt) {
                isDraggingActive = false;
                const taskId = evt.to.dataset.taskId;
                if (!taskId) { setTimeout(renderDayPlan, 30); return; }
                const task = appData.tasks.find(t => t.id === taskId);
                if (!task) { setTimeout(renderDayPlan, 30); return; }
                const newSubIds = Array.from(evt.to.querySelectorAll('.sub-task-item')).map(el => el.dataset.subId).filter(Boolean);
                const reordered = newSubIds.map(id => task.subTasks.find(s => s.id === id)).filter(Boolean);
                const others = task.subTasks.filter(s => !newSubIds.includes(s.id));
                task.subTasks = [...reordered, ...others];
                saveDataToFile(appData);
                setTimeout(renderDayPlan, 30);
            }
        });
    });
}
function isCategoryAllCheckedForDate(exId, ds) {
    const ex = appData.exercises.find(e => e.id === exId);
    if (!ex) return false;
    const c = appData.dailyExerciseChecks[ds] || {};
    if (!ex.subTasks || ex.subTasks.length === 0) return !!c[exId];
    return ex.subTasks.every(s => c[`${exId}_${s.id}`]);
}
function isCategoryAllChecked(exId) { return isCategoryAllCheckedForDate(exId, appData.selectedDate); }
function setCategoryExerciseChecked(exId, ds, checked) {
    const ex = appData.exercises.find(e => e.id === exId);
    if (!ex) return { was: false, now: false, ex: null, cost: 0 };
    if (!appData.dailyExerciseChecks[ds]) appData.dailyExerciseChecks[ds] = {};
    const c = appData.dailyExerciseChecks[ds];
    const was = isCategoryAllCheckedForDate(exId, ds);
    if (!ex.subTasks || ex.subTasks.length === 0) c[exId] = !!checked;
    else ex.subTasks.forEach(s => { c[`${exId}_${s.id}`] = !!checked; });
    const now = isCategoryAllCheckedForDate(exId, ds);
    return { was, now, ex, cost: ex.energyCost || 15 };
}
function applyExerciseEffects(was, now, cost) {
    if (was === now) return;
    if (now) { adjustTodayEnergy(cost); adjustExp(cost); adjustAttr('exercise', 1); updateStreak(); }
    else { adjustTodayEnergy(-cost); adjustExp(-cost); adjustAttr('exercise', -1); }
}
function renderDayExercises() {
    ensureEnergyData();
    const grid = document.getElementById('exercise-grid');
    grid.innerHTML = '';
    const ds = appData.selectedDate;
    const manual = appData.exerciseSchedule[ds] || [];
    const checks = appData.dailyExerciseChecks[ds] || {};
    appData.exercises.forEach(ex => {
        const isPlanned = manual.includes(ex.name) || isRecurringMatch(ex.recurringType, ds);
        const card = document.createElement('div');
        card.className = `exercise-card ${isPlanned ? 'active-plan' : ''}`;
        const loopC = ex.recurringType ? 'active' : '';
        const loopL = ex.recurringType ? `<span class="loop-label">${ex.recurringType}</span>` : '';
        const all = isCategoryAllChecked(ex.id);
        let html = `<div class="exercise-card-header"><div class="exercise-header-left"><input type="checkbox" class="exercise-cat-checkbox" ${all ? 'checked' : ''} onchange="toggleExerciseCategory('${ex.id}')"><span class="exercise-name" title="${ex.name}" ondblclick="renameExerciseCategory('${ex.id}')">${ex.name}</span>${loopL}</div><div class="exercise-header-right"><span class="btn-energy" title="精力消耗" onclick="setExerciseEnergyCost('${ex.id}')">⚡${ex.energyCost || 15}</span><span class="btn-loop ${loopC}" title="循环" onclick="toggleExerciseRecurring('${ex.id}')">🔁</span><span class="btn-del-ex" title="删除" onclick="deleteExerciseCategory('${ex.id}')">✖</span></div></div><div class="exercise-content">`;
        if (ex.subTasks.length === 0) html += '<div style="color:var(--text-muted);text-align:center;font-size:var(--font-hint);margin:8px 0;">👇 点击下方添加动作</div>';
        else {
            const act = ex.subTasks.filter(s => !checks[`${ex.id}_${s.id}`]);
            const done = ex.subTasks.filter(s => checks[`${ex.id}_${s.id}`]);
            act.forEach(s => { html += `<div class="exercise-item"><div class="exercise-item-left"><input type="checkbox" onchange="toggleExerciseTask('${ex.id}', '${s.id}')"><span ondblclick="enableExerciseTaskEdit(this, '${ex.id}', '${s.id}')" title="双击编辑" style="cursor:text;">${s.text}</span></div><span class="btn-del-action" onclick="deleteExerciseAction('${ex.id}', '${s.id}')">✕</span></div>`; });
            if (done.length > 0) {
                html += `<details><summary>已完成 (${done.length})</summary>`;
                done.forEach(s => { html += `<div class="exercise-item"><div class="exercise-item-left"><input type="checkbox" checked onchange="toggleExerciseTask('${ex.id}', '${s.id}')"><span class="task-completed" ondblclick="enableExerciseTaskEdit(this, '${ex.id}', '${s.id}')" title="双击编辑" style="cursor:text;">${s.text}</span></div></div>`; });
                html += `</details>`;
            }
        }
        html += `</div><div style="margin-top:8px;display:flex;gap:4px;"><input type="text" style="flex:1;min-width:0;border:1px solid var(--border-color);padding:4px 6px;border-radius:4px;font-size:var(--font-hint);background:var(--bg-input);color:var(--text-main);" placeholder="🏋️ 添加动作..." onkeypress="addExerciseTask(event, '${ex.id}')"></div>`;
        card.innerHTML = html;
        grid.appendChild(card);
    });
}
document.querySelectorAll('.nav-item[data-target]').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        item.classList.add('active');
        const t = item.getAttribute('data-target');
        document.getElementById(`view-${t}`).classList.add('active');
        if (t === 'month') renderCalendar();
        else if (t === 'year') renderYearHeatmap();
        else if (t === 'week') { renderWeekBoard(); renderTaskPool(); renderExercisePool(); renderFixedBlockPool(); }
        else if (t === 'day') { renderDayPlan(); applyPanelLayout(); }
        else if (t === 'methods') { initMethodsEditor(); renderMethodsFileList(); refreshMethodsEditorContent(); }
        else if (t === 'settings') {
            renderP2PHistory(); updateBackupUI(); renderLevelConfig(); renderEnergyAndRPG(); renderTimeSlotConfig(); renderFixedBlockEnergyConfig();
            const sh = localStorage.getItem('my_p2p_host_id');
            if (sh) document.getElementById('my-peer-id').innerText = sh;
        }
        if (t !== 'methods') cleanupMethodsTimers();
        if (t !== 'week') {
            const panel = document.getElementById('week-drawer-panel');
            if (panel && panel.classList.contains('open')) toggleWeekDrawer(false);
        }
    });
});
window.handleReflectionInput = function(val) {
    ensureEnergyData();
    appData.dailyReflections[appData.selectedDate] = val;
    saveDataToFile(appData);
    if (document.getElementById('view-month').classList.contains('active')) renderCalendar();
};
document.getElementById('month-summary-textarea').addEventListener('input', (e) => {
    const mKey = `${appData.viewYear}-${appData.viewMonth}`;
    if (!appData.monthlyReflections) appData.monthlyReflections = {};
    appData.monthlyReflections[mKey] = e.target.value;
    saveDataToFile(appData);
});
let draggedTaskId = null, draggedExerciseName = null, draggedExerciseSource = null, draggedFixedBlockId = null;
function allowDrop(ev) { ev.preventDefault(); ev.currentTarget.classList.add('drag-over'); }
function drag(ev, id) { draggedTaskId = id; draggedExerciseName = null; draggedExerciseSource = null; draggedFixedBlockId = null; isDraggingActive = true; }
function dragExercise(ev, n, s) { draggedExerciseName = n; draggedExerciseSource = s || 'pool'; draggedTaskId = null; draggedFixedBlockId = null; isDraggingActive = true; }
function dragFixedBlock(ev, id) { draggedFixedBlockId = id; draggedTaskId = null; draggedExerciseName = null; draggedExerciseSource = null; isDraggingActive = true; }
window.unscheduleTask = function(taskId) {
    const t = appData.tasks.find(x => x.id === taskId);
    if (!t) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的任务不参与排期'); return; }
    if (t._poolOrigin) { t.date = 'pool'; delete t._poolOrigin; }
    else if (t._prevDate) { t.date = t._prevDate; delete t._prevDate; }
    delete t.timeSlot; if (t.timeSlots) t.timeSlots = [];
    saveDataToFile(appData);
    renderWeekBoard(); renderTaskPool(); renderCalendar(); renderYearHeatmap(); updateFixedProgressBars();
    renderDayPlan(); renderEnergyAndRPG();
};
function handleDrop(ev, td, timeslot, poolKind) {
    ev.preventDefault();
    document.querySelectorAll('.week-column, .task-pool-list, #exercise-pool, .week-grid-cell').forEach(c => c.classList.remove('drag-over'));
    if (draggedFixedBlockId) {
        if (td !== 'pool' && timeslot) {
            ensureEnergyData();
            const fb = appData.fixedBlocks.find(b => b.id === draggedFixedBlockId);
            if (fb) {
                if (!appData.fixedBlockSchedule[td]) appData.fixedBlockSchedule[td] = {};
                if (!appData.fixedBlockSchedule[td][timeslot]) appData.fixedBlockSchedule[td][timeslot] = [];
                appData.fixedBlockSchedule[td][timeslot].push({ id: 'fbi_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), blockId: fb.id, name: fb.name });
                saveDataToFile(appData);
            }
        }
        draggedFixedBlockId = null; isDraggingActive = false;
        renderWeekBoard(); renderTaskPool(); renderExercisePool(); renderCalendar(); renderYearHeatmap(); updateFixedProgressBars(); renderEnergyAndRPG();
        return;
    }
    if (draggedTaskId) {
        const t = appData.tasks.find(t => t.id === draggedTaskId);
        if (t) {
            if (td === 'pool') {
                if (t.type !== 'todo') {
                    t.todoKind = (t.type === 'other') ? 'other' : 'learning';
                    t.type = 'todo';
                    t.completed = false; if (t.completions) delete t.completions;
                    if (t.recurringEndedDate) delete t.recurringEndedDate;
                    if (t.subTasks) t.subTasks.forEach(s => { s.completed = false; if (s.completions) delete s.completions; });
                } else if (poolKind) t.todoKind = poolKind;
                t.date = 'pool'; delete t.timeSlot; if (t.timeSlots) t.timeSlots = [];
                delete t._poolOrigin; delete t._prevDate;
            } else if (timeslot) {
                if (t.type === 'todo') {
                    const kind = t.todoKind === 'other' ? 'other' : 'learning';
                    t.type = kind; t.date = td; t.timeSlot = timeslot;
                    delete t.todoKind;
                    t.completed = false; if (t.completions) delete t.completions;
                    if (t.recurringEndedDate) delete t.recurringEndedDate;
                    if (t.subTasks) t.subTasks.forEach(s => { s.completed = false; if (s.completions) delete s.completions; });
                } else if (t.countOnly) {
                    if (!t.timeSlots) t.timeSlots = [];
                    const key = td + '_' + timeslot;
                    if (!t.timeSlots.includes(key)) t.timeSlots.push(key);
                    saveDataToFile(appData);
                    renderWeekBoard(); renderTaskPool();
                    draggedTaskId = null; isDraggingActive = false;
                    return;
                } else {
                    if (t.date === 'pool') t._poolOrigin = true;
                    else if (!t._prevDate && t.date !== td) t._prevDate = t.date;
                    t.date = td; t.timeSlot = timeslot;
                }
            }
        }
    } else if (draggedExerciseName) {
        const isSlot = draggedExerciseSource && draggedExerciseSource.startsWith('slot:');
        let oldSd = null, oldTs = null;
        if (isSlot) {
            const parts = draggedExerciseSource.split(':');
            oldSd = parts[1]; oldTs = parts[2];
            if (appData.exerciseTimeSlotSchedule[oldSd] && appData.exerciseTimeSlotSchedule[oldSd][oldTs]) {
                appData.exerciseTimeSlotSchedule[oldSd][oldTs] = appData.exerciseTimeSlotSchedule[oldSd][oldTs].filter(n => n !== draggedExerciseName);
                if (appData.exerciseTimeSlotSchedule[oldSd][oldTs].length === 0) delete appData.exerciseTimeSlotSchedule[oldSd][oldTs];
                if (Object.keys(appData.exerciseTimeSlotSchedule[oldSd]).length === 0) delete appData.exerciseTimeSlotSchedule[oldSd];
            }
        } else {
            const sd = draggedExerciseSource && draggedExerciseSource.startsWith('date:') ? draggedExerciseSource.substring(5) : null;
            if (sd) removeExerciseFromDate(draggedExerciseName, sd);
        }
        if (td === 'pool') { /* 已经从源移除 */ }
        else if (timeslot) {
            if (!appData.exerciseTimeSlotSchedule) appData.exerciseTimeSlotSchedule = {};
            if (!appData.exerciseTimeSlotSchedule[td]) appData.exerciseTimeSlotSchedule[td] = {};
            if (!appData.exerciseTimeSlotSchedule[td][timeslot]) appData.exerciseTimeSlotSchedule[td][timeslot] = [];
            if (!appData.exerciseTimeSlotSchedule[td][timeslot].includes(draggedExerciseName)) appData.exerciseTimeSlotSchedule[td][timeslot].push(draggedExerciseName);
        } else {
            if (!appData.exerciseSchedule[td]) appData.exerciseSchedule[td] = [];
            if (!appData.exerciseSchedule[td].includes(draggedExerciseName)) appData.exerciseSchedule[td].push(draggedExerciseName);
        }
    }
    saveDataToFile(appData);
    renderWeekBoard(); renderTaskPool(); renderExercisePool(); renderCalendar(); renderYearHeatmap(); updateFixedProgressBars();
    renderDayPlan(); renderEnergyAndRPG();
    draggedTaskId = null; draggedExerciseName = null; draggedExerciseSource = null; isDraggingActive = false;
}
window.deleteTask = function(id) {
    if (!confirm('删除这个任务？')) return;
    appData.tasks = appData.tasks.filter(t => t.id !== id);
    renderDayPlan(); renderCalendar(); renderTaskPool(); renderYearHeatmap(); updateFixedProgressBars(); saveDataToFile(appData);
    refreshDetailModalIfOpen();
};
window.deleteSubTask = function(tid, sid) {
    const t = appData.tasks.find(t => t.id === tid);
    if (t && t.subTasks) {
        t.subTasks = t.subTasks.filter(s => s.id !== sid);
        if (t.subTasks.length > 0 && t.type !== 'todo') syncParentTaskStatus(t, appData.selectedDate);
        else if (t.type !== 'todo') setTaskDone(t, appData.selectedDate, false);
        renderDayPlan(); renderCalendar(); updateFixedProgressBars(); saveDataToFile(appData);
        refreshDetailModalIfOpen();
    }
};
window.togglePinTask = function(id) {
    const t = appData.tasks.find(t => t.id === id);
    if (!t) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的任务不能置顶'); return; }
    t.pinned = !t.pinned; renderDayPlan(); saveDataToFile(appData); refreshDetailModalIfOpen();
};
window.toggleMainTaskFromWeek = function(id, ds) {
    const t = appData.tasks.find(t => t.id === id);
    if (!t) return;
    if (t.type === 'todo') return;
    toggleTaskCompletion(t, ds);
    renderEnergyAndRPG(); updateFixedProgressBars(); saveDataToFile(appData);
    renderWeekBoard(); renderCalendar(); renderTaskPool(); refreshDetailModalIfOpen();
};
function toggleTaskCompletion(t, ds) {
    if (t.type === 'todo') return;
    const was = isTaskDone(t, ds);
    const will = !was;
    const hasSub = t.subTasks && t.subTasks.length > 0;
    const isCount = !!t.target && !hasSub;
    if (hasSub) {
        t.subTasks.forEach(s => {
            if (s.countOnly) { if (will && !s.countEnded) adjustAttr(t.type, 1); s.countEnded = will; return; }
            const sw = isSubTaskDone(s, ds);
            if (s.target) {
                if (will) {
                    const cur = getSubCurrent(s, ds, t);
                    const d = s.target - cur;
                    if (d > 0) { adjustTodayEnergy(d * (s.energyCost || 1)); adjustExp(d * (s.energyCost || 1)); }
                    setSubCurrent(s, ds, s.target); setSubTaskDone(s, ds, true);
                    if (!sw) adjustAttr(t.type, 1);
                } else { setSubTaskDone(s, ds, false); if (sw) adjustAttr(t.type, -1); }
            } else {
                if (sw !== will) {
                    if (will) { adjustTodayEnergy(s.energyCost || 5); adjustExp(s.energyCost || 5); adjustAttr(t.type, 1); }
                    else { adjustTodayEnergy(-(s.energyCost || 5)); adjustExp(-(s.energyCost || 5)); adjustAttr(t.type, -1); }
                }
                setSubTaskDone(s, ds, will);
            }
        });
        setTaskDone(t, ds, will);
        if (will && !was) updateStreak();
    } else if (isCount) {
        if (will) {
            const cur = getTaskCurrent(t, ds);
            const d = t.target - cur;
            if (d > 0) { adjustTodayEnergy(d * (t.energyCost || 1)); adjustExp(d * (t.energyCost || 1)); }
            setTaskCurrent(t, ds, t.target); setTaskDone(t, ds, true);
            adjustAttr(t.type, 1); adjustAttr('focus', 1); updateStreak();
        } else { setTaskDone(t, ds, false); adjustAttr(t.type, -1); adjustAttr('focus', -1); }
    } else {
        if (will) { adjustTodayEnergy(t.energyCost || 10); adjustExp(t.energyCost || 10); adjustAttr(t.type, 1); setTaskDone(t, ds, true); updateStreak(); }
        else { adjustTodayEnergy(-(t.energyCost || 10)); adjustExp(-(t.energyCost || 10)); adjustAttr(t.type, -1); setTaskDone(t, ds, false); }
    }
    logTaskAction(ds, t.id, t.text, will ? 'complete' : 'uncomplete');
}
window.incrementTaskProgress = function(id) {
    const ds = appData.selectedDate;
    const t = appData.tasks.find(t => t.id === id);
    if (!t || !t.target) return;
    if (t.type === 'todo') return;
    const cur = getTaskCurrent(t, ds);
    const c = t.energyCost || 1;
    setTaskCurrent(t, ds, cur + 1);
    adjustTodayEnergy(c); adjustExp(c);
    logTaskAction(ds, t.id, t.text, 'count', 1);
    if (cur + 1 >= t.target) {
        const wasDone = isTaskDone(t, ds);
        setTaskDone(t, ds, true);
        if (!wasDone) { adjustAttr(t.type, 1); adjustAttr('focus', 1); updateStreak(); logTaskAction(ds, t.id, t.text, 'complete'); }
        if (t.recurringType && !t.recurringEndedDate) { t.recurringEndedDate = ds; showMiniToast(`🎉【${t.text}】目标已达成！该循环任务已自动结束。`); }
    }
    renderEnergyAndRPG(); updateFixedProgressBars(); saveDataToFile(appData);
    renderDayPlan(); renderCalendar(); renderYearHeatmap(); refreshDetailModalIfOpen();
};
window.decrementTaskProgress = function(id) {
    const ds = appData.selectedDate;
    const t = appData.tasks.find(t => t.id === id);
    if (!t || !t.target) return;
    if (t.type === 'todo') return;
    const c = t.energyCost || 1;
    const cur = getTaskCurrent(t, ds);
    if (cur > 0) {
        adjustTodayEnergy(-c); adjustExp(-c);
        setTaskCurrent(t, ds, cur - 1);
        logTaskAction(ds, t.id, t.text, 'count', -1);
        if (cur - 1 < t.target && isTaskDone(t, ds)) { setTaskDone(t, ds, false); adjustAttr(t.type, -1); adjustAttr('focus', -1); logTaskAction(ds, t.id, t.text, 'uncomplete'); }
    }
    renderEnergyAndRPG(); updateFixedProgressBars(); saveDataToFile(appData);
    renderDayPlan(); renderCalendar(); renderYearHeatmap(); refreshDetailModalIfOpen();
};
window.incrementSubTaskProgress = function(tid, sid) {
    const ds = appData.selectedDate;
    const t = appData.tasks.find(t => t.id === tid);
    if (!t || !t.subTasks) return;
    if (t.type === 'todo') return;
    const s = t.subTasks.find(s => s.id === sid);
    if (!s || !s.target) return;
    const cur = getSubCurrent(s, ds, t);
    const wt = isTaskDone(t, ds);
    const c = s.energyCost || 1;
    setSubCurrent(s, ds, cur + 1);
    adjustTodayEnergy(c); adjustExp(c);
    logTaskAction(ds, s.id, s.text, 'count', 1);
    if (cur + 1 >= s.target) { if (!isSubTaskDone(s, ds)) adjustAttr(t.type, 1); setSubTaskDone(s, ds, true); logTaskAction(ds, s.id, s.text, 'complete'); }
    syncParentTaskStatus(t, ds);
    const newT = isTaskDone(t, ds);
    if (!wt && newT) { adjustAttr('focus', 1); updateStreak(); logTaskAction(ds, t.id, t.text, 'complete'); }
    if (newT && t.recurringType && !t.recurringEndedDate) { t.recurringEndedDate = ds; showMiniToast(`🎉【${t.text}】目标已达成！该循环任务已自动结束。`); }
    renderEnergyAndRPG(); updateFixedProgressBars(); saveDataToFile(appData);
    renderDayPlan(); renderCalendar(); renderYearHeatmap(); refreshDetailModalIfOpen();
};
window.decrementSubTaskProgress = function(tid, sid) {
    const ds = appData.selectedDate;
    const t = appData.tasks.find(t => t.id === tid);
    if (!t || !t.subTasks) return;
    if (t.type === 'todo') return;
    const s = t.subTasks.find(s => s.id === sid);
    if (!s || !s.target) return;
    const wt = isTaskDone(t, ds);
    const c = s.energyCost || 1;
    const cur = getSubCurrent(s, ds, t);
    if (cur > 0) {
        adjustTodayEnergy(-c); adjustExp(-c);
        setSubCurrent(s, ds, cur - 1);
        logTaskAction(ds, s.id, s.text, 'count', -1);
        if (cur - 1 < s.target && isSubTaskDone(s, ds)) { setSubTaskDone(s, ds, false); adjustAttr(t.type, -1); logTaskAction(ds, s.id, s.text, 'uncomplete'); }
    }
    syncParentTaskStatus(t, ds);
    const newT = isTaskDone(t, ds);
    if (wt && !newT) { adjustAttr('focus', -1); logTaskAction(ds, t.id, t.text, 'uncomplete'); }
    renderEnergyAndRPG(); updateFixedProgressBars(); saveDataToFile(appData);
    renderDayPlan(); renderCalendar(); renderYearHeatmap(); refreshDetailModalIfOpen();
};
window.setTaskTarget = function(id) {
    const t = appData.tasks.find(t => t.id === id);
    if (!t) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的任务不能设置属性，拖入学习/其他后再设置'); return; }
    const v = prompt("累计总次数 (0 取消)：", t.target || 0);
    if (v === null) return;
    const n = parseInt(v);
    if (isNaN(n) || n < 0) return;
    t.target = n;
    if (n === 0) { delete t.target; delete t.current; delete t.currents; setTaskDone(t, appData.selectedDate, false); }
    else { if (!t.current) t.current = 0; if (getTaskCurrent(t, appData.selectedDate) >= t.target) setTaskDone(t, appData.selectedDate, true); }
    renderDayPlan(); refreshDetailModalIfOpen();
};
window.setSubTaskTarget = function(tid, sid) {
    const t = appData.tasks.find(t => t.id === tid);
    if (!t || !t.subTasks) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的任务不能设置属性'); return; }
    const s = t.subTasks.find(s => s.id === sid);
    if (!s) return;
    const v = prompt(`设置【${s.text}】总次数 (0 取消)：`, s.target || 0);
    if (v === null) return;
    const n = parseInt(v);
    if (isNaN(n) || n < 0) return;
    s.target = n;
    if (n === 0) { delete s.target; delete s.current; delete s.currents; setSubTaskDone(s, appData.selectedDate, false); }
    else { if (!s.current) s.current = 0; if (getSubCurrent(s, appData.selectedDate, t) >= s.target) setSubTaskDone(s, appData.selectedDate, true); }
    syncParentTaskStatus(t, appData.selectedDate); renderDayPlan(); renderCalendar(); refreshDetailModalIfOpen();
};
function handleAddInput(e, type, dateStr, isPool) {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    let text = e.target.value.trim(), target = 0;
    const m = text.match(/\*\s*(\d+)$/);
    if (m) { target = parseInt(m[1]); text = text.replace(/\*\s*\d+$/, '').trim(); }
    if (isPool) {
        const nt = { id: Date.now().toString(), text, type: 'todo', date: 'pool', todoKind: type, completed: false, subTasks: [] };
        if (target > 0) { nt.target = target; nt.current = 0; }
        appData.tasks.push(nt);
        e.target.value = '';
        renderTaskPool(); saveDataToFile(appData);
        return;
    }
    const nt = { id: Date.now().toString(), text, type, date: dateStr, completed: false, subTasks: [], deadline: '', pinned: false, energyCost: target > 0 ? 1 : 10 };
    if (target > 0) { nt.target = target; nt.current = 0; }
    appData.tasks.push(nt); e.target.value = '';
    renderDayPlan();
}
function handleAddTodoInput(e) {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    let text = e.target.value.trim(), target = 0;
    const m = text.match(/\*\s*(\d+)$/);
    if (m) { target = parseInt(m[1]); text = text.replace(/\*\s*\d+$/, '').trim(); }
    const nt = { id: Date.now().toString(), text, type: 'todo', date: 'pool', todoKind: 'learning', completed: false, subTasks: [] };
    if (target > 0) { nt.target = target; nt.current = 0; }
    appData.tasks.push(nt); e.target.value = '';
    renderDayPlan(); saveDataToFile(appData);
}
document.getElementById('pool-input-learning').addEventListener('keypress', e => handleAddInput(e, 'learning', 'pool', true));
document.getElementById('pool-input-other').addEventListener('keypress', e => handleAddInput(e, 'other', 'pool', true));
document.getElementById('learning-input').addEventListener('keypress', e => handleAddInput(e, 'learning', appData.selectedDate, false));
document.getElementById('other-input').addEventListener('keypress', e => handleAddInput(e, 'other', appData.selectedDate, false));
document.getElementById('todo-input').addEventListener('keypress', handleAddTodoInput);
window.toggleRecurring = function(id) {
    const t = appData.tasks.find(t => t.id === id);
    if (!t) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的任务不能设置循环，拖入学习/其他后再设置'); return; }
    const c = prompt("循环天数 (1=每日, 7=每周, 30=每月, 其他=自定义，留空取消)：");
    if (c === null || !c.trim()) { t.recurringType = ''; renderDayPlan(); refreshDetailModalIfOpen(); return; }
    const d = parseInt(c);
    if (isNaN(d) || d <= 0) { alert('无效数字'); return; }
    t.recurringType = d === 1 ? '每日' : d === 7 ? '每周' : d === 30 ? '每月' : `自定义${d}天`;
    renderDayPlan(); refreshDetailModalIfOpen();
};
window.toggleExerciseRecurring = function(id) {
    const ex = appData.exercises.find(e => e.id === id);
    if (!ex) return;
    const c = prompt(`设置【${ex.name}】循环天数 (留空取消)：`);
    if (c === null || !c.trim()) { ex.recurringType = ''; ex._lastModified = Date.now(); renderDayExercises(); renderWeekBoard(); return; }
    const d = parseInt(c);
    if (isNaN(d) || d <= 0) { alert('无效数字'); return; }
    ex.recurringType = d === 1 ? '每日' : d === 7 ? '每周' : d === 30 ? '每月' : `自定义${d}天`;
    ex._lastModified = Date.now();
    renderDayExercises(); renderWeekBoard(); saveDataToFile(appData);
};
window.setDeadline = function(id, v) {
    if (v === null) return;
    const t = appData.tasks.find(t => t.id === id);
    if (!t) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的任务不能设置截止日期，拖入学习/其他后再设置'); return; }
    const nv = v.trim();
    if (nv) t.deadline = nv;
    else delete t.deadline;
    renderDayPlan(); refreshDetailModalIfOpen(); saveDataToFile(appData);
};
window.addExerciseCategory = function() {
    const n = prompt("新锻炼大类名称：");
    if (n && n.trim()) {
        appData.exercises.push({ id: 'ex_' + Date.now(), name: n.trim(), subTasks: [], recurringType: '', energyCost: 15, _lastModified: Date.now() });
        renderExercisePool(); renderDayExercises(); saveDataToFile(appData);
    }
};
window.renameExerciseCategory = function(id) {
    const ex = appData.exercises.find(e => e.id === id);
    if (!ex) return;
    const n = prompt("修改名称：", ex.name);
    if (!n || !n.trim() || n === ex.name) return;
    const old = ex.name; ex.name = n.trim(); ex._lastModified = Date.now();
    for (let d in appData.exerciseSchedule) { const i = appData.exerciseSchedule[d].indexOf(old); if (i !== -1) appData.exerciseSchedule[d][i] = ex.name; }
    renderExercisePool(); renderDayExercises(); renderWeekBoard(); saveDataToFile(appData);
};
window.deleteExerciseCategory = function(id) {
    if (!confirm("删除这个锻炼大类吗？")) return;
    const ex = appData.exercises.find(e => e.id === id);
    if (!ex) return;
    appData.exercises = appData.exercises.filter(e => e.id !== id);
    for (let d in appData.exerciseSchedule) appData.exerciseSchedule[d] = appData.exerciseSchedule[d].filter(n => n !== ex.name);
    renderExercisePool(); renderDayExercises(); renderWeekBoard(); saveDataToFile(appData);
};
window.addExerciseTask = function(e, exId) {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    const ex = appData.exercises.find(e => e.id === exId);
    if (ex) { ex.subTasks.push({ id: Date.now().toString(), text: e.target.value.trim() }); ex._lastModified = Date.now(); e.target.value = ''; renderDayExercises(); saveDataToFile(appData); }
};
window.deleteExerciseAction = function(exId, sid) {
    const ex = appData.exercises.find(e => e.id === exId);
    if (ex) { ex.subTasks = ex.subTasks.filter(s => s.id !== sid); ex._lastModified = Date.now(); renderDayExercises(); saveDataToFile(appData); }
};
window.toggleExerciseCategory = function(exId) {
    ensureEnergyData();
    const ds = appData.selectedDate;
    const was = isCategoryAllCheckedForDate(exId, ds);
    const result = setCategoryExerciseChecked(exId, ds, !was);
    if (!result.ex) return;
    applyExerciseEffects(result.was, result.now, result.cost);
    renderDayExercises(); renderCalendar(); renderYearHeatmap(); updateFixedProgressBars(); renderEnergyAndRPG(); saveDataToFile(appData);
};
window.toggleExerciseTask = function(exId, sid) {
    ensureEnergyData();
    const ds = appData.selectedDate;
    if (!appData.dailyExerciseChecks[ds]) appData.dailyExerciseChecks[ds] = {};
    const k = `${exId}_${sid}`;
    const was = isCategoryAllCheckedForDate(exId, ds);
    appData.dailyExerciseChecks[ds][k] = !appData.dailyExerciseChecks[ds][k];
    const now = isCategoryAllCheckedForDate(exId, ds);
    const ex = appData.exercises.find(e => e.id === exId);
    if (ex && was !== now) applyExerciseEffects(was, now, ex.energyCost || 15);
    renderDayExercises(); renderCalendar(); renderYearHeatmap(); updateFixedProgressBars(); renderEnergyAndRPG(); saveDataToFile(appData);
};
window.toggleMainTask = function(id) {
    const t = appData.tasks.find(t => t.id === id);
    if (!t) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的任务不能完成，拖入学习/其他后再处理'); return; }
    toggleTaskCompletion(t, appData.selectedDate);
    renderEnergyAndRPG(); updateFixedProgressBars(); saveDataToFile(appData);
    renderDayPlan(); renderCalendar(); renderTaskPool(); renderYearHeatmap(); refreshDetailModalIfOpen();
};
window.toggleSubTask = function(tid, sid) {
    const ds = appData.selectedDate;
    const t = appData.tasks.find(t => t.id === tid);
    if (!t || !t.subTasks) return;
    if (t.type === 'todo') { showMiniToast('待办清单里的子任务不能完成'); return; }
    const s = t.subTasks.find(s => s.id === sid);
    if (!s) return;
    if (s.countOnly) return;
    const wt = isTaskDone(t, ds);
    const ws = isSubTaskDone(s, ds);
    const will = !ws;
    if (s.target) {
        if (will) {
            const d = s.target - getSubCurrent(s, ds, t);
            if (d > 0) { adjustTodayEnergy(d * (s.energyCost || 1)); adjustExp(d * (s.energyCost || 1)); }
            setSubCurrent(s, ds, s.target); setSubTaskDone(s, ds, true); adjustAttr(t.type, 1);
        } else {
            const r = getSubCurrent(s, ds, t) * (s.energyCost || 1);
            adjustTodayEnergy(-r); adjustExp(-r);
            setSubCurrent(s, ds, 0); setSubTaskDone(s, ds, false); adjustAttr(t.type, -1);
        }
    } else {
        if (will) { adjustTodayEnergy(s.energyCost || 5); adjustExp(s.energyCost || 5); adjustAttr(t.type, 1); setSubTaskDone(s, ds, true); }
        else { adjustTodayEnergy(-(s.energyCost || 5)); adjustExp(-(s.energyCost || 5)); adjustAttr(t.type, -1); setSubTaskDone(s, ds, false); }
    }
    syncParentTaskStatus(t, ds);
    const newT = isTaskDone(t, ds);
    if (!wt && newT) { adjustAttr('focus', 1); updateStreak(); }
    if (wt && !newT) adjustAttr('focus', -1);
    logTaskAction(ds, s.id, s.text, will ? 'complete' : 'uncomplete');
    logTaskAction(ds, t.id, t.text, newT ? 'complete' : 'uncomplete');
    renderEnergyAndRPG(); updateFixedProgressBars(); saveDataToFile(appData);
    renderDayPlan(); renderCalendar(); refreshDetailModalIfOpen();
};
window.showSubInput = function(id, el) {
    let input = null;
    if (el && el.closest) { const card = el.closest('.main-task-item'); if (card) input = card.querySelector('.add-sub-task-input'); }
    if (!input) input = document.getElementById('input-' + id);
    if (!input) return;
    input.style.display = 'block';
    input.focus();
    setTimeout(() => { try { input.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch(e) {} }, 50);
};
window.addSubTask = function(e, tid) {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    const t = appData.tasks.find(t => t.id === tid);
    if (!t) return;
    if (!t.subTasks) t.subTasks = [];
    let text = e.target.value.trim(), target = 0;
    const m = text.match(/\*\s*(\d+)$/);
    if (m) { target = parseInt(m[1]); text = text.replace(/\*\s*\d+$/, '').trim(); }
    const ns = { id: Date.now().toString(), text, completed: false, energyCost: target > 0 ? 1 : 5 };
    if (target > 0) { ns.target = target; ns.current = 0; }
    t.subTasks.push(ns);
    e.target.value = ''; e.target.style.display = 'none';
    if (t.type !== 'todo') syncParentTaskStatus(t, appData.selectedDate);
    renderDayPlan(); renderCalendar(); saveDataToFile(appData); refreshDetailModalIfOpen();
};
function syncGoal(v) {
    appData.yearlyGoals = v;
    if (document.activeElement.id !== 'yearly-goals') document.getElementById('yearly-goals').innerText = v;
    if (document.activeElement.id !== 'yearly-goals-bottom') document.getElementById('yearly-goals-bottom').value = v;
    saveDataToFile(appData);
}
document.getElementById('yearly-goals').addEventListener('input', e => syncGoal(e.target.innerText));
document.getElementById('yearly-goals-bottom').addEventListener('input', e => syncGoal(e.target.value));
function updateFixedProgressBars() {
    ensureEnergyData();
    const td = getTodayString();
    const y = new Date().getFullYear();
    const m = new Date().getMonth() + 1;
    let yt = 0, yd = 0, mt = 0, md = 0, wt = 0, wd = 0;
    const dim = new Date(y, m, 0).getDate();
    for (let i = 1; i <= dim; i++) {
        const ds = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const l = calcProgress(ds, 'learning'), o = calcProgress(ds, 'other'), e = calcProgress(ds, '锻炼');
        mt += l.total + o.total + e.total; md += l.done + o.done + e.done;
    }
    for (let mm = 1; mm <= 12; mm++) {
        const d = new Date(y, mm, 0).getDate();
        for (let i = 1; i <= d; i++) {
            const ds = `${y}-${String(mm).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const l = calcProgress(ds, 'learning'), o = calcProgress(ds, 'other'), e = calcProgress(ds, '锻炼');
            yt += l.total + o.total + e.total; yd += l.done + o.done + e.done;
        }
    }
    const b = new Date(td);
    const dow = b.getDay() || 7;
    const mon = new Date(b); mon.setDate(b.getDate() - dow + 1);
    for (let i = 0; i < 7; i++) {
        const cd = new Date(mon); cd.setDate(mon.getDate() + i);
        const ds = formatDate(cd.getFullYear(), cd.getMonth(), cd.getDate());
        const l = calcProgress(ds, 'learning'), o = calcProgress(ds, 'other'), e = calcProgress(ds, '锻炼');
        wt += l.total + o.total + e.total; wd += l.done + o.done + e.done;
    }
    const tl = calcProgress(td, 'learning'), to = calcProgress(td, 'other'), te = calcProgress(td, '锻炼');
    const dt = tl.total + to.total + te.total, dd = tl.done + to.done + te.done;
    const pct = (d, t) => t <= 0 ? 0 : Math.round((d / t) * 100);
    const yP = pct(yd, yt); document.getElementById('prog-year-text').innerText = yP + '%'; document.getElementById('prog-year-fill').style.width = yP + '%';
    const mP = pct(md, mt); document.getElementById('prog-month-text').innerText = mP + '%'; document.getElementById('prog-month-fill').style.width = mP + '%';
    const wP = pct(wd, wt); document.getElementById('prog-week-text').innerText = wP + '%'; document.getElementById('prog-week-fill').style.width = wP + '%';
    const dP = pct(dd, dt); document.getElementById('prog-day-text').innerText = dP + '%'; document.getElementById('prog-day-fill').style.width = dP + '%';
}
function getCleanedDataForBackup(data) { const copy = JSON.parse(JSON.stringify(data)); delete copy._lastModified; return JSON.stringify(copy); }
function buildModulePayload(moduleKeys) {
    const payload = { __format: 'workspace-modules-v1', __version: 1, __exportTime: new Date().toISOString(), __modules: moduleKeys.slice() };
    moduleKeys.forEach(k => {
        if (!BACKUP_MODULES[k]) return;
        payload[k] = {};
        BACKUP_MODULES[k].fields.forEach(f => { if (appData[f] !== undefined) payload[k][f] = JSON.parse(JSON.stringify(appData[f])); });
    });
    return payload;
}
window.exportData = function() {
    const s = "data:text/json;charset=utf-8," + encodeURIComponent(getCleanedDataForBackup(appData));
    const a = document.createElement('a');
    a.setAttribute("href", s); a.setAttribute("download", `backup_${getTodayString()}.json`);
    document.body.appendChild(a); a.click(); a.remove();
};
window.exportSelectedModules = function() {
    const checks = document.querySelectorAll('#export-module-checks input[type="checkbox"]:checked');
    const keys = [...checks].map(c => c.value);
    if (keys.length === 0) { alert('请至少勾选一个模块'); return; }
    const payload = buildModulePayload(keys);
    const names = keys.map(k => BACKUP_MODULES[k].name).join('+');
    const dateStr = getTodayString().replace(/-/g, '');
    const filename = `工作台备份-${names}_${dateStr}.json`;
    const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload));
    const a = document.createElement('a');
    a.setAttribute("href", s); a.setAttribute("download", filename);
    document.body.appendChild(a); a.click(); a.remove();
};
window.importData = function(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = function(ev) {
        try {
            const d = JSON.parse(ev.target.result);
            let availableModules = [];
            if (d.__format === 'workspace-modules-v1' && Array.isArray(d.__modules)) {
                availableModules = d.__modules.filter(k => BACKUP_MODULES[k] && d[k] && typeof d[k] === 'object');
            } else if (d.tasks && d.exercises) {
                availableModules = Object.keys(BACKUP_MODULES).filter(k => BACKUP_MODULES[k].fields.some(f => d[f] !== undefined));
            } else {
                alert('无法识别的文件格式');
                return;
            }
            if (availableModules.length === 0) { alert('文件中未找到可识别的数据模块'); return; }
            _pendingImportData = d;
            _pendingImportAvailableModules = availableModules;
            const list = document.getElementById('import-module-list');
            list.innerHTML = availableModules.map(k => {
                const m = BACKUP_MODULES[k];
                return `<label style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border-color);border-radius:6px;cursor:pointer;background:var(--bg-sidebar);"><input type="checkbox" value="${k}" checked><div style="flex:1;"><div style="font-weight:600;">${m.name}</div><div style="font-size:11px;color:var(--text-muted);">${m.fields.join('、')}</div></div></label>`;
            }).join('');
            document.getElementById('import-confirm-modal').classList.add('active');
        } catch (err) { alert('解析失败：' + err.message); }
    };
    r.readAsText(f); e.target.value = '';
};
let _pendingImportAvailableModules = [];
window.closeImportModal = function() {
    document.getElementById('import-confirm-modal').classList.remove('active');
    _pendingImportData = null;
    _pendingImportAvailableModules = [];
};
window.confirmImport = function() {
    if (!_pendingImportData) return;
    const checked = [...document.querySelectorAll('#import-module-list input[type="checkbox"]:checked')].map(c => c.value);
    if (checked.length === 0) { alert('请至少勾选一个模块'); return; }
    const d = _pendingImportData;
    checked.forEach(modKey => {
        if (!BACKUP_MODULES[modKey]) return;
        const fields = BACKUP_MODULES[modKey].fields;
        const source = (d[modKey] && typeof d[modKey] === 'object') ? d[modKey] : d;
        fields.forEach(f => { if (source[f] !== undefined) appData[f] = JSON.parse(JSON.stringify(source[f])); });
    });
    ensureEnergyData();
    lastSavedSignature = '';
    lastRpgState = null;
    document.body.classList.toggle('dark-mode', appData.themeMode === 'dark');
    if (appData.themeColor) document.documentElement.style.setProperty('--accent-color', appData.themeColor);
    if (appData.fonts) ['title','content','hint','small'].forEach(k => document.documentElement.style.setProperty(`--font-${k}`, appData.fonts[k]));
    if (appData.radius) document.documentElement.style.setProperty('--radius', appData.radius);
    renderCalendar(); renderYearHeatmap(); renderDayPlan(); updateFixedProgressBars(); renderEnergyAndRPG();
    renderLevelConfig(); renderTimeSlotConfig(); renderWeekBoard(); renderFixedBlockPool(); renderFixedBlockEnergyConfig();
    renderMethodsFileList(); refreshMethodsEditorContent();
    saveDataToFile(appData);
    resetSyncedBaseline(appData);
    closeImportModal();
    alert('✅ 已恢复选中的 ' + checked.length + ' 个模块');
};
window.resetAllData = function() {
    if (!confirm('⚠️ 清空所有数据？不可恢复！')) return;
    if (!confirm('再次确认？')) return;
    localStorage.clear(); location.reload();
};
let backupDirHandle = null, pendingBackupHandle = null;
let autoBackupTimer = null, isBackingUp = false, autoBackupIntervalMin = 3;
let lastBackupTime = 0, lastBackupModified = 0;
function openBackupDB() {
    return new Promise((res, rej) => {
        const req = indexedDB.open('workspaceBackupDB', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('handles');
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}
async function idbPut(k, v) {
    const db = await openBackupDB();
    return new Promise((res, rej) => {
        const tx = db.transaction('handles', 'readwrite');
        tx.objectStore('handles').put(v, k);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
}
async function idbGet(k) {
    const db = await openBackupDB();
    return new Promise((res, rej) => {
        const tx = db.transaction('handles', 'readonly');
        const req = tx.objectStore('handles').get(k);
        req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
    });
}
window.chooseBackupFolder = async function() {
    if (!window.showDirectoryPicker) { alert('浏览器不支持文件夹备份。请用 Chrome/Edge。'); return; }
    try {
        const h = await window.showDirectoryPicker({ mode: 'readwrite' });
        backupDirHandle = h; pendingBackupHandle = null;
        await idbPut('backupDir', h);
        startAutoBackupTimer(); updateBackupUI();
        alert('✅ 已选择文件夹');
    } catch (e) { if (e.name !== 'AbortError') alert('选择失败：' + e.message); }
};
window.restoreBackupFolder = async function() {
    if (!pendingBackupHandle) return;
    try {
        const p = await pendingBackupHandle.requestPermission({ mode: 'readwrite' });
        if (p === 'granted') { backupDirHandle = pendingBackupHandle; pendingBackupHandle = null; startAutoBackupTimer(); updateBackupUI(); }
        else alert('未获得权限');
    } catch (e) { alert('恢复失败：' + e.message); }
};
window.stopAutoBackup = function() {
    if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
    backupDirHandle = null; pendingBackupHandle = null; updateBackupUI();
};
window.changeBackupInterval = function(v) {
    autoBackupIntervalMin = parseInt(v) || 3;
    localStorage.setItem('myWorkspaceBackupInterval', String(autoBackupIntervalMin));
    if (backupDirHandle) startAutoBackupTimer();
    updateBackupUI();
};
function startAutoBackupTimer() {
    if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
    if (!backupDirHandle) return;
    autoBackupTimer = setInterval(() => performBackup(true), autoBackupIntervalMin * 60 * 1000);
    updateBackupUI();
}
window.performBackup = async function(silent) {
    if (!backupDirHandle) { if (!silent) alert('请先选择文件夹'); return false; }
    if (isBackingUp) return false;
    isBackingUp = true;
    try {
        let p = await backupDirHandle.queryPermission({ mode: 'readwrite' });
        if (p !== 'granted') { p = await backupDirHandle.requestPermission({ mode: 'readwrite' }); if (p !== 'granted') throw new Error('无写入权限'); }
        const fileMap = {
            'tasks.json': buildModulePayload(['tasks']),
            'exercises.json': buildModulePayload(['exercises']),
            'rpg_energy.json': buildModulePayload(['rpg']),
            'settings.json': buildModulePayload(['settings']),
            'methods.json': buildModulePayload(['methods'])
        };
        for (const [filename, payload] of Object.entries(fileMap)) {
            const fh = await backupDirHandle.getFileHandle(filename, { create: true });
            const w = await fh.createWritable();
            await w.write(JSON.stringify(payload, null, 2));
            await w.close();
        }
        try {
            const coreData = {
                tasks: appData.tasks, exercises: appData.exercises, exerciseSchedule: appData.exerciseSchedule,
                exerciseTimeSlotSchedule: appData.exerciseTimeSlotSchedule, dailyExerciseChecks: appData.dailyExerciseChecks,
                dailyEnergy: appData.dailyEnergy, dailyLogs: appData.dailyLogs, dailyReflections: appData.dailyReflections,
                weeklyReflections: appData.weeklyReflections, monthlyReflections: appData.monthlyReflections, rpg: appData.rpg,
                fixedBlocks: appData.fixedBlocks, fixedBlockSchedule: appData.fixedBlockSchedule, timeSlots: appData.timeSlots,
                timeSlotsLastModified: appData.timeSlotsLastModified
            };
            const fhCore = await backupDirHandle.getFileHandle('core_data.json', { create: true });
            const wCore = await fhCore.createWritable(); await wCore.write(JSON.stringify(coreData, null, 2)); await wCore.close();
        } catch(e) { console.warn('旧版兼容文件写入失败', e); }
        lastBackupTime = Date.now();
        lastBackupModified = appData._lastModified || 0;
        localStorage.setItem('myWorkspaceLastBackupTime', String(lastBackupTime));
        updateBackupUI();
        if (!silent) alert('✅ 已分模块备份');
        return true;
    } catch (e) { if (!silent) alert('备份失败：' + e.message); return false; }
    finally { isBackingUp = false; }
};
window.restoreFromFolder = async function() {
    if (!backupDirHandle) { alert('请先选择备份文件夹'); return; }
    const checked = [...document.querySelectorAll('#restore-module-checks input[type="checkbox"]:checked')].map(c => c.value);
    if (checked.length === 0) { alert('请至少勾选一项要恢复的内容'); return; }
    if (!confirm('恢复选中模块会覆盖当前对应数据，确定继续吗？')) return;
    let p = await backupDirHandle.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted') { p = await backupDirHandle.requestPermission({ mode: 'readwrite' }); if (p !== 'granted') { alert('无权限读取文件夹'); return; } }
    const fileMap = { tasks: 'tasks.json', exercises: 'exercises.json', rpg: 'rpg_energy.json', settings: 'settings.json', methods: 'methods.json' };
    const legacyMap = { tasks: 'core_data.json', exercises: 'core_data.json', rpg: 'core_data.json', settings: 'app_settings.json', methods: 'methods_data.json' };
    try {
        for (const modKey of checked) {
            if (!BACKUP_MODULES[modKey]) continue;
            let ok = false;
            try {
                const fh = await backupDirHandle.getFileHandle(fileMap[modKey]);
                const file = await fh.getFile();
                const data = JSON.parse(await file.text());
                const source = (data[modKey] && typeof data[modKey] === 'object') ? data[modKey] : data;
                BACKUP_MODULES[modKey].fields.forEach(f => { if (source[f] !== undefined) appData[f] = JSON.parse(JSON.stringify(source[f])); });
                ok = true;
            } catch(e) { console.warn('读取 ' + fileMap[modKey] + ' 失败，尝试旧版兼容', e); }
            if (!ok) {
                try {
                    const legacyFile = legacyMap[modKey];
                    const fh = await backupDirHandle.getFileHandle(legacyFile);
                    const file = await fh.getFile();
                    const data = JSON.parse(await file.text());
                    BACKUP_MODULES[modKey].fields.forEach(f => { if (data[f] !== undefined) appData[f] = JSON.parse(JSON.stringify(data[f])); });
                } catch(e2) { console.warn('旧版兼容读取 ' + legacyMap[modKey] + ' 失败', e2); }
            }
        }
        ensureEnergyData(); lastSavedSignature = ''; lastRpgState = null;
        document.body.classList.toggle('dark-mode', appData.themeMode === 'dark');
        if (appData.themeColor) document.documentElement.style.setProperty('--accent-color', appData.themeColor);
        if (appData.fonts) ['title','content','hint','small'].forEach(k => document.documentElement.style.setProperty(`--font-${k}`, appData.fonts[k]));
        if (appData.radius) document.documentElement.style.setProperty('--radius', appData.radius);
        renderCalendar(); renderYearHeatmap(); renderDayPlan(); updateFixedProgressBars(); renderEnergyAndRPG();
        renderLevelConfig(); renderTimeSlotConfig(); renderWeekBoard(); renderFixedBlockPool(); renderFixedBlockEnergyConfig();
        renderMethodsFileList(); refreshMethodsEditorContent();
        saveDataToFile(appData);
        resetSyncedBaseline(appData);
        alert('✅ 已恢复选中的 ' + checked.length + ' 个模块');
    } catch(e) { alert('恢复失败：' + e.message); }
};
function updateBackupUI() {
    const s = document.getElementById('backup-status-text');
    const l = document.getElementById('last-backup-time');
    const sb = document.getElementById('btn-stop-auto-backup');
    const rb = document.getElementById('btn-restore-backup-folder');
    if (!s) return;
    if (backupDirHandle) { s.innerText = `状态：✅ 已开启，每 ${autoBackupIntervalMin} 分钟备份`; s.style.color = '#2e7d32'; if (sb) sb.style.display = ''; if (rb) rb.style.display = 'none'; }
    else if (pendingBackupHandle) { s.innerText = '状态：⚠️ 检测到上次文件夹，请点击「恢复文件夹权限」继续自动备份'; s.style.color = '#f2994a'; if (sb) sb.style.display = 'none'; if (rb) rb.style.display = ''; }
    else { s.innerText = '状态：未开启'; s.style.color = ''; if (sb) sb.style.display = 'none'; if (rb) rb.style.display = 'none'; }
    if (l) {
        if (lastBackupTime) { const d = new Date(lastBackupTime), p = n => String(n).padStart(2, '0'); l.innerText = `上次：${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
        else l.innerText = '上次：尚未备份';
    }
}
async function tryRestoreBackupFolder() {
    if (!window.showDirectoryPicker) return;
    try {
        const h = await idbGet('backupDir');
        if (!h) return;
        const p = await h.queryPermission({ mode: 'readwrite' });
        if (p === 'granted') { backupDirHandle = h; startAutoBackupTimer(); updateBackupUI(); }
        else if (p === 'prompt') { pendingBackupHandle = h; updateBackupUI(); }
    } catch (e) {}
}
window.addEventListener('beforeunload', (e) => {
    if ((appData._lastModified || 0) === lastBackupModified) return;
    if (backupDirHandle) performBackup(true);
    e.preventDefault();
    e.returnValue = '有修改未备份，确定离开？';
    return e.returnValue;
});
window.copyHostId = function() {
    const t = document.getElementById('my-peer-id').innerText.trim();
    if (!t || t === '未生成') { alert('请先点击"开启"'); return; }
    copyTextToClipboard(t, '✅ 连接码已复制！');
};
function renderP2PHistory() {
    const container = document.getElementById('p2p-history-list');
    let history = JSON.parse(localStorage.getItem('my_p2p_history') || '[]');
    container.innerHTML = '';
    if (history.length === 0) { container.innerHTML = '<span style="font-size:var(--font-small);color:var(--text-muted);">暂无</span>'; return; }
    history.forEach(id => {
        const w = document.createElement('div');
        w.style.cssText = 'display:flex;align-items:center;background:var(--bg-card);border:1px solid var(--border-color);border-radius:4px;overflow:hidden;font-size:var(--font-small);';
        const c = document.createElement('div'); c.style.cssText = 'padding:3px 6px;color:var(--accent-color);cursor:pointer;';
        c.innerText = id.substring(0, 10) + '...'; c.title = id;
        c.onclick = () => { isAutoReconnecting = false; document.getElementById('target-peer-id').value = id; connectToPeer(); };
        const cp = document.createElement('div'); cp.style.cssText = 'padding:3px 6px;background:var(--hover-bg);color:var(--accent-color);cursor:pointer;border-left:1px solid var(--border-color);'; cp.innerText = '📋';
        cp.onclick = (e) => { e.stopPropagation(); copyTextToClipboard(id, '✅ 已复制：\n' + id); };
        const d = document.createElement('div'); d.style.cssText = 'padding:3px 6px;background:var(--hover-bg);color:var(--danger-color);cursor:pointer;border-left:1px solid var(--border-color);'; d.innerText = '✕';
        d.onclick = (e) => { e.stopPropagation(); deletePeerHistory(id); };
        w.appendChild(c); w.appendChild(cp); w.appendChild(d);
        container.appendChild(w);
    });
}
function deletePeerHistory(id) {
    if (!confirm('确定删除？')) return;
    let history = JSON.parse(localStorage.getItem('my_p2p_history') || '[]');
    history = history.filter(x => x !== id);
    localStorage.setItem('my_p2p_history', JSON.stringify(history));
    if (localStorage.getItem('last_connected_peer') === id) { localStorage.removeItem('last_connected_peer'); isAutoReconnecting = false; }
    renderP2PHistory();
}
window.resetHostId = function() {
    if (!confirm('重置同步码？手机需重新连接新码。')) return;
    localStorage.removeItem('my_p2p_host_id');
    if (peer) { try { peer.destroy(); } catch(e){} peer = null; }
    if (conn) { try { conn.close(); } catch(e){} conn = null; }
    document.getElementById('my-peer-id').innerText = '未生成';
    initPeer(true);
};
window.initPeer = function(isHost, isAutoConnect = false) {
    if (isHost && peer && !peer.destroyed && peer.open && !peer.disconnected) {
        document.getElementById('my-peer-id').innerText = peer.id;
        document.getElementById('p2p-status').innerText = "✅ 主机已就绪";
        document.getElementById('p2p-status').style.color = "#f2994a";
        return;
    }
    if (peer) { try { peer.destroy(); } catch(e){} peer = null; }
    if (conn) { try { conn.close(); } catch(e){} conn = null; }
    isConnecting = false; handshakeDone = false; if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
    let customId = null;
    if (isHost) {
        customId = localStorage.getItem('my_p2p_host_id');
        if (!customId) { customId = generatePeerId(); localStorage.setItem('my_p2p_host_id', customId); }
        document.getElementById('my-peer-id').innerText = customId;
    }
    peer = new Peer(customId, {
        debug: 1,
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }], iceCandidatePoolSize: 10 },
        pingInterval: 3000
    });
    peer.on('open', function(id) {
        if (isHost) { document.getElementById('my-peer-id').innerText = id; document.getElementById('p2p-status').innerText = "✅ 主机已就绪"; document.getElementById('p2p-status').style.color = "#f2994a"; }
        else if (isAutoConnect) { isAutoReconnecting = true; startAutoConnectLoop(); }
    });
    peer.on('connection', function(c) {
        if (conn && conn !== c && conn.open) { try { conn.close(); } catch(e){} }
        conn = c; handshakeDone = false;
        setupConnection(conn, true, c.peer);
    });
    peer.on('disconnected', function() { if (peer && !peer.destroyed) { try { peer.reconnect(); } catch(e){} } });
    peer.on('error', function(err) {
        if (err.type === 'unavailable-id') { if (isHost) { localStorage.removeItem('my_p2p_host_id'); setTimeout(() => initPeer(true), 500); } }
        else if (err.type === 'peer-unavailable') {
            if (!isHost) {
                isConnecting = false; if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
                document.getElementById('p2p-status').innerText = "⏳ 主机不在线";
                document.getElementById('p2p-status').style.color = "var(--danger-color)";
                p2pIndicator.className = 'p2p-dot';
                if (isAutoReconnecting) setTimeout(() => { if (isAutoReconnecting) startAutoConnectLoop(); }, 3000);
            }
        }
    });
};
function startAutoConnectLoop() {
    if (!isAutoReconnecting) return;
    const lastPeer = localStorage.getItem('last_connected_peer');
    if (!lastPeer) { isAutoReconnecting = false; return; }
    if (conn && conn.open) { isAutoReconnecting = false; isConnecting = false; return; }
    if (isConnecting) return;
    if (!peer || peer.destroyed) { initPeer(false); setTimeout(() => { if (isAutoReconnecting) startAutoConnectLoop(); }, 300); return; }
    if (peer.disconnected) { try { peer.reconnect(); } catch(e){} setTimeout(() => { if (isAutoReconnecting) startAutoConnectLoop(); }, 500); return; }
    if (!peer.open) { setTimeout(() => { if (isAutoReconnecting) startAutoConnectLoop(); }, 300); return; }
    isConnecting = true; handshakeDone = false;
    document.getElementById('p2p-status').innerText = "🔄 寻找主机...";
    document.getElementById('p2p-status').style.color = "#f2994a";
    p2pIndicator.className = 'p2p-dot connecting';
    if (conn) { try { conn.close(); } catch(e){} conn = null; }
    currentTargetPeer = lastPeer;
    try { conn = peer.connect(lastPeer, { reliable: true }); }
    catch (e) { isConnecting = false; setTimeout(() => { if (isAutoReconnecting) startAutoConnectLoop(); }, 1000); return; }
    setupConnection(conn, false, lastPeer);
    if (connectTimer) clearTimeout(connectTimer);
    connectTimer = setTimeout(() => {
        if (isConnecting && (!conn || !conn.open)) {
            isConnecting = false;
            if (conn) { try { conn.close(); } catch(e){} conn = null; }
            if (isAutoReconnecting) setTimeout(() => { if (isAutoReconnecting) startAutoConnectLoop(); }, 1000);
        }
    }, 7000);
}
window.connectToPeer = function(targetId = null) {
    isAutoReconnecting = false; isConnecting = false; handshakeDone = false;
    if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
    const id = targetId || document.getElementById('target-peer-id').value.trim();
    if (!id) { alert('请输入连接码'); return; }
    document.getElementById('p2p-status').innerText = "正在连接...";
    document.getElementById('p2p-status').style.color = "#f2994a";
    p2pIndicator.className = 'p2p-dot connecting';
    const doConnect = () => {
        if (!peer || peer.destroyed) { initPeer(false); setTimeout(doConnect, 500); return; }
        if (peer.disconnected) { try { peer.reconnect(); } catch(e){} setTimeout(doConnect, 500); return; }
        if (!peer.open) { setTimeout(doConnect, 300); return; }
        if (conn) { try { conn.close(); } catch(e){} conn = null; }
        currentTargetPeer = id;
        try { conn = peer.connect(id, { reliable: true }); }
        catch (e) { document.getElementById('p2p-status').innerText = "❌ 连接失败"; return; }
        setupConnection(conn, false, id);
        if (connectTimer) clearTimeout(connectTimer);
        connectTimer = setTimeout(() => {
            if (conn && !conn.open) {
                document.getElementById('p2p-status').innerText = "❌ 连接超时";
                document.getElementById('p2p-status').style.color = "var(--danger-color)";
                p2pIndicator.className = 'p2p-dot';
                try { conn.close(); } catch(e){}
            }
        }, 7000);
    };
    doConnect();
};
function mergeData(local, remote) {
    const merged = JSON.parse(JSON.stringify(local));
    const configKeys = ['yearlyGoals', 'themeColor', 'themeMode', 'fonts', 'radius', 'energyMax', 'energyWarnThreshold', 'expRatio', 'napEnergy', 'breakEnergy', 'levelConfig', 'commonBtns', 'maxVisible', 'animationEnabled', 'panelLayout'];
    configKeys.forEach(k => { if (remote[k] !== undefined) merged[k] = remote[k]; });
    if (remote.methodsFiles && Array.isArray(remote.methodsFiles)) {
        if (!Array.isArray(merged.methodsFiles)) merged.methodsFiles = [];
        const localFileMap = new Map(merged.methodsFiles.map(f => [f.id, f]));
        remote.methodsFiles.forEach(rf => {
            if (!localFileMap.has(rf.id)) merged.methodsFiles.push(JSON.parse(JSON.stringify(rf)));
            else {
                const lf = localFileMap.get(rf.id);
                const rAt = rf.updatedAt || 0;
                const lAt = lf.updatedAt || 0;
                if (rAt > lAt) { lf.name = rf.name; lf.type = rf.type; lf.parentId = rf.parentId; if (rf.type === 'file') { lf.contentHtml = rf.contentHtml; lf.contentText = rf.contentText; } lf.updatedAt = rf.updatedAt; }
            }
        });
    }
    if (!Array.isArray(merged.methodsFiles) || merged.methodsFiles.length === 0) merged.methodsFiles = [{ id: 'file_default', name: '我的学习方法', type: 'file', parentId: null, contentHtml: '', contentText: '', updatedAt: 0 }];
    if (!merged.methodsFiles.find(f => f.id === merged.activeMethodsFileId)) merged.activeMethodsFileId = merged.methodsFiles.find(f => f.type === 'file')?.id;
    const curFile = merged.methodsFiles.find(f => f.id === merged.activeMethodsFileId);
    merged.learningMethodsHtml = curFile ? curFile.contentHtml || '' : '';
    merged.learningMethods = curFile ? curFile.contentText || '' : '';
    merged.methodsFiles.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const localTasksMap = new Map(merged.tasks.map(t => [t.id, t]));
    (remote.tasks || []).forEach(rt => {
        if (!localTasksMap.has(rt.id)) merged.tasks.push(rt);
        else {
            const lt = localTasksMap.get(rt.id);
            if (rt.type !== undefined && rt.type !== lt.type) lt.type = rt.type;
            if (rt.todoKind !== undefined) lt.todoKind = rt.todoKind;
            if (rt.date !== undefined && rt.date !== lt.date) lt.date = rt.date;
            lt.text = rt.text || lt.text;
            if (rt.completed !== undefined) lt.completed = rt.completed;
            if (rt.note !== undefined) lt.note = rt.note;
            if (rt.deadline !== undefined) lt.deadline = rt.deadline;
            if (rt.target !== undefined) lt.target = rt.target;
            if (rt.recurringType !== undefined) lt.recurringType = rt.recurringType;
            if (rt.energyCost !== undefined) lt.energyCost = rt.energyCost;
            if (rt.countTotal !== undefined) lt.countTotal = Math.max(lt.countTotal || 0, rt.countTotal);
            if (rt.countEnded !== undefined) lt.countEnded = rt.countEnded || lt.countEnded;
            if (rt.estimate !== undefined) lt.estimate = rt.estimate;
            if (rt.pinned !== undefined) lt.pinned = rt.pinned;
            if (rt.timeSlot !== undefined) lt.timeSlot = rt.timeSlot;
            if (rt.timeSlots !== undefined) lt.timeSlots = rt.timeSlots;
            if (rt.completions) { if (!lt.completions) lt.completions = {}; Object.assign(lt.completions, rt.completions); }
            if (rt.currents) { if (!lt.currents) lt.currents = {}; for (let k in rt.currents) lt.currents[k] = Math.max(lt.currents[k] || 0, rt.currents[k]); }
            if (rt.skipDates) { if (!lt.skipDates) lt.skipDates = {}; Object.assign(lt.skipDates, rt.skipDates); }
            if (rt.recurringEndedDate) lt.recurringEndedDate = rt.recurringEndedDate;
            if (rt.subTasks) {
                if (!lt.subTasks) lt.subTasks = [];
                const localSubMap = new Map(lt.subTasks.map(s => [s.id, s]));
                rt.subTasks.forEach(rs => {
                    if (!localSubMap.has(rs.id)) lt.subTasks.push(rs);
                    else {
                        const ls = localSubMap.get(rs.id);
                        ls.text = rs.text || ls.text;
                        if (rs.completed !== undefined) ls.completed = rs.completed;
                        if (rs.target !== undefined) ls.target = rs.target;
                        if (rs.energyCost !== undefined) ls.energyCost = rs.energyCost;
                        if (rs.countTotal !== undefined) ls.countTotal = Math.max(ls.countTotal || 0, rs.countTotal);
                        if (rs.countEnded !== undefined) ls.countEnded = rs.countEnded || ls.countEnded;
                        if (rs.estimate !== undefined) ls.estimate = rs.estimate;
                        if (rs.completions) { if (!ls.completions) ls.completions = {}; Object.assign(ls.completions, rs.completions); }
                        if (rs.currents) { if (!ls.currents) ls.currents = {}; for (let k in rs.currents) ls.currents[k] = Math.max(ls.currents[k] || 0, rs.currents[k]); }
                    }
                });
            }
        }
    });
    merged.exercises = mergeExercisesList(merged.exercises || [], remote.exercises || []);
    merged.exerciseSchedule = mergeExerciseScheduleDict(merged.exerciseSchedule || {}, remote.exerciseSchedule || {});
    merged.exerciseTimeSlotSchedule = mergeExerciseTimeSlotDict(merged.exerciseTimeSlotSchedule || {}, remote.exerciseTimeSlotSchedule || {});
    merged.dailyExerciseChecks = mergeDailyExerciseChecksDict(merged.dailyExerciseChecks || {}, remote.dailyExerciseChecks || {});
    const dictKeys = ['dailyReflections', 'weeklyReflections', 'dailyLogs', 'fixedBlockSchedule', 'monthlyReflections'];
    dictKeys.forEach(key => {
        if (!remote[key]) return;
        if (!merged[key]) merged[key] = {};
        Object.keys(remote[key]).forEach(dateStr => {
            if (!merged[key][dateStr]) merged[key][dateStr] = JSON.parse(JSON.stringify(remote[key][dateStr]));
            else {
                if (typeof merged[key][dateStr] === 'object' && !Array.isArray(merged[key][dateStr])) {
                    if (key === 'dailyLogs') {
                        Object.keys(remote[key][dateStr]).forEach(taskId => {
                            if (!merged[key][dateStr][taskId]) merged[key][dateStr][taskId] = remote[key][dateStr][taskId];
                            else {
                                const lLog = merged[key][dateStr][taskId];
                                const rLog = remote[key][dateStr][taskId];
                                lLog.name = rLog.name || lLog.name;
                                lLog.completed = rLog.completed || lLog.completed;
                                lLog.delta = Math.max(lLog.delta || 0, rLog.delta || 0);
                            }
                        });
                    } else Object.assign(merged[key][dateStr], remote[key][dateStr]);
                } else if (Array.isArray(merged[key][dateStr])) merged[key][dateStr] = [...new Set([...merged[key][dateStr], ...remote[key][dateStr]])];
                else merged[key][dateStr] = remote[key][dateStr];
            }
        });
    });
    if (remote.dailyEnergy) {
        if (!merged.dailyEnergy) merged.dailyEnergy = {};
        Object.keys(remote.dailyEnergy).forEach(dateStr => { merged.dailyEnergy[dateStr] = Math.max(merged.dailyEnergy[dateStr] || 0, remote.dailyEnergy[dateStr]); });
    }
    if (remote.rpg) {
        ['exp', 'int', 'vit', 'cre', 'foc', 'wil', 'streak'].forEach(k => { merged.rpg[k] = Math.max(merged.rpg[k] || 0, remote.rpg[k] || 0); });
        if (remote.rpg.lastDate && (!merged.rpg.lastDate || remote.rpg.lastDate > merged.rpg.lastDate)) merged.rpg.lastDate = remote.rpg.lastDate;
    }
    if (remote.fixedBlocks) {
        if (!merged.fixedBlocks) merged.fixedBlocks = [];
        const localMap = new Map(merged.fixedBlocks.map(x => [x.id, x]));
        remote.fixedBlocks.forEach(x => {
            if (!localMap.has(x.id)) merged.fixedBlocks.push(JSON.parse(JSON.stringify(x)));
            else Object.assign(localMap.get(x.id), x);
        });
    }
    const localTSMod = merged.timeSlotsLastModified || 0;
    const remoteTSMod = remote.timeSlotsLastModified || 0;
    if (remote.timeSlots && Array.isArray(remote.timeSlots)) {
        if (remoteTSMod > localTSMod) {
            merged.timeSlots = JSON.parse(JSON.stringify(remote.timeSlots));
            merged.timeSlotsLastModified = remoteTSMod;
        } else if (remoteTSMod === localTSMod && !merged.timeSlots) {
            merged.timeSlots = JSON.parse(JSON.stringify(remote.timeSlots));
            merged.timeSlotsLastModified = remoteTSMod;
        }
    }
    merged.tasks.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    merged.exercises.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    merged.fixedBlocks.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (Array.isArray(merged.timeSlots)) merged.timeSlots.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return merged;
}
function computeDiffs(oldData, newData) {
    const diffs = {};
    if (!oldData) { diffs.all = true; return diffs; }
    const jstr = (v) => JSON.stringify(v);
    diffs.tasks = jstr(oldData.tasks) !== jstr(newData.tasks);
    diffs.exercises = jstr(oldData.exercises) !== jstr(newData.exercises);
    diffs.exerciseSchedule = jstr(oldData.exerciseSchedule) !== jstr(newData.exerciseSchedule);
    diffs.exerciseTimeSlotSchedule = jstr(oldData.exerciseTimeSlotSchedule) !== jstr(newData.exerciseTimeSlotSchedule);
    diffs.dailyExerciseChecks = jstr(oldData.dailyExerciseChecks) !== jstr(newData.dailyExerciseChecks);
    diffs.fixedBlocks = jstr(oldData.fixedBlocks) !== jstr(newData.fixedBlocks);
    diffs.fixedBlockSchedule = jstr(oldData.fixedBlockSchedule) !== jstr(newData.fixedBlockSchedule);
    diffs.timeSlots = jstr(oldData.timeSlots) !== jstr(newData.timeSlots);
    diffs.timeSlotsLastModified = (oldData.timeSlotsLastModified || 0) !== (newData.timeSlotsLastModified || 0);
    diffs.methodsFiles = jstr(oldData.methodsFiles) !== jstr(newData.methodsFiles);
    diffs.rpg = jstr(oldData.rpg) !== jstr(newData.rpg);
    diffs.dailyEnergy = jstr(oldData.dailyEnergy) !== jstr(newData.dailyEnergy);
    diffs.dailyReflections = jstr(oldData.dailyReflections) !== jstr(newData.dailyReflections);
    diffs.weeklyReflections = jstr(oldData.weeklyReflections) !== jstr(newData.weeklyReflections);
    diffs.monthlyReflections = jstr(oldData.monthlyReflections) !== jstr(newData.monthlyReflections);
    diffs.levelConfig = jstr(oldData.levelConfig) !== jstr(newData.levelConfig);
    diffs.commonBtns = jstr(oldData.commonBtns) !== jstr(newData.commonBtns);
    diffs.maxVisible = oldData.maxVisible !== newData.maxVisible;
    diffs.themeMode = oldData.themeMode !== newData.themeMode;
    diffs.themeColor = oldData.themeColor !== newData.themeColor;
    diffs.fonts = jstr(oldData.fonts) !== jstr(newData.fonts);
    diffs.radius = oldData.radius !== newData.radius;
    diffs.yearlyGoals = oldData.yearlyGoals !== newData.yearlyGoals;
    diffs.napEnergy = oldData.napEnergy !== newData.napEnergy;
    diffs.breakEnergy = oldData.breakEnergy !== newData.breakEnergy;
    return diffs;
}
function applyRemoteData(payload, oldData) {
    isSyncing = true;
    if (isDraggingActive) { setTimeout(() => { isSyncing = false; applyRemoteData(payload, appData); }, 300); return; }
    const diffs = computeDiffs(oldData, payload);
    appData = payload;
    ensureEnergyData();
    if (diffs.themeMode) document.body.classList.toggle('dark-mode', appData.themeMode === 'dark');
    if (diffs.themeColor && appData.themeColor) document.documentElement.style.setProperty('--accent-color', appData.themeColor);
    if (diffs.fonts && appData.fonts) ['title','content','hint','small'].forEach(k => document.documentElement.style.setProperty(`--font-${k}`, appData.fonts[k]));
    if (diffs.radius && appData.radius) document.documentElement.style.setProperty('--radius', appData.radius);
    if (diffs.yearlyGoals) {
        const g = appData.yearlyGoals || "";
        const yg = document.getElementById('yearly-goals');
        const ygb = document.getElementById('yearly-goals-bottom');
        if (yg && document.activeElement !== yg) yg.innerText = g;
        if (ygb && document.activeElement !== ygb) ygb.value = g;
    }
    if (diffs.tasks || diffs.exercises || diffs.exerciseSchedule || diffs.exerciseTimeSlotSchedule || diffs.dailyExerciseChecks) updateFixedProgressBars();
    if (diffs.rpg || diffs.dailyEnergy || diffs.napEnergy || diffs.breakEnergy) { lastRpgState = null; renderEnergyAndRPG(); }
    if (diffs.methodsFiles) {
        renderMethodsFileList();
        const editor = methodsGetEditor();
        if (!editor || document.activeElement !== editor) refreshMethodsEditorContent();
    }
    if (diffs.levelConfig) renderLevelConfig();
    if (diffs.commonBtns && appData.commonBtns) document.querySelectorAll('#common-btns-config input[type="checkbox"]').forEach(cb => { cb.checked = appData.commonBtns.includes(cb.value); });
    if (diffs.timeSlots || diffs.timeSlotsLastModified) { renderTimeSlotConfig(); renderWeekBoard(); renderTaskPool(); }
    if (diffs.fixedBlocks) { renderFixedBlockPool(); renderFixedBlockEnergyConfig(); }
    if (diffs.maxVisible) { const el = document.getElementById('max-visible-val'); if (el) el.innerText = appData.maxVisible; }
    const activeViewEl = document.querySelector('.view-container.active');
    const activeView = activeViewEl ? activeViewEl.id : '';
    const viewNeedsUpdate = diffs.tasks || diffs.exercises || diffs.dailyExerciseChecks || diffs.exerciseSchedule || diffs.exerciseTimeSlotSchedule || diffs.fixedBlockSchedule || diffs.dailyReflections || diffs.weeklyReflections || diffs.monthlyReflections || diffs.timeSlots || diffs.timeSlotsLastModified || diffs.fixedBlocks;
    if (viewNeedsUpdate) {
        const activeEl = document.activeElement;
        const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (!isEditing) {
            if (activeView === 'view-day') renderDayPlan();
            else if (activeView === 'view-week') { renderWeekBoard(); renderTaskPool(); }
            else if (activeView === 'view-month') renderCalendar();
            else if (activeView === 'view-year') renderYearHeatmap();
        }
    }
    lastSavedSignature = '';
    saveLocalStorage();
    setTimeout(() => { isSyncing = false; }, 100);
}
function setupConnection(connection, isHost, targetId) {
    connection.on('open', () => {
        if (conn !== connection) return;
        isAutoReconnecting = false; isConnecting = false;
        if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
        document.getElementById('p2p-status').innerText = "🔗 已连接";
        document.getElementById('p2p-status').style.color = "#27ae60";
        p2pIndicator.className = 'p2p-dot connected';
        syncStatus = 'connected'; updateSyncUI();
        if (!isHost && targetId) {
            let history = JSON.parse(localStorage.getItem('my_p2p_history') || '[]');
            if (!history.includes(targetId)) { history.unshift(targetId); if (history.length > 5) history.pop(); localStorage.setItem('my_p2p_history', JSON.stringify(history)); }
            localStorage.setItem('last_connected_peer', targetId);
            renderP2PHistory();
        }
        try { connection.send({ type: 'SYNC_MERGE', payload: appData, lastModified: appData._lastModified || 1 }); } catch(e){}
        resetSyncedBaseline(appData);
    });
    connection.on('data', (data) => {
        if (conn !== connection || !data || !data.type) return;
        if (data.type === 'OP') handleIncomingOp(data.data);
        else if (data.type === 'LOCK') applyRemoteLock(data.targetId, data.clientId);
        else if (data.type === 'UNLOCK') removeRemoteLock(data.targetId);
        else if (data.type === 'SYNC_MERGE') {
            const oldData = JSON.parse(JSON.stringify(appData));
            const merged = mergeData(appData, data.payload);
            applyRemoteData(merged, oldData);
            resetSyncedBaseline(appData);
        }
    });
    connection.on('close', () => {
        if (conn !== connection) return;
        isConnecting = false; if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
        p2pIndicator.className = 'p2p-dot';
        conn = null;
        syncStatus = 'offline'; updateSyncUI();
        if (!isAutoReconnecting) { document.getElementById('p2p-status').innerText = "❌ 连接已断开"; document.getElementById('p2p-status').style.color = "var(--text-muted)"; }
        else setTimeout(() => { if (isAutoReconnecting) startAutoConnectLoop(); }, 1000);
    });
    connection.on('error', (err) => { if (conn !== connection) return; console.log("Err:", err); });
}
window.toggleWeekDrawer = function(force) {
    const panel = document.getElementById('week-drawer-panel');
    const tab = document.getElementById('week-drawer-tab');
    const view = document.getElementById('view-week');
    if (!panel || !tab) return;
    const open = force !== undefined ? force : !panel.classList.contains('open');
    if (open) { panel.classList.add('open'); tab.classList.add('hidden'); if (view) view.classList.add('drawer-open'); }
    else { panel.classList.remove('open'); tab.classList.remove('hidden'); if (view) view.classList.remove('drawer-open'); }
};
let _autoScrollRAF = null, _autoScrollDir = 0, _autoScrollEl = null;
function startAutoScroll(el, dir) {
    if (_autoScrollEl === el && _autoScrollDir === dir && _autoScrollRAF) return;
    stopAutoScroll();
    _autoScrollEl = el; _autoScrollDir = dir;
    const step = () => {
        if (!_autoScrollEl || !_autoScrollDir) { _autoScrollRAF = null; return; }
        _autoScrollEl.scrollTop += _autoScrollDir * 14;
        _autoScrollRAF = requestAnimationFrame(step);
    };
    _autoScrollRAF = requestAnimationFrame(step);
}
function stopAutoScroll() { _autoScrollEl = null; _autoScrollDir = 0; if (_autoScrollRAF) { cancelAnimationFrame(_autoScrollRAF); _autoScrollRAF = null; } }
document.addEventListener('dragover', (e) => {
    if (!draggedTaskId && !draggedExerciseName && !draggedFixedBlockId) { stopAutoScroll(); return; }
    const view = document.getElementById('view-week');
    if (!view || !view.classList.contains('active')) { stopAutoScroll(); return; }
    if (e.target.closest && (e.target.closest('.week-drawer-panel') || e.target.closest('.week-drawer-tab'))) { stopAutoScroll(); return; }
    const rect = view.getBoundingClientRect();
    const threshold = 90;
    if (e.clientY < rect.top + threshold) startAutoScroll(view, -1);
    else if (e.clientY > rect.bottom - threshold) startAutoScroll(view, 1);
    else stopAutoScroll();
});
document.addEventListener('dragend', () => { stopAutoScroll(); isDraggingActive = false; });
document.addEventListener('drop', () => { stopAutoScroll(); }, true);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        document.body.classList.add('invisible-anim');
    } else {
        document.body.classList.remove('invisible-anim');
    }
});
window.addEventListener('beforeunload', () => {
    cleanupMethodsTimers();
    if (_opDebounceTimer) clearTimeout(_opDebounceTimer);
    if (_mainLoopInterval) clearInterval(_mainLoopInterval);
    _clearBackupTimers();
    if (resizeObserver) { try { resizeObserver.disconnect(); } catch(e) {} }
    if (_panelSortable) { try { _panelSortable.destroy(); } catch(e) {} }
    if (_tsSortable) { try { _tsSortable.destroy(); } catch(e) {} }
    document.querySelectorAll('.task-drop-zone').forEach(zone => { if (zone._sortable) { try { zone._sortable.destroy(); } catch(e) {} zone._sortable = null; } });
    document.querySelectorAll('.sub-task-list').forEach(list => { if (list._sortable) { try { list._sortable.destroy(); } catch(e) {} list._sortable = null; } });
    if (peer) { try { peer.destroy(); } catch(e){} peer = null; }
    if (conn) { try { conn.close(); } catch(e){} conn = null; }
});
(function() {
    const tab = document.getElementById('week-drawer-tab');
    if (!tab) return;
    tab.addEventListener('dragover', (e) => {
        e.preventDefault();
        const panel = document.getElementById('week-drawer-panel');
        if (panel && !panel.classList.contains('open')) toggleWeekDrawer(true);
    });
})();
(function init() {
    const saved = localStorage.getItem('myWorkspaceAppData');
    if (saved) { try { appData = JSON.parse(saved); } catch (e) {} }
    else {
        appData.tasks.push({ id: '1', text: '搭建个人应用框架', type: 'learning', date: 'pool', completed: false, subTasks: [{id: '1-1', text: '设计UI', completed: false, energyCost: 5}], deadline: '', pinned: false, energyCost: 10 });
        appData.tasks.push({ id: '2', text: '看教程视频', type: 'learning', date: getTodayString(), completed: false, subTasks: [], deadline: '', target: 100, current: 10, pinned: false, energyCost: 1 });
        appData.tasks.push({ id: '3', text: '复习考试', type: 'learning', date: getTodayString(), completed: false, subTasks: [{id: '3-1', text: '第一章', completed: false, target: 5, current: 0, energyCost: 1}, {id: '3-2', text: '第二章', completed: false, target: 5, current: 0, energyCost: 1}], deadline: '', pinned: false, energyCost: 1 });
    }
    ensureEnergyData();
    if (!appData._lastModified) appData._lastModified = 1;
    appData.selectedDate = getTodayString();
    appData.viewYear = new Date().getFullYear();
    appData.viewMonth = new Date().getMonth();
    appData.viewWeekBaseDate = getTodayString();
    appData.tasks.forEach(t => {
        if (t.energyCost === undefined && t.type !== 'todo') t.energyCost = t.target ? 1 : 10;
        if (t.subTasks) t.subTasks.forEach(s => { if (s.energyCost === undefined) s.energyCost = s.target ? 1 : 5; });
    });
    appData.exercises.forEach(ex => { if (ex.energyCost === undefined) ex.energyCost = 15; });
    document.body.classList.toggle('dark-mode', appData.themeMode === 'dark');
    lastSavedSignature = '';
    lastBackupModified = appData._lastModified || 0;
    const si = localStorage.getItem('myWorkspaceBackupInterval');
    if (si) autoBackupIntervalMin = parseInt(si) || 3;
    const slb = localStorage.getItem('myWorkspaceLastBackupTime');
    if (slb) lastBackupTime = parseInt(slb) || 0;
    const sel = document.getElementById('backup-interval');
    if (sel) sel.value = String(autoBackupIntervalMin);
    if (appData.themeColor) document.documentElement.style.setProperty('--accent-color', appData.themeColor);
    if (appData.fonts) ['title','content','hint','small'].forEach(k => document.documentElement.style.setProperty(`--font-${k}`, appData.fonts[k]));
    if (appData.radius) {
        document.documentElement.style.setProperty('--radius', appData.radius);
        const rsl = document.getElementById('radius-slider'), rvl = document.getElementById('radius-val');
        const rn = parseInt(appData.radius);
        if (rsl) rsl.value = rn;
        if (rvl) rvl.innerText = rn;
    }
    applyPanelLayout();
    renderCalendar(); renderYearHeatmap(); renderDayPlan(); updateFixedProgressBars();
    initDragAndDrop(); renderTimeSlotConfig(); updateBackupUI(); renderEnergyAndRPG();
    renderLevelConfig(); renderFixedBlockEnergyConfig();
    renderP2PHistory(); renderFixedBlockPool();
    initMethodsEditor();
    const sh = localStorage.getItem('my_p2p_host_id');
    if (sh) document.getElementById('my-peer-id').innerText = sh;
    tryRestoreBackupFolder();
    updateSyncUI();
    window.addEventListener('online', () => { syncStatus = 'connected'; updateSyncUI(); });
    window.addEventListener('offline', () => { syncStatus = 'offline'; updateSyncUI(); });
    if (isMobileDevice && localStorage.getItem('last_connected_peer')) {
        document.getElementById('target-peer-id').value = localStorage.getItem('last_connected_peer');
        setTimeout(() => initPeer(false, true), 500);
    }
    if (_mainLoopInterval) clearInterval(_mainLoopInterval);
    _mainLoopInterval = setInterval(() => {
        if (document.hidden) return;
        const today = getTodayString();
        if (!userPickedDate && appData.selectedDate !== today) {
            appData.selectedDate = today;
            if (document.getElementById('view-day').classList.contains('active')) renderDayPlan();
            if (document.getElementById('view-month').classList.contains('active')) renderCalendar();
        }
        renderEnergyAndRPG();
    }, 60000);
})();

// ===== 新增：立即同步按钮事件委托（不覆盖任何已有监听） =====
document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    const btn = e.target.closest('#manual-sync-btn');
    if (!btn) return;
    if (typeof window.doManualSync === 'function') {
        e.preventDefault();
        window.doManualSync();
    }
});

/* ===== FIX-INJECT-BEGIN: events-settings ===== */
/* ------------------------------------------------------------------
 * 修复注入②：设置控件监听 / 保存 / 回填
 * 目的：
 *   1) 通过 document 级事件委托，为所有带 data-setting 的控件
 *      （滑块、数字框、复选框、主题按钮）统一处理，写入 appData
 *      并调用 saveDataToFile()，修复「设置无法保存 / 无法修改」。
 *   2) 提供 refreshSettingsPanel()，从 appData 回填设置控件值，
 *      修复「设置面板没有加载默认配置值」。
 *   3) 通过事件委托接管 月份总结 / 年度目标 / 待办输入框 等可能
 *      因模板延迟注入而绑定失败的输入（处理逻辑幂等，不会重复添加）。
 * 原有拖拽、同步、任务勾选、菜单、弹窗等事件与逻辑全部保留。
 * ------------------------------------------------------------------ */
(function bindSettingsControls() {
    if (window.__settingsControlsBound) return;
    window.__settingsControlsBound = true;

    /* ---------- 工具 ---------- */
    function setPath(obj, path, value) {
        var parts = String(path).split('.');
        var cur = obj;
        for (var i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
    }

    function persist() {
        try {
            if (typeof saveDataToFile === 'function') { saveDataToFile(appData); return; }
        } catch (e) {}
        try { localStorage.setItem('myWorkspaceAppData', JSON.stringify(appData)); } catch (e) {}
    }

    function getAppData() {
        return (typeof appData !== 'undefined' && appData) ? appData : null;
    }

    function applySettingFromControl(el) {
        if (!el || !el.getAttribute) return;
        var a = getAppData();
        if (!a) return;
        var field = el.getAttribute('data-setting');
        if (!field) return;

        var value;
        if (el.type === 'checkbox') value = !!el.checked;
        else if (el.type === 'range' || el.type === 'number') value = parseFloat(el.value);
        else value = el.value;

        /* —— 特化处理 —— */
        if (field === 'radius') {
            var r = Math.round(parseFloat(value) || 8);
            if (r < 0) r = 0;
            if (r > 30) r = 30;
            a.radius = r + 'px';
            document.documentElement.style.setProperty('--radius', a.radius);
            var rv = document.getElementById('radius-val'); if (rv) rv.innerText = r;
            var rs = document.getElementById('radius-slider'); if (rs && rs !== el) rs.value = r;
            persist(); return;
        }

        if (field.indexOf('fonts.') === 0) {
            var k = field.split('.')[1];
            var px = Math.round(parseFloat(value) || 14);
            if (!a.fonts) a.fonts = {};
            a.fonts[k] = px + 'px';
            document.documentElement.style.setProperty('--font-' + k, a.fonts[k]);
            var fv = document.getElementById('font-' + k + '-val'); if (fv) fv.innerText = px;
            persist(); return;
        }

        if (field === 'expRatio') {
            var pct = parseFloat(value);
            if (isNaN(pct)) pct = 60;
            if (pct < 10) pct = 10;
            if (pct > 100) pct = 100;
            a.expRatio = pct / 100;
            var ev = document.getElementById('exp-ratio-val');
            if (ev) ev.innerText = Math.round(a.expRatio * 100);
            persist(); return;
        }

        if (field === 'commonBtns') {
            if (!Array.isArray(a.commonBtns)) a.commonBtns = [];
            var val = el.getAttribute('data-value') || el.value;
            if (el.checked) {
                if (a.commonBtns.indexOf(val) < 0) a.commonBtns.push(val);
            } else {
                a.commonBtns = a.commonBtns.filter(function (b) { return b !== val; });
            }
            persist();
            try { if (typeof renderDayPlan === 'function') renderDayPlan(); } catch (e) {}
            try { if (typeof renderTaskPool === 'function') renderTaskPool(); } catch (e) {}
            return;
        }

        if (field === 'themeMode') {
            a.themeMode = value;
            document.body.classList.toggle('dark-mode', value === 'dark');
            persist(); return;
        }
        if (field === 'themeColor') {
            a.themeColor = value;
            document.documentElement.style.setProperty('--accent-color', value);
            persist(); return;
        }

        if (field === 'maxVisible') {
            a.maxVisible = Math.max(1, Math.round(parseFloat(value) || 5));
            var mv = document.getElementById('max-visible-val');
            if (mv) mv.innerText = a.maxVisible;
            persist();
            try { if (typeof renderDayPlan === 'function') renderDayPlan(); } catch (e) {}
            return;
        }
        if (field === 'energyMax') {
            a.energyMax = Math.max(1, Math.round(parseFloat(value) || 200));
            var emv = document.getElementById('energy-max-val');
            if (emv) emv.innerText = a.energyMax;
            persist();
            try { if (typeof renderEnergyAndRPG === 'function') renderEnergyAndRPG(); } catch (e) {}
            return;
        }
        if (field === 'energyWarnThreshold') {
            a.energyWarnThreshold = Math.max(0, Math.round(parseFloat(value) || 30));
            var ewv = document.getElementById('energy-warn-val');
            if (ewv) ewv.innerText = a.energyWarnThreshold;
            persist();
            try { if (typeof renderEnergyAndRPG === 'function') renderEnergyAndRPG(); } catch (e) {}
            return;
        }
        if (field === 'napEnergy' || field === 'breakEnergy') {
            var n = Math.max(0, Math.round(parseFloat(value) || 0));
            a[field] = n;
            persist();
            try { if (typeof renderEnergyAndRPG === 'function') renderEnergyAndRPG(); } catch (e) {}
            return;
        }

        /* —— 通用写回 —— */
        setPath(a, field, value);
        persist();
        try { if (typeof renderEnergyAndRPG === 'function') renderEnergyAndRPG(); } catch (e) {}
    }

    /* ---------- 设置控件委托：input / change / click ---------- */
    document.addEventListener('input', function (e) {
        var el = e.target;
        if (!el || !el.getAttribute) return;
        if (el.getAttribute('data-setting')) applySettingFromControl(el);
    }, true);

    document.addEventListener('change', function (e) {
        var el = e.target;
        if (!el || !el.getAttribute) return;
        if (!el.getAttribute('data-setting')) return;
        if (el.type === 'checkbox' || el.tagName === 'SELECT') applySettingFromControl(el);
    }, true);

    document.addEventListener('click', function (e) {
        var el = e.target;
        if (!el || !el.closest) return;
        var btn = el.closest('[data-setting][data-value]');
        if (!btn || btn.tagName !== 'BUTTON') return;
        var field = btn.getAttribute('data-setting');
        var val = btn.getAttribute('data-value');
        var a = getAppData();
        if (!a) return;
        if (field === 'themeMode') {
            a.themeMode = val;
            document.body.classList.toggle('dark-mode', val === 'dark');
            persist();
        } else if (field === 'themeColor') {
            a.themeColor = val;
            document.documentElement.style.setProperty('--accent-color', val);
            persist();
        }
    }, true);

    /* ---------- 输入框兜底委托（模板延迟注入时顶层绑定可能失效） ---------- */
    document.addEventListener('input', function (e) {
        var t = e.target;
        if (!t || !t.id) return;
        if (t.id === 'yearly-goals') {
            if (typeof syncGoal === 'function') syncGoal(t.innerText);
            return;
        }
        if (t.id === 'yearly-goals-bottom') {
            if (typeof syncGoal === 'function') syncGoal(t.value);
            return;
        }
        if (t.id === 'month-summary-textarea') {
            var a = getAppData();
            if (!a) return;
            var mKey = a.viewYear + '-' + a.viewMonth;
            if (!a.monthlyReflections) a.monthlyReflections = {};
            a.monthlyReflections[mKey] = t.value;
            persist();
        }
    }, false);

    document.addEventListener('keypress', function (e) {
        var t = e.target;
        if (!t || !t.id) return;
        var a = getAppData();
        if (!a) return;
        if (t.id === 'pool-input-learning') {
            if (typeof handleAddInput === 'function') handleAddInput(e, 'learning', 'pool', true);
        } else if (t.id === 'pool-input-other') {
            if (typeof handleAddInput === 'function') handleAddInput(e, 'other', 'pool', true);
        } else if (t.id === 'learning-input') {
            if (typeof handleAddInput === 'function') handleAddInput(e, 'learning', a.selectedDate, false);
        } else if (t.id === 'other-input') {
            if (typeof handleAddInput === 'function') handleAddInput(e, 'other', a.selectedDate, false);
        } else if (t.id === 'todo-input') {
            if (typeof handleAddTodoInput === 'function') handleAddTodoInput(e);
        }
    }, false);

    /* ---------- 回填：从 appData 写回设置面板 ---------- */
    function refreshSettingsPanel() {
        var a = getAppData();
        if (!a) return;
        var d = window.DEFAULT_SETTINGS || {};
        var fontsD = d.fonts || { title: '18px', content: '14px', hint: '12px', small: '10px' };

        function setVal(id, v) {
            var el = document.getElementById(id);
            if (!el) return;
            if (document.activeElement === el) return;
            el.value = v;
        }
        function setText(id, v) {
            var el = document.getElementById(id);
            if (el) el.innerText = v;
        }
        function setChecked(id, v) {
            var el = document.getElementById(id);
            if (el) el.checked = !!v;
        }

        var rn = parseInt(a.radius || d.radius || '8px', 10) || 8;
        setVal('radius-slider', rn);
        setText('radius-val', rn);

        var mv = (typeof a.maxVisible === 'number') ? a.maxVisible : (d.maxVisible || 5);
        setVal('max-visible-slider', mv);
        setText('max-visible-val', mv);

        setChecked('animation-toggle', a.animationEnabled !== false);

        ['title', 'content', 'hint', 'small'].forEach(function (k) {
            var raw = (a.fonts && a.fonts[k]) || fontsD[k] || '14px';
            var n = parseInt(raw, 10) || 14;
            setVal('font-' + k + '-slider', n);
            setText('font-' + k + '-val', n);
        });

        var emax = (typeof a.energyMax === 'number') ? a.energyMax : (d.energyMax || 200);
        setVal('energy-max-slider', emax);
        setText('energy-max-val', emax);

        var ewarn = (typeof a.energyWarnThreshold === 'number') ? a.energyWarnThreshold : (d.energyWarnThreshold || 30);
        setVal('energy-warn-slider', ewarn);
        setText('energy-warn-val', ewarn);

        var ratio = (typeof a.expRatio === 'number') ? a.expRatio : (d.expRatio || 0.6);
        var rp = Math.round(ratio * 100);
        setVal('exp-ratio-slider', rp);
        setText('exp-ratio-val', rp);

        setVal('set-nap-energy', (typeof a.napEnergy === 'number') ? a.napEnergy : (d.napEnergy || 50));
        setVal('set-break-energy', (typeof a.breakEnergy === 'number') ? a.breakEnergy : (d.breakEnergy || 20));

        if (a.rpg) {
            setVal('rpg-edit-exp', a.rpg.exp || 0);
            setVal('rpg-edit-int', a.rpg.int || 0);
            setVal('rpg-edit-vit', a.rpg.vit || 0);
            setVal('rpg-edit-cre', a.rpg.cre || 0);
            setVal('rpg-edit-foc', a.rpg.foc || 0);
            setVal('rpg-edit-wil', a.rpg.wil || 0);
        }

        var cbs = document.querySelectorAll('#common-btns-config input[type="checkbox"]');
        for (var i = 0; i < cbs.length; i++) {
            var cb = cbs[i];
            cb.checked = Array.isArray(a.commonBtns) && a.commonBtns.indexOf(cb.value) >= 0;
        }
    }

    function tryRefresh() {
        try { refreshSettingsPanel(); } catch (e) {
            if (window.console && console.warn) console.warn('[7-events fix] refreshSettingsPanel error', e);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryRefresh, { once: true });
    } else {
        tryRefresh();
    }
    setTimeout(tryRefresh, 0);
    setTimeout(tryRefresh, 300);
    setTimeout(tryRefresh, 1200);

    window.refreshSettingsPanel = refreshSettingsPanel;
})();

/* ------------------------------------------------------------------
 * 兜底：若原文件顶层的某处绑定仍因环境差异中断，
 *       这里补一次基础初始化（不覆盖任何已有逻辑）
 * ------------------------------------------------------------------ */
(function fallbackInit() {
    function run() {
        try {
            if (typeof appData === 'undefined' || !appData) return;
            /* 原文件中断的判定：deleteTask 定义在报错点之后 */
            var originalBroken = (typeof window.deleteTask !== 'function');

            try { if (typeof window.refreshSettingsPanel === 'function') window.refreshSettingsPanel(); } catch (e) {}

            if (originalBroken) {
                try { if (typeof applyPanelLayout === 'function') applyPanelLayout(); } catch (e) {}
                try { if (typeof renderCalendar === 'function') renderCalendar(); } catch (e) {}
                try { if (typeof renderYearHeatmap === 'function') renderYearHeatmap(); } catch (e) {}
                try { if (typeof renderDayPlan === 'function') renderDayPlan(); } catch (e) {}
                try { if (typeof updateFixedProgressBars === 'function') updateFixedProgressBars(); } catch (e) {}
                try { if (typeof renderEnergyAndRPG === 'function') renderEnergyAndRPG(); } catch (e) {}
                try { if (typeof initTaskAndSubTaskDrag === 'function') initTaskAndSubTaskDrag(); } catch (e) {}
                try { if (typeof initDragAndDrop === 'function') initDragAndDrop(); } catch (e) {}
                try { if (typeof renderTaskPool === 'function') renderTaskPool(); } catch (e) {}
                try { if (typeof renderWeekBoard === 'function') renderWeekBoard(); } catch (e) {}
                try { if (typeof renderMethodsFileList === 'function') renderMethodsFileList(); } catch (e) {}
            }
        } catch (e) {
            if (window.console && console.warn) console.warn('[7-events fix] fallbackInit error', e);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
    }
    setTimeout(run, 300);
    setTimeout(run, 1500);
})();
/* ===== FIX-INJECT-END: events-settings ===== */

/* ===== FIX-INJECT-BEGIN: events-plan-guard ===== */
/* ------------------------------------------------------------------
 * 修复注入：设置保存保护计划课表数据 + 修改设置后重渲染
 * 背景：
 *   1) 用户在设置面板修改任意设置时会触发 saveDataToFile(appData)，
 *      若此前 appData.timeSlots / fixedBlocks 被某处写成空数组（例如
 *      同步把远端空数据合进来、某按钮把变量清空），保存时就会把
 *      空数组写入 localStorage，下次启动加载到的就是空课表 ——
 *      表现即「课表时间段消失」；
 *   2) 修改设置后原代码只在部分字段调用局部渲染（如仅
 *      renderDayPlan 或 renderEnergyAndRPG），周 / 月 / 全年视图没有
 *      重新绘制，看起来像「视图空白」。
 * 方案：
 *   - 包装 window.saveDataToFile：保存前调用 ensurePlanBaseData()
 *     补全课表 / 计划结构；并对 timeSlots / fixedBlocks / tasks /
 *     exercises 做「非空基线保护」——若当前变成空数组而上一次非空，
 *     则恢复为上一次非空快照，禁止被误清空写入存储；
 *   - 追加 document 级设置变更监听：任何带 data-setting 的控件发生
 *     input / change / 按钮点击后，节流触发全视图重渲染；
 *   - 全视图渲染函数均用 try/catch 包裹、幂等，可与原有设置监听叠加，
 *     多渲染几次只会重绘，不会产生副作用。
 * 说明：
 *   - 之前的 events-top-guard、events-settings 注入段、原按钮事件、
 *     拖拽、同步、任务勾选等逻辑全部保留不动；
 *   - 本段仅做保护与重渲染，不改变任何业务字段语义。
 * ------------------------------------------------------------------ */
(function installSettingsPlanGuard() {
    if (window.__settingsPlanGuardInstalled) return;
    window.__settingsPlanGuardInstalled = true;

    var PROTECT_KEYS = ['timeSlots', 'fixedBlocks', 'tasks', 'exercises'];
    var lastValid = {};

    function getAppData() {
        return (typeof appData !== 'undefined' && appData) ? appData : null;
    }

    function deepSnap(v) {
        try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
    }

    function captureBaseline() {
        var a = getAppData();
        if (!a) return;
        PROTECT_KEYS.forEach(function (k) {
            if (Array.isArray(a[k]) && a[k].length > 0) {
                lastValid[k] = deepSnap(a[k]);
            }
        });
    }

    function ensurePlanData() {
        var a = getAppData();
        if (!a) return false;

        /* 先走通用补全（1-core 注入的 ensurePlanBaseData） */
        try {
            if (typeof window.ensurePlanBaseData === 'function') {
                window.ensurePlanBaseData(a);
            }
        } catch (e) {}

        var changed = false;

        /* 再做数组级「非空基线」保护：当前为空但上次非空 → 恢复 */
        PROTECT_KEYS.forEach(function (k) {
            if (!Array.isArray(a[k])) {
                /* 非法结构：恢复上一次非空 / 空数组 */
                if (lastValid[k] && lastValid[k].length > 0) {
                    a[k] = deepSnap(lastValid[k]);
                } else {
                    a[k] = [];
                }
                changed = true;
                return;
            }
            if (a[k].length === 0) {
                if (lastValid[k] && lastValid[k].length > 0) {
                    a[k] = deepSnap(lastValid[k]);
                    changed = true;
                }
            } else {
                lastValid[k] = deepSnap(a[k]);
            }
        });

        return changed;
    }

    /* ---------- 包装 saveDataToFile：保存前保护计划数据 ---------- */
    function wrapSaveDataToFile() {
        var fn = window.saveDataToFile;
        if (typeof fn !== 'function' || fn.__planGuardWrapped) return;

        var wrapped = function () {
            try { ensurePlanData(); } catch (e) {
                if (window.console && console.warn) console.warn('[7-events fix] ensurePlanData before save error', e);
            }
            return fn.apply(this, arguments);
        };
        wrapped.__planGuardWrapped = true;
        window.saveDataToFile = wrapped;
    }

    /* ---------- 全视图重渲染（幂等 + try/catch） ---------- */
    function renderAll() {
        var names = [
            'applyPanelLayout',
            'renderCalendar',
            'renderYearHeatmap',
            'renderWeekBoard',
            'renderDayPlan',
            'renderTaskPool',
            'renderExercisePool',
            'renderFixedBlockPool',
            'updateFixedProgressBars',
            'renderTimeSlotConfig',
            'renderEnergyAndRPG'
        ];
        for (var i = 0; i < names.length; i++) {
            try {
                if (typeof window[names[i]] === 'function') window[names[i]]();
            } catch (e) {
                if (window.console && console.warn) {
                    console.warn('[7-events fix] ' + names[i] + ' error', e);
                }
            }
        }
    }

    var renderTimer = null;
    function scheduleRender() {
        if (renderTimer) clearTimeout(renderTimer);
        renderTimer = setTimeout(function () {
            renderTimer = null;
            /* 重渲染前先补全一次计划数据，避免渲染函数读到空结构 */
            try { ensurePlanData(); } catch (e) {}
            renderAll();
        }, 80);
    }

    /* ---------- 设置变更监听（与原有监听并存） ---------- */
    document.addEventListener('input', function (e) {
        var el = e.target;
        if (!el || !el.getAttribute) return;
        if (!el.getAttribute('data-setting')) return;
        scheduleRender();
    }, true);

    document.addEventListener('change', function (e) {
        var el = e.target;
        if (!el || !el.getAttribute) return;
        if (!el.getAttribute('data-setting')) return;
        scheduleRender();
    }, true);

    document.addEventListener('click', function (e) {
        var el = e.target;
        if (!el || !el.closest) return;
        var btn = el.closest('[data-setting][data-value]');
        if (!btn) return;
        scheduleRender();
    }, true);

    /* ---------- 启动：抓基线 + 补全 ---------- */
    function bootstrap() {
        try {
            wrapSaveDataToFile();
            ensurePlanData();
            captureBaseline();
        } catch (e) {
            if (window.console && console.warn) console.warn('[7-events fix] bootstrap error', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    } else {
        bootstrap();
    }
    setTimeout(bootstrap, 0);
    setTimeout(bootstrap, 200);
    setTimeout(bootstrap, 600);
    setTimeout(bootstrap, 1500);

    /* 暴露给调试 / 其它脚本调用 */
    window.ensureSettingsPlanData = ensurePlanData;
    window.captureSettingsPlanBaseline = captureBaseline;
})();
/* ===== FIX-INJECT-END: events-plan-guard ===== */
