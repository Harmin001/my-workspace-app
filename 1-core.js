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

/* ===== FIX-INJECT-BEGIN: core-settings ===== */
/* ------------------------------------------------------------------
 * 修复注入：设置默认配置
 * 目的：
 *   1) 提供完整的默认设置常量 DEFAULT_SETTINGS
 *   2) 初始化时若本地存储没有数据，可直接使用默认值
 *   3) 提供 ensureSettingsDefaults()，用于把已有的 appData 补全为完整设置
 *   4) 提供 loadSettingsFromStorage()，供 9-init.js 初始化时读取
 * 说明：原有代码（DEFAULT_LEVELS / DEFAULT_TIMESLOTS / DEFAULT_FIXED_BLOCKS /
 *       appData / peer 等）全部保留，本段只做增量补充。
 * ------------------------------------------------------------------ */

const DEFAULT_SETTINGS = {
    themeColor: '#2383e2',
    themeMode: 'light',
    fonts: { title: '18px', content: '14px', hint: '12px', small: '10px' },
    radius: '8px',
    maxVisible: 5,
    animationEnabled: true,
    energyMax: 200,
    energyWarnThreshold: 30,
    expRatio: 0.6,
    napEnergy: 50,
    breakEnergy: 20,
    levelConfig: { levels: JSON.parse(JSON.stringify(DEFAULT_LEVELS)) },
    commonBtns: ['skip', 'target', 'loop', 'deadline', 'delete'],
    timeSlots: JSON.parse(JSON.stringify(DEFAULT_TIMESLOTS)),
    fixedBlocks: JSON.parse(JSON.stringify(DEFAULT_FIXED_BLOCKS)),
    panelLayout: { order: ['todo', 'learning', 'other', 'exercise'], spans: {}, sizes: {} },
    rpg: { exp: 0, int: 0, vit: 0, cre: 0, foc: 0, wil: 0, streak: 0, lastDate: '' }
};

const SETTINGS_STORAGE_KEY = 'myWorkspaceAppData';

/* 取一份深拷贝的默认设置（避免被外部修改污染常量） */
function getDefaultSettings() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

/* 把 target（默认 appData）补全成完整设置；返回同一个对象 */
function ensureSettingsDefaults(target) {
    const t = (target && typeof target === 'object')
        ? target
        : (typeof appData !== 'undefined' ? appData : null);
    if (!t) return getDefaultSettings();

    const d = getDefaultSettings();

    /* 顶层字段补全 */
    Object.keys(d).forEach(function (k) {
        if (t[k] === undefined || t[k] === null) t[k] = JSON.parse(JSON.stringify(d[k]));
    });

    /* 字体对象逐项补全 */
    if (!t.fonts || typeof t.fonts !== 'object') t.fonts = JSON.parse(JSON.stringify(d.fonts));
    ['title', 'content', 'hint', 'small'].forEach(function (k) {
        if (!t.fonts[k] || isNaN(parseInt(t.fonts[k], 10))) t.fonts[k] = d.fonts[k];
    });

    /* 等级配置 */
    if (!t.levelConfig || !Array.isArray(t.levelConfig.levels) || t.levelConfig.levels.length === 0) {
        t.levelConfig = JSON.parse(JSON.stringify(d.levelConfig));
    }

    /* 数组类设置 */
    if (!Array.isArray(t.commonBtns)) t.commonBtns = d.commonBtns.slice();
    if (!Array.isArray(t.timeSlots) || t.timeSlots.length === 0) {
        t.timeSlots = JSON.parse(JSON.stringify(d.timeSlots));
    }
    if (!Array.isArray(t.fixedBlocks) || t.fixedBlocks.length === 0) {
        t.fixedBlocks = JSON.parse(JSON.stringify(d.fixedBlocks));
    }

    /* 面板布局 */
    if (!t.panelLayout || typeof t.panelLayout !== 'object') {
        t.panelLayout = JSON.parse(JSON.stringify(d.panelLayout));
    }
    if (!Array.isArray(t.panelLayout.order) || t.panelLayout.order.length === 0) {
        t.panelLayout.order = d.panelLayout.order.slice();
    }
    if (!t.panelLayout.spans) t.panelLayout.spans = {};
    if (!t.panelLayout.sizes) t.panelLayout.sizes = {};

    /* 数值类设置 */
    if (typeof t.energyMax !== 'number' || t.energyMax <= 0) t.energyMax = d.energyMax;
    if (typeof t.energyWarnThreshold !== 'number') t.energyWarnThreshold = d.energyWarnThreshold;
    if (typeof t.expRatio !== 'number' || t.expRatio <= 0 || t.expRatio > 1) t.expRatio = d.expRatio;
    if (typeof t.napEnergy !== 'number') t.napEnergy = d.napEnergy;
    if (typeof t.breakEnergy !== 'number') t.breakEnergy = d.breakEnergy;
    if (typeof t.maxVisible !== 'number' || t.maxVisible < 1) t.maxVisible = d.maxVisible;
    if (typeof t.animationEnabled !== 'boolean') t.animationEnabled = d.animationEnabled;
    if (!t.radius || isNaN(parseInt(t.radius, 10))) t.radius = d.radius;
    if (!t.themeMode) t.themeMode = d.themeMode;
    if (!t.themeColor) t.themeColor = d.themeColor;

    /* RPG */
    if (!t.rpg || typeof t.rpg !== 'object') t.rpg = JSON.parse(JSON.stringify(d.rpg));
    Object.keys(d.rpg).forEach(function (k) {
        if (t.rpg[k] === undefined) t.rpg[k] = d.rpg[k];
    });

    return t;
}

/* 从本地存储读取设置；没有存储数据时返回默认值对象 */
function loadSettingsFromStorage() {
    let stored = null;
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) stored = JSON.parse(raw);
    } catch (e) {
        stored = null;
    }
    return ensureSettingsDefaults((stored && typeof stored === 'object') ? stored : {});
}

/* 挂到 window，方便 9-init.js / 7-events.js 直接调用 */
window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
window.SETTINGS_STORAGE_KEY = SETTINGS_STORAGE_KEY;
window.getDefaultSettings = getDefaultSettings;
window.ensureSettingsDefaults = ensureSettingsDefaults;
window.loadSettingsFromStorage = loadSettingsFromStorage;
/* ===== FIX-INJECT-END: core-settings ===== */

/* ===== FIX-INJECT-BEGIN: core-plan ===== */
/* ------------------------------------------------------------------
 * 修复注入：课表 / 周·月·全年计划 默认基础数据
 * 目的：
 *   1) 提供独立于原常量之外的完整 fallback 数据源，避免原常量被
 *      清空 / 缺失时课表与计划视图失去数据；
 *   2) ensurePlanBaseData() 幂等补全 appData 中计划渲染所需字段；
 *   3) 文件加载时立即执行一次补全，保证后续 6-render / 9-init
 *      能读到合法的基础数据结构。
 * 说明：
 *   - 原有 DEFAULT_LEVELS / DEFAULT_TIMESLOTS / DEFAULT_FIXED_BLOCKS /
 *     appData / 设置修复段（core-settings）全部保留不动；
 *   - 本段只做课表与计划数据的补充，不改事件、同步、设置保存逻辑。
 * ------------------------------------------------------------------ */

const DEFAULT_TIMESLOTS_FALLBACK = [
    { id: 'ts1',  label: '08:30-09:10' },
    { id: 'ts2',  label: '09:15-09:55' },
    { id: 'ts3',  label: '10:10-10:50' },
    { id: 'ts4',  label: '10:55-11:35' },
    { id: 'ts5',  label: '11:35-13:05' },
    { id: 'ts6',  label: '13:10-13:50' },
    { id: 'ts7',  label: '13:55-14:35' },
    { id: 'ts8',  label: '14:45-15:25' },
    { id: 'ts9',  label: '15:30-16:10' },
    { id: 'ts10', label: '16:15-16:55' },
    { id: 'ts11', label: '18:00-18:40' },
    { id: 'ts12', label: '18:45-19:25' },
    { id: 'ts13', label: '19:30-20:10' }
];

const DEFAULT_FIXED_BLOCKS_FALLBACK = [
    { id: 'fb_class',   name: '上课', energyCost: 20 },
    { id: 'fb_meal',    name: '吃饭', energyCost: 5 },
    { id: 'fb_rest',    name: '休息', energyCost: 0 },
    { id: 'fb_commute', name: '通勤', energyCost: 10 }
];

const DEFAULT_WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DEFAULT_MONTH_HEADERS = ['一', '二', '三', '四', '五', '六', '日'];

/* 首次初始化用的示例任务（仅作为常量数据源，不自动写入 appData） */
const DEFAULT_PLAN_SEED_TASKS = [
    {
        id: 'seed_1', text: '搭建个人应用框架', type: 'learning', date: 'pool',
        completed: false, subTasks: [{ id: 'seed_1_1', text: '设计UI', completed: false, energyCost: 5 }],
        deadline: '', pinned: false, energyCost: 10
    },
    {
        id: 'seed_2', text: '看教程视频', type: 'learning', date: '',
        completed: false, subTasks: [], deadline: '', target: 100, current: 10,
        pinned: false, energyCost: 1
    }
];

/* 动态生成默认视图状态（依赖当前日期，不能用常量字面量） */
function getDefaultPlanViewState() {
    var d = new Date();
    var y = d.getFullYear();
    var m = d.getMonth();
    var ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return {
        viewYear: y,
        viewMonth: m,
        viewWeekBaseDate: ds,
        selectedDate: ds
    };
}

/* 取有效的课表默认值：优先原 DEFAULT_TIMESLOTS（非空），否则 fallback */
function getEffectiveTimeSlotsDefault() {
    try {
        if (typeof DEFAULT_TIMESLOTS !== 'undefined' && Array.isArray(DEFAULT_TIMESLOTS) && DEFAULT_TIMESLOTS.length > 0) {
            return JSON.parse(JSON.stringify(DEFAULT_TIMESLOTS));
        }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_TIMESLOTS_FALLBACK));
}

/* 取有效的固定块默认值 */
function getEffectiveFixedBlocksDefault() {
    try {
        if (typeof DEFAULT_FIXED_BLOCKS !== 'undefined' && Array.isArray(DEFAULT_FIXED_BLOCKS) && DEFAULT_FIXED_BLOCKS.length > 0) {
            return JSON.parse(JSON.stringify(DEFAULT_FIXED_BLOCKS));
        }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_FIXED_BLOCKS_FALLBACK));
}

/* 幂等补全：保证计划渲染所需字段一定合法 */
function ensurePlanBaseData(target) {
    var t = target || (typeof appData !== 'undefined' ? appData : null);
    if (!t) return false;
    var changed = false;

    /* 课表时间段：空数组或缺失 → 恢复默认（修复课表消失） */
    if (!Array.isArray(t.timeSlots) || t.timeSlots.length === 0) {
        var dts = getEffectiveTimeSlotsDefault();
        if (dts && dts.length > 0) {
            t.timeSlots = dts;
            t.timeSlotsLastModified = Date.now();
            changed = true;
        }
    }

    /* 固定块：缺失 / 非数组 / 空数组 → 恢复默认 */
    if (t.fixedBlocks === undefined || t.fixedBlocks === null || !Array.isArray(t.fixedBlocks) || t.fixedBlocks.length === 0) {
        t.fixedBlocks = getEffectiveFixedBlocksDefault();
        changed = true;
    }

    /* 任务 / 锻炼：保证为数组 */
    if (!Array.isArray(t.tasks)) { t.tasks = []; changed = true; }
    if (!Array.isArray(t.exercises)) { t.exercises = []; changed = true; }

    /* 周/月/全年计划映射字段 */
    var mapKeys = [
        'dailyReflections', 'weeklyReflections', 'monthlyReflections', 'dailyLogs',
        'dailyEnergy', 'dailyExerciseChecks', 'exerciseSchedule',
        'exerciseTimeSlotSchedule', 'fixedBlockSchedule'
    ];
    for (var i = 0; i < mapKeys.length; i++) {
        var k = mapKeys[i];
        if (!t[k] || typeof t[k] !== 'object' || Array.isArray(t[k])) {
            t[k] = {};
            changed = true;
        }
    }

    /* 视图状态：周/月/全年计划定位 */
    var view = getDefaultPlanViewState();
    if (typeof t.viewYear !== 'number') { t.viewYear = view.viewYear; changed = true; }
    if (typeof t.viewMonth !== 'number' || t.viewMonth < 0 || t.viewMonth > 11) { t.viewMonth = view.viewMonth; changed = true; }
    if (!t.viewWeekBaseDate) { t.viewWeekBaseDate = view.viewWeekBaseDate; changed = true; }
    if (!t.selectedDate) { t.selectedDate = view.selectedDate; changed = true; }

    /* 面板布局 */
    if (!t.panelLayout || typeof t.panelLayout !== 'object') {
        t.panelLayout = { order: ['todo', 'learning', 'other', 'exercise'], spans: {}, sizes: {} };
        changed = true;
    } else {
        if (!Array.isArray(t.panelLayout.order) || t.panelLayout.order.length === 0) {
            t.panelLayout.order = ['todo', 'learning', 'other', 'exercise'];
            changed = true;
        }
        if (!t.panelLayout.spans) { t.panelLayout.spans = {}; changed = true; }
        if (!t.panelLayout.sizes) { t.panelLayout.sizes = {}; changed = true; }
    }

    if (typeof t.yearlyGoals !== 'string') { t.yearlyGoals = ''; changed = true; }

    return changed;
}

/* 修正设置修复段里的 DEFAULT_SETTINGS：避免 timeSlots 为空导致 6-render 读不到默认课表 */
try {
    if (window.DEFAULT_SETTINGS && typeof window.DEFAULT_SETTINGS === 'object') {
        if (!Array.isArray(window.DEFAULT_SETTINGS.timeSlots) || window.DEFAULT_SETTINGS.timeSlots.length === 0) {
            window.DEFAULT_SETTINGS.timeSlots = JSON.parse(JSON.stringify(DEFAULT_TIMESLOTS_FALLBACK));
        }
        if (!Array.isArray(window.DEFAULT_SETTINGS.fixedBlocks) || window.DEFAULT_SETTINGS.fixedBlocks.length === 0) {
            window.DEFAULT_SETTINGS.fixedBlocks = JSON.parse(JSON.stringify(DEFAULT_FIXED_BLOCKS_FALLBACK));
        }
    }
} catch (e) {}

/* 挂到 window，供 6-render / 9-init / 调试使用 */
window.DEFAULT_TIMESLOTS_FALLBACK = DEFAULT_TIMESLOTS_FALLBACK;
window.DEFAULT_FIXED_BLOCKS_FALLBACK = DEFAULT_FIXED_BLOCKS_FALLBACK;
window.DEFAULT_WEEK_DAYS = DEFAULT_WEEK_DAYS;
window.DEFAULT_MONTH_HEADERS = DEFAULT_MONTH_HEADERS;
window.DEFAULT_PLAN_SEED_TASKS = DEFAULT_PLAN_SEED_TASKS;
window.getDefaultPlanViewState = getDefaultPlanViewState;
window.getEffectiveTimeSlotsDefault = getEffectiveTimeSlotsDefault;
window.getEffectiveFixedBlocksDefault = getEffectiveFixedBlocksDefault;
window.ensurePlanBaseData = ensurePlanBaseData;

/* 立即补全一次，保证初始化即存在基础数据源 */
try {
    if (typeof appData !== 'undefined' && appData) ensurePlanBaseData(appData);
} catch (e) {
    if (window.console && console.warn) console.warn('[1-core fix] ensurePlanBaseData 执行失败', e);
}
/* ===== FIX-INJECT-END: core-plan ===== */
