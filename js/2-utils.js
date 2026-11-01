function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDate(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function getDateLabel(dateStr) {
    const today = getTodayString();
    const d = new Date(dateStr + 'T00:00:00'), t = new Date(today + 'T00:00:00');
    const diffDays = Math.round((t - d) / (1000 * 60 * 60 * 24));
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const full = `${d.getMonth()+1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
    if (diffDays === 0) return `今天 · ${full}`;
    if (diffDays === 1) return `昨天 · ${full}`;
    if (diffDays === -1) return `明天 · ${full}`;
    if (diffDays === 2) return `前天 · ${full}`;
    if (diffDays === -2) return `后天 · ${full}`;
    if (diffDays > 2 && diffDays <= 7) return `${diffDays}天前 · ${full}`;
    if (diffDays < -2 && diffDays >= -7) return `${-diffDays}天后 · ${full}`;
    if (d.getFullYear() === t.getFullYear()) return full;
    return `${d.getFullYear()}年${full}`;
}
function generatePeerId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = 'ws-';
    for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}
function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, ta.value.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta); return ok;
}
function copyTextToClipboard(text, successMsg) {
    const done = () => { if (successMsg) alert(successMsg); };
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(() => { if (fallbackCopy(text)) done(); else alert('复制失败'); });
        return;
    }
    if (fallbackCopy(text)) done(); else alert('复制失败');
}
function showMiniToast(msg) {
    const el = document.createElement('div');
    el.className = 'mini-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
    }, 1200);
}
function isRecurringMatch(type, startDateStr, targetDateStr) {
    if (!type) return false;
    if (type === '每日') return true;
    let startStr = startDateStr, targetStr = targetDateStr;
    if (!targetStr) { targetStr = startDateStr; startStr = getTodayString(); }
    const start = new Date(startStr), target = new Date(targetStr);
    const diffDays = Math.round(Math.abs(target - start) / (1000 * 60 * 60 * 24));
    if (type === '每周') return diffDays % 7 === 0;
    if (type === '每月') return target.getDate() === start.getDate();
    const m = type.match(/自定义(\d+)天/);
    if (m) return diffDays % parseInt(m[1]) === 0;
    return false;
}
function getPrevRecurringDate(type, dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (type === '每日') d.setDate(d.getDate() - 1);
    else if (type === '每周') d.setDate(d.getDate() - 7);
    else if (type === '每月') d.setMonth(d.getMonth() - 1);
    else { const m = type.match(/自定义(\d+)天/); if (m) d.setDate(d.getDate() - parseInt(m[1])); else return null; }
    return formatDate(d.getFullYear(), d.getMonth(), d.getDate());
}
function getTasksForDate(dateStr, options = {}) {
    const includeDeadlineRange = options.includeDeadlineRange !== false;
    const filteredDirect = appData.tasks.filter(t => {
        if (t.date !== dateStr || t.date === 'pool') return false;
        if (t.type === 'todo') return false;
        if (t.skipDates && t.skipDates[dateStr] && dateStr !== t.deadline) return false;
        return true;
    });
    let deadlineRange = [];
    if (includeDeadlineRange) {
        deadlineRange = appData.tasks.filter(t => {
            if (t.type === 'todo') return false;
            if (!t.deadline || t.recurringType || t.countOnly || t.date === 'pool' || !t.date) return false;
            if (t.date > dateStr || dateStr > t.deadline) return false;
            if (filteredDirect.includes(t)) return false;
            if (t.skipDates && t.skipDates[dateStr] && dateStr !== t.deadline) return false;
            return true;
        });
    }
    const recurring = appData.tasks.filter(t => {
        if (t.type === 'todo') return false;
        if (!t.recurringType || t.date === 'pool' || t.date > dateStr) return false;
        if (t.timeSlot && dateStr !== t.date) return false;
        if (t.deadline && dateStr > t.deadline) return false;
        if (t.recurringEndedDate && dateStr > t.recurringEndedDate) return false;
        if (t.completed && t.date < dateStr && !t.recurringEndedDate) return false;
        if (t.skipDates && t.skipDates[dateStr] && dateStr !== t.deadline) return false;
        if (filteredDirect.includes(t) || deadlineRange.includes(t)) return false;
        return isRecurringMatch(t.recurringType, t.date, dateStr);
    });
    const countOnlyTasks = appData.tasks.filter(t => {
        if (t.type === 'todo') return false;
        if (!t.countOnly || t.countEnded || t.date === 'pool' || !t.date || t.date > dateStr) return false;
        if (t.timeSlot && dateStr !== t.date) return false;
        if (filteredDirect.includes(t)) return false;
        return true;
    });
    return [...filteredDirect, ...deadlineRange, ...recurring, ...countOnlyTasks];
}
function isTaskDone(task, dateStr) {
    if (task.countOnly) return !!task.countEnded;
    if (task.deadline && !task.recurringType && task.date && task.date !== 'pool') {
        if (task.date <= dateStr && dateStr <= task.deadline) return !!task.completed;
    }
    if (task.completions && task.completions[dateStr] !== undefined) return task.completions[dateStr];
    if (task.date === dateStr) return !!task.completed;
    return false;
}
function setTaskDone(task, dateStr, val) {
    if (task.countOnly) { task.countEnded = val; return; }
    if (!task.completions) task.completions = {};
    task.completions[dateStr] = val;
    if (task.date === dateStr) task.completed = val;
    if (task.deadline && !task.recurringType && task.date && task.date !== 'pool') {
        if (task.date <= dateStr && dateStr <= task.deadline) task.completed = val;
    }
}
function getTaskCurrent(task, dateStr) {
    if (task.currents && task.currents[dateStr] !== undefined) return task.currents[dateStr];
    if (task.target && task.recurringType) {
        let checkDateStr = dateStr;
        for (let i = 0; i < 50; i++) {
            const prev = getPrevRecurringDate(task.recurringType, checkDateStr);
            if (!prev || prev < task.date) break;
            if (task.currents && task.currents[prev] !== undefined) {
                const prevVal = task.currents[prev];
                return prevVal < task.target ? prevVal : 0;
            }
            checkDateStr = prev;
        }
        if (task.date <= dateStr && task.current !== undefined) return task.current < task.target ? task.current : 0;
    }
    if (task.date === dateStr) return task.current || 0;
    return 0;
}
function setTaskCurrent(task, dateStr, val) {
    if (!task.currents) task.currents = {};
    task.currents[dateStr] = val;
    if (task.date === dateStr) task.current = val;
}
function isSubTaskDone(sub, dateStr) {
    if (sub.countOnly) return !!sub.countEnded;
    if (sub.completions && sub.completions[dateStr] !== undefined) return sub.completions[dateStr];
    return !!sub.completed;
}
function setSubTaskDone(sub, dateStr, val) {
    if (sub.countOnly) { sub.countEnded = val; return; }
    if (!sub.completions) sub.completions = {};
    sub.completions[dateStr] = val;
    sub.completed = val;
}
function getSubCurrent(sub, dateStr, parentTask) {
    if (sub.currents && sub.currents[dateStr] !== undefined) return sub.currents[dateStr];
    if (sub.target && parentTask && parentTask.recurringType) {
        let checkDateStr = dateStr;
        for (let i = 0; i < 50; i++) {
            const prev = getPrevRecurringDate(parentTask.recurringType, checkDateStr);
            if (!prev || prev < parentTask.date) break;
            if (sub.currents && sub.currents[prev] !== undefined) {
                const prevVal = sub.currents[prev];
                return prevVal < sub.target ? prevVal : 0;
            }
            checkDateStr = prev;
        }
        if (parentTask.date <= dateStr && sub.current !== undefined) return sub.current < sub.target ? sub.current : 0;
    }
    return sub.current || 0;
}
function setSubCurrent(sub, dateStr, val) {
    if (!sub.currents) sub.currents = {};
    sub.currents[dateStr] = val;
    sub.current = val;
}