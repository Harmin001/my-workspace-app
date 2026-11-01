/* ===== FIX-INJECT-BEGIN: init-storage-guard ===== */
/* ------------------------------------------------------------------
 * 修复注入①：appData 存储读取合并保护
 * 背景：
 *   原 9-init.js 的 IIFE 中有：
 *       const saved = localStorage.getItem('myWorkspaceAppData');
 *       if (saved) { appData = JSON.parse(saved); }
 *   这会把 appData 整体替换为存储内容。一旦存储里
 *   timeSlots / fixedBlocks / levelConfig / panelLayout 为空数组或
 *   缺失，1-core.js 里补全的默认课表与基础计划数据就被覆盖清空，
 *   导致「课表时间段消失、周/月/全年计划视图空白」。
 * 方案：
 *   在 IIFE 执行前，包装 Storage.prototype.getItem，
 *   仅对 myWorkspaceAppData 这个 key 生效：
 *     - 存储中不存在该 key → 原样返回 null，让原 else 分支跑首次初始化；
 *     - 存储存在 → 用「当前 appData 基底 + 存储中非空字段」做字段级合并，
 *       返回合并后的 JSON 字符串给原代码 JSON.parse，
 *       从而空 timeSlots / 空 levelConfig 等不再覆盖默认值。
 * 影响：
 *   - 只影响读取这一个 key 的行为，写入流程完全不变；
 *   - 包装常驻（开销极小），保证任何时机读取都不会拿到残缺数据；
 *   - 之前的 init-settings 注入段读取存储时也能拿到合并后的完整数据，
 *     不会再用残缺数据覆盖 appData。
 * ------------------------------------------------------------------ */
(function installInitStorageGuard() {
    if (window.__initStorageGuardInstalled) return;
    window.__initStorageGuardInstalled = true;

    if (typeof Storage === 'undefined' || !Storage.prototype || typeof Storage.prototype.getItem !== 'function') return;

    var STORAGE_KEY = 'myWorkspaceAppData';
    var origGet = Storage.prototype.getItem;
    if (origGet.__initStorageGuardWrapped) return;

    function deepClone(o) {
        try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; }
    }

    /* 空值时绝不覆盖基底默认值的数组字段 */
    var PROTECTED_ARRAYS = ['timeSlots', 'fixedBlocks'];

    function mergeStoredIntoBase(base, stored) {
        var merged = deepClone(base || {});
        if (!stored || typeof stored !== 'object') return merged;

        Object.keys(stored).forEach(function (k) {
            var sv = stored[k];
            if (sv === null || sv === undefined) return;

            /* 数组字段 */
            if (Array.isArray(sv)) {
                if (PROTECTED_ARRAYS.indexOf(k) >= 0 && sv.length === 0) return; /* 保留默认课表 / 固定块 */
                merged[k] = deepClone(sv);
                return;
            }

            /* 对象字段：保护关键结构不被空值覆盖 */
            if (typeof sv === 'object') {
                if (k === 'levelConfig') {
                    if (!sv.levels || !Array.isArray(sv.levels) || sv.levels.length === 0) return;
                }
                if (k === 'panelLayout') {
                    if (!sv.order || !Array.isArray(sv.order) || sv.order.length === 0) return;
                }
                if (k === 'fonts') {
                    if (!sv.title && !sv.content && !sv.hint && !sv.small) return;
                }
                merged[k] = deepClone(sv);
                return;
            }

            /* 基本类型：存储值优先（用户可能是故意设置为空串等） */
            merged[k] = sv;
        });

        return merged;
    }

    var wrapped = function (key) {
        if (key !== STORAGE_KEY) return origGet.call(this, key);
        var raw = origGet.call(this, key);
        if (raw === null || raw === undefined) return raw;

        var stored;
        try { stored = JSON.parse(raw); } catch (e) { return raw; }

        var base = (typeof appData !== 'undefined' && appData) ? appData : {};
        var merged = mergeStoredIntoBase(base, stored);

        try { return JSON.stringify(merged); } catch (e) { return raw; }
    };
    wrapped.__initStorageGuardWrapped = true;

    Storage.prototype.getItem = wrapped;
})();
/* ===== FIX-INJECT-END: init-storage-guard ===== */

/* ===== FIX-INJECT-BEGIN: init-settings ===== */
/* ------------------------------------------------------------------
 * 修复注入：页面初始化时读取本地配置，并回填设置面板
 * 目的：
 *   1) 初始化时优先读取 localStorage 中的配置（myWorkspaceAppData）；
 *   2) 本地无配置时，使用 1-core.js 里 appData / DEFAULT_SETTINGS 的
 *      默认值（appData 本身已带完整默认值，本段仅补全缺失项）；
 *   3) 把最终配置回填到设置面板控件（滑块、数字框、复选框、按钮）；
 *   4) 应用视觉设置（主题模式、主题色、字体、圆角）。
 * 说明：
 *   - 原有定时器、启动、同步初始化等逻辑全部保留不动；
 *   - 仅在文件末尾追加，DOM 就绪后多轮兜底执行，兼容模板延迟注入；
 *   - window.__initSettingsLoaded 标记确保只从 localStorage 载入一次，
 *     后续延时回填不会覆盖页面运行中的修改。
 * ------------------------------------------------------------------ */
(function initSettingsFromStorage() {
    var STORAGE_KEY = (window.SETTINGS_STORAGE_KEY) || 'myWorkspaceAppData';

    function getAppData() {
        return (typeof appData !== 'undefined' && appData) ? appData : null;
    }

    function ensureDefaults(a) {
        try {
            if (typeof ensureSettingsDefaults === 'function') {
                ensureSettingsDefaults(a);
                return;
            }
            if (typeof window.ensureSettingsDefaults === 'function') {
                window.ensureSettingsDefaults(a);
                return;
            }
        } catch (e) {}
        /* 兜底：用 DEFAULT_SETTINGS 补全顶层字段 */
        var d = window.DEFAULT_SETTINGS;
        if (!d) return;
        Object.keys(d).forEach(function (k) {
            if (a[k] === undefined || a[k] === null) {
                a[k] = JSON.parse(JSON.stringify(d[k]));
            }
        });
    }

    function applyVisual(a) {
        if (a.themeMode) document.body.classList.toggle('dark-mode', a.themeMode === 'dark');
        if (a.themeColor) document.documentElement.style.setProperty('--accent-color', a.themeColor);
        if (a.fonts) {
            ['title', 'content', 'hint', 'small'].forEach(function (k) {
                if (a.fonts[k]) document.documentElement.style.setProperty('--font-' + k, a.fonts[k]);
            });
        }
        if (a.radius) document.documentElement.style.setProperty('--radius', a.radius);
    }

    function refreshPanelFallback(a) {
        function setVal(id, v) {
            var el = document.getElementById(id);
            if (el && document.activeElement !== el) el.value = v;
        }
        function setText(id, v) {
            var el = document.getElementById(id);
            if (el) el.innerText = v;
        }
        function setChecked(id, v) {
            var el = document.getElementById(id);
            if (el) el.checked = !!v;
        }

        var rn = parseInt(a.radius || '8px', 10) || 8;
        setVal('radius-slider', rn); setText('radius-val', rn);

        var mv = (typeof a.maxVisible === 'number') ? a.maxVisible : 5;
        setVal('max-visible-slider', mv); setText('max-visible-val', mv);

        setChecked('animation-toggle', a.animationEnabled !== false);

        ['title', 'content', 'hint', 'small'].forEach(function (k) {
            var raw = (a.fonts && a.fonts[k]) || '14px';
            var n = parseInt(raw, 10) || 14;
            setVal('font-' + k + '-slider', n);
            setText('font-' + k + '-val', n);
        });

        var emax = (typeof a.energyMax === 'number') ? a.energyMax : 200;
        setVal('energy-max-slider', emax); setText('energy-max-val', emax);

        var ewarn = (typeof a.energyWarnThreshold === 'number') ? a.energyWarnThreshold : 30;
        setVal('energy-warn-slider', ewarn); setText('energy-warn-val', ewarn);

        var ratio = (typeof a.expRatio === 'number') ? a.expRatio : 0.6;
        var rp = Math.round(ratio * 100);
        setVal('exp-ratio-slider', rp); setText('exp-ratio-val', rp);

        setVal('set-nap-energy', (typeof a.napEnergy === 'number') ? a.napEnergy : 50);
        setVal('set-break-energy', (typeof a.breakEnergy === 'number') ? a.breakEnergy : 20);

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
            cbs[i].checked = Array.isArray(a.commonBtns) && a.commonBtns.indexOf(cbs[i].value) >= 0;
        }
    }

    function refreshPanel(a) {
        /* 优先使用 7-events.js 修复注入提供的 refreshSettingsPanel */
        try {
            if (typeof window.refreshSettingsPanel === 'function') {
                window.refreshSettingsPanel();
                return;
            }
        } catch (e) {}
        try {
            refreshPanelFallback(a);
        } catch (e) {}
    }

    function apply() {
        try {
            var a = getAppData();
            if (!a) return;

            /* 仅首次从 localStorage 载入，避免后续延时回填覆盖运行中修改 */
            if (!window.__initSettingsLoaded) {
                window.__initSettingsLoaded = true;
                var stored = null;
                try {
                    var raw = localStorage.getItem(STORAGE_KEY);
                    if (raw) stored = JSON.parse(raw);
                } catch (e) { stored = null; }

                if (stored && typeof stored === 'object') {
                    Object.keys(stored).forEach(function (k) {
                        if (stored[k] !== undefined && stored[k] !== null) a[k] = stored[k];
                    });
                }
            }

            /* 补全默认值（幂等，可多次执行） */
            ensureDefaults(a);

            /* 写回 localStorage（含补全后的完整设置） */
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); } catch (e) {}

            /* 应用视觉 + 回填面板 */
            applyVisual(a);
            refreshPanel(a);
        } catch (e) {
            if (window.console && console.warn) console.warn('[9-init fix] apply error', e);
        }
    }

    /* 多轮兜底：DOM 就绪后执行；模板可能延迟注入，多轮保证最终回填 */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply, { once: true });
    } else {
        apply();
    }
    setTimeout(apply, 0);
    setTimeout(apply, 300);
    setTimeout(apply, 1200);
    setTimeout(apply, 2500);
})();
/* ===== FIX-INJECT-END: init-settings ===== */

/* ===== FIX-INJECT-BEGIN: init-plan-render ===== */
/* ------------------------------------------------------------------
 * 修复注入②：初始化后数据补全 + 全视图渲染触发
 * 目的：
 *   1) 原 IIFE 初始化后，再执行一次 ensurePlanBaseData()，
 *      保证 timeSlots / fixedBlocks / tasks / exercises / 各类映射字典
 *      / 视图日期字段 / 面板布局全部合法（幂等）；
 *   2) 依次触发所有视图渲染：renderCalendar / renderYearHeatmap /
 *      renderWeekBoard / renderDayPlan / renderTaskPool /
 *      renderExercisePool / renderFixedBlockPool /
 *      updateFixedProgressBars / renderTimeSlotConfig / renderEnergyAndRPG，
 *      修复「周/月/全年计划视图空白」；
 *   3) 多轮延时兜底，兼容 3-templates 模板延迟注入；
 *   4) 定期巡检：数据被意外清空时自动修复并重渲染，
 *      防止运行过程中课表 / 计划数据再次丢失。
 * 说明：
 *   - 原 IIFE、定时器、同步初始化、之前的 init-settings 段全部保留不动；
 *   - 渲染函数幂等，重复调用只会重绘，不会产生副作用。
 * ------------------------------------------------------------------ */
(function triggerPlanRenderAfterInit() {
    if (window.__initPlanRenderInstalled) return;
    window.__initPlanRenderInstalled = true;

    function safeCall(name) {
        try {
            if (typeof window[name] === 'function') window[name]();
        } catch (e) {
            if (window.console && console.warn) console.warn('[9-init fix] ' + name + ' error', e);
        }
    }

    function ensureData() {
        var changed = false;
        try {
            if (typeof window.ensurePlanBaseData === 'function' &&
                typeof appData !== 'undefined' && appData) {
                changed = !!window.ensurePlanBaseData(appData);
            }
        } catch (e) {
            if (window.console && console.warn) console.warn('[9-init fix] ensurePlanBaseData error', e);
        }
        if (changed) {
            try {
                if (typeof saveDataToFile === 'function') saveDataToFile(appData);
                else localStorage.setItem('myWorkspaceAppData', JSON.stringify(appData));
            } catch (e) {}
        }
        return changed;
    }

    function renderAll() {
        safeCall('applyPanelLayout');
        safeCall('renderCalendar');
        safeCall('renderYearHeatmap');
        safeCall('renderWeekBoard');
        safeCall('renderDayPlan');
        safeCall('renderTaskPool');
        safeCall('renderExercisePool');
        safeCall('renderFixedBlockPool');
        safeCall('updateFixedProgressBars');
        safeCall('renderTimeSlotConfig');
        safeCall('renderEnergyAndRPG');
    }

    function run() {
        ensureData();
        renderAll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
    }
    setTimeout(run, 0);
    setTimeout(run, 100);
    setTimeout(run, 300);
    setTimeout(run, 800);
    setTimeout(run, 1500);
    setTimeout(run, 2500);

    /* 定期巡检：数据被意外清空时自动恢复并重渲染 */
    setInterval(function () {
        if (typeof appData === 'undefined' || !appData) return;
        if (document.hidden) return;
        var changed = false;
        try {
            if (typeof window.ensurePlanBaseData === 'function') {
                changed = !!window.ensurePlanBaseData(appData);
            }
        } catch (e) { return; }
        if (changed) {
            try {
                if (typeof saveDataToFile === 'function') saveDataToFile(appData);
            } catch (e) {}
            renderAll();
        }
    }, 2500);
})();
/* ===== FIX-INJECT-END: init-plan-render ===== */
