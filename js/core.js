// ===== 核心模块 =====
// 应用初始化、数据管理、事件系统、模块加载器

const MODULES = {
    tasks: './js/tasks.js',
    calendar: './js/calendar.js',
    day: './js/day.js',
    methods: './js/methods.js',
    settings: './js/settings.js',
    peer: './js/peer.js',
    rpg: './js/rpg.js',
    timer: './js/timer.js',
    util: './js/util.js'
};

// ============ 全局状态 ============
let appData = null;
let isInitComplete = false;

// ============ 工具函数 ============
function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(y, m, d) {
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
}

function ensureStorage() {
    if (!window.localStorage) return;
    try {
        const saved = localStorage.getItem('workbench_data');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed._version && parsed._version >= 2) {
                // 迁移旧数据
                appData = { ...parsed, _version: 3 };
            } else {
                appData = parsed;
            }
        }
    } catch (e) {
        console.warn('[ensureStorage] 读取失败', e);
    }
}

function saveDataToFile(data) {
    if (!window.localStorage) return;
    try {
        const toSave = JSON.parse(JSON.stringify(data));
        toSave._version = 3;
        toSave._lastModified = Date.now();
        localStorage.setItem('workbench_data', JSON.stringify(toSave));
        return true;
    } catch (e) {
        console.warn('[saveDataToFile] 保存失败', e);
        return false;
    }
}

function loadData() {
    ensureStorage();
    // 确保数据结构完整性 - 增加空对象判断兜底
    if (appData && !appData.tasks) appData.tasks = [];
    if (appData && !appData.exercises) appData.exercises = [];
    if (appData && !appData.exerciseSchedule) appData.exerciseSchedule = {};
    if (appData && !appData.exerciseTimeSlotSchedule) appData.exerciseTimeSlotSchedule = {};
    if (appData && !appData.dailyExerciseChecks) appData.dailyExerciseChecks = {};
    if (appData && !appData.dailyReflections) appData.dailyReflections = {};
    if (appData && !appData.weeklyReflections) appData.weeklyReflections = {};
    if (appData && !appData.monthlyReflections) appData.monthlyReflections = {};
    if (appData && !appData.dailyLogs) appData.dailyLogs = {};
    if (appData && !appData.dailyEnergy) appData.dailyEnergy = {};
    if (appData && !appData.dailyEnergyTS) appData.dailyEnergyTS = {};
    if (appData && !appData.fixedBlockSchedule) appData.fixedBlockSchedule = {};
    
    // 默认值 - 增加空对象判断
    if (appData && (appData.energyMax === undefined || appData.energyMax === null)) appData.energyMax = 200;
    if (appData && (appData.energyWarnThreshold === undefined || appData.energyWarnThreshold === null)) appData.energyWarnThreshold = 30;
    if (appData && (appData.expRatio === undefined || appData.expRatio === null)) appData.expRatio = 0.6;
    if (appData && (appData.napEnergy === undefined || appData.napEnergy === null)) appData.napEnergy = 50;
    if (appData && (appData.breakEnergy === undefined || appData.breakEnergy === null)) appData.breakEnergy = 20;
    if (appData && appData.maxVisible === undefined) appData.maxVisible = 5;
    if (appData && appData.animationEnabled === undefined) appData.animationEnabled = true;
    if (appData && appData.supplementYesterdayEnabled === undefined) appData.supplementYesterdayEnabled = true;
    
    return appData;
}

// ============ 事件系统 ============
const eventBus = {
    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    },
    emit(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(cb => cb(data));
        }
    },
    _listeners: {}
};

// ============ 模块加载器 ============
function loadModule(name) {
    const path = MODULES[name];
    if (!path) return null;
    
    return new Promise((resolve, reject) => {
        if (window[name]) {
            resolve(window[name]);
            return;
        }
        
        const script = document.createElement('script');
        script.src = path;
        script.type = 'module';
        script.onload = () => {
            resolve(window[name]);
        };
        script.onerror = (e) => {
            reject(new Error(`Failed to load module ${path}: ${e.message}`));
        };
        document.head.appendChild(script);
    });
}

// ============ 应用初始化 ============
async function initApp() {
    console.log('[initApp] 开始初始化...');
    
    // 加载工具模块
    const util = await loadModule('util');
    
    // 加载核心模块
    const tasks = await loadModule('tasks');
    const calendar = await loadModule('calendar');
    const day = await loadModule('day');
    const methods = await loadModule('methods');
    const settings = await loadModule('settings');
    const peer = await loadModule('peer');
    const rpg = await loadModule('rpg');
    const timer = await loadModule('timer');
    
    // 加载数据
    appData = loadData();
    
    // 初始化各模块 - 增加空对象判断兜底
    if (tasks && typeof tasks.init === 'function') tasks.init();
    if (calendar && typeof calendar.init === 'function') calendar.init();
    if (day && typeof day.init === 'function') day.init();
    if (methods && typeof methods.init === 'function') methods.init();
    if (settings && typeof settings.init === 'function') settings.init();
    if (peer && typeof peer.init === 'function') peer.init();
    if (rpg && typeof rpg.init === 'function') rpg.init();
    if (timer && typeof timer.init === 'function') timer.init();
    
    // 渲染主视图
    renderMainView();
    
    // 自动渲染默认视图（月计划）
    renderDefaultView();
    
    // 绑定侧边栏点击事件
    bindNavClickEvents();
    
    // 标记完成
    isInitComplete = true;
    console.log('[initApp] 初始化完成');
    
    // 派发初始化完成事件
    eventBus.emit('app:init-complete', { appData });
}

// ============ 默认视图渲染 ============
function renderDefaultView() {
    console.log('[renderDefaultView] 渲染默认视图：月计划');
    
    // 从 tasks.js 导入 renderCalendarView 函数
    import('./tasks.js').then(module => {
        if (module.renderCalendarView && typeof module.renderCalendarView === 'function') {
            module.renderCalendarView();
        } else {
            console.warn('[renderDefaultView] renderCalendarView 不存在，跳过月计划渲染');
        }
    }).catch(err => {
        console.warn('[renderDefaultView] 导入 tasks.js 失败:', err);
    });
    
    // 加载 day 和 methods 模块（同步调用）
    const day = loadModule('day');
    const methods = loadModule('methods');
    
    // 确保各视图模块已加载并调用其渲染函数
    if (day && typeof day.renderDay === 'function') {
        day.renderDay();
    }
    if (methods && typeof methods.renderNotes === 'function') {
        methods.renderNotes();
    }
    // 其他视图按需渲染...
}

// ============ 视图切换 ============
function switchView(target) {
    console.log('[switchView] 切换到视图:', target);
    
    // 移除当前视图的 active 类
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    
    // 添加新视图的 active 类
    const viewEl = document.getElementById(`view-${target}`);
    if (viewEl) viewEl.classList.add('active');
    
    // 根据目标视图调用相应的渲染函数
    switch (target) {
        case 'year':
            console.log('[switchView] 渲染全年总览');
            break;
        case 'month':
            console.log('[switchView] 渲染月计划');
            import('./calendar.js').then(module => {
                if (module.renderCalendarView) module.renderCalendarView();
            }).catch(err => console.warn('[switchView] 导入失败:', err));
            break;
        case 'week':
            console.log('[switchView] 渲染周计划');
            break;
        case 'day':
            console.log('[switchView] 渲染日计划');
            if (day && typeof day.renderDay === 'function') day.renderDay();
            break;
        case 'methods':
            console.log('[switchView] 渲染笔记');
            if (methods && typeof methods.renderNotes === 'function') methods.renderNotes();
            break;
        case 'settings':
            console.log('[switchView] 渲染设置');
            break;
        default:
            console.warn('[switchView] 未知视图:', target);
    }
}

// 绑定侧边栏点击事件
function bindNavClickEvents() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.dataset.target;
            if (target) switchView(target);
        });
    });
}

// ============ 主视图渲染 ============
function renderMainView() {
    const container = document.getElementById('app');
    if (!container) return;
    
    container.innerHTML = `
        <div class="sidebar">
            <div class="sidebar-title">
                <span id="workspace-title" contenteditable="true" style="outline:none;border-radius:4px;padding:2px 4px;min-width:20px;cursor:text;" title="点击编辑工作台名称" onfocus="window.selectAllTitle(this)" onblur="window.saveWorkspaceTitle(this)">🚀 我的工作台</span>
                <div class="sync-controls">
                    <div class="p2p-dot" id="p2p-indicator" title="未连接"></div>
                    <button class="btn-manual-sync" id="btn-manual-sync" onclick="window.manualSync()" title="立即与配对设备双向同步">立即同步</button>
                </div>
            </div>
            <div class="nav-item" data-target="year">📊 全年</div>
            <div class="nav-item" data-target="month">📅 月计划</div>
            <div class="nav-item" data-target="week">🗓️ 周计划</div>
            <div class="nav-item" data-target="day" style="justify-content:space-between; padding-right:6px;">
                <span>📝 日计划</span>
                <span onclick="window.jumpToToday(event)" style="color:var(--accent-color);font-weight:700;font-size:var(--font-hint);padding:2px 6px;border-radius:4px;background:rgba(35,131,226,.1);" title="回到今天">📍 今天</span>
            </div>
            <div class="nav-item" data-target="methods">📚 笔记</div>
            <div class="nav-item" data-target="settings">⚙️ 设置</div>
            <div class="sidebar-footer">
                <div id="global-timer-sidebar-wrap"></div>
                <div class="sidebar-goal-box">
                    <div class="sidebar-goal-title">🎯 我的目标</div>
                    <div class="goals-list" id="goals-list-sidebar"></div>
                    <input type="text" class="goals-input" id="goal-input-sidebar" placeholder="➕ 添加目标，回车保存">
                </div>
                <div class="fixed-progress-bars">
                    <div class="prog-row" onclick="window.openStatsModal('year')"><div class="prog-label-row"><span>年完成度</span><span id="prog-year-text">0%</span></div><div class="prog-bar-bg"><div class="prog-bar-fill" id="prog-year-fill" style="background:#2383e2;"></div></div></div>
                    <div class="prog-row" onclick="window.openStatsModal('month')"><div class="prog-label-row"><span>月完成度</span><span id="prog-month-text">0%</span></div><div class="prog-bar-bg"><div class="prog-bar-fill" id="prog-month-fill" style="background:#f2994a;"></div></div></div>
                    <div class="prog-row" onclick="window.openStatsModal('week')"><div class="prog-label-row"><span>周完成度</span><span id="prog-week-text">0%</span></div><div class="prog-bar-bg"><div class="prog-bar-fill" id="prog-week-fill" style="background:#9b51e0;"></div></div></div>
                    <div class="prog-row" onclick="window.openStatsModal('day')"><div class="prog-label-row"><span>日完成度</span><span id="prog-day-text">0%</span></div><div class="prog-bar-bg"><div class="prog-bar-fill" id="prog-day-fill" style="background:#27ae60;"></div></div></div>
                </div>
                <div class="energy-rpg-panel">
                    <div class="rpg-card" id="rpg-card">
                        <div class="rpg-energy-section" onclick="window.handleRpgCardClick(event)">
                            <div class="energy-left">
                                <div class="energy-header"><span>⚡ 今日精力</span></div>
                                <div class="energy-bar-bg"><div class="energy-bar-fill" id="energy-fill" style="width:100%;"></div></div>
                                <div class="energy-footer"><span id="energy-text">200 / 200</span></div>
                                <div class="energy-warn" id="energy-warn" style="display:none;">⚠️ 精力过低，注意休息！</div>
                            </div>
                            <div class="energy-right">
                                <button class="btn-energy-restore" onclick="window.restoreEnergy('nap')" id="btn-nap" title="恢复精力">😴+50</button>
                                <button class="btn-energy-restore" onclick="window.restoreEnergy('break')" id="btn-break" title="恢复精力">☕+20</button>
                            </div>
                        </div>
                        <div class="rpg-card-main" onclick="window.handleRpgCardClick(event)">
                            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                                <span class="rpg-level" id="rpg-level" title="点击查看详情" style="cursor:pointer;flex-shrink:0;">Lv.1</span>
                                <span class="rpg-title" id="rpg-title" style="flex-shrink:0;">新手</span>
                                <div class="rpg-exp-bar" id="rpg-exp-bar-wrap" title="经验条" style="position:relative;overflow:visible;flex:1;margin-bottom:0;">
                                    <div class="rpg-exp-fill" id="rpg-exp-fill" style="width:0%;"></div>
                                    <div id="rpg-exp-text" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:9px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6);pointer-events:none;white-space:nowrap;line-height:1;">0 / 100 EXP</div>
                                </div>
                            </div>
                            <div class="rpg-attrs" id="rpg-attrs-wrap" style="display:none;">
                                <div class="rpg-attr"><span>📚 智力</span><b id="rpg-int">0</b></div>
                                <div class="rpg-attr"><span>💪 体力</span><b id="rpg-vit">0</b></div>
                                <div class="rpg-attr"><span>🎨 创造力</span><b id="rpg-cre">0</b></div>
                                <div class="rpg-attr"><span>🎯 专注</span><b id="rpg-foc">0</b></div>
                                <div class="rpg-attr"><span>🔥 毅力</span><b id="rpg-wil">0</b></div>
                            </div>
                            <div class="rpg-expand-trigger" onclick="window.toggleRPGExpand(event)" title="点击展开/收起属性详情">
                                <span id="rpg-expand-arrow" style="display:inline-block;transition:transform .2s;">▼</span>
                                <span>属性详情</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="main-content">
            <div class="view-container active" id="view-year">
                <div class="year-header"><h1>📊 全年总览</h1><div class="time-nav" style="margin-bottom:0;"><button onclick="window.changeYear(-1)">← 上一年</button><span id="year-display" style="font-size:var(--font-content);">2025 年</span><button onclick="window.changeYear(1)">下一年 →</button></div></div>
                <div class="year-heatmap" id="year-heatmap"></div>
            </div>
            <div class="view-container" id="view-month">
                <div class="calendar-wrapper" id="calendar-wrapper" style="margin-top:16px;">
                    <div class="time-nav" style="display:flex;align-items:center;justify-content:flex-start;gap:12px;margin-bottom:12px;"><h1 style="margin:0;font-size:var(--font-title);">📅 月计划</h1><button onclick="window.changeMonth(-1)">← 上月</button><span id="month-display" style="font-size:var(--font-content);flex:1;text-align:center;">2025 年 10 月</span><button onclick="window.changeMonth(1)">下月 →</button></div>
                    <div class="calendar-grid" id="calendar-grid"></div>
                </div>
            </div>
            <div class="view-container" id="view-week">
                <div class="year-header"><h1>🗓️ 周计划</h1><div class="time-nav" style="margin-bottom:0;"><button onclick="window.changeWeek(-1)">← 上周</button><span id="week-display" style="font-size:var(--font-content);">本周</span><button onclick="window.changeWeek(1)">下周 →</button></div></div>
                <div class="week-board" id="week-board"></div>
            </div>
            <div class="view-container" id="view-day">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:20px;"><h1 id="day-title" style="margin-bottom:0;">📝 日计划</h1></div>
                <div class="day-panels-grid" id="day-panels-grid"></div>
            </div>
            <div class="view-container" id="view-methods">
                <div style="padding:16px;">📚 笔记</div>
            </div>
            <div class="view-container" id="view-settings">
                <div style="padding:16px;">⚙️ 设置</div>
            </div>
        </div>
    `;
    
    // 添加导航点击事件
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.dataset.target;
            if (target) {
                document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
                document.getElementById(`view-${target}`).classList.add('active');
            }
        });
    });
}

// ============ 导出 ============
window.initApp = initApp;
window.getTodayString = getTodayString;
window.escapeHtml = escapeHtml;
window.eventBus = eventBus;
window.appData = appData; // 导出 appData

// 命名导出 appData
export { appData };

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
