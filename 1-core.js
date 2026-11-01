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
