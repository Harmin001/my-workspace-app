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
