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

/* ===== FIX-INJECT-BEGIN: utils-safe ===== */
/* ------------------------------------------------------------------
 * 修复注入：日期 / 任务数据工具函数安全化
 * 背景：
 *   1) formatDate(y, m, d) 若收到 undefined / NaN 会生成 "NaN-NaN-NaN"，
 *      被 getDateLabel / getPrevRecurringDate 等使用后导致视图标题与
 *      循环判断异常；
 *   2) getTasksForDate() 内部直接 appData.tasks.filter(...)，
 *      一旦 appData.tasks 不是数组（被存储损坏、被错误赋值），
 *      渲染函数调用此函数立即抛错，日历 / 周板 / 年历全部空白 ——
 *      这就是「周/月/全年计划视图空白」的直接触发点；
 *   3) isTaskDone / getTaskCurrent 等若遇到 task 非对象或
 *      task.completions / task.currents 被污染，同样会抛错中断渲染。
 * 方案：
 *   - 保留原函数体不变，仅在其外层加输入校验 + try/catch；
 *   - 数据异常时返回安全的默认值（false / 0 / [] / null），
 *     让渲染流程得以继续，不因单条异常数据而整体崩溃；
 *   - 安装标记 window.__utilsSafeFixInstalled 防止重复包装形成递归。
 * 影响面：
 *   - 只影响上述函数的行为边界；
 *   - 正常路径完全走原实现，性能几乎无影响。
 * ------------------------------------------------------------------ */
(function installUtilsSafeFix() {
    if (window.__utilsSafeFixInstalled) return;
    window.__utilsSafeFixInstalled = true;

    /* ---------- 捕获原始实现（此时原函数已由文件主体定义好） ---------- */
    var _orig = {
        formatDate:           typeof formatDate           === 'function' ? formatDate           : null,
        getTodayString:       typeof getTodayString       === 'function' ? getTodayString       : null,
        getDateLabel:         typeof getDateLabel         === 'function' ? getDateLabel         : null,
        isRecurringMatch:     typeof isRecurringMatch     === 'function' ? isRecurringMatch     : null,
        getPrevRecurringDate: typeof getPrevRecurringDate === 'function' ? getPrevRecurringDate : null,
        getTasksForDate:      typeof getTasksForDate      === 'function' ? getTasksForDate      : null,
        isTaskDone:           typeof isTaskDone           === 'function' ? isTaskDone           : null,
        setTaskDone:          typeof setTaskDone          === 'function' ? setTaskDone          : null,
        getTaskCurrent:       typeof getTaskCurrent       === 'function' ? getTaskCurrent       : null,
        setTaskCurrent:       typeof setTaskCurrent       === 'function' ? setTaskCurrent       : null,
        isSubTaskDone:        typeof isSubTaskDone        === 'function' ? isSubTaskDone        : null,
        setSubTaskDone:       typeof setSubTaskDone       === 'function' ? setSubTaskDone       : null,
        getSubCurrent:        typeof getSubCurrent        === 'function' ? getSubCurrent        : null,
        setSubCurrent:        typeof setSubCurrent        === 'function' ? setSubCurrent        : null
    };

    /* ---------- 通用工具 ---------- */
    function todayParts() {
        var d = new Date();
        return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
    }
    function pad2(n) {
        n = Math.floor(Number(n));
        if (!isFinite(n) || n < 0) n = 0;
        return n < 10 ? '0' + n : String(n);
    }
    function isValidDateStr(s) {
        if (typeof s !== 'string') return false;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
        var d = new Date(s + 'T00:00:00');
        return !isNaN(d.getTime());
    }
    function safeTodayStr() {
        try {
            if (_orig.getTodayString) {
                var r = _orig.getTodayString();
                if (isValidDateStr(r)) return r;
            }
        } catch (e) {}
        var t = todayParts();
        return t.y + '-' + pad2(t.m + 1) + '-' + pad2(t.d);
    }
    function ensureTasksArray() {
        if (typeof appData !== 'undefined' && appData) {
            if (!Array.isArray(appData.tasks)) {
                appData.tasks = [];
            }
        }
    }
    function warn(name, e) {
        if (window.console && console.warn) {
            console.warn('[2-utils fix] ' + name + ' error', e);
        }
    }

    /* ---------- 1) formatDate：输入校验 + 月份越界修正 ---------- */
    window.formatDate = function (y, m, d) {
        if (typeof y !== 'number' || !isFinite(y)) { y = todayParts().y; }
        if (typeof m !== 'number' || !isFinite(m)) { m = 0; }
        if (typeof d !== 'number' || !isFinite(d)) { d = 1; }
        y = Math.floor(y);
        m = Math.floor(m);
        d = Math.floor(d);
        while (m < 0)  { m += 12; y -= 1; }
        while (m > 11) { m -= 12; y += 1; }
        if (d < 1)  d = 1;
        if (d > 31) d = 31;
        try {
            if (_orig.formatDate) {
                var r = _orig.formatDate(y, m, d);
                if (typeof r === 'string' && r.indexOf('NaN') === -1) return r;
            }
        } catch (e) { warn('formatDate', e); }
        return y + '-' + pad2(m + 1) + '-' + pad2(d);
    };

    /* ---------- 2) getTodayString：始终返回合法日期字符串 ---------- */
    window.getTodayString = function () {
        try {
            if (_orig.getTodayString) {
                var r = _orig.getTodayString();
                if (isValidDateStr(r)) return r;
            }
        } catch (e) { warn('getTodayString', e); }
        return safeTodayStr();
    };

    /* ---------- 3) getDateLabel：无效 dateStr 自动回退到今天 ---------- */
    window.getDateLabel = function (dateStr) {
        if (!isValidDateStr(dateStr)) dateStr = safeTodayStr();
        try {
            if (_orig.getDateLabel) {
                var r = _orig.getDateLabel(dateStr);
                if (typeof r === 'string' && r.length > 0) return r;
            }
        } catch (e) { warn('getDateLabel', e); }
        return dateStr;
    };

    /* ---------- 4) isRecurringMatch：无效日期返回 false ---------- */
    window.isRecurringMatch = function (type, startDateStr, targetDateStr) {
        if (!type) return false;
        var startStr = startDateStr;
        var targetStr = targetDateStr;
        if (!targetStr) {
            targetStr = startDateStr;
            startStr = safeTodayStr();
        }
        if (!isValidDateStr(startStr) || !isValidDateStr(targetStr)) return false;
        try {
            if (_orig.isRecurringMatch) {
                return !!_orig.isRecurringMatch(type, startStr, targetStr);
            }
        } catch (e) { warn('isRecurringMatch', e); }
        return false;
    };

    /* ---------- 5) getPrevRecurringDate：无效 dateStr 返回 null ---------- */
    window.getPrevRecurringDate = function (type, dateStr) {
        if (!isValidDateStr(dateStr)) return null;
        try {
            if (_orig.getPrevRecurringDate) {
                var r = _orig.getPrevRecurringDate(type, dateStr);
                if (r === null) return null;
                if (typeof r === 'string' && isValidDateStr(r)) return r;
            }
        } catch (e) { warn('getPrevRecurringDate', e); }
        return null;
    };

    /* ---------- 6) getTasksForDate：核心兜底，永远返回数组 ---------- */
    window.getTasksForDate = function (dateStr, options) {
        try {
            ensureTasksArray();
            if (!isValidDateStr(dateStr)) dateStr = safeTodayStr();
            if (_orig.getTasksForDate) {
                var result = _orig.getTasksForDate(dateStr, options || {});
                if (Array.isArray(result)) {
                    /* 过滤掉非对象项，避免后续渲染读到 undefined 崩溃 */
                    return result.filter(function (t) { return t && typeof t === 'object'; });
                }
            }
        } catch (e) {
            warn('getTasksForDate', e);
        }
        return [];
    };

    /* ---------- 7) isTaskDone ---------- */
    window.isTaskDone = function (task, dateStr) {
        if (!task || typeof task !== 'object') return false;
        try {
            if (_orig.isTaskDone) return !!_orig.isTaskDone(task, dateStr);
        } catch (e) { warn('isTaskDone', e); }
        return !!task.completed;
    };

    /* ---------- 8) setTaskDone ---------- */
    window.setTaskDone = function (task, dateStr, val) {
        if (!task || typeof task !== 'object') return;
        if (!task.completions || typeof task.completions !== 'object' || Array.isArray(task.completions)) {
            task.completions = {};
        }
        try {
            if (_orig.setTaskDone) return _orig.setTaskDone(task, dateStr, val);
        } catch (e) { warn('setTaskDone', e); }
        task.completions[dateStr] = !!val;
        if (task.date === dateStr) task.completed = !!val;
    };

    /* ---------- 9) getTaskCurrent / setTaskCurrent ---------- */
    window.getTaskCurrent = function (task, dateStr) {
        if (!task || typeof task !== 'object') return 0;
        try {
            if (_orig.getTaskCurrent) {
                var v = _orig.getTaskCurrent(task, dateStr);
                return (typeof v === 'number' && isFinite(v)) ? v : 0;
            }
        } catch (e) { warn('getTaskCurrent', e); }
        return 0;
    };

    window.setTaskCurrent = function (task, dateStr, val) {
        if (!task || typeof task !== 'object') return;
        if (!task.currents || typeof task.currents !== 'object' || Array.isArray(task.currents)) {
            task.currents = {};
        }
        try {
            if (_orig.setTaskCurrent) return _orig.setTaskCurrent(task, dateStr, val);
        } catch (e) { warn('setTaskCurrent', e); }
        task.currents[dateStr] = val;
        if (task.date === dateStr) task.current = val;
    };

    /* ---------- 10) 子任务四件套 ---------- */
    window.isSubTaskDone = function (sub, dateStr) {
        if (!sub || typeof sub !== 'object') return false;
        try {
            if (_orig.isSubTaskDone) return !!_orig.isSubTaskDone(sub, dateStr);
        } catch (e) { warn('isSubTaskDone', e); }
        return !!sub.completed;
    };

    window.setSubTaskDone = function (sub, dateStr, val) {
        if (!sub || typeof sub !== 'object') return;
        if (!sub.completions || typeof sub.completions !== 'object' || Array.isArray(sub.completions)) {
            sub.completions = {};
        }
        try {
            if (_orig.setSubTaskDone) return _orig.setSubTaskDone(sub, dateStr, val);
        } catch (e) { warn('setSubTaskDone', e); }
        sub.completions[dateStr] = !!val;
        sub.completed = !!val;
    };

    window.getSubCurrent = function (sub, dateStr, parentTask) {
        if (!sub || typeof sub !== 'object') return 0;
        try {
            if (_orig.getSubCurrent) {
                var v = _orig.getSubCurrent(sub, dateStr, parentTask);
                return (typeof v === 'number' && isFinite(v)) ? v : 0;
            }
        } catch (e) { warn('getSubCurrent', e); }
        return 0;
    };

    window.setSubCurrent = function (sub, dateStr, val) {
        if (!sub || typeof sub !== 'object') return;
        if (!sub.currents || typeof sub.currents !== 'object' || Array.isArray(sub.currents)) {
            sub.currents = {};
        }
        try {
            if (_orig.setSubCurrent) return _orig.setSubCurrent(sub, dateStr, val);
        } catch (e) { warn('setSubCurrent', e); }
        sub.currents[dateStr] = val;
        sub.current = val;
    };
})();
/* ===== FIX-INJECT-END: utils-safe ===== */
