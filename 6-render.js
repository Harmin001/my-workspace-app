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
function saveDataToFile(data) {
    if (!isSyncing) data._lastModified = Date.now();
    try { localStorage.setItem('myWorkspaceAppData', JSON.stringify(data)); } catch (e) { console.warn('localStorage 保存失败', e); }
    if (!isSyncing) {
        clearTimeout(_opDebounceTimer);
        _opDebounceTimer = setTimeout(() => {
            if (syncStatus === 'connected' || syncStatus === 'syncing') broadcastDiffs(data);
        }, 300);
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

/* ===== FIX-INJECT-BEGIN: render-data ===== */
/* ------------------------------------------------------------------
 * 修复注入：渲染数据兜底 + 视图重新渲染
 * 目的：
 *   1) 每次渲染前对 appData 做完整性校验，缺失或非法字段用默认值补全；
 *      —— 修复「课表时间段消失」（timeSlots 空数组 / undefined）
 *      —— 修复「日历 / 周板 / 热力图空白」（tasks / 映射字段缺失）
 *   2) 初始化后自动重新渲染所有视图；定期检查数据完整性，异常时自动
 *      修复并重渲染。
 * 说明：
 *   - 原有渲染函数（renderCalendar / renderWeekBoard / renderYearHeatmap /
 *     renderDayPlan / renderTaskPool / renderExercisePool /
 *     renderFixedBlockPool / updateFixedProgressBars / renderTimeSlotConfig）
 *     全部保留不动，仅在启动阶段触发它们；
 *   - 不改事件、同步、设置保存逻辑；
 *   - 可重复执行，工具层面会剥离旧注入段。
 * ------------------------------------------------------------------ */
(function installRenderDataFix() {
    if (window.__renderDataFixInstalled) return;
    window.__renderDataFixInstalled = true;

    /* ---------- 取默认值（优先 core 注入的 getDefaultSettings，回退全局常量） ---------- */
    function getDefaultTimeSlots() {
        try {
            if (typeof window.getDefaultSettings === 'function') {
                var d = window.getDefaultSettings();
                if (d && Array.isArray(d.timeSlots) && d.timeSlots.length > 0) {
                    return JSON.parse(JSON.stringify(d.timeSlots));
                }
            }
        } catch (e) {}
        try {
            if (typeof DEFAULT_TIMESLOTS !== 'undefined' && Array.isArray(DEFAULT_TIMESLOTS)) {
                return JSON.parse(JSON.stringify(DEFAULT_TIMESLOTS));
            }
        } catch (e) {}
        return null;
    }

    function getDefaultFixedBlocks() {
        try {
            if (typeof window.getDefaultSettings === 'function') {
                var d = window.getDefaultSettings();
                if (d && Array.isArray(d.fixedBlocks) && d.fixedBlocks.length > 0) {
                    return JSON.parse(JSON.stringify(d.fixedBlocks));
                }
            }
        } catch (e) {}
        try {
            if (typeof DEFAULT_FIXED_BLOCKS !== 'undefined' && Array.isArray(DEFAULT_FIXED_BLOCKS)) {
                return JSON.parse(JSON.stringify(DEFAULT_FIXED_BLOCKS));
            }
        } catch (e) {}
        return null;
    }

    /* ---------- 数据兜底：保证渲染函数读到的结构一定合法 ---------- */
    function sanitizeRenderData() {
        if (typeof appData === 'undefined' || !appData) return false;
        var a = appData;
        var changed = false;

        /* 对象映射字段（渲染时大量使用，缺失会抛错） */
        var objKeys = [
            'dailyReflections', 'weeklyReflections', 'monthlyReflections', 'dailyLogs',
            'dailyEnergy', 'dailyExerciseChecks', 'exerciseSchedule',
            'exerciseTimeSlotSchedule', 'fixedBlockSchedule'
        ];
        for (var i = 0; i < objKeys.length; i++) {
            var k = objKeys[i];
            if (!a[k] || typeof a[k] !== 'object' || Array.isArray(a[k])) {
                a[k] = {};
                changed = true;
            }
        }
        if (typeof a.yearlyGoals !== 'string') { a.yearlyGoals = ''; changed = true; }

        /* 数组字段 */
        if (!Array.isArray(a.tasks)) { a.tasks = []; changed = true; }
        if (!Array.isArray(a.exercises)) { a.exercises = []; changed = true; }

        /* timeSlots：空数组或缺失 → 恢复默认（课表依赖它显示行） */
        if (!Array.isArray(a.timeSlots) || a.timeSlots.length === 0) {
            var dts = getDefaultTimeSlots();
            if (dts && dts.length > 0) {
                a.timeSlots = dts;
                a.timeSlotsLastModified = Date.now();
                changed = true;
                if (window.console && console.warn) {
                    console.warn('[6-render fix] appData.timeSlots 为空，已恢复为默认时间段');
                }
            }
        }

        /* fixedBlocks：仅在缺失 / 非法时恢复默认；空数组合法（用户可清空） */
        if (a.fixedBlocks === undefined || a.fixedBlocks === null) {
            var dfb = getDefaultFixedBlocks();
            if (dfb) { a.fixedBlocks = dfb; changed = true; }
        } else if (!Array.isArray(a.fixedBlocks)) {
            a.fixedBlocks = [];
            changed = true;
        }

        /* panelLayout */
        if (!a.panelLayout || typeof a.panelLayout !== 'object') {
            a.panelLayout = { order: ['todo', 'learning', 'other', 'exercise'], spans: {}, sizes: {} };
            changed = true;
        } else {
            if (!Array.isArray(a.panelLayout.order) || a.panelLayout.order.length === 0) {
                a.panelLayout.order = ['todo', 'learning', 'other', 'exercise'];
                changed = true;
            }
            if (!a.panelLayout.spans) { a.panelLayout.spans = {}; changed = true; }
            if (!a.panelLayout.sizes) { a.panelLayout.sizes = {}; changed = true; }
        }

        return changed;
    }

    /* ---------- 安全调用渲染函数（单个失败不影响其余） ---------- */
    function safeCall(fnName) {
        try {
            var fn = window[fnName];
            if (typeof fn === 'function') fn();
        } catch (e) {
            if (window.console && console.warn) console.warn('[6-render fix] ' + fnName + ' error', e);
        }
    }

    function renderAllViews() {
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

    /* ---------- 修复 + 重渲染 ---------- */
    function fixAndRender() {
        try {
            var changed = sanitizeRenderData();
            if (changed) {
                try {
                    if (typeof saveDataToFile === 'function') saveDataToFile(appData);
                    else localStorage.setItem('myWorkspaceAppData', JSON.stringify(appData));
                } catch (e) {}
            }
            renderAllViews();
        } catch (e) {
            if (window.console && console.warn) console.warn('[6-render fix] fixAndRender error', e);
        }
    }

    /* ---------- 启动：多轮兜底，兼容模板延迟注入 ---------- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixAndRender, { once: true });
    } else {
        fixAndRender();
    }
    setTimeout(fixAndRender, 100);
    setTimeout(fixAndRender, 400);
    setTimeout(fixAndRender, 1000);
    setTimeout(fixAndRender, 2000);

    /* ---------- 定期巡检：数据被意外清空时自动恢复并重渲染 ---------- */
    setInterval(function () {
        if (typeof appData === 'undefined' || !appData) return;
        var changed = sanitizeRenderData();
        if (changed) {
            try {
                if (typeof saveDataToFile === 'function') saveDataToFile(appData);
            } catch (e) {}
            renderAllViews();
        }
    }, 2000);

    /* ---------- 对外暴露（便于调试 / 其它脚本调用） ---------- */
    window.sanitizeRenderData = sanitizeRenderData;
    window.renderAllViews = renderAllViews;
    window.fixAndRenderAll = fixAndRender;
})();
/* ===== FIX-INJECT-END: render-data ===== */
