// 未找到该段代码 (原文件可能已修改)

// ===== 新增：立即同步（手动触发一次完整双向同步） =====
window._manualSyncInProgress = false;
window._manualSyncFinish = null;
window._manualSyncTimer = null;

window.doManualSync = function () {
    const btn = document.getElementById('manual-sync-btn');

    // ① P2P 未建立连接：轻提示，不执行同步流程
    if (!conn || !conn.open) {
        if (typeof showMiniToast === 'function') showMiniToast('暂无连接，无法同步');
        else alert('暂无连接，无法同步');
        return;
    }

    // ② 同步进行中：按钮置灰禁用，避免重复触发
    if (window._manualSyncInProgress) return;
    window._manualSyncInProgress = true;
    if (btn) {
        btn.disabled = true;
        btn.classList.add('syncing');
        btn.textContent = '同步中...';
    }

    const finish = function (success) {
        if (!window._manualSyncInProgress) return;
        window._manualSyncInProgress = false;
        if (window._manualSyncTimer) { clearTimeout(window._manualSyncTimer); window._manualSyncTimer = null; }
        window._manualSyncFinish = null;
        const b = document.getElementById('manual-sync-btn');
        if (b) {
            b.disabled = false;
            b.classList.remove('syncing');
            b.textContent = '立即同步';
        }
        // ③ 同步结束：轻提示区分成功 / 失败
        if (typeof showMiniToast === 'function') {
            showMiniToast(success ? '✅ 同步成功' : '❌ 同步失败');
        } else {
            alert(success ? '✅ 同步成功' : '❌ 同步失败');
        }
    };

    window._manualSyncFinish = finish;
    window._manualSyncTimer = setTimeout(function () {
        finish(false);
    }, 8000);

    try {
        // 发送手动同步请求，payload 携带本地全量数据，远端会复用 mergeData 合并
        conn.send({
            type: 'MANUAL_SYNC_REQ',
            payload: appData,
            lastModified: appData._lastModified || 1,
            clientId: (typeof CLIENT_ID !== 'undefined' ? CLIENT_ID : null),
            time: Date.now()
        });
    } catch (e) {
        finish(false);
    }
};

/* ===== FIX-INJECT-BEGIN: sync-plan-guard ===== */
/* ------------------------------------------------------------------
 * 修复注入：同步合并时保护课表 / 计划数据 + 同步后重渲染
 * 背景：
 *   - mergeData 里 timeSlots 的合并是「远端时间戳更新则整体覆盖」，
 *     若远端 timeSlots 是空数组、fixedBlocks 为空、各映射字典为空，
 *     合并后本地课表 / 计划数据就会被清空 —— 这正是「课表时间消失、
 *     周/月/全年计划视图空白」在同步后的触发点；
 *   - applyRemoteData 直接 appData = payload，若 payload 关键字段异常，
 *     本地原有数据会被抹掉；
 *   - handleIncomingOp 的 UPDATE_SETTINGS 分支里 Object.assign(appData, incoming)
 *     会把空 timeSlots / 空 fixedBlocks 写进本地；
 *   - 同步完成后原代码只做了部分视图刷新，周/月/年视图未必重绘。
 * 方案（原有 P2P / 双向同步基础逻辑一字不动，只加保护层）：
 *   1) 维护本地非空快照 lastSnap；
 *   2) __syncProtectRemote / __syncProtectPayload / __syncProtectOp
 *      在合并 / 应用 / OP 处理前用快照填补空值或剥离空字段；
 *   3) __syncScheduleRender 节流触发全视图重渲染；
 *   4) 800ms 巡检：若数据被意外清空，用快照恢复并保存。
 * ------------------------------------------------------------------ */
(function installSyncPlanGuard() {
    if (window.__syncPlanGuardInstalled) return;
    window.__syncPlanGuardInstalled = true;

    var PROTECT_ARRAYS = ['timeSlots', 'fixedBlocks'];
    var PROTECT_DICTS  = [
        'dailyReflections', 'weeklyReflections', 'monthlyReflections', 'dailyLogs',
        'dailyEnergy', 'dailyExerciseChecks', 'exerciseSchedule',
        'exerciseTimeSlotSchedule', 'fixedBlockSchedule'
    ];
    var lastSnap = {};
    var lastDictSnap = {};

    function deepSnap(v) {
        try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
    }
    function getApp() {
        return (typeof appData !== 'undefined' && appData) ? appData : null;
    }
    function captureSnapshot() {
        var a = getApp();
        if (!a) return;
        PROTECT_ARRAYS.forEach(function (k) {
            if (Array.isArray(a[k]) && a[k].length > 0) lastSnap[k] = deepSnap(a[k]);
        });
        PROTECT_DICTS.forEach(function (k) {
            if (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) && Object.keys(a[k]).length > 0) {
                lastDictSnap[k] = deepSnap(a[k]);
            }
        });
    }

    /* 远端合并前：空数组 / 空字典 → 用本地快照填补 */
    window.__syncProtectRemote = function (remote) {
        if (!remote || typeof remote !== 'object') return remote;
        try { captureSnapshot(); } catch (e) {}
        PROTECT_ARRAYS.forEach(function (k) {
            if (Array.isArray(remote[k]) && remote[k].length === 0 && lastSnap[k]) {
                remote[k] = deepSnap(lastSnap[k]);
            }
        });
        PROTECT_DICTS.forEach(function (k) {
            if (remote[k] && typeof remote[k] === 'object' && !Array.isArray(remote[k]) &&
                Object.keys(remote[k]).length === 0 && lastDictSnap[k]) {
                remote[k] = deepSnap(lastDictSnap[k]);
            }
        });
        return remote;
    };

    /* 替换 appData 前：保护 payload */
    window.__syncProtectPayload = function (payload) {
        if (!payload || typeof payload !== 'object') return payload;
        try { captureSnapshot(); } catch (e) {}
        PROTECT_ARRAYS.forEach(function (k) {
            if (Array.isArray(payload[k]) && payload[k].length === 0 && lastSnap[k]) {
                payload[k] = deepSnap(lastSnap[k]);
            }
        });
        return payload;
    };

    /* OP 处理前：UPDATE_SETTINGS 剥离空数组字段，避免清空本地 */
    window.__syncProtectOp = function (op) {
        if (!op || typeof op !== 'object') return op;
        if (op.action === 'UPDATE_SETTINGS' && op.settings) {
            if (Array.isArray(op.settings.timeSlots) && op.settings.timeSlots.length === 0) {
                try { delete op.settings.timeSlots; } catch (e) {}
                try { delete op.settings.timeSlotsLastModified; } catch (e) {}
            }
            if (Array.isArray(op.settings.fixedBlocks) && op.settings.fixedBlocks.length === 0) {
                try { delete op.settings.fixedBlocks; } catch (e) {}
            }
        }
        return op;
    };

    /* 全视图重渲染 */
    function renderAll() {
        try {
            if (typeof window.ensurePlanBaseData === 'function') {
                var a = getApp();
                if (a) window.ensurePlanBaseData(a);
            }
        } catch (e) {}
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
            try { if (typeof window[names[i]] === 'function') window[names[i]](); } catch (e) {}
        }
    }

    var renderTimer = null;
    window.__syncScheduleRender = function () {
        if (renderTimer) return;
        renderTimer = setTimeout(function () {
            renderTimer = null;
            try { captureSnapshot(); } catch (e) {}
            renderAll();
        }, 120);
    };

    /* 巡检：数据被清空时自动恢复并重渲染 */
    setInterval(function () {
        if (document.hidden) return;
        var a = getApp();
        if (!a) return;
        var restored = false;
        PROTECT_ARRAYS.forEach(function (k) {
            if (Array.isArray(a[k]) && a[k].length === 0 && lastSnap[k] && lastSnap[k].length > 0) {
                a[k] = deepSnap(lastSnap[k]);
                restored = true;
            }
        });
        if (restored) {
            try { if (typeof window.saveDataToFile === 'function') window.saveDataToFile(a); } catch (e) {}
            renderAll();
        }
    }, 800);

    /* 启动抓一次基线快照 */
    function bootstrap() {
        try { captureSnapshot(); } catch (e) {}
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    } else { bootstrap(); }
    setTimeout(bootstrap, 0);
    setTimeout(bootstrap, 300);
    setTimeout(bootstrap, 1500);
    setTimeout(bootstrap, 3000);

    window.__syncCaptureSnapshot = captureSnapshot;
})();
/* ===== FIX-INJECT-END: sync-plan-guard ===== */
