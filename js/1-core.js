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