const DEFAULT_LEVELS = [
    { name: '新手', needExp: 100 }, { name: '学习者', needExp: 1000 }, { name: '学霸', needExp: 10000 },
    { name: '博学者', needExp: 100000 }, { name: '大师', needExp: 1000000 }, { name: '宗师', needExp: 10000000 }, { name: '传说', needExp: 100000000 }
];
const DEFAULT_TIMESLOTS = [
    { id: 'ts1', label: '08:30-09:10' }, { id: 'ts2', label: '09:15-09:55' }, { id: 'ts3', label: '10:10-10:50' },
    { id: 'ts4', label: '10:55-11:35' }, { id: 'ts5', label: '11:35-13:05' }, { id: 'ts6', label: '13:10-13:50' },
    { id: 'ts7', label: '13:55-14:35' }, { id: 'ts8', label: '14:45-15:25' }, { id: 'ts9', label: '15:30-16:10' },
    { id: 'ts10', label: '16:15-16:55' }, { id: 'ts11', label: '18:00-18:40' }, { id: 'ts12', label: '18:45-19:25' },
    { id: 'ts13', label: '19:30-20:10' }
];
const DEFAULT_FIXED_BLOCKS = [
    { id: 'fb_class', name: '上课', energyCost: 20 }, { id: 'fb_meal', name: '吃饭', energyCost: 5 }, { id: 'fb_rest', name: '休息', energyCost: 0 }, { id: 'fb_commute', name: '通勤', energyCost: 10 }
];
const BACKUP_MODULES = {
    tasks:     { name: '核心任务',  fields: ['tasks','dailyLogs','dailyReflections','weeklyReflections','monthlyReflections','yearlyGoals','fixedBlockSchedule'] },
    exercises: { name: '锻炼数据',  fields: ['exercises','exerciseSchedule','exerciseTimeSlotSchedule','dailyExerciseChecks'] },
    rpg:       { name: 'RPG与精力', fields: ['rpg','dailyEnergy','panelLayout'] },
    settings:  { name: '系统设置',  fields: ['themeColor','themeMode','fonts','radius','energyMax','energyWarnThreshold','expRatio','napEnergy','breakEnergy','levelConfig','commonBtns','timeSlots','timeSlotsLastModified','fixedBlocks','maxVisible','animationEnabled'] },
    methods:   { name: '学习方法',  fields: ['methodsFiles','learningMethods','learningMethodsHtml','activeMethodsFileId','activeMethodsFileId2','splitScreenMode'] }
};
let appData = {
    tasks: [],
    exercises: [
        { id: 'ex_chest', name: '胸部', subTasks: [], recurringType: '', energyCost: 15 },
        { id: 'ex_back', name: '背部', subTasks: [], recurringType: '', energyCost: 15 },
        { id: 'ex_legs', name: '腿部', subTasks: [], recurringType: '', energyCost: 15 },
        { id: 'ex_cardio', name: '有氧', subTasks: [], recurringType: '', energyCost: 15 }
    ],
    exerciseSchedule: {}, dailyExerciseChecks: {}, dailyReflections: {}, dailyLogs: {},
    weeklyReflections: {}, monthlyReflections: {}, exerciseTimeSlotSchedule: {},
    selectedDate: getTodayString(), yearlyGoals: "",
    learningMethods: "", learningMethodsHtml: "", methodsCollapsed: false,
    methodsFiles: [], activeMethodsFileId: null, activeMethodsFileId2: null, splitScreenMode: false,
    themeColor: "#2383e2", themeMode: "light",
    fonts: { title: "18px", content: "14px", hint: "12px", small: "10px" },
    radius: "8px",
    viewYear: new Date().getFullYear(), viewMonth: new Date().getMonth(), viewWeekBaseDate: getTodayString(),
    _lastModified: 1, energyMax: 200, energyWarnThreshold: 30, expRatio: 0.6, dailyEnergy: {},
    napEnergy: 50, breakEnergy: 20,
    rpg: { exp: 0, int: 0, vit: 0, cre: 0, foc: 0, wil: 0, streak: 0, lastDate: '' },
    panelLayout: { order: ['todo', 'learning', 'other', 'exercise'], spans: {}, sizes: {} },
    levelConfig: { levels: JSON.parse(JSON.stringify(DEFAULT_LEVELS)) },
    commonBtns: ['skip', 'target', 'loop', 'deadline', 'delete'],
    timeSlots: JSON.parse(JSON.stringify(DEFAULT_TIMESLOTS)),
    timeSlotsLastModified: 0,
    fixedBlocks: JSON.parse(JSON.stringify(DEFAULT_FIXED_BLOCKS)),
    fixedBlockSchedule: {}, maxVisible: 5, animationEnabled: true
};
let peer = null, conn = null;
let isSyncing = false, isAutoReconnecting = false, isConnecting = false;
let connectTimer = null;
let currentTargetPeer = null, handshakeDone = false;
const p2pIndicator = document.getElementById('p2p-indicator');
const isMobileDevice = window.innerWidth <= 768;
let lastSavedSignature = '';
let resizeObserver = null;
let currentTaskModalCategory = null;
let currentDetailTaskId = null;
let lastRpgState = null;
let userPickedDate = false;
const expandedSubTasks = new Set();
const expandedMethodFolders = new Set();
let isDraggingActive = false;
const CLIENT_ID = Math.random().toString(36).substring(2, 11);
let syncStatus = 'offline';
let locks = {};
let conflictQueue = [];
let lastSyncedTasks = [];
let lastSyncedExercises = [];
let lastSyncedMethods = [];
let lastSyncedSettings = {};
let lastSyncedTimeSlots = { timeSlots: [], mod: 0 };
let lastSyncedDailyChecks = {};
let lastSyncedExerciseSchedule = {};
let lastSyncedExerciseTimeSlotSchedule = {};
let lastSyncedReflections = {};
let lastSyncedRpg = {};
let lastSyncedEnergy = {};
let _opDebounceTimer = null;
let _mainLoopInterval = null;
let _pendingImportData = null;
let _backupTimerRegistry = [];
function _registerBackupTimer(id) { _backupTimerRegistry.push(id); return id; }
function _clearBackupTimers() { _backupTimerRegistry.forEach(id => { clearInterval(id); clearTimeout(id); }); _backupTimerRegistry = []; }
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
function ensureEnergyData() {
    if (!appData.tasks) appData.tasks = [];
    if (!appData.exercises) appData.exercises = [];
    if (!appData.exerciseSchedule) appData.exerciseSchedule = {};
    if (!appData.exerciseTimeSlotSchedule) appData.exerciseTimeSlotSchedule = {};
    if (!appData.dailyExerciseChecks) appData.dailyExerciseChecks = {};
    if (!appData.dailyReflections) appData.dailyReflections = {};
    if (!appData.weeklyReflections) appData.weeklyReflections = {};
    if (!appData.monthlyReflections) appData.monthlyReflections = {};
    if (!appData.dailyLogs) appData.dailyLogs = {};
    if (!appData.dailyEnergy) appData.dailyEnergy = {};
    if (!appData.fixedBlockSchedule) appData.fixedBlockSchedule = {};
    if (appData.energyMax === undefined || appData.energyMax === null || isNaN(Number(appData.energyMax))) appData.energyMax = 200;
    if (appData.energyWarnThreshold === undefined || appData.energyWarnThreshold === null) appData.energyWarnThreshold = 30;
    if (appData.expRatio === undefined || appData.expRatio === null) appData.expRatio = 0.6;
    if (appData.napEnergy === undefined || appData.napEnergy === null) appData.napEnergy = 50;
    if (appData.breakEnergy === undefined || appData.breakEnergy === null) appData.breakEnergy = 20;
    const def = { exp: 0, int: 0, vit: 0, cre: 0, foc: 0, wil: 0, streak: 0, lastDate: '' };
    if (!appData.rpg) appData.rpg = { ...def };
    else Object.keys(def).forEach(k => { if (appData.rpg[k] === undefined) appData.rpg[k] = def[k]; });
    if (!appData.panelLayout) appData.panelLayout = { order: ['todo', 'learning', 'other', 'exercise'], spans: {}, sizes: {} };
    if (!appData.panelLayout.order) appData.panelLayout.order = ['todo', 'learning', 'other', 'exercise'];
    if (!appData.panelLayout.order.includes('todo')) appData.panelLayout.order.unshift('todo');
    if (!appData.panelLayout.spans) appData.panelLayout.spans = {};
    if (!appData.panelLayout.sizes) appData.panelLayout.sizes = {};
    if (!appData.levelConfig || !Array.isArray(appData.levelConfig.levels) || appData.levelConfig.levels.length === 0)
        appData.levelConfig = { levels: JSON.parse(JSON.stringify(DEFAULT_LEVELS)) };
    appData.levelConfig.levels.forEach(lv => {
        if (typeof lv.name !== 'string' || !lv.name) lv.name = '等级';
        if (typeof lv.needExp !== 'number' || lv.needExp < 1) lv.needExp = 100;
    });
    if (!appData.radius) appData.radius = "8px";
    if (!appData.commonBtns) appData.commonBtns = ['skip', 'target', 'loop', 'deadline', 'delete'];
    if (!appData.fonts) appData.fonts = { title: "18px", content: "14px", hint: "12px", small: "10px" };
    if (!appData.timeSlots) appData.timeSlots = JSON.parse(JSON.stringify(DEFAULT_TIMESLOTS));
    if (appData.timeSlotsLastModified === undefined) appData.timeSlotsLastModified = 0;
    if (!Array.isArray(appData.fixedBlocks)) appData.fixedBlocks = JSON.parse(JSON.stringify(DEFAULT_FIXED_BLOCKS));
    appData.fixedBlocks.forEach(fb => {
        if (fb.energyCost === undefined) {
            if (fb.name.includes('上课')) fb.energyCost = 20;
            else if (fb.name.includes('通勤')) fb.energyCost = 10;
            else if (fb.name.includes('吃饭')) fb.energyCost = 5;
            else if (fb.name.includes('休息')) fb.energyCost = 0;
            else fb.energyCost = 0;
        }
    });
    if (appData.maxVisible === undefined) appData.maxVisible = 5;
    if (appData.animationEnabled === undefined) appData.animationEnabled = true;
    if (appData.learningMethods === undefined) appData.learningMethods = "";
    if (appData.learningMethodsHtml === undefined) appData.learningMethodsHtml = "";
    if (appData.methodsCollapsed === undefined) appData.methodsCollapsed = false;
    if (appData.splitScreenMode === undefined) appData.splitScreenMode = false;
    if (!Array.isArray(appData.methodsFiles) || appData.methodsFiles.length === 0) {
        const oldHtml = appData.learningMethodsHtml || '';
        const oldText = appData.learningMethods || '';
        appData.methodsFiles = [{ id: 'file_default', name: '我的学习方法', type: 'file', parentId: null, contentHtml: oldHtml, contentText: oldText, updatedAt: (oldHtml || oldText) ? Date.now() : 0 }];
    }
    appData.methodsFiles.forEach(f => {
        if (!f.id) f.id = 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        if (typeof f.name !== 'string' || !f.name) f.name = '未命名文件';
        if (!f.type) f.type = 'file';
        if (f.type === 'file') {
            if (f.contentHtml === undefined) f.contentHtml = '';
            if (f.contentText === undefined) f.contentText = '';
            if (f.updatedAt === undefined) f.updatedAt = 0;
        }
    });
    if (!appData.activeMethodsFileId || !appData.methodsFiles.find(f => f.id === appData.activeMethodsFileId)) {
        const firstFile = appData.methodsFiles.find(f => f.type === 'file') || appData.methodsFiles[0];
        appData.activeMethodsFileId = firstFile ? firstFile.id : null;
    }
    if (!appData.activeMethodsFileId2 || !appData.methodsFiles.find(f => f.id === appData.activeMethodsFileId2)) {
        const secondFile = appData.methodsFiles.filter(f => f.type === 'file')[1] || appData.methodsFiles.find(f => f.type === 'file') || appData.methodsFiles[0];
        appData.activeMethodsFileId2 = secondFile ? secondFile.id : null;
    }
    appData.tasks.forEach(t => {
        if (!t.countOnly && (t.type === 'learning' || t.type === 'other') && t.date === 'pool') {
            t.todoKind = t.type; t.type = 'todo';
            delete t.timeSlot; if (t.timeSlots) t.timeSlots = [];
            t.completed = false; if (t.completions) delete t.completions;
            if (t.recurringEndedDate) delete t.recurringEndedDate;
            if (t.subTasks) t.subTasks.forEach(s => { s.completed = false; if (s.completions) delete s.completions; });
        }
        if (t.type === 'todo' && !t.todoKind) t.todoKind = 'learning';
    });
}
function logTaskAction(dateStr, taskId, taskName, actionType, delta = 0) {
    ensureEnergyData();
    if (!appData.dailyLogs[dateStr]) appData.dailyLogs[dateStr] = {};
    if (!appData.dailyLogs[dateStr][taskId]) appData.dailyLogs[dateStr][taskId] = { name: taskName, delta: 0, completed: 0 };
    const log = appData.dailyLogs[dateStr][taskId];
    log.name = taskName;
    if (actionType === 'count') log.delta += delta;
    else if (actionType === 'complete') log.completed = 1;
    else if (actionType === 'uncomplete') log.completed = 0;
}
function getDateEnergySpent(dateStr) {
    ensureEnergyData();
    let total = appData.dailyEnergy[dateStr] || 0;
    const fbSched = appData.fixedBlockSchedule[dateStr] || {};
    Object.values(fbSched).forEach(arr => {
        arr.forEach(fbi => {
            const template = appData.fixedBlocks.find(b => b.id === fbi.blockId);
            if (template) total += (template.energyCost || 0);
        });
    });
    appData.tasks.forEach(t => {
        if (t.date === dateStr && t.timeSlot && !isTaskDone(t, dateStr)) total += (t.energyCost || 10);
    });
    return total;
}
function getTodayEnergySpent() { return getDateEnergySpent(getTodayString()); }
function getTodayEnergyRemaining() { ensureEnergyData(); return Math.max(-20, appData.energyMax - getTodayEnergySpent()); }
function adjustTodayEnergy(delta) {
    ensureEnergyData();
    const today = getTodayString();
    appData.dailyEnergy[today] = (appData.dailyEnergy[today] || 0) + delta;
}
function adjustExp(delta) {
    ensureEnergyData();
    let finalDelta = delta;
    if (delta > 0) {
        const remain = getTodayEnergyRemaining();
        if (remain <= -20) finalDelta = 1;
        else if (remain < (appData.energyWarnThreshold || 30)) finalDelta = Math.max(1, Math.floor(delta * 0.5 * appData.expRatio));
        else finalDelta = Math.max(1, Math.floor(delta * appData.expRatio));
    } else if (delta < 0) finalDelta = Math.floor(delta * appData.expRatio);
    appData.rpg.exp = Math.max(0, appData.rpg.exp + finalDelta);
    return finalDelta;
}
function adjustAttr(type, sign) {
    ensureEnergyData();
    const r = appData.rpg;
    if (type === 'learning') r.int = Math.max(0, r.int + sign);
    else if (type === 'other') r.cre = Math.max(0, r.cre + sign);
    else if (type === 'exercise') r.vit = Math.max(0, r.vit + sign);
    else if (type === 'focus') r.foc = Math.max(0, r.foc + sign);
}
function updateStreak() {
    ensureEnergyData();
    const today = getTodayString(), r = appData.rpg;
    if (r.lastDate !== today) {
        const d = new Date(); d.setDate(d.getDate() - 1);
        const y = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        r.streak = (r.lastDate === y) ? r.streak + 1 : 1;
        r.lastDate = today;
    }
    r.wil = r.streak;
}
function getLevelInfo(totalExp) {
    ensureEnergyData();
    const levels = appData.levelConfig.levels;
    const last = levels[levels.length - 1];
    let level = 1, remaining = totalExp;
    while (true) {
        const need = (levels[level - 1] && levels[level - 1].needExp) || (last && last.needExp) || 100;
        if (remaining < need) break;
        remaining -= need; level++;
        if (level > 999) { level = 999; break; }
    }
    const needed = (levels[level - 1] && levels[level - 1].needExp) || (last && last.needExp) || 100;
    return { level, expInLevel: remaining, needed };
}
function getLevelTitle(level) {
    ensureEnergyData();
    const levels = appData.levelConfig.levels;
    return (levels[level - 1] && levels[level - 1].name) || (levels[levels.length - 1] && levels[levels.length - 1].name) || '新手';
}
function showRpgFloat(anchorEl, text, color) {
    if (!anchorEl || anchorEl.offsetParent === null) return;
    const rect = anchorEl.getBoundingClientRect();
    const float = document.createElement('div');
    float.style.cssText = `position:fixed;left:${rect.left + rect.width/2}px;top:${rect.top}px;color:${color};font-weight:800;font-size:15px;pointer-events:none;z-index:9999;animation:rpgFloatUp 1.2s cubic-bezier(.2,.9,.3,1) forwards;text-shadow:0 1px 3px rgba(255,255,255,.95);`;
    float.textContent = text;
    document.body.appendChild(float);
    setTimeout(() => { if (float.parentNode) float.parentNode.removeChild(float); }, 1200);
}
function flashElement(el, cls, ms) { if (!el) return; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms || 600); }
function renderEnergyAndRPG() {
    ensureEnergyData();
    const max = appData.energyMax, spent = getTodayEnergySpent();
    const remaining = Math.max(-20, max - spent);
    const pct = max > 0 ? Math.max(0, Math.min(100, (remaining / max) * 100)) : 0;
    const low = remaining < (appData.energyWarnThreshold || 30);
    const critical = remaining <= -20;
    const energyColor = critical ? '#ff0000' : (remaining < 0 ? '#ff4d4d' : (remaining / max > 0.6 ? '#27ae60' : (remaining / max > 0.3 ? '#f2994a' : '#eb5757')));
    const eText = document.getElementById('energy-text'), eFill = document.getElementById('energy-fill');
    if (eText) { eText.innerText = `${remaining} / ${max}`; eText.style.color = critical ? '#ff0000' : (low ? 'var(--danger-color)' : (document.body.classList.contains('dark-mode') ? '#fbbf24' : '#b45309')); }
    if (eFill) { eFill.style.width = pct + '%'; eFill.style.background = energyColor; }
    const warn = document.getElementById('energy-warn');
    if (warn) {
        if (critical) { warn.style.display = 'block'; warn.innerText = '🚨 精力耗尽（-20），请立刻休息！获得的经验降为1。'; warn.style.background = '#ff0000'; warn.style.color = '#fff'; }
        else if (low) { warn.style.display = 'block'; warn.innerText = '⚠️ 精力过低，注意休息！'; warn.style.background = ''; warn.style.color = ''; }
        else warn.style.display = 'none';
    }
    const mText = document.getElementById('modal-energy-text'), mFill = document.getElementById('modal-energy-fill'), mWarn = document.getElementById('modal-energy-warn');
    if (mText) { mText.innerText = `${remaining} / ${max}`; mText.style.color = critical ? '#ff0000' : (low ? 'var(--danger-color)' : (document.body.classList.contains('dark-mode') ? '#fbbf24' : '#b45309')); }
    if (mFill) { mFill.style.width = pct + '%'; mFill.style.background = energyColor; }
    if (mWarn) {
        if (critical) { mWarn.style.display = 'block'; mWarn.innerText = '🚨 精力耗尽（-20），请立刻休息！获得的经验降为1。'; mWarn.style.background = '#ff0000'; mWarn.style.color = '#fff'; }
        else if (low) { mWarn.style.display = 'block'; mWarn.innerText = '⚠️ 精力过低，注意休息！'; mWarn.style.background = ''; mWarn.style.color = ''; }
        else mWarn.style.display = 'none';
    }
    const rpgCard = document.getElementById('rpg-card'), modalEnergyPanel = document.getElementById('rpg-modal-energy-panel');
    [rpgCard, modalEnergyPanel].forEach(el => { if (el) el.classList.toggle('rpg-critical', critical); });
    const rpg = appData.rpg;
    const { level, expInLevel, needed } = getLevelInfo(rpg.exp);
    const title = getLevelTitle(level);
    const setT = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setT('rpg-level', 'Lv.' + level); setT('rpg-title', title); setT('rpg-exp-text', `${expInLevel} / ${needed} EXP`);
    ['int','vit','cre','foc','wil'].forEach(k => setT('rpg-' + k, rpg[k]));
    const expFill = document.getElementById('rpg-exp-fill');
    if (expFill) expFill.style.width = ((expInLevel / needed) * 100) + '%';
    const mLv = document.getElementById('mobile-rpg-lv'), mEn = document.getElementById('mobile-rpg-energy');
    if (mLv) mLv.innerText = 'Lv.' + level;
    if (mEn) { mEn.innerText = '⚡' + remaining; mEn.style.color = critical ? '#ff0000' : (low ? 'var(--danger-color)' : (document.body.classList.contains('dark-mode') ? '#fbbf24' : '#b45309')); }
    const maxV = document.getElementById('energy-max-val'), warnV = document.getElementById('energy-warn-val'), expRV = document.getElementById('exp-ratio-val');
    if (maxV) maxV.innerText = max;
    if (warnV) warnV.innerText = appData.energyWarnThreshold;
    if (expRV) expRV.innerText = Math.round(appData.expRatio * 100);
    const maxS = document.getElementById('energy-max-slider'); if (maxS) maxS.value = max;
    const warnS = document.getElementById('energy-warn-slider'); if (warnS) warnS.value = appData.energyWarnThreshold;
    const expRS = document.getElementById('exp-ratio-slider'); if (expRS) expRS.value = Math.round(appData.expRatio * 100);
    const setNapV = document.getElementById('set-nap-energy'); if (setNapV) setNapV.value = appData.napEnergy;
    const setBreakV = document.getElementById('set-break-energy'); if (setBreakV) setBreakV.value = appData.breakEnergy;
    const btnNap = document.getElementById('btn-nap'); if (btnNap) btnNap.innerText = `😴+${appData.napEnergy}`;
    const btnBreak = document.getElementById('btn-break'); if (btnBreak) btnBreak.innerText = `☕+${appData.breakEnergy}`;
    const mBtnNap = document.getElementById('modal-btn-nap'); if (mBtnNap) mBtnNap.innerText = `😴+${appData.napEnergy}`;
    const mBtnBreak = document.getElementById('modal-btn-break'); if (mBtnBreak) mBtnBreak.innerText = `☕+${appData.breakEnergy}`;
    const editMap = { 'rpg-edit-exp': rpg.exp, 'rpg-edit-int': rpg.int, 'rpg-edit-vit': rpg.vit, 'rpg-edit-cre': rpg.cre, 'rpg-edit-foc': rpg.foc, 'rpg-edit-wil': rpg.wil };
    Object.keys(editMap).forEach(id => { const el = document.getElementById(id); if (el && document.activeElement !== el) el.value = editMap[id]; });
    if (appData.commonBtns) document.querySelectorAll('#common-btns-config input[type="checkbox"]').forEach(cb => { cb.checked = appData.commonBtns.includes(cb.value); });
    if (appData.fonts) ['title','content','hint','small'].forEach(k => {
        const valEl = document.getElementById(`font-${k}-val`), sliderEl = document.getElementById(`font-${k}-slider`);
        if (valEl) valEl.innerText = parseInt(appData.fonts[k]);
        if (sliderEl) sliderEl.value = parseInt(appData.fonts[k]);
    });
    const mVisV = document.getElementById('max-visible-val'), mVisS = document.getElementById('max-visible-slider');
    if (mVisV) mVisV.innerText = appData.maxVisible;
    if (mVisS) mVisS.value = appData.maxVisible;
    const animT = document.getElementById('animation-toggle');
    if (animT) animT.checked = appData.animationEnabled;
    const cur = { exp: rpg.exp, int: rpg.int, vit: rpg.vit, cre: rpg.cre, foc: rpg.foc, wil: rpg.wil, level: level };
    if (lastRpgState) {
        if (cur.exp !== lastRpgState.exp) {
            const delta = cur.exp - lastRpgState.exp;
            const expText = document.getElementById('rpg-exp-text');
            if (delta > 0) {
                flashElement(document.getElementById('rpg-exp-bar-wrap'), 'flash', 700);
                if (expText) { flashElement(expText, 'rpg-value-pop'); showRpgFloat(expText, '+' + delta + ' EXP', '#27ae60'); }
            } else if (expText) showRpgFloat(expText, delta + ' EXP', 'var(--danger-color)');
        }
        if (cur.level !== lastRpgState.level) {
            const lvEl = document.getElementById('rpg-level'), modalLv = document.getElementById('rpg-modal-level');
            if (lvEl) { flashElement(lvEl, 'rpg-value-pop', 900); showRpgFloat(lvEl, '🎉 升级！Lv.' + cur.level, '#f59e0b'); }
            if (modalLv) flashElement(modalLv, 'rpg-value-pop', 900);
            if (cur.level > lastRpgState.level) {
                const upLevel = cur.level;
                setTimeout(() => window.showLevelUpModal(upLevel, getLevelTitle(upLevel), expInLevel, needed), 400);
            }
        }
        ['int','vit','cre','foc','wil'].forEach(k => {
            if (cur[k] !== lastRpgState[k]) {
                const delta = cur[k] - lastRpgState[k];
                const el = document.getElementById('rpg-' + k);
                if (el) { flashElement(el, 'rpg-value-pop'); showRpgFloat(el, (delta > 0 ? '+' : '') + delta, delta > 0 ? '#27ae60' : 'var(--danger-color)'); }
            }
        });
    }
    lastRpgState = cur;
    if (document.getElementById('rpg-modal').classList.contains('active')) {
        document.getElementById('rpg-modal-level').innerText = 'Lv.' + level;
        document.getElementById('rpg-modal-title').innerText = title;
        document.getElementById('rpg-modal-exp').innerText = `${expInLevel} / ${needed} EXP`;
        const attrs = [
            { name: '📚 智力', value: rpg.int, desc: '完成学习任务 +1' },
            { name: '💪 体力', value: rpg.vit, desc: '完成锻炼任务 +1' },
            { name: '🎨 创造力', value: rpg.cre, desc: '完成其他任务 +1' },
            { name: '🎯 专注', value: rpg.foc, desc: '完成带次数目标的任务 +1' },
            { name: '🔥 毅力', value: rpg.wil, desc: '连续打卡天数' }
        ];
        document.getElementById('rpg-modal-grid').innerHTML = attrs.map(a => `<div class="rpg-attr-card"><div class="attr-row"><span class="attr-name">${a.name}</span><span class="attr-value">${a.value}</span></div><div class="attr-desc">${a.desc}</div></div>`).join('');
    }
}
window.showLevelUpModal = function(level, title, expInLevel, needed) {
    const overlay = document.getElementById('levelup-overlay');
    if (!overlay) return;
    document.getElementById('levelup-level-num').textContent = level;
    document.getElementById('levelup-title-name').textContent = title;
    document.getElementById('levelup-exp').textContent = `${expInLevel} / ${needed} EXP`;
    const confetti = document.getElementById('levelup-confetti');
    confetti.innerHTML = '';
    const colors = ['#fbbf24', '#f59e0b', '#27ae60', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#06b6d4'];
    for (let i = 0; i < 50; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        p.style.left = Math.random() * 100 + '%';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.animationDelay = (Math.random() * 0.8) + 's';
        p.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
        p.style.setProperty('--x', (Math.random() * 240 - 120) + 'px');
        p.style.width = (5 + Math.random() * 6) + 'px';
        p.style.height = (10 + Math.random() * 8) + 'px';
        confetti.appendChild(p);
    }
    overlay.classList.add('active');
};
window.closeLevelUpModal = function() {
    document.getElementById('levelup-overlay').classList.remove('active');
    const confetti = document.getElementById('levelup-confetti');
    if (confetti) confetti.innerHTML = '';
};
window.restoreEnergy = function(type) {
    ensureEnergyData();
    const amt = Math.max(0, Number(type === 'nap' ? appData.napEnergy : appData.breakEnergy) || 0);
    if (amt <= 0) return;
    const today = getTodayString();
    const max = appData.energyMax;
    const spentTotal = getDateEnergySpent(today);
    const rawRemain = max - spentTotal;
    const shownRemain = Math.max(-20, rawRemain);
    const targetRemain = Math.min(max, shownRemain + amt);
    if (targetRemain <= shownRemain) { showMiniToast('⚡ 精力已满，无需恢复'); return; }
    const reduce = targetRemain - rawRemain;
    appData.dailyEnergy[today] = (appData.dailyEnergy[today] || 0) - reduce;
    renderEnergyAndRPG();
    saveDataToFile(appData);
    showMiniToast(`⚡ 精力 +${targetRemain - shownRemain}`);
};
window.changeRestoreEnergy = function(type, val) {
    ensureEnergyData();
    const num = parseInt(val);
    if (isNaN(num) || num < 0) return;
    if (type === 'nap') appData.napEnergy = num;
    else appData.breakEnergy = num;
    renderEnergyAndRPG(); saveDataToFile(appData);
};
window.changeEnergyMax = function(val) { ensureEnergyData(); appData.energyMax = parseInt(val) || 200; renderEnergyAndRPG(); saveDataToFile(appData); };
window.changeEnergyWarn = function(val) { ensureEnergyData(); appData.energyWarnThreshold = parseInt(val) || 30; renderEnergyAndRPG(); saveDataToFile(appData); };
window.changeExpRatio = function(val) { ensureEnergyData(); appData.expRatio = parseFloat(val) / 100; renderEnergyAndRPG(); saveDataToFile(appData); };
window.editRPGValue = function(key, val) {
    ensureEnergyData();
    const num = parseInt(val);
    if (isNaN(num) || num < 0) return;
    appData.rpg[key] = num;
    if (key === 'wil') appData.rpg.streak = num;
    renderEnergyAndRPG(); saveDataToFile(appData);
};
window.changeMaxVisible = function(val) {
    ensureEnergyData();
    appData.maxVisible = parseInt(val) || 5;
    document.getElementById('max-visible-val').innerText = appData.maxVisible;
    renderDayPlan(); saveDataToFile(appData);
};
window.changeAnimation = function(val) { ensureEnergyData(); appData.animationEnabled = !!val; saveDataToFile(appData); };
window.setTaskEnergyCost = function(taskId) {
    const task = appData.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.type === 'todo') { showMiniToast('待办清单里的任务不能设置属性，拖入学习/其他后再设置'); return; }
    const cur = task.energyCost || (task.target ? 1 : 10);
    const val = prompt(`设置【${task.text}】精力消耗：`, cur);
    if (val === null) return;
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0) { task.energyCost = num; renderDayPlan(); renderTaskPool(); renderWeekBoard(); saveDataToFile(appData); refreshDetailModalIfOpen(); }
};
window.setSubTaskEnergyCost = function(taskId, subId) {
    const task = appData.tasks.find(t => t.id === taskId);
    if (!task || !task.subTasks) return;
    if (task.type === 'todo') { showMiniToast('待办清单里的任务不能设置属性'); return; }
    const sub = task.subTasks.find(s => s.id === subId);
    if (!sub) return;
    const cur = sub.energyCost || (sub.target ? 1 : 5);
    const val = prompt(`设置【${sub.text}】精力消耗：`, cur);
    if (val === null) return;
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0) { sub.energyCost = num; renderDayPlan(); saveDataToFile(appData); refreshDetailModalIfOpen(); }
};
window.setExerciseEnergyCost = function(exId) {
    const ex = appData.exercises.find(e => e.id === exId);
    if (!ex) return;
    const cur = ex.energyCost || 15;
    const val = prompt(`设置【${ex.name}】完成时消耗的精力：`, cur);
    if (val === null) return;
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0) { ex.energyCost = num; ex._lastModified = Date.now(); renderDayExercises(); saveDataToFile(appData); }
};
window.openRPGModal = function() {
    ensureEnergyData();
    const rpg = appData.rpg;
    const { level, expInLevel, needed } = getLevelInfo(rpg.exp);
    document.getElementById('rpg-modal-level').innerText = 'Lv.' + level;
    document.getElementById('rpg-modal-title').innerText = getLevelTitle(level);
    document.getElementById('rpg-modal-exp').innerText = `${expInLevel} / ${needed} EXP`;
    const attrs = [
        { name: '📚 智力', value: rpg.int, desc: '完成学习任务 +1' },
        { name: '💪 体力', value: rpg.vit, desc: '完成锻炼任务 +1' },
        { name: '🎨 创造力', value: rpg.cre, desc: '完成其他任务 +1' },
        { name: '🎯 专注', value: rpg.foc, desc: '完成带次数目标的任务 +1' },
        { name: '🔥 毅力', value: rpg.wil, desc: '连续打卡天数' }
    ];
    document.getElementById('rpg-modal-grid').innerHTML = attrs.map(a => `<div class="rpg-attr-card"><div class="attr-row"><span class="attr-name">${a.name}</span><span class="attr-value">${a.value}</span></div><div class="attr-desc">${a.desc}</div></div>`).join('');
    renderEnergyAndRPG();
    document.getElementById('rpg-modal').classList.add('active');
};
window.closeRPGModal = function() { document.getElementById('rpg-modal').classList.remove('active'); };
let methodsEditorInitialized = false;
let methodsSavedRange = null;
let methodsSaveTimer = null;
let methodsStatusTimer = null;
let activeEditorId = 'methods-content';
let searchMatches = [];
let searchIndex = -1;
function cleanupMethodsTimers() {
    if (methodsSaveTimer) { clearTimeout(methodsSaveTimer); methodsSaveTimer = null; }
    if (methodsStatusTimer) { clearTimeout(methodsStatusTimer); methodsStatusTimer = null; }
    methodsSavedRange = null;
}
function methodsGetEditor() { return document.getElementById(activeEditorId); }
function methodsSaveSelection() {
    const editor = methodsGetEditor();
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editor.contains(range.startContainer) && editor.contains(range.endContainer)) methodsSavedRange = range.cloneRange();
}
function methodsRestoreSelection() {
    if (!methodsSavedRange) return;
    const editor = methodsGetEditor();
    if (!editor) return;
    const sel = window.getSelection();
    try { sel.removeAllRanges(); sel.addRange(methodsSavedRange); } catch(e) {}
    editor.focus();
}
function methodsApplyFontSize(px) {
    const editor = methodsGetEditor();
    if (!editor) return;
    methodsRestoreSelection();
    try { document.execCommand('fontSize', false, '7'); } catch(e) {}
    editor.querySelectorAll('font[size="7"]').forEach(font => {
        const span = document.createElement('span');
        span.style.fontSize = px + 'px';
        span.innerHTML = font.innerHTML;
        font.parentNode.replaceChild(span, font);
    });
}
function methodsSetStatus(txt, color) {
    const el = document.getElementById('methods-save-status');
    if (!el) return;
    if (txt) el.innerText = txt;
    if (color) el.style.color = color;
    clearTimeout(methodsStatusTimer);
    methodsStatusTimer = setTimeout(() => { if (el) { el.innerText = '💾 自动保存'; el.style.color = ''; } }, 1600);
}
function getCurrentMethodsFile(idStr) {
    if (!Array.isArray(appData.methodsFiles) || appData.methodsFiles.length === 0) return null;
    const targetId = idStr || appData.activeMethodsFileId;
    const f = appData.methodsFiles.find(f => f.id === targetId);
    return (f && f.type === 'file') ? f : appData.methodsFiles.find(f => f.type === 'file');
}
function renderKaTeX(el) {
    if (!el || typeof renderMathInElement === 'undefined') return;
    try {
        renderMathInElement(el, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false, ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"] });
    } catch (e) { console.warn("KaTeX render error", e); }
}
function clearSearchHighlight() {
    document.querySelectorAll('.methods-content').forEach(editor => {
        const marks = editor.querySelectorAll('mark.search-hl');
        marks.forEach(m => {
            const parent = m.parentNode;
            parent.replaceChild(document.createTextNode(m.textContent), m);
            parent.normalize();
        });
        if (editor.innerHTML.trim() === '') editor.innerHTML = '';
    });
    searchMatches = [];
    searchIndex = -1;
    document.getElementById('search-count').innerText = '0/0';
}
function commitMethodsEditorToFile() {
    let changed = false;
    const cleanHTML = (html) => html.replace(/<mark class="search-hl[^"]*">/g, '').replace(/<\/mark>/g, '');
    const editor1 = document.getElementById('methods-content');
    const f1 = getCurrentMethodsFile(appData.activeMethodsFileId);
    if (editor1 && f1) {
        const newHtml = cleanHTML(editor1.innerHTML);
        const newText = editor1.innerText || '';
        if (f1.contentHtml !== newHtml || f1.contentText !== newText) {
            f1.contentHtml = newHtml; f1.contentText = newText; f1.updatedAt = Date.now();
            changed = true;
        }
    }
    if (appData.splitScreenMode) {
        const editor2 = document.getElementById('methods-content-2');
        const f2 = getCurrentMethodsFile(appData.activeMethodsFileId2);
        if (editor2 && f2) {
            const newHtml = cleanHTML(editor2.innerHTML);
            const newText = editor2.innerText || '';
            if (f2.contentHtml !== newHtml || f2.contentText !== newText) {
                f2.contentHtml = newHtml; f2.contentText = newText; f2.updatedAt = Date.now();
                changed = true;
            }
        }
    }
    if (changed) {
        const curFile = getCurrentMethodsFile(appData.activeMethodsFileId);
        appData.learningMethodsHtml = curFile ? curFile.contentHtml || '' : '';
        appData.learningMethods = curFile ? curFile.contentText || '' : '';
    }
    return changed;
}
function methodsTriggerSave() {
    const editor = methodsGetEditor();
    if (!editor) return;
    clearTimeout(methodsSaveTimer);
    methodsSaveTimer = setTimeout(() => {
        if (document.activeElement !== editor) {
            renderKaTeX(editor);
            if (appData.splitScreenMode) renderKaTeX(document.getElementById('methods-content-2'));
        }
        const changed = commitMethodsEditorToFile();
        if (changed) saveDataToFile(appData);
        methodsSetStatus('✅ 已保存', '#2e7d32');
    }, 500);
}
function performSearch() {
    clearSearchHighlight();
    const kw = document.getElementById('methods-search-input').value.trim();
    if (!kw) return;
    let editors = [];
    if (appData.splitScreenMode && document.getElementById('search-both-sides').checked) editors = [document.getElementById('methods-content'), document.getElementById('methods-content-2')];
    else editors = [methodsGetEditor()];
    editors.forEach(editor => {
        if (!editor) return;
        const walk = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
        let node;
        const textNodes = [];
        while(node = walk.nextNode()) textNodes.push(node);
        textNodes.forEach(node => {
            const text = node.nodeValue;
            const lowerText = text.toLowerCase();
            const lowerKw = kw.toLowerCase();
            let idx = lowerText.indexOf(lowerKw);
            if (idx === -1) return;
            const frag = document.createDocumentFragment();
            let lastIdx = 0;
            while (idx !== -1) {
                frag.appendChild(document.createTextNode(text.substring(lastIdx, idx)));
                const mark = document.createElement('mark');
                mark.className = 'search-hl';
                mark.textContent = text.substring(idx, idx + kw.length);
                frag.appendChild(mark);
                searchMatches.push(mark);
                lastIdx = idx + kw.length;
                idx = lowerText.indexOf(lowerKw, lastIdx);
            }
            frag.appendChild(document.createTextNode(text.substring(lastIdx)));
            node.parentNode.replaceChild(frag, node);
        });
    });
    if (searchMatches.length > 0) { searchIndex = 0; highlightMatch(); }
    else document.getElementById('search-count').innerText = '无结果';
}
function highlightMatch() {
    if (searchMatches.length === 0) return;
    searchMatches.forEach(m => m.classList.remove('active'));
    const match = searchMatches[searchIndex];
    match.classList.add('active');
    match.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('search-count').innerText = `${searchIndex + 1}/${searchMatches.length}`;
}
window.prevSearch = function() { if (searchMatches.length === 0) return; searchIndex = (searchIndex - 1 + searchMatches.length) % searchMatches.length; highlightMatch(); };
window.nextSearch = function() { if (searchMatches.length === 0) return; searchIndex = (searchIndex + 1) % searchMatches.length; highlightMatch(); };
window.clearSearch = function() { document.getElementById('methods-search-input').value = ''; clearSearchHighlight(); };
function methodsUpdateToolbarState() {
    const editor = methodsGetEditor();
    const toolbar = document.getElementById('methods-toolbar');
    if (!editor || !toolbar) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) return;
    ['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','justifyLeft','justifyCenter','justifyRight','justifyFull'].forEach(cmd => {
        const btn = toolbar.querySelector(`button[data-cmd="${cmd}"]`);
        if (!btn) return;
        let state = false;
        try { state = document.queryCommandState(cmd); } catch(e) {}
        btn.classList.toggle('active', state);
    });
}
function methodsExecCommand(cmd, val) {
    const editor = methodsGetEditor();
    if (!editor) return;
    methodsRestoreSelection();
    try {
        if (cmd === 'fontSize') methodsApplyFontSize(parseInt(val) || 14);
        else if (cmd === 'removeFormat') { document.execCommand('removeFormat', false, null); document.execCommand('formatBlock', false, 'p'); }
        else document.execCommand(cmd, false, val);
    } catch(e) { console.warn(e); }
    editor.focus();
    methodsUpdateToolbarState();
    methodsTriggerSave();
}
function getFileFullPath(fileId) {
    let path = [];
    let current = appData.methodsFiles.find(f => f.id === fileId);
    while (current) { path.unshift(current.name); current = appData.methodsFiles.find(f => f.id === current.parentId); }
    return path.join('/');
}
function buildFileTree(parentId = null) { return appData.methodsFiles.filter(f => (f.parentId || null) === parentId); }
async function importFileToFolder(file, folderId) {
    const rawName = file.name || '未命名文件';
    const dotIdx = rawName.lastIndexOf('.');
    const ext = dotIdx > 0 ? rawName.substring(dotIdx + 1).toLowerCase() : '';
    const name = dotIdx > 0 ? rawName.substring(0, dotIdx) : rawName;
    let contentHtml = '', contentText = '';
    const textExts = ['txt','md','markdown','html','htm','log','csv','json','xml','yaml','yml','ini','js','ts','css','py','java','c','cpp','h','sh'];
    if (textExts.includes(ext)) { try { const text = await file.text(); contentText = text; contentHtml = escapeHtml(text).replace(/\r\n/g,'\n').replace(/\n/g,'<br>'); } catch(err) {} }
    const newFile = { id: 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2,8), name: name || '未命名', type: 'file', parentId: folderId, contentHtml, contentText, updatedAt: Date.now() };
    if (!Array.isArray(appData.methodsFiles)) appData.methodsFiles = [];
    appData.methodsFiles.push(newFile);
    return newFile;
}
function moveMethodsFileToFolder(fileId, targetFolderId) {
    const f = appData.methodsFiles.find(x => x.id === fileId);
    const target = appData.methodsFiles.find(x => x.id === targetFolderId);
    if (!f || !target || target.type !== 'folder' || f.id === targetFolderId) return false;
    let cur = target;
    while (cur) { if (cur.id === fileId) return false; cur = appData.methodsFiles.find(x => x.id === cur.parentId); }
    if (f.parentId === targetFolderId) return false;
    f.parentId = targetFolderId;
    if (f.type === 'file') f.updatedAt = Date.now();
    return true;
}
function renderMethodsFileTree(node, listElement, depth = 0) {
    node.forEach(f => {
        const isFolder = f.type === 'folder';
        const isExpanded = expandedMethodFolders.has(f.id);
        const item = document.createElement('div');
        item.className = 'methods-file-item' + (f.id === appData.activeMethodsFileId && !isFolder ? ' active' : '');
        item.style.paddingLeft = (10 + depth * 12) + 'px';
        item.title = f.name + '\n双击重命名';
        item.setAttribute('draggable', 'true');
        item.addEventListener('dragstart', (e) => { try { e.dataTransfer.setData('text/methods-file-id', f.id); e.dataTransfer.effectAllowed = 'move'; } catch(err) {} });
        const icon = document.createElement('span'); icon.className = 'file-icon'; icon.textContent = isFolder ? (isExpanded ? '📂' : '📁') : '📄';
        const toggle = document.createElement('span'); toggle.className = 'folder-toggle'; toggle.textContent = isFolder ? (isExpanded ? '▼' : '▶') : '';
        const nameSpan = document.createElement('span'); nameSpan.className = 'methods-file-name'; nameSpan.textContent = f.name;
        const delSpan = document.createElement('span'); delSpan.className = 'methods-file-del'; delSpan.textContent = '✕'; delSpan.title = '删除';
        if (isFolder) toggle.onclick = (e) => { e.stopPropagation(); if (isExpanded) expandedMethodFolders.delete(f.id); else expandedMethodFolders.add(f.id); renderMethodsFileList(); };
        item.appendChild(toggle); item.appendChild(icon); item.appendChild(nameSpan); item.appendChild(delSpan);
        item.onclick = (e) => { if (e.target === delSpan || e.target === toggle) return; if (isFolder) { if (isExpanded) expandedMethodFolders.delete(f.id); else expandedMethodFolders.add(f.id); renderMethodsFileList(); } else switchMethodsFile(f.id); };
        item.ondblclick = (e) => { if (e.target === delSpan || e.target === toggle) return; renameMethodsFile(f.id); };
        delSpan.onclick = (e) => { e.stopPropagation(); deleteMethodsFile(f.id); };
        if (isFolder) {
            item.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; item.classList.add('folder-drag-over'); });
            item.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); item.classList.add('folder-drag-over'); });
            item.addEventListener('dragleave', (e) => { e.stopPropagation(); if (!item.contains(e.relatedTarget)) item.classList.remove('folder-drag-over'); });
            item.addEventListener('drop', async (e) => {
                e.preventDefault(); e.stopPropagation(); item.classList.remove('folder-drag-over');
                try {
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        let okCount = 0;
                        for (const file of Array.from(e.dataTransfer.files)) { try { await importFileToFolder(file, f.id); okCount++; } catch(err) { console.warn(err); } }
                        expandedMethodFolders.add(f.id); renderMethodsFileList(); saveDataToFile(appData);
                        showMiniToast(okCount > 0 ? '已导入 ' + okCount + ' 个文件到「' + f.name + '」' : '拖拽失败');
                        return;
                    }
                    const dragFileId = e.dataTransfer.getData('text/methods-file-id');
                    if (dragFileId && moveMethodsFileToFolder(dragFileId, f.id)) {
                        expandedMethodFolders.add(f.id); renderMethodsFileList(); saveDataToFile(appData); showMiniToast('已移动到文件夹');
                    }
                } catch(err) { console.error('拖拽失败', err); showMiniToast('拖拽失败'); }
            });
        }
        listElement.appendChild(item);
        if (isFolder && isExpanded) { const children = buildFileTree(f.id); if (children.length > 0) renderMethodsFileTree(children, listElement, depth + 1); }
    });
}
function renderMethodsFileList() {
    const list = document.getElementById('methods-file-list');
    if (!list) return;
    list.innerHTML = '';
    if (!Array.isArray(appData.methodsFiles) || appData.methodsFiles.length === 0) { list.innerHTML = '<div class="methods-file-empty">暂无文件<br>点右上角 ➕ 新建</div>'; return; }
    const roots = buildFileTree(null);
    renderMethodsFileTree(roots, list);
    const files = appData.methodsFiles.filter(f => f.type === 'file');
    const leftSel = document.getElementById('split-left-select');
    const rightSel = document.getElementById('split-right-select');
    if (leftSel && rightSel) {
        const buildOpts = (selectedId) => files.map(f => { const fullPath = getFileFullPath(f.id); return `<option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>${fullPath}</option>`; }).join('');
        leftSel.innerHTML = buildOpts(appData.activeMethodsFileId);
        rightSel.innerHTML = buildOpts(appData.activeMethodsFileId2);
    }
}
function switchMethodsFile(id) {
    if (appData.activeMethodsFileId === id) return;
    commitMethodsEditorToFile();
    appData.activeMethodsFileId = id;
    refreshMethodsEditorContent();
    renderMethodsFileList();
    saveDataToFile(appData);
}
window.switchMethodsFile2 = function(id) {
    if (appData.activeMethodsFileId2 === id) return;
    commitMethodsEditorToFile();
    appData.activeMethodsFileId2 = id;
    refreshMethodsEditorContent();
    renderMethodsFileList();
    saveDataToFile(appData);
};
window.createMethodsFolder = function() {
    const name = prompt('新文件夹名称：', '新建文件夹');
    if (name === null || !name.trim()) return;
    let parentId = null;
    const activeFile = appData.methodsFiles.find(f => f.id === appData.activeMethodsFileId);
    if (activeFile && activeFile.parentId) parentId = activeFile.parentId;
    else if (activeFile && activeFile.type === 'folder') parentId = activeFile.id;
    const newFolder = { id: 'folder_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: name.trim(), type: 'folder', parentId: parentId };
    appData.methodsFiles.push(newFolder);
    if (parentId) expandedMethodFolders.add(parentId);
    renderMethodsFileList(); saveDataToFile(appData);
    showMiniToast('✅ 已创建文件夹「' + newFolder.name + '」');
};
window.createMethodsFile = function() {
    const name = prompt('新文件名：', '新学习方法');
    if (name === null || !name.trim()) return;
    commitMethodsEditorToFile();
    let parentId = null;
    const activeFile = appData.methodsFiles.find(f => f.id === appData.activeMethodsFileId);
    if (activeFile && activeFile.parentId) parentId = activeFile.parentId;
    else if (activeFile && activeFile.type === 'folder') parentId = activeFile.id;
    const newFile = { id: 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: name.trim(), type: 'file', parentId: parentId, contentHtml: '', contentText: '', updatedAt: Date.now() };
    appData.methodsFiles.push(newFile);
    appData.activeMethodsFileId = newFile.id;
    if (parentId) expandedMethodFolders.add(parentId);
    renderMethodsFileList(); refreshMethodsEditorContent(); saveDataToFile(appData);
    showMiniToast('✅ 已创建「' + newFile.name + '」');
};
function renameMethodsFile(id) {
    const f = appData.methodsFiles.find(x => x.id === id);
    if (!f) return;
    const name = prompt('修改名称：', f.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === f.name) return;
    f.name = trimmed;
    if (f.type === 'file') f.updatedAt = Date.now();
    renderMethodsFileList(); saveDataToFile(appData);
    showMiniToast('✏️ 已重命名');
}
function deleteMethodsFile(id) {
    const f = appData.methodsFiles.find(x => x.id === id);
    if (!f) return;
    if (f.type === 'folder') {
        const children = appData.methodsFiles.filter(x => x.parentId === id);
        if (children.length > 0) { alert('文件夹不为空，请先删除内部的文件/文件夹。'); return; }
    }
    if (appData.methodsFiles.filter(x => x.type === 'file').length <= 1 && f.type === 'file') { alert('至少保留一个文件'); return; }
    if (!confirm(`删除「${f.name}」？内容将永久丢失。`)) return;
    const deleteRecursive = (delId) => {
        const children = appData.methodsFiles.filter(x => x.parentId === delId);
        children.forEach(c => deleteRecursive(c.id));
        appData.methodsFiles = appData.methodsFiles.filter(x => x.id !== delId);
    };
    deleteRecursive(id);
    if (appData.activeMethodsFileId === id) { const firstFile = appData.methodsFiles.find(x => x.type === 'file'); appData.activeMethodsFileId = firstFile ? firstFile.id : null; }
    if (appData.activeMethodsFileId2 === id) { const secondFile = appData.methodsFiles.filter(x => x.type === 'file')[1] || appData.methodsFiles.find(x => x.type === 'file'); appData.activeMethodsFileId2 = secondFile ? secondFile.id : null; }
    renderMethodsFileList(); refreshMethodsEditorContent(); saveDataToFile(appData);
    showMiniToast('🗑️ 已删除');
}
window.toggleSplitScreen = function() {
    commitMethodsEditorToFile();
    appData.splitScreenMode = !appData.splitScreenMode;
    const container = document.getElementById('methods-paper-container');
    const editor2 = document.getElementById('methods-content-2');
    const btn = document.getElementById('btn-toggle-split');
    const splitControls = document.getElementById('methods-split-controls');
    if (appData.splitScreenMode) {
        container.classList.add('split-screen'); editor2.classList.add('mirror');
        btn.classList.add('btn-primary'); btn.innerText = '🖥️ 单栏模式';
        if (splitControls) splitControls.style.display = 'flex';
    } else {
        container.classList.remove('split-screen'); editor2.classList.remove('mirror');
        btn.classList.remove('btn-primary'); btn.innerText = '🖥️ 双栏模式';
        if (splitControls) splitControls.style.display = 'none';
    }
    renderMethodsFileList(); refreshMethodsEditorContent(); saveDataToFile(appData);
};
function initMethodsEditor() {
    if (methodsEditorInitialized) return;
    methodsEditorInitialized = true;
    const editor1 = document.getElementById('methods-content');
    const editor2 = document.getElementById('methods-content-2');
    const toolbar = document.getElementById('methods-toolbar');
    if (!editor1 || !toolbar) return;
    renderMethodsFileList(); refreshMethodsEditorContent();
    document.addEventListener('selectionchange', () => {
        if (document.activeElement === editor1) { activeEditorId = 'methods-content'; methodsSaveSelection(); methodsUpdateToolbarState(); }
        else if (document.activeElement === editor2) { activeEditorId = 'methods-content-2'; methodsSaveSelection(); methodsUpdateToolbarState(); }
    });
    [editor1, editor2].forEach(ed => {
        if (!ed) return;
        ed.addEventListener('input', () => methodsTriggerSave());
        ed.addEventListener('mouseup', methodsSaveSelection);
        ed.addEventListener('keyup', methodsSaveSelection);
        ed.addEventListener('focus', () => { activeEditorId = ed.id; });
        ed.addEventListener('blur', () => {
            clearTimeout(methodsSaveTimer);
            const changed = commitMethodsEditorToFile();
            if (changed) saveDataToFile(appData);
            renderKaTeX(ed);
        });
    });
    const searchInput = document.getElementById('methods-search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (searchMatches.length > 0 && searchMatches[searchIndex].textContent.toLowerCase() === searchInput.value.trim().toLowerCase()) nextSearch();
                else performSearch();
            }
        });
    }
    toolbar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-cmd]');
        if (!btn) return;
        e.preventDefault();
        methodsExecCommand(btn.dataset.cmd);
    });
    toolbar.querySelectorAll('select[data-cmd]').forEach(sel => {
        sel.addEventListener('change', () => methodsExecCommand(sel.dataset.cmd, sel.value));
    });
    const foreColorInput = document.getElementById('methods-forecolor');
    const foreColorSwatch = document.getElementById('forecolor-swatch');
    const hiliteColorInput = document.getElementById('methods-hilitecolor');
    const hiliteColorSwatch = document.getElementById('hilitecolor-swatch');
    if (foreColorInput) {
        foreColorInput.addEventListener('input', () => { if (foreColorSwatch) foreColorSwatch.style.background = foreColorInput.value; });
        foreColorInput.addEventListener('change', () => methodsExecCommand('foreColor', foreColorInput.value));
    }
    if (hiliteColorInput) {
        hiliteColorInput.addEventListener('input', () => { if (hiliteColorSwatch) hiliteColorSwatch.style.background = hiliteColorInput.value; });
        hiliteColorInput.addEventListener('change', () => {
            const editor = methodsGetEditor();
            if (!editor) return;
            methodsRestoreSelection();
            let ok = false;
            try { ok = document.execCommand('hiliteColor', false, hiliteColorInput.value); } catch(e) { ok = false; }
            if (!ok) { try { document.execCommand('backColor', false, hiliteColorInput.value); } catch(e) {} }
            editor.focus();
            methodsTriggerSave();
        });
    }
}
function refreshMethodsEditorContent() {
    const editor1 = document.getElementById('methods-content');
    const editor2 = document.getElementById('methods-content-2');
    const f1 = getCurrentMethodsFile(appData.activeMethodsFileId);
    if (editor1 && f1) {
        if (editor1.innerHTML !== (f1.contentHtml || '')) { editor1.innerHTML = f1.contentHtml || ''; renderKaTeX(editor1); }
    }
    if (editor2 && appData.splitScreenMode) {
        const f2 = getCurrentMethodsFile(appData.activeMethodsFileId2);
        if (f2 && editor2.innerHTML !== (f2.contentHtml || '')) { editor2.innerHTML = f2.contentHtml || ''; renderKaTeX(editor2); }
    }
    if (appData.splitScreenMode) {
        const container = document.getElementById('methods-paper-container');
        container.classList.add('split-screen');
        editor2.classList.add('mirror');
        document.getElementById('btn-toggle-split').classList.add('btn-primary');
        document.getElementById('btn-toggle-split').innerText = '🖥️ 单栏模式';
        document.getElementById('methods-split-controls').style.display = 'flex';
    }
}
function renderLevelConfig() {
    ensureEnergyData();
    const list = document.getElementById('level-config-list');
    if (!list) return;
    const levels = appData.levelConfig.levels;
    if (levels.length === 0) { list.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:10px;font-size:var(--font-hint);">暂无等级</div>'; return; }
    list.innerHTML = levels.map((lv, idx) => `
        <div class="level-config-row">
            <span class="level-badge">Lv.${idx + 1}</span>
            <input type="text" value="${escapeHtml(lv.name)}" onchange="updateLevelName(${idx}, this.value)" placeholder="等级名称">
            <input type="number" value="${lv.needExp}" onchange="updateLevelExp(${idx}, this.value)" min="1" placeholder="所需经验">
            <button class="btn btn-sm" onclick="deleteLevelConfig(${idx})" style="color:var(--danger-color);border-color:var(--danger-color);padding:2px 6px;font-size:var(--font-small);">✕</button>
        </div>`).join('');
}
window.updateLevelName = function(idx, val) { if (appData.levelConfig.levels[idx]) { appData.levelConfig.levels[idx].name = val.trim() || '等级'; renderEnergyAndRPG(); saveDataToFile(appData); } };
window.updateLevelExp = function(idx, val) { const num = parseInt(val); if (!isNaN(num) && num >= 1 && appData.levelConfig.levels[idx]) { appData.levelConfig.levels[idx].needExp = num; renderEnergyAndRPG(); saveDataToFile(appData); } };
window.deleteLevelConfig = function(idx) { if (appData.levelConfig.levels.length <= 1) { alert('至少保留一个等级'); return; } appData.levelConfig.levels.splice(idx, 1); renderLevelConfig(); renderEnergyAndRPG(); saveDataToFile(appData); };
window.addLevelConfig = function() { ensureEnergyData(); const last = appData.levelConfig.levels[appData.levelConfig.levels.length - 1]; appData.levelConfig.levels.push({ name: '新等级', needExp: (last ? last.needExp : 100) * 10 }); renderLevelConfig(); saveDataToFile(appData); };
window.resetLevelConfig = function() { if (!confirm('恢复默认等级配置？')) return; appData.levelConfig = { levels: JSON.parse(JSON.stringify(DEFAULT_LEVELS)) }; renderLevelConfig(); renderEnergyAndRPG(); saveDataToFile(appData); };
window.updateCommonBtn = function(btn, checked) {
    if (!appData.commonBtns) appData.commonBtns = [];
    if (checked) { if (!appData.commonBtns.includes(btn)) appData.commonBtns.push(btn); }
    else appData.commonBtns = appData.commonBtns.filter(b => b !== btn);
    renderDayPlan(); renderTaskPool(); saveDataToFile(appData);
};
function renderTimeSlotConfig() {
    const list = document.getElementById('timeslot-config-list');
    if (!list) return;
    list.innerHTML = appData.timeSlots.map((ts, idx) => `
        <div class="level-config-row" data-ts-id="${ts.id}" style="display:flex;gap:6px;align-items:center;background:var(--bg-card);border:1px solid var(--border-color);border-radius:6px;padding:4px 6px;">
            <span class="ts-drag-handle" title="拖动排序">⋮⋮</span>
            <span style="font-size:var(--font-hint);font-weight:bold;color:var(--text-muted);width:24px;text-align:center;">${idx+1}</span>
            <input type="text" value="${escapeHtml(ts.label)}" onchange="updateTimeSlot('${ts.id}', this.value)" style="flex:1;padding:4px;font-size:var(--font-hint);">
            <button class="btn btn-sm" onclick="deleteTimeSlot('${ts.id}')" style="color:var(--danger-color);border-color:var(--danger-color);padding:2px 6px;">✕</button>
        </div>`).join('');
    initTimeSlotSortable();
}
let _tsSortable = null;
function initTimeSlotSortable() {
    const list = document.getElementById('timeslot-config-list');
    if (!list || !window.Sortable) return;
    if (_tsSortable) { try { _tsSortable.destroy(); } catch(e){} _tsSortable = null; }
    _tsSortable = new Sortable(list, {
        animation: 160, handle: '.ts-drag-handle', ghostClass: 'ts-sortable-ghost', chosenClass: 'ts-sortable-chosen',
        onEnd: function() {
            const rows = Array.from(list.querySelectorAll('[data-ts-id]'));
            const newIds = rows.map(r => r.getAttribute('data-ts-id'));
            const newSlots = newIds.map(id => appData.timeSlots.find(t => t.id === id)).filter(Boolean);
            if (newSlots.length === appData.timeSlots.length) {
                appData.timeSlots = newSlots;
                appData.timeSlotsLastModified = Date.now();
                rows.forEach((r, i) => { const numSpan = r.children[1]; if (numSpan) numSpan.textContent = i + 1; });
                saveDataToFile(appData); renderWeekBoard();
            }
        }
    });
}
window.updateTimeSlot = function(id, val) {
    const ts = appData.timeSlots.find(t => t.id === id);
    if (ts) {
        ts.label = val.trim() || '00:00';
        appData.timeSlotsLastModified = Date.now();
        saveDataToFile(appData); renderWeekBoard();
    }
};
window.addTimeSlot = function() {
    appData.timeSlots.push({ id: 'ts_' + Date.now(), label: '00:00-00:00' });
    appData.timeSlotsLastModified = Date.now();
    renderTimeSlotConfig(); saveDataToFile(appData); renderWeekBoard();
};
window.deleteTimeSlot = function(id) {
    if (!confirm('确定删除该时间段？分配到该时间的任务将变为"未安排"。')) return;
    appData.timeSlots = appData.timeSlots.filter(t => t.id !== id);
    appData.timeSlotsLastModified = Date.now();
    appData.tasks.forEach(t => { if (t.timeSlot === id) delete t.timeSlot; });
    if (appData.fixedBlockSchedule) {
        Object.keys(appData.fixedBlockSchedule).forEach(d => {
            if (appData.fixedBlockSchedule[d][id]) delete appData.fixedBlockSchedule[d][id];
            if (Object.keys(appData.fixedBlockSchedule[d]).length === 0) delete appData.fixedBlockSchedule[d];
        });
    }
    renderTimeSlotConfig(); saveDataToFile(appData); renderWeekBoard(); renderTaskPool();
};
window.resetTimeSlots = function() {
    if (!confirm('恢复默认时间段？已分配的任务可能受影响。')) return;
    appData.timeSlots = JSON.parse(JSON.stringify(DEFAULT_TIMESLOTS));
    appData.timeSlotsLastModified = Date.now();
    renderTimeSlotConfig(); saveDataToFile(appData); renderWeekBoard(); renderTaskPool();
};
function renderFixedBlockEnergyConfig() {
    const list = document.getElementById('fixed-block-energy-config-list');
    if (!list) return;
    list.innerHTML = appData.fixedBlocks.map(fb => `
        <div class="level-config-row" style="display:flex;gap:6px;align-items:center;background:var(--bg-card);border:1px solid var(--border-color);border-radius:6px;padding:4px 6px;">
            <span style="font-size:var(--font-hint);font-weight:bold;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📌 ${escapeHtml(fb.name)}</span>
            <input type="number" value="${fb.energyCost || 0}" onchange="updateFixedBlockEnergy('${fb.id}', this.value)" style="width:70px;padding:4px;font-size:var(--font-hint);">
            <span style="font-size:10px;color:var(--text-muted);">点</span>
        </div>
    `).join('');
}
window.updateFixedBlockEnergy = function(id, val) {
    const fb = appData.fixedBlocks.find(b => b.id === id);
    if (!fb) return;
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0) { fb.energyCost = num; saveDataToFile(appData); renderEnergyAndRPG(); }
};
function getSettingsObj() {
    return {
        energyMax: appData.energyMax, energyWarnThreshold: appData.energyWarnThreshold, expRatio: appData.expRatio,
        napEnergy: appData.napEnergy, breakEnergy: appData.breakEnergy, themeColor: appData.themeColor, themeMode: appData.themeMode,
        fonts: appData.fonts, radius: appData.radius, levelConfig: appData.levelConfig, commonBtns: appData.commonBtns,
        timeSlots: appData.timeSlots, timeSlotsLastModified: appData.timeSlotsLastModified || 0,
        fixedBlocks: appData.fixedBlocks, maxVisible: appData.maxVisible,
        animationEnabled: appData.animationEnabled, yearlyGoals: appData.yearlyGoals, panelLayout: appData.panelLayout
    };
}
let _lastSaveToastAt = 0;
function _showSaveErrorToast(msg) { const now = Date.now(); if (now - _lastSaveToastAt < 2000) return; _lastSaveToastAt = now; showMiniToast(msg); }
function saveDataToFile(data) {
    if (!isSyncing) data._lastModified = Date.now();
    let jsonStr;
    try { jsonStr = JSON.stringify(data); } catch (e) { console.error('[存储] 序列化失败：', e); _showSaveErrorToast('保存失败，存储空间不足'); return; }
    try { localStorage.setItem('myWorkspaceAppData', jsonStr); } catch (e) { console.error('[存储] 写入失败：', e); _showSaveErrorToast('保存失败，存储空间不足'); return; }
    try { const check = localStorage.getItem('myWorkspaceAppData'); if (check !== jsonStr) { console.error('[存储] 校验失败'); _showSaveErrorToast('保存异常，请检查'); } } catch (e) { console.error('[存储] 读取校验异常：', e); }
    if (!isSyncing) {
        try { lastSyncedSettings = JSON.parse(JSON.stringify(getSettingsObj())); lastSyncedRpg = JSON.parse(JSON.stringify(data.rpg || {})); lastSyncedEnergy = JSON.parse(JSON.stringify(data.dailyEnergy || {})); } catch(e) {}
        clearTimeout(_opDebounceTimer);
        _opDebounceTimer = setTimeout(() => { if (syncStatus === 'connected' || syncStatus === 'syncing') broadcastDiffs(data); }, 300);
    }
}
function saveLocalStorage() { try { localStorage.setItem('myWorkspaceAppData', JSON.stringify(appData)); } catch(e) {} }
window.changeThemeMode = function(mode) { appData.themeMode = mode; document.body.classList.toggle('dark-mode', mode === 'dark'); saveDataToFile(appData); };
function changeTheme(color) { appData.themeColor = color; document.documentElement.style.setProperty('--accent-color', color); if (!isSyncing) saveDataToFile(appData); }
window.changeFontSetting = function(key, val) {
    const px = val + 'px';
    appData.fonts[key] = px;
    document.documentElement.style.setProperty(`--font-${key}`, px);
    document.getElementById(`font-${key}-val`).innerText = val;
    if (!isSyncing) saveDataToFile(appData);
};
window.changeRadius = function(v) {
    const r = parseInt(v);
    appData.radius = r + 'px';
    document.documentElement.style.setProperty('--radius', appData.radius);
    document.getElementById('radius-slider').value = r;
    document.getElementById('radius-val').innerText = r;
    if (!isSyncing) saveDataToFile(appData);
};
function updateSyncUI() {
    const badge = document.getElementById('sync-status-badge');
    const text = document.getElementById('sync-status-text');
    badge.className = 'sync-status-badge ' + syncStatus;
    if (syncStatus === 'connected') text.innerText = '已同步';
    else if (syncStatus === 'syncing') text.innerText = '同步中...';
    else if (syncStatus === 'conflict') text.innerText = '存在冲突';
    else text.innerText = '离线模式';
}
function acquireLock(targetId) {
    locks[targetId] = { clientId: CLIENT_ID, time: Date.now() };
    if (conn && conn.open) conn.send({ type: 'LOCK', targetId, clientId: CLIENT_ID });
}
function releaseLock(targetId) {
    delete locks[targetId];
    if (conn && conn.open) conn.send({ type: 'UNLOCK', targetId, clientId: CLIENT_ID });
}
function applyRemoteLock(targetId, clientId) {
    if (clientId === CLIENT_ID) return;
    locks[targetId] = { clientId, time: Date.now() };
    const el = document.querySelector(`[data-task-id="${targetId}"]`);
    if (el) el.classList.add('locked-by-remote');
}
function removeRemoteLock(targetId) {
    if (locks[targetId] && locks[targetId].clientId !== CLIENT_ID) {
        delete locks[targetId];
        const el = document.querySelector(`[data-task-id="${targetId}"]`);
        if (el) el.classList.remove('locked-by-remote');
    }
}
function resetSyncedBaseline(data) {
    lastSyncedSettings = JSON.parse(JSON.stringify(getSettingsObj()));
    lastSyncedTimeSlots = JSON.parse(JSON.stringify({ timeSlots: data.timeSlots || [], mod: data.timeSlotsLastModified || 0 }));
    lastSyncedDailyChecks = JSON.parse(JSON.stringify(data.dailyExerciseChecks || {}));
    lastSyncedExerciseSchedule = JSON.parse(JSON.stringify(data.exerciseSchedule || {}));
    lastSyncedExerciseTimeSlotSchedule = JSON.parse(JSON.stringify(data.exerciseTimeSlotSchedule || {}));
    lastSyncedReflections = JSON.parse(JSON.stringify({ daily: data.dailyReflections, weekly: data.weeklyReflections, monthly: data.monthlyReflections }));
    lastSyncedRpg = JSON.parse(JSON.stringify(data.rpg));
    lastSyncedEnergy = JSON.parse(JSON.stringify(data.dailyEnergy));
    lastSyncedTasks = JSON.parse(JSON.stringify(data.tasks));
    lastSyncedExercises = JSON.parse(JSON.stringify(data.exercises));
    lastSyncedMethods = JSON.parse(JSON.stringify(data.methodsFiles));
}
function broadcastDiffs(data) {
    if (!conn || !conn.open) return;
    const jstr = (v) => JSON.stringify(v);
    const curSettings = getSettingsObj();
    if (jstr(lastSyncedSettings) !== jstr(curSettings)) {
        conn.send({ type: 'OP', data: { action: 'UPDATE_SETTINGS', settings: curSettings, clientId: CLIENT_ID, time: Date.now() } });
        lastSyncedSettings = JSON.parse(jstr(curSettings));
    }
    const curTS = { timeSlots: data.timeSlots || [], mod: data.timeSlotsLastModified || 0 };
    if (jstr(lastSyncedTimeSlots) !== jstr(curTS)) {
        lastSyncedTimeSlots = JSON.parse(jstr(curTS));
    }
    const checkObj = data.dailyExerciseChecks || {};
    if (jstr(lastSyncedDailyChecks) !== jstr(checkObj)) {
        conn.send({ type: 'OP', data: { action: 'UPDATE_DAILY_CHECKS', checks: checkObj, clientId: CLIENT_ID, time: Date.now() } });
        lastSyncedDailyChecks = JSON.parse(jstr(checkObj));
    }
    const exSch = data.exerciseSchedule || {};
    const tsSch = data.exerciseTimeSlotSchedule || {};
    if (jstr(lastSyncedExerciseSchedule) !== jstr(exSch) || jstr(lastSyncedExerciseTimeSlotSchedule) !== jstr(tsSch)) {
        conn.send({ type: 'OP', data: { action: 'UPDATE_EXERCISE_SCHEDULE', exSch, tsSch, clientId: CLIENT_ID, time: Date.now() } });
        lastSyncedExerciseSchedule = JSON.parse(jstr(exSch));
        lastSyncedExerciseTimeSlotSchedule = JSON.parse(jstr(tsSch));
    }
    const reflections = { daily: data.dailyReflections, weekly: data.weeklyReflections, monthly: data.monthlyReflections };
    if (jstr(lastSyncedReflections) !== jstr(reflections)) {
        conn.send({ type: 'OP', data: { action: 'UPDATE_REFLECTIONS', reflections, clientId: CLIENT_ID, time: Date.now() } });
        lastSyncedReflections = JSON.parse(jstr(reflections));
    }
    if (jstr(lastSyncedRpg) !== jstr(data.rpg)) {
        conn.send({ type: 'OP', data: { action: 'UPDATE_RPG', rpg: data.rpg, clientId: CLIENT_ID, time: Date.now() } });
        lastSyncedRpg = JSON.parse(jstr(data.rpg));
    }
    if (jstr(lastSyncedEnergy) !== jstr(data.dailyEnergy)) {
        conn.send({ type: 'OP', data: { action: 'UPDATE_ENERGY', energy: data.dailyEnergy, clientId: CLIENT_ID, time: Date.now() } });
        lastSyncedEnergy = JSON.parse(jstr(data.dailyEnergy));
    }
    const currentTasks = data.tasks || [];
    currentTasks.forEach(ct => {
        const lt = lastSyncedTasks.find(x => x.id === ct.id);
        if (!lt || jstr(lt) !== jstr(ct)) conn.send({ type: 'OP', data: { action: 'UPDATE_TASK', task: ct, clientId: CLIENT_ID, time: Date.now() } });
    });
    lastSyncedTasks.forEach(lt => { if (!currentTasks.find(x => x.id === lt.id)) conn.send({ type: 'OP', data: { action: 'DELETE_TASK', id: lt.id, clientId: CLIENT_ID, time: Date.now() } }); });
    lastSyncedTasks = currentTasks.map(t => t);
    const currentExercises = data.exercises || [];
    currentExercises.forEach(ce => {
        const le = lastSyncedExercises.find(x => x.id === ce.id);
        if (!le || jstr(le) !== jstr(ce)) conn.send({ type: 'OP', data: { action: 'UPDATE_EXERCISE', exercise: ce, clientId: CLIENT_ID, time: Date.now() } });
    });
    lastSyncedExercises.forEach(le => { if (!currentExercises.find(x => x.id === le.id)) conn.send({ type: 'OP', data: { action: 'DELETE_EXERCISE', id: le.id, clientId: CLIENT_ID, time: Date.now() } }); });
    lastSyncedExercises = currentExercises.map(e => e);
    const currentMethods = data.methodsFiles || [];
    currentMethods.forEach(cm => {
        const lm = lastSyncedMethods.find(x => x.id === cm.id);
        if (!lm || jstr(lm) !== jstr(cm)) conn.send({ type: 'OP', data: { action: 'UPDATE_METHODS', method: cm, clientId: CLIENT_ID, time: Date.now() } });
    });
    lastSyncedMethods.forEach(lm => { if (!currentMethods.find(x => x.id === lm.id)) conn.send({ type: 'OP', data: { action: 'DELETE_METHODS', id: lm.id, clientId: CLIENT_ID, time: Date.now() } }); });
    lastSyncedMethods = currentMethods.map(m => m);
}
function queueConflict(op) {
    syncStatus = 'conflict'; updateSyncUI();
    let localVal = '';
    if (op.action === 'UPDATE_TASK') {
        const t = appData.tasks.find(x => x.id === op.task.id);
        localVal = t ? t.text : '';
        document.getElementById('conflict-local-val').innerText = localVal || '(无)';
        document.getElementById('conflict-remote-val').innerText = op.task.text || '(无)';
    } else {
        document.getElementById('conflict-local-val').innerText = '本地已修改';
        document.getElementById('conflict-remote-val').innerText = '远端已修改';
    }
    document.getElementById('conflict-modal').classList.add('active');
    conflictQueue.push({ op, localVal });
}
window.resolveConflict = function(choice) {
    document.getElementById('conflict-modal').classList.remove('active');
    const conflict = conflictQueue.shift();
    if (!conflict) return;
    if (choice === 'local') {
        if (conflict.op.action === 'UPDATE_TASK') {
            const t = appData.tasks.find(x => x.id === conflict.op.task.id);
            if (t && conn && conn.open) conn.send({ type: 'OP', data: { action: 'UPDATE_TASK', task: t, clientId: CLIENT_ID, time: Date.now() } });
        }
    } else if (choice === 'remote') {
        if (conflict.op.action === 'UPDATE_TASK') {
            const t = appData.tasks.find(x => x.id === conflict.op.task.id);
            if (t) Object.assign(t, conflict.op.task);
            renderDayPlan(); renderCalendar(); renderWeekBoard();
        }
    }
    if (conflictQueue.length === 0) { syncStatus = 'connected'; updateSyncUI(); }
    else setTimeout(() => queueConflict(conflictQueue[0].op), 500);
};
function mergeExercisesList(localArr, remoteArr) {
    const merged = JSON.parse(JSON.stringify(localArr || []));
    const localMap = new Map(merged.map(x => [x.id, x]));
    (remoteArr || []).forEach(x => {
        if (!x || x.id === undefined) return;
        if (!localMap.has(x.id)) {
            merged.push(JSON.parse(JSON.stringify(x)));
            localMap.set(x.id, merged[merged.length - 1]);
        } else {
            const lx = localMap.get(x.id);
            const lTime = Number(lx._lastModified || lx.updatedAt || 0);
            const rTime = Number(x._lastModified || x.updatedAt || 0);
            if (rTime > lTime) {
                const lSubs = Array.isArray(lx.subTasks) ? lx.subTasks : [];
                const rSubs = Array.isArray(x.subTasks) ? x.subTasks : [];
                const seen = new Set(rSubs.map(s => s.id));
                const finalSubs = rSubs.map(s => JSON.parse(JSON.stringify(s)));
                lSubs.forEach(s => { if (!seen.has(s.id)) finalSubs.push(JSON.parse(JSON.stringify(s))); });
                Object.assign(lx, JSON.parse(JSON.stringify(x)));
                lx.subTasks = finalSubs;
            } else if (rTime < lTime) {
                const lSubs = Array.isArray(lx.subTasks) ? lx.subTasks : [];
                const rSubs = Array.isArray(x.subTasks) ? x.subTasks : [];
                const seen = new Set(lSubs.map(s => s.id));
                rSubs.forEach(s => { if (!seen.has(s.id)) lSubs.push(JSON.parse(JSON.stringify(s))); });
                lx.subTasks = lSubs;
            } else {
                const lSubs = Array.isArray(lx.subTasks) ? lx.subTasks : [];
                const rSubs = Array.isArray(x.subTasks) ? x.subTasks : [];
                const seen = new Set(lSubs.map(s => s.id));
                rSubs.forEach(s => { if (!seen.has(s.id)) lSubs.push(JSON.parse(JSON.stringify(s))); });
                lx.subTasks = lSubs;
                if (!lx.name && x.name) lx.name = x.name;
                if (!lx.recurringType && x.recurringType) lx.recurringType = x.recurringType;
                if (lx.energyCost === undefined && x.energyCost !== undefined) lx.energyCost = x.energyCost;
            }
        }
    });
    return merged;
}
function mergeExerciseScheduleDict(local, remote) {
    const merged = JSON.parse(JSON.stringify(local || {}));
    Object.keys(remote || {}).forEach(dateStr => {
        const lArr = Array.isArray(merged[dateStr]) ? merged[dateStr] : [];
        const rArr = Array.isArray(remote[dateStr]) ? remote[dateStr] : [];
        merged[dateStr] = [...new Set([...lArr, ...rArr])];
    });
    return merged;
}
function mergeExerciseTimeSlotDict(local, remote) {
    const merged = JSON.parse(JSON.stringify(local || {}));
    Object.keys(remote || {}).forEach(dateStr => {
        if (!merged[dateStr]) merged[dateStr] = JSON.parse(JSON.stringify(remote[dateStr]));
        else {
            const lDay = merged[dateStr];
            const rDay = remote[dateStr];
            if (lDay && typeof lDay === 'object' && !Array.isArray(lDay) && rDay && typeof rDay === 'object' && !Array.isArray(rDay)) {
                Object.keys(rDay).forEach(tsId => {
                    if (!lDay[tsId]) lDay[tsId] = JSON.parse(JSON.stringify(rDay[tsId]));
                    else if (Array.isArray(lDay[tsId]) && Array.isArray(rDay[tsId])) lDay[tsId] = [...new Set([...lDay[tsId], ...rDay[tsId]])];
                    else lDay[tsId] = rDay[tsId];
                });
            } else merged[dateStr] = JSON.parse(JSON.stringify(rDay));
        }
    });
    return merged;
}
function mergeDailyExerciseChecksDict(local, remote) {
    const merged = JSON.parse(JSON.stringify(local || {}));
    Object.keys(remote || {}).forEach(dateStr => {
        if (!merged[dateStr]) merged[dateStr] = JSON.parse(JSON.stringify(remote[dateStr]));
        else {
            const lDay = merged[dateStr];
            const rDay = remote[dateStr];
            if (lDay && typeof lDay === 'object' && !Array.isArray(lDay) && rDay && typeof rDay === 'object' && !Array.isArray(rDay)) {
                Object.keys(rDay).forEach(k => { if (lDay[k] === undefined || rDay[k] === true) lDay[k] = rDay[k]; });
            } else merged[dateStr] = JSON.parse(JSON.stringify(rDay));
        }
    });
    return merged;
}
function handleIncomingOp(op) {
    if (op.clientId === CLIENT_ID) return;
    if (op.action === 'UPDATE_TASK' && locks[op.task.id]) { queueConflict(op); return; }
    isSyncing = true;
    if (op.action === 'UPDATE_SETTINGS') {
        const incoming = Object.assign({}, op.settings);
        const localTSMod = appData.timeSlotsLastModified || 0;
        const incomingTSMod = incoming.timeSlotsLastModified || 0;
        if (incoming.timeSlots !== undefined && localTSMod > 0 && incomingTSMod <= localTSMod) {
            delete incoming.timeSlots;
            delete incoming.timeSlotsLastModified;
        }
        Object.assign(appData, incoming);
        document.body.classList.toggle('dark-mode', appData.themeMode === 'dark');
        if (appData.themeColor) document.documentElement.style.setProperty('--accent-color', appData.themeColor);
        if (appData.fonts) ['title','content','hint','small'].forEach(k => document.documentElement.style.setProperty(`--font-${k}`, appData.fonts[k]));
        if (appData.radius) document.documentElement.style.setProperty('--radius', appData.radius);
        renderEnergyAndRPG(); renderLevelConfig(); renderTimeSlotConfig(); renderFixedBlockPool(); renderFixedBlockEnergyConfig(); renderDayPlan(); renderWeekBoard(); renderTaskPool();
    } else if (op.action === 'UPDATE_DAILY_CHECKS') {
        appData.dailyExerciseChecks = mergeDailyExerciseChecksDict(appData.dailyExerciseChecks || {}, op.checks || {});
        renderDayExercises(); renderCalendar(); renderYearHeatmap(); updateFixedProgressBars();
    } else if (op.action === 'UPDATE_EXERCISE_SCHEDULE') {
        appData.exerciseSchedule = mergeExerciseScheduleDict(appData.exerciseSchedule || {}, op.exSch || {});
        appData.exerciseTimeSlotSchedule = mergeExerciseTimeSlotDict(appData.exerciseTimeSlotSchedule || {}, op.tsSch || {});
        renderDayExercises(); renderWeekBoard(); renderTaskPool(); renderCalendar(); renderYearHeatmap();
    } else if (op.action === 'UPDATE_REFLECTIONS') {
        appData.dailyReflections = op.reflections.daily;
        appData.weeklyReflections = op.reflections.weekly;
        appData.monthlyReflections = op.reflections.monthly;
        renderCalendar(); renderWeekBoard();
    } else if (op.action === 'UPDATE_RPG') {
        appData.rpg = op.rpg;
        renderEnergyAndRPG();
    } else if (op.action === 'UPDATE_ENERGY') {
        appData.dailyEnergy = op.energy;
        renderEnergyAndRPG();
    } else if (op.action === 'UPDATE_TASK') {
        const t = appData.tasks.find(x => x.id === op.task.id);
        if (t) Object.assign(t, op.task);
        else appData.tasks.push(op.task);
        renderDayPlan(); renderCalendar(); renderWeekBoard(); renderYearHeatmap(); updateFixedProgressBars();
        refreshDetailModalIfOpen();
    } else if (op.action === 'DELETE_TASK') {
        appData.tasks = appData.tasks.filter(x => x.id !== op.id);
        renderDayPlan(); renderCalendar(); renderWeekBoard(); renderYearHeatmap(); updateFixedProgressBars();
        refreshDetailModalIfOpen();
    } else if (op.action === 'UPDATE_EXERCISE') {
        const exIdx = appData.exercises.findIndex(x => x.id === op.exercise.id);
        if (exIdx === -1) appData.exercises.push(JSON.parse(JSON.stringify(op.exercise)));
        else {
            const mergedOne = mergeExercisesList([appData.exercises[exIdx]], [op.exercise]);
            appData.exercises[exIdx] = mergedOne[0];
        }
        renderDayExercises(); renderWeekBoard(); renderExercisePool();
    } else if (op.action === 'DELETE_EXERCISE') {
        appData.exercises = appData.exercises.filter(x => x.id !== op.id);
        renderDayExercises(); renderWeekBoard(); renderExercisePool();
    } else if (op.action === 'UPDATE_METHODS') {
        const m = appData.methodsFiles.find(x => x.id === op.method.id);
        if (m) Object.assign(m, op.method);
        else appData.methodsFiles.push(op.method);
        renderMethodsFileList();
        const editor = methodsGetEditor();
        if (!editor || document.activeElement !== editor) { refreshMethodsEditorContent(); renderKaTeX(editor); }
    } else if (op.action === 'DELETE_METHODS') {
        appData.methodsFiles = appData.methodsFiles.filter(x => x.id !== op.id);
        renderMethodsFileList(); refreshMethodsEditorContent();
    }
    syncStatus = 'connected'; updateSyncUI();
    setTimeout(() => isSyncing = false, 100);
}
function applyPanelLayout() {
    ensureEnergyData();
    const layout = appData.panelLayout, grid = document.getElementById('day-panels-grid');
    if (!grid) return;
    const panels = {};
    grid.querySelectorAll('[data-panel]').forEach(p => { panels[p.getAttribute('data-panel')] = p; });
    layout.order.forEach(k => { if (panels[k]) grid.appendChild(panels[k]); });
    Object.keys(panels).forEach(k => {
        const p = panels[k];
        p.classList.toggle('span-full', !!layout.spans[k]);
        const s = layout.sizes[k];
        if (s) {
            if (s.w) p.style.width = s.w; else p.style.removeProperty('width');
            if (s.h) p.style.height = s.h; else p.style.removeProperty('height');
        }
    });
}
function savePanelOrder() {
    const grid = document.getElementById('day-panels-grid');
    if (!grid) return;
    appData.panelLayout.order = Array.from(grid.querySelectorAll('[data-panel]')).map(p => p.getAttribute('data-panel'));
    saveDataToFile(appData);
}
function setupResizeObserver() {
    if (resizeObserver) { try { resizeObserver.disconnect(); } catch(e) {} resizeObserver = null; }
    if (!window.ResizeObserver) return;
    const grid = document.getElementById('day-panels-grid');
    if (!grid) return;
    let resizeDebounce = null;
    resizeObserver = new ResizeObserver(entries => {
        clearTimeout(resizeDebounce);
        resizeDebounce = setTimeout(() => {
            let changed = false;
            entries.forEach(entry => {
                const p = entry.target, k = p.getAttribute('data-panel');
                if (!k) return;
                const w = p.style.width, h = p.style.height;
                if (!appData.panelLayout.sizes[k]) appData.panelLayout.sizes[k] = {};
                if (w && appData.panelLayout.sizes[k].w !== w) { appData.panelLayout.sizes[k].w = w; changed = true; }
                if (h && appData.panelLayout.sizes[k].h !== h) { appData.panelLayout.sizes[k].h = h; changed = true; }
            });
            if (changed) saveDataToFile(appData);
        }, 500);
    });
    grid.querySelectorAll('[data-panel]').forEach(p => resizeObserver.observe(p));
}
window.togglePanelWidth = function(btn) {
    const box = btn.closest('.section-box'), k = box.getAttribute('data-panel');
    box.classList.toggle('span-full');
    appData.panelLayout.spans[k] = box.classList.contains('span-full');
    saveDataToFile(appData);
};
let _panelSortable = null;
function initDragAndDrop() {
    const gridEl = document.getElementById('day-panels-grid');
    if (!gridEl) return;
    if (_panelSortable) { try { _panelSortable.destroy(); } catch(e){} _panelSortable = null; }
    _panelSortable = new Sortable(gridEl, { animation: 200, handle: '.panel-header', ghostClass: 'sortable-ghost', onEnd: savePanelOrder });
    setupResizeObserver();
}
window.changeMonth = function(o) { appData.viewMonth += o; if (appData.viewMonth > 11) { appData.viewMonth = 0; appData.viewYear++; } if (appData.viewMonth < 0) { appData.viewMonth = 11; appData.viewYear--; } renderCalendar(); };
window.changeYear = function(o) { appData.viewYear += o; renderYearHeatmap(); };
window.changeWeek = function(o) {
    const b = new Date(appData.viewWeekBaseDate);
    b.setDate(b.getDate() + o * 7);
    appData.viewWeekBaseDate = `${b.getFullYear()}-${String(b.getMonth()+1).padStart(2,'0')}-${String(b.getDate()).padStart(2,'0')}`;
    renderWeekBoard(); renderTaskPool();
    const wkDetails = document.getElementById('week-summary-details');
    const wkText = document.getElementById('week-summary-textarea');
    const wkVal = appData.weeklyReflections[appData.viewWeekBaseDate] || '';
    if (wkText) wkText.value = wkVal;
    if (wkDetails) wkDetails.open = !!wkVal;
};
window.jumpToDay = function(ds) { appData.selectedDate = ds; userPickedDate = true; document.querySelector('.nav-item[data-target="day"]').click(); };
window.jumpToToday = function(e) {
    if (e) e.stopPropagation();
    const today = getTodayString();
    appData.selectedDate = today;
    appData.viewYear = new Date().getFullYear();
    appData.viewMonth = new Date().getMonth();
    appData.viewWeekBaseDate = today;
    userPickedDate = false;
    document.querySelector('.nav-item[data-target="day"]').click();
    renderDayPlan();
    showMiniToast('📍 已回到今天');
};
function getSubTaskProgress(s, ds, parentTask) {
    if (s.countOnly) return { done: 0, total: 1, count: s.countTotal || 0 };
    const done = isSubTaskDone(s, ds);
    if (s.target) { let cur = getSubCurrent(s, ds, parentTask); if (done) cur = s.target; return { done: cur, total: s.target }; }
    return { done: done ? 1 : 0, total: 1 };
}
function getTaskProgress(t, ds) {
    if (t.countOnly) { const hasCount = (t.countTotal || 0) > 0 || t.countEnded; return { done: hasCount ? 1 : 0, total: 1 }; }
    const done = isTaskDone(t, ds);
    if (t.subTasks && t.subTasks.length > 0) {
        let d = 0, tot = 0;
        t.subTasks.forEach(s => { const p = getSubTaskProgress(s, ds, t); d += p.done; tot += p.total; });
        return { done: d, total: tot };
    }
    if (t.target) { let cur = getTaskCurrent(t, ds); if (done && cur < t.target) cur = t.target; return { done: cur, total: t.target }; }
    return { done: done ? 1 : 0, total: 1 };
}
function syncParentTaskStatus(t, ds) {
    if (!t.subTasks || t.subTasks.length === 0) return;
    const allDone = t.subTasks.every(s => {
        if (s.countOnly) return !!s.countEnded;
        return s.target ? getSubCurrent(s, ds, t) >= s.target : isSubTaskDone(s, ds);
    });
    setTaskDone(t, ds, allDone);
}
function calcProgress(dateStr, type) {
    ensureEnergyData();
    if (type === '锻炼') {
        const manual = appData.exerciseSchedule[dateStr] || [];
        const slotSched = (appData.exerciseTimeSlotSchedule && appData.exerciseTimeSlotSchedule[dateStr]) || {};
        let allSlotExs = [];
        Object.values(slotSched).forEach(arr => { allSlotExs = allSlotExs.concat(arr); });
        const recurring = appData.exercises.filter(e => isRecurringMatch(e.recurringType, dateStr)).map(e => e.name);
        const names = [...new Set([...manual, ...recurring, ...allSlotExs])];
        if (names.length === 0) return { done: 0, total: 0 };
        let tot = 0, d = 0;
        const checks = appData.dailyExerciseChecks[dateStr] || {};
        names.forEach(n => {
            const ex = appData.exercises.find(e => e.name === n);
            if (!ex) return;
            if (!ex.subTasks || ex.subTasks.length === 0) {
                tot++;
                if (checks[ex.id]) d++;
            } else {
                ex.subTasks.forEach(s => { tot++; if (checks[`${ex.id}_${s.id}`]) d++; });
            }
        });
        return { done: d, total: tot };
    }
    const tasks = getTasksForDate(dateStr).filter(t => t.type === type);
    let d = 0, tot = 0;
    tasks.forEach(t => { const p = getTaskProgress(t, dateStr); d += p.done; tot += p.total; });
    return { done: d, total: tot };
}
window.openStatsModal = function(type) {
    ensureEnergyData();
    let title = '', s = '', e = '';
    if (type === 'year') { const y = appData.viewYear; title = `${y}年 统计`; s = formatDate(y, 0, 1); e = formatDate(y, 11, 31); }
    else if (type === 'month') { const y = appData.viewYear, m = appData.viewMonth; title = `${y}年 ${m+1}月 统计`; s = formatDate(y, m, 1); e = formatDate(y, m, new Date(y, m+1, 0).getDate()); }
    else if (type === 'week') {
        const b = new Date(appData.viewWeekBaseDate + 'T00:00:00');
        const dow = b.getDay() || 7;
        const mon = new Date(b); mon.setDate(b.getDate() - dow + 1);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        title = `本周 统计 (${mon.getMonth()+1}/${mon.getDate()} - ${sun.getMonth()+1}/${sun.getDate()})`;
        s = formatDate(mon.getFullYear(), mon.getMonth(), mon.getDate());
        e = formatDate(sun.getFullYear(), sun.getMonth(), sun.getDate());
    } else { const d = appData.selectedDate; title = `${getDateLabel(d)} 统计`; s = d; e = d; }
    document.getElementById('stats-modal-title').innerText = title;
    let ld = 0, od = 0, ed = 0;
    let cur = new Date(s + 'T00:00:00');
    const end = new Date(e + 'T00:00:00');
    let logHtml = '<div style="margin-top:16px; border-top:1px dashed var(--border-color); padding-top:12px;"><h4 style="font-size:var(--font-content);margin-bottom:8px;">📋 操作记录</h4><div style="max-height:240px;overflow-y:auto;font-size:var(--font-hint);display:flex;flex-direction:column;gap:6px;">';
    let hasLogs = false;
    while (cur <= end) {
        const d = formatDate(cur.getFullYear(), cur.getMonth(), cur.getDate());
        getTasksForDate(d).forEach(t => { const pr = getTaskProgress(t, d); if (t.type === 'learning') ld += pr.done; if (t.type === 'other') od += pr.done; });
        const checks = appData.dailyExerciseChecks[d] || {};
        const manual = appData.exerciseSchedule[d] || [];
        const slotSched = (appData.exerciseTimeSlotSchedule && appData.exerciseTimeSlotSchedule[d]) || {};
        let allSlotExs = [];
        Object.values(slotSched).forEach(arr => { allSlotExs = allSlotExs.concat(arr); });
        const rec = appData.exercises.filter(ex => isRecurringMatch(ex.recurringType, d)).map(ex => ex.name);
        [...new Set([...manual, ...allSlotExs, ...rec])].forEach(n => {
            const ex = appData.exercises.find(e => e.name === n);
            if (!ex) return;
            if (!ex.subTasks || ex.subTasks.length === 0) { if (checks[ex.id]) ed++; }
            else ex.subTasks.forEach(sub => { if (checks[`${ex.id}_${sub.id}`]) ed++; });
        });
        const logs = (appData.dailyLogs && appData.dailyLogs[d]) ? appData.dailyLogs[d] : {};
        const logItems = [];
        Object.values(logs).forEach(l => {
            const parts = [];
            if (l.completed) parts.push('✅ 完成');
            if (l.delta !== 0) parts.push(`🔄 计数 ${l.delta > 0 ? '+' : ''}${l.delta}`);
            if (parts.length > 0) logItems.push(`<span style="display:inline-block;margin-right:10px;margin-bottom:2px;background:var(--bg-sidebar);padding:2px 6px;border-radius:4px;">${escapeHtml(l.name)} (${parts.join(', ')})</span>`);
        });
        if (logItems.length > 0) { hasLogs = true; logHtml += `<div><b style="color:var(--accent-color);">${d}</b><br><div style="margin-top:4px;">${logItems.join('')}</div></div>`; }
        cur.setDate(cur.getDate() + 1);
    }
    if (!hasLogs) logHtml += '<span style="color:var(--text-muted);">暂无操作记录</span>';
    logHtml += '</div></div>';
    const maxVal = Math.max(ld, od, ed, 1);
    document.getElementById('stats-left-content').innerHTML = `
        <div class="stat-bar-row"><div class="stat-bar-label">📚 学习</div><div class="stat-bar-track"><div class="stat-bar-fill" style="width:${(ld/maxVal)*100}%; background:#2383e2;"></div></div><div class="stat-bar-val" style="color:#2383e2;">${ld}</div></div>
        <div class="stat-bar-row"><div class="stat-bar-label">🧺 其他</div><div class="stat-bar-track"><div class="stat-bar-fill" style="width:${(od/maxVal)*100}%; background:#f2994a;"></div></div><div class="stat-bar-val" style="color:#f2994a;">${od}</div></div>
        <div class="stat-bar-row"><div class="stat-bar-label">💪 锻炼</div><div class="stat-bar-track"><div class="stat-bar-fill" style="width:${(ed/maxVal)*100}%; background:#27ae60;"></div></div><div class="stat-bar-val" style="color:#27ae60;">${ed}</div></div>
        <div class="stat-bar-row" style="margin-top:auto; border-top:1px dashed var(--border-color); padding-top:12px;"><div class="stat-bar-label">总计</div><div class="stat-bar-track"></div><div class="stat-bar-val" style="font-size:1.2em;">${ld+od+ed}</div></div>
        ${logHtml}`;
    let chartHtml = '';
    const today = new Date(getTodayString() + 'T00:00:00');
    let maxDayTotal = 1;
    const dayData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const ds = formatDate(d.getFullYear(), d.getMonth(), d.getDate());
        let dayTotal = 0;
        getTasksForDate(ds).forEach(t => { const pr = getTaskProgress(t, ds); dayTotal += pr.done; });
        const checks = appData.dailyExerciseChecks[ds] || {};
        const manual = appData.exerciseSchedule[ds] || [];
        const slotSched = (appData.exerciseTimeSlotSchedule && appData.exerciseTimeSlotSchedule[ds]) || {};
        let allSlotExs = [];
        Object.values(slotSched).forEach(arr => { allSlotExs = allSlotExs.concat(arr); });
        const rec = appData.exercises.filter(ex => isRecurringMatch(ex.recurringType, ds)).map(ex => ex.name);
        [...new Set([...manual, ...allSlotExs, ...rec])].forEach(n => {
            const ex = appData.exercises.find(e => e.name === n);
            if (!ex) return;
            if (!ex.subTasks || ex.subTasks.length === 0) { if (checks[ex.id]) dayTotal++; }
            else ex.subTasks.forEach(sub => { if (checks[`${ex.id}_${sub.id}`]) dayTotal++; });
        });
        dayData.push({ label: `${d.getMonth()+1}/${d.getDate()}`, val: dayTotal });
        if (dayTotal > maxDayTotal) maxDayTotal = dayTotal;
    }
    dayData.forEach(d => { const hPct = (d.val / maxDayTotal) * 100; chartHtml += `<div class="chart-col"><div class="chart-bar" style="height:${hPct}%;" data-val="${d.val}"></div><div class="chart-label">${d.label}</div></div>`; });
    document.getElementById('stats-chart-content').innerHTML = chartHtml;
    document.getElementById('stats-modal').classList.add('active');
};
window.closeStatsModal = function() { document.getElementById('stats-modal').classList.remove('active'); };
function renderYearHeatmap() {
    ensureEnergyData();
    document.getElementById('year-display').innerText = appData.viewYear + '年';
    const h = document.getElementById('year-heatmap');
    if (!h) return;
    const frag = document.createDocumentFragment();
    const y = appData.viewYear;
    const sd = new Date(y, 0, 1), ed = new Date(y, 11, 31);
    const td = getTodayString();
    const startOfYear = new Date(y, 0, 0);
    for (let d = new Date(sd); d <= ed; d.setDate(d.getDate() + 1)) {
        const ds = formatDate(d.getFullYear(), d.getMonth(), d.getDate());
        const div = document.createElement('div');
        div.className = 'heatmap-cell';
        const diff = d - startOfYear;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);
        div.innerText = dayOfYear;
        const l = calcProgress(ds, 'learning'), o = calcProgress(ds, 'other'), e = calcProgress(ds, '锻炼');
        const tot = l.total + o.total + e.total, done = l.done + o.done + e.done;
        if (tot > 0) {
            const pct = (done / tot) * 100;
            if (pct === 100) { div.style.backgroundColor = '#27ae60'; div.style.color = '#fff'; }
            else { const hue = pct * 1.2; div.style.backgroundColor = `hsl(${hue}, 70%, 60%)`; div.style.color = hue > 50 ? '#333' : '#fff'; }
        } else { div.style.backgroundColor = 'var(--bg-sidebar)'; div.style.color = 'var(--text-muted)'; }
        if (ds === td) div.classList.add('today-cell');
        div.onclick = () => { jumpToDay(ds); appData.viewYear = d.getFullYear(); appData.viewMonth = d.getMonth(); };
        frag.appendChild(div);
    }
    h.innerHTML = '';
    h.appendChild(frag);
    const g = appData.yearlyGoals || "";
    document.getElementById('yearly-goals').innerText = g;
    document.getElementById('yearly-goals-bottom').value = g;
}
function renderCalendar() {
    ensureEnergyData();
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const y = appData.viewYear, m = appData.viewMonth;
    document.getElementById('month-display').innerText = `${y}年 ${m+1}月`;
    ['一','二','三','四','五','六','日'].forEach(d => {
        const h = document.createElement('div'); h.className = 'calendar-header-cell'; h.innerText = '周' + d; grid.appendChild(h);
    });
    const dim = new Date(y, m+1, 0).getDate();
    let fd = new Date(y, m, 1).getDay();
    if (fd === 0) fd = 7;
    for (let i = 1; i < fd; i++) grid.appendChild(document.createElement('div'));
    const todayStr = getTodayString();
    for (let i = 1; i <= dim; i++) {
        const ds = formatDate(y, m, i);
        const div = document.createElement('div');
        const lp = calcProgress(ds, 'learning'), op = calcProgress(ds, 'other'), ep = calcProgress(ds, '锻炼');
        const tot = lp.total + op.total + ep.total, done = lp.done + op.done + ep.done;
        const allDone = tot > 0 && done === tot;
        const isToday = ds === todayStr;
        const isActive = ds === appData.selectedDate;
        div.className = 'day-box' + (isActive ? ' active' : '') + (allDone ? ' all-done' : '') + (isToday ? ' is-today' : '');
        let sHtml = '<div class="day-summary">';
        if (lp.total > 0) { const p = Math.round((lp.done/lp.total)*100); sHtml += `<div class="mini-bar-row"><span>📚学习</span><div class="mini-bar-bg"><div class="mini-bar-fill" style="width:${p}%;background:#2383e2;"></div></div><span>${p}%</span></div>`; }
        if (op.total > 0) { const p = Math.round((op.done/op.total)*100); sHtml += `<div class="mini-bar-row"><span>🧺其他</span><div class="mini-bar-bg"><div class="mini-bar-fill" style="width:${p}%;background:#f2994a;"></div></div><span>${p}%</span></div>`; }
        if (ep.total > 0) { const p = Math.round((ep.done/ep.total)*100); sHtml += `<div class="mini-bar-row"><span>💪锻炼</span><div class="mini-bar-bg"><div class="mini-bar-fill" style="width:${p}%;background:#27ae60;"></div></div><span>${p}%</span></div>`; }
        if (tot === 0) sHtml += '<div style="color:var(--text-muted);font-size:var(--font-small);text-align:center;margin-top:8px;">🌸 无任务</div>';
        sHtml += '</div>';
        let refl = '';
        if (appData.dailyReflections[ds] && appData.dailyReflections[ds].trim()) {
            const t = appData.dailyReflections[ds].trim();
            refl = `<div class="reflection-preview" title="${t}">📝 ${t.length > 6 ? t.substring(0,6)+'...' : t}</div>`;
        }
        const dl = appData.tasks.filter(t => t.deadline === ds && !t.completed && !t.countOnly && t.type !== 'todo');
        let dHtml = '';
        if (dl.length > 0) { const dt = dl.map(t => t.text).join(', '); dHtml = `<div class="deadline-preview" title="截止任务: ${dt}">⏰ ${dt.length > 6 ? dt.substring(0,6)+'...' : dt}</div>`; }
        const todayBadge = isToday ? '<span class="today-badge">今天</span>' : '';
        div.innerHTML = `<div class="day-number">${i}${todayBadge}</div>${sHtml}${refl}${dHtml}`;
        const completedTasks = getTasksForDate(ds).filter(t => !t.countOnly && isTaskDone(t, ds));
        const learning = completedTasks.filter(t => t.type === 'learning').map(t => t.text);
        const other = completedTasks.filter(t => t.type === 'other').map(t => t.text);
        const logs = (appData.dailyLogs && appData.dailyLogs[ds]) ? appData.dailyLogs[ds] : {};
        const countLogs = [];
        Object.values(logs).forEach(l => { if (l.delta !== 0) countLogs.push(`${l.name}: ${l.delta > 0 ? '+' : ''}${l.delta}`); });
        let tooltipArr = [];
        if (learning.length > 0) tooltipArr.push(`📚 学习:\n - ${learning.join('\n - ')}`);
        if (other.length > 0) tooltipArr.push(`🧺 其他:\n - ${other.join('\n - ')}`);
        const exCompleted = [];
        const manualEx = appData.exerciseSchedule[ds] || [];
        const slotSched = (appData.exerciseTimeSlotSchedule && appData.exerciseTimeSlotSchedule[ds]) || {};
        let allSlotExs = [];
        Object.values(slotSched).forEach(arr => { allSlotExs = allSlotExs.concat(arr); });
        [...new Set([...manualEx, ...allSlotExs, ...appData.exercises.filter(ex => isRecurringMatch(ex.recurringType, ds)).map(ex=>ex.name)])].forEach(n => {
            const ex = appData.exercises.find(e => e.name === n);
            if (ex && isCategoryAllCheckedForDate(ex.id, ds)) exCompleted.push(n);
        });
        if (exCompleted.length > 0) tooltipArr.push(`💪 锻炼:\n - ${exCompleted.join('\n - ')}`);
        if (countLogs.length > 0) tooltipArr.push(`\n🔄 计数记录:\n - ${countLogs.join('\n - ')}`);
        if (tooltipArr.length === 0) tooltipArr.push('当日暂无已完成任务');
        div.title = tooltipArr.join('\n');
        div.onclick = () => { jumpToDay(ds); };
        grid.appendChild(div);
    }
    const mDetails = document.getElementById('month-summary-details');
    const mText = document.getElementById('month-summary-textarea');
    if (mText && mDetails) {
        const mKey = `${y}-${m}`;
        const mVal = appData.monthlyReflections?.[mKey] || '';
        mText.value = mVal;
        mDetails.open = !!mVal;
    }
}
function createWeekTaskDOM(t, ds, options = {}) {
    const item = document.createElement('div');
    item.className = 'task-item';
    item.draggable = true;
    item.ondragstart = (e) => { isDraggingActive = true; drag(e, t.id); };
    if (t.type === 'todo') {
        item.classList.add('todo-pool-item');
        const text = document.createElement('span'); text.className = 'task-text'; text.innerText = t.text; item.appendChild(text);
        const kindTag = document.createElement('span'); kindTag.className = 'task-tag todo-kind'; kindTag.innerText = t.todoKind === 'other' ? '🧺 其他' : '📚 学习'; item.appendChild(kindTag);
        const del = document.createElement('span'); del.className = 'task-delete-btn'; del.innerText = '🗑️'; del.title = '删除此任务';
        del.onclick = (e) => { e.stopPropagation(); e.preventDefault(); deleteTaskFromWeek(t.id); };
        del.ondragstart = (e) => e.stopPropagation();
        item.appendChild(del);
        return item;
    }
    if (t.countOnly) {
        item.classList.add('count-task');
        const text = document.createElement('span'); text.className = 'task-text'; text.innerText = `🔄 ${t.text} (${t.countTotal || 0}次)`; item.appendChild(text);
        if (options.slotDate && options.slotId) {
            item.classList.add('in-slot');
            const rm = document.createElement('span'); rm.className = 'task-unschedule-btn'; rm.innerText = '↩️'; rm.title = '移出时间池';
            rm.onclick = (e) => { e.stopPropagation(); e.preventDefault(); t.timeSlots = (t.timeSlots || []).filter(k => k !== (options.slotDate + '_' + options.slotId)); saveDataToFile(appData); renderWeekBoard(); renderTaskPool(); };
            rm.ondragstart = (e) => e.stopPropagation();
            item.appendChild(rm);
        }
        return item;
    } else {
        const p = getTaskProgress(t, ds);
        const isDone = isTaskDone(t, ds);
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = isDone; cb.onclick = (e) => e.stopPropagation(); cb.onchange = () => toggleMainTaskFromWeek(t.id, ds);
        const text = document.createElement('span'); text.className = 'task-text' + (isDone ? ' task-completed' : '');
        text.innerText = (t.target || (t.subTasks && t.subTasks.length > 0)) ? `${t.text} (${p.done}/${p.total})` : t.text;
        item.appendChild(cb); item.appendChild(text);
    }
    if (t.timeSlot || t._poolOrigin) {
        item.classList.add('in-slot');
        const rm = document.createElement('span'); rm.className = 'task-unschedule-btn'; rm.innerText = '↩️'; rm.title = t._poolOrigin ? '移回待办池' : '移回未安排';
        rm.onclick = (e) => { e.stopPropagation(); e.preventDefault(); unscheduleTask(t.id); };
        rm.ondragstart = (e) => e.stopPropagation();
        item.appendChild(rm);
    }
    const del = document.createElement('span'); del.className = 'task-delete-btn'; del.innerText = '🗑️'; del.title = '删除此任务';
    del.onclick = (e) => { e.stopPropagation(); e.preventDefault(); deleteTaskFromWeek(t.id); };
    del.ondragstart = (e) => e.stopPropagation();
    item.appendChild(del);
    return item;
}
function removeExerciseFromDate(name, ds) {
    if (!appData.exerciseSchedule[ds]) return;
    appData.exerciseSchedule[ds] = appData.exerciseSchedule[ds].filter(n => n !== name);
    if (appData.exerciseSchedule[ds].length === 0) delete appData.exerciseSchedule[ds];
}
function isExerciseAllChecked(ds, ex) { if (!ex) return false; return isCategoryAllCheckedForDate(ex.id, ds); }
function renderWeekBoard() {
    ensureEnergyData();
    const board = document.getElementById('week-board');
    if (!board) return;
    board.innerHTML = '';
    const wd = ['周一','周二','周三','周四','周五','周六','周日'];
    const bd = new Date(appData.viewWeekBaseDate);
    const dow = bd.getDay() || 7;
    const mon = new Date(bd);
    mon.setDate(bd.getDate() - dow + 1);
    const todayStr = getTodayString();
    document.getElementById('week-display').innerText = `${mon.getMonth()+1}月${mon.getDate()}日 那一周`;
    const dates = [];
    for (let i = 0; i < 7; i++) { const cd = new Date(mon); cd.setDate(mon.getDate() + i); dates.push(formatDate(cd.getFullYear(), cd.getMonth(), cd.getDate())); }
    const wkDetails = document.getElementById('week-summary-details');
    const wkText = document.getElementById('week-summary-textarea');
    if (!appData.weeklyReflections) appData.weeklyReflections = {};
    const wkKey = appData.viewWeekBaseDate;
    const wkVal = appData.weeklyReflections[wkKey] || '';
    if (wkText) wkText.value = wkVal;
    if (wkDetails) wkDetails.open = !!wkVal;
    if (wkText) wkText.oninput = (e) => { appData.weeklyReflections[wkKey] = e.target.value; saveDataToFile(appData); };
    if (window.innerWidth <= 768) {
        board.style.gridTemplateColumns = '';
        wd.forEach((dn, i) => {
            const ds = dates[i];
            const isToday = ds === todayStr;
            const col = document.createElement('div');
            col.className = 'week-column' + (isToday ? ' today-col' : '');
            col.innerHTML = `<div class="week-column-header" onclick="jumpToDay('${ds}')">${dn} <br><span style="font-size:var(--font-small);color:var(--text-muted);">${new Date(ds).getMonth()+1}/${new Date(ds).getDate()}</span>${isToday ? '<br><span class="week-today-badge">今天</span>' : ''}</div>`;
            getTasksForDate(ds).forEach(t => {
                if (t.countOnly && !t.timeSlot) return;
                const item = createWeekTaskDOM(t, ds);
                if (t.timeSlot) {
                    const ts = appData.timeSlots.find(x => x.id === t.timeSlot);
                    if (ts) { const tag = document.createElement('span'); tag.style = 'font-size:10px;color:var(--text-muted);margin-left:4px;'; tag.innerText = ts.label.split('-')[0]; item.appendChild(tag); }
                }
                col.appendChild(item);
            });
            const manual = appData.exerciseSchedule[ds] || [];
            const slotSched = (appData.exerciseTimeSlotSchedule && appData.exerciseTimeSlotSchedule[ds]) || {};
            let allSlotExs = [];
            Object.values(slotSched).forEach(arr => { allSlotExs = allSlotExs.concat(arr); });
            const rec = appData.exercises.filter(e => isRecurringMatch(e.recurringType, ds)).map(e => e.name);
            const names = [...new Set([...manual.filter(n => !allSlotExs.includes(n)), ...rec.filter(n => !allSlotExs.includes(n))])];
            names.forEach(n => {
                const ex = appData.exercises.find(e => e.name === n);
                if (!ex) return;
                const ad = isCategoryAllCheckedForDate(ex.id, ds);
                const exDiv = document.createElement('div'); exDiv.className = 'exercise-capsule'; exDiv.draggable = true;
                exDiv.ondragstart = (e) => { isDraggingActive = true; dragExercise(e, n, 'date:' + ds); };
                const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = ad;
                cb.onchange = (e) => {
                    const target = e.target.checked;
                    const result = setCategoryExerciseChecked(ex.id, ds, target);
                    applyExerciseEffects(result.was, result.now, result.cost);
                    renderWeekBoard(); renderCalendar(); renderYearHeatmap(); updateFixedProgressBars(); renderEnergyAndRPG(); saveDataToFile(appData);
                };
                const lbl = document.createElement('span'); lbl.innerText = '💪 ' + n;
                const del = document.createElement('span'); del.className = 'ex-del-btn'; del.innerText = '✕';
                del.onclick = (e) => { e.stopPropagation(); removeExerciseFromDate(n, ds); saveDataToFile(appData); renderWeekBoard(); renderCalendar(); renderYearHeatmap(); updateFixedProgressBars(); };
                exDiv.appendChild(cb); exDiv.appendChild(lbl); exDiv.appendChild(del);
                col.appendChild(exDiv);
            });
            const fbDaySch = (appData.fixedBlockSchedule && appData.fixedBlockSchedule[ds]) || {};
            Object.keys(fbDaySch).forEach(tsId => {
                const tsl = appData.timeSlots.find(x => x.id === tsId);
                fbDaySch[tsId].forEach(fbi => {
                    const fbEl = document.createElement('div'); fbEl.className = 'fixed-block-item';
                    const txt = document.createElement('span'); txt.innerText = (tsl ? tsl.label.split('-')[0] + ' ' : '') + fbi.name;
                    const rm = document.createElement('span'); rm.className = 'fb-del'; rm.innerText = '✕'; rm.title = '移除该固定块';
                    rm.onclick = (e) => { e.stopPropagation(); removeFixedBlockInstance(ds, tsId, fbi.id); };
                    fbEl.appendChild(txt); fbEl.appendChild(rm);
                    col.appendChild(fbEl);
                });
            });
            board.appendChild(col);
        });
        return;
    }
    board.style.gridTemplateColumns = `60px repeat(7, 1fr)`;
    board.appendChild(document.createElement('div'));
    wd.forEach((dn, i) => {
        const ds = dates[i];
        const isToday = ds === todayStr;
        const header = document.createElement('div');
        header.className = 'week-grid-header' + (isToday ? ' today-col' : '');
        header.innerHTML = `<span onclick="jumpToDay('${ds}')" style="cursor:pointer">${dn}<br><span style="font-size:var(--font-small);">${new Date(ds).getMonth()+1}/${new Date(ds).getDate()}</span></span>`;
        board.appendChild(header);
    });
    appData.timeSlots.forEach(ts => {
        const timeCell = document.createElement('div'); timeCell.className = 'week-time-cell'; timeCell.innerText = ts.label.replace('-', '\n');
        board.appendChild(timeCell);
        dates.forEach(ds => {
            const isToday = ds === todayStr;
            const cell = document.createElement('div');
            cell.className = 'week-grid-cell' + (isToday ? ' today-col' : '');
            cell.dataset.date = ds; cell.dataset.timeslot = ts.id;
            cell.ondrop = (e) => handleDrop(e, ds, ts.id); cell.ondragover = allowDrop;
            getTasksForDate(ds).filter(t => t.timeSlot === ts.id && !t.countOnly).forEach(t => {
                const item = createWeekTaskDOM(t, ds); item.classList.add('lecture-task'); cell.appendChild(item);
            });
            appData.tasks.filter(t => t.countOnly && t.timeSlots && t.timeSlots.includes(ds + '_' + ts.id)).forEach(t => {
                const item = createWeekTaskDOM(t, ds, { slotDate: ds, slotId: ts.id }); item.classList.add('lecture-task'); cell.appendChild(item);
            });
            const exSched = (appData.exerciseTimeSlotSchedule && appData.exerciseTimeSlotSchedule[ds] && appData.exerciseTimeSlotSchedule[ds][ts.id]) || [];
            exSched.forEach(exName => {
                const ex = appData.exercises.find(e => e.name === exName);
                if (!ex) return;
                const ad = isCategoryAllCheckedForDate(ex.id, ds);
                const exDiv = document.createElement('div'); exDiv.className = 'exercise-capsule'; exDiv.style.margin = '0'; exDiv.draggable = true;
                exDiv.ondragstart = (e) => { isDraggingActive = true; dragExercise(e, exName, 'slot:' + ds + ':' + ts.id); };
                const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = ad;
                cb.onchange = (e) => {
                    const target = e.target.checked;
                    const result = setCategoryExerciseChecked(ex.id, ds, target);
                    applyExerciseEffects(result.was, result.now, result.cost);
                    renderWeekBoard(); renderCalendar(); renderYearHeatmap(); updateFixedProgressBars(); renderEnergyAndRPG(); saveDataToFile(appData);
                };
                const lbl = document.createElement('span'); lbl.innerText = '💪 ' + exName; lbl.style.fontSize = '12px';
                const del = document.createElement('span'); del.className = 'ex-del-btn'; del.innerText = '✕';
                del.onclick = (e) => {
                    e.stopPropagation();
                    if (appData.exerciseTimeSlotSchedule[ds] && appData.exerciseTimeSlotSchedule[ds][ts.id]) {
                        appData.exerciseTimeSlotSchedule[ds][ts.id] = appData.exerciseTimeSlotSchedule[ds][ts.id].filter(n => n !== exName);
                        saveDataToFile(appData); renderWeekBoard(); renderCalendar(); renderYearHeatmap(); updateFixedProgressBars();
                    }
                };
                exDiv.appendChild(cb); exDiv.appendChild(lbl); exDiv.appendChild(del);
                cell.appendChild(exDiv);
            });
            const fbSched = (appData.fixedBlockSchedule && appData.fixedBlockSchedule[ds]) || {};
            (fbSched[ts.id] || []).forEach(fbi => {
                const fbEl = document.createElement('div'); fbEl.className = 'fixed-block-item';
                const txt = document.createElement('span'); txt.innerText = fbi.name;
                const rm = document.createElement('span'); rm.className = 'fb-del'; rm.innerText = '✕'; rm.title = '移除该固定块';
                rm.onclick = (e) => { e.stopPropagation(); removeFixedBlockInstance(ds, ts.id, fbi.id); };
                fbEl.appendChild(txt); fbEl.appendChild(rm);
                cell.appendChild(fbEl);
            });
            board.appendChild(cell);
        });
    });
}
window.deleteTaskFromWeek = function(id) {
    const t = appData.tasks.find(x => x.id === id);
    if (!t) return;
    if (!confirm(`删除任务【${t.text}】？`)) return;
    appData.tasks = appData.tasks.filter(x => x.id !== id);
    saveDataToFile(appData);
    renderTaskPool(); renderWeekBoard(); renderDayPlan(); renderCalendar(); renderYearHeatmap(); updateFixedProgressBars();
    refreshDetailModalIfOpen();
};
function renderExercisePool() {
    const pool = document.getElementById('exercise-pool');
    if (!pool) return;
    pool.innerHTML = '';
    appData.exercises.forEach(ex => {
        const div = document.createElement('div'); div.className = 'exercise-capsule'; div.innerText = ex.name; div.draggable = true;
        div.ondragstart = (e) => { isDraggingActive = true; dragExercise(e, ex.name, 'pool'); };
        pool.appendChild(div);
    });
}
function renderFixedBlockPool() {
    const pool = document.getElementById('fixed-block-pool');
    if (!pool) return;
    ensureEnergyData();
    pool.innerHTML = '';
    appData.fixedBlocks.forEach(fb => {
        const div = document.createElement('div'); div.className = 'fixed-block-capsule'; div.draggable = true;
        div.ondragstart = (e) => { isDraggingActive = true; dragFixedBlock(e, fb.id); };
        const txt = document.createElement('span'); txt.innerText = '📌 ' + fb.name; txt.title = '双击改名';
        txt.ondblclick = (e) => { e.stopPropagation(); renameFixedBlock(fb.id); };
        const del = document.createElement('span'); del.className = 'fb-del-btn'; del.innerText = '✕'; del.title = '删除该固定块';
        del.onclick = (e) => { e.stopPropagation(); deleteFixedBlock(fb.id); };
        div.appendChild(txt); div.appendChild(del);
        pool.appendChild(div);
    });
    if (appData.fixedBlocks.length === 0) pool.innerHTML = '<span style="font-size:var(--font-hint);color:var(--text-muted);">暂无固定块，点右上角添加</span>';
}
window.addFixedBlock = function() {
    ensureEnergyData();
    const n = prompt('固定块名称（如：上课、吃饭）：');
    if (!n || !n.trim()) return;
    appData.fixedBlocks.push({ id: 'fb_' + Date.now(), name: n.trim(), energyCost: 0 });
    renderFixedBlockPool(); renderFixedBlockEnergyConfig(); saveDataToFile(appData);
};
window.renameFixedBlock = function(id) {
    const fb = appData.fixedBlocks.find(b => b.id === id);
    if (!fb) return;
    const n = prompt('修改固定块名称：', fb.name);
    if (!n || !n.trim() || n === fb.name) return;
    fb.name = n.trim();
    if (appData.fixedBlockSchedule) {
        Object.keys(appData.fixedBlockSchedule).forEach(d => Object.keys(appData.fixedBlockSchedule[d]).forEach(ts => appData.fixedBlockSchedule[d][ts].forEach(fbi => { if (fbi.blockId === id) fbi.name = fb.name; })));
    }
    renderFixedBlockPool(); renderWeekBoard(); renderFixedBlockEnergyConfig(); saveDataToFile(appData);
};
window.deleteFixedBlock = function(id) {
    const fb = appData.fixedBlocks.find(b => b.id === id);
    if (!fb) return;
    if (!confirm(`删除固定块【${fb.name}】？已排期的实例也会一并移除。`)) return;
    appData.fixedBlocks = appData.fixedBlocks.filter(b => b.id !== id);
    if (appData.fixedBlockSchedule) {
        Object.keys(appData.fixedBlockSchedule).forEach(d => {
            Object.keys(appData.fixedBlockSchedule[d]).forEach(ts => {
                appData.fixedBlockSchedule[d][ts] = appData.fixedBlockSchedule[d][ts].filter(fbi => fbi.blockId !== id);
                if (appData.fixedBlockSchedule[d][ts].length === 0) delete appData.fixedBlockSchedule[d][ts];
            });
            if (Object.keys(appData.fixedBlockSchedule[d]).length === 0) delete appData.fixedBlockSchedule[d];
        });
    }
    renderFixedBlockPool(); renderWeekBoard(); renderFixedBlockEnergyConfig(); saveDataToFile(appData);
};
window.removeFixedBlockInstance = function(ds, tsId, instId) {
    if (!appData.fixedBlockSchedule?.[ds]?.[tsId]) return;
    appData.fixedBlockSchedule[ds][tsId] = appData.fixedBlockSchedule[ds][tsId].filter(x => x.id !== instId);
    if (appData.fixedBlockSchedule[ds][tsId].length === 0) delete appData.fixedBlockSchedule[ds][tsId];
    if (Object.keys(appData.fixedBlockSchedule[ds]).length === 0) delete appData.fixedBlockSchedule[ds];
    saveDataToFile(appData); renderWeekBoard(); renderEnergyAndRPG();
};
function renderTaskPool() {
    ensureEnergyData();
    const td = getTodayString();
    const pl = document.getElementById('task-pool-learning');
    const po = document.getElementById('task-pool-other');
    const povd = document.getElementById('task-pool-overdue');
    const ovdWrapper = document.getElementById('overdue-wrapper');
    pl.innerHTML = ''; po.innerHTML = ''; povd.innerHTML = '';
    let hasOverdue = false;
    ['learning', 'other'].forEach(type => {
        const pool = type === 'learning' ? pl : po;
        appData.tasks.filter(t => {
            if (t.type === 'todo') { const kind = t.todoKind === 'other' ? 'other' : 'learning'; return kind === type; }
            if (t.type !== type) return false;
            if (t.countOnly) return true;
            if (t.date === 'pool') return true;
            if (!t.timeSlot) return true;
            return false;
        }).forEach(t => {
            const ds = t.date === 'pool' || t.type === 'todo' ? appData.selectedDate : t.date;
            const item = createWeekTaskDOM(t, ds);
            if (t.type !== 'todo') {
                if (t.date === 'pool') { const tag = document.createElement('span'); tag.className = 'task-tag'; tag.innerText = '待安排'; item.appendChild(tag); }
                else if (t.date && t.date !== 'pool') {
                    const d = new Date(t.date + 'T00:00:00');
                    const tagText = t.date === td ? '今日' : `${d.getMonth()+1}/${d.getDate()}`;
                    const tag = document.createElement('span'); tag.className = 'task-tag'; tag.innerText = tagText; item.appendChild(tag);
                }
            }
            pool.appendChild(item);
        });
    });
    appData.tasks.filter(t => t.type !== 'todo' && t.date !== 'pool' && t.date < td && !isTaskDone(t, t.date) && !t.countOnly).forEach(t => {
        hasOverdue = true;
        const item = createWeekTaskDOM(t, t.date);
        const tag = document.createElement('span'); tag.className = 'task-tag overdue'; tag.innerText = `逾期 ${t.date.substring(5)}`;
        item.appendChild(tag);
        povd.appendChild(item);
    });
    ovdWrapper.style.display = hasOverdue ? 'block' : 'none';
}
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
window.manualSyncNow = function() {
    if (!conn || !conn.open) { showMiniToast('暂无连接，无法同步'); return; }
    const btn = document.getElementById('btn-sync-now');
    if (btn && btn.disabled) return;
    if (isSyncing) return;
    if (btn) { btn.disabled = true; btn.classList.add('syncing'); btn.textContent = '同步中...'; }
    let ok = false;
    try {
        resetSyncedBaseline({});
        broadcastDiffs(appData);
        conn.send({ type: 'SYNC_MERGE', payload: appData, lastModified: appData._lastModified || Date.now(), requestResponse: true, isManualSync: true });
        ok = true;
    } catch (err) { console.error('手动同步失败', err); }
    finally {
        setTimeout(() => { if (btn) { btn.disabled = false; btn.classList.remove('syncing'); btn.textContent = '立即同步'; } }, 800);
    }
    showMiniToast(ok ? '同步成功' : '同步失败');
};
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
            if (data.requestResponse) {
                try { connection.send({ type: 'SYNC_MERGE', payload: appData, lastModified: appData._lastModified || Date.now() }); } catch(e) { console.warn('同步回传失败', e); }
            }
            if (data.isManualSync) showMiniToast('同步成功');
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
        try { saveDataToFile(appData); } catch(e) { console.error('切后台保存失败', e); }
    } else {
        document.body.classList.remove('invisible-anim');
    }
});
window.addEventListener('pagehide', () => { try { saveDataToFile(appData); } catch(e) { console.error('pagehide 保存失败', e); } });
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