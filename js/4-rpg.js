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
    if (!appData.energyMax || appData.energyMax === 100) appData.energyMax = 200;
    if (appData.energyWarnThreshold === undefined) appData.energyWarnThreshold = 30;
    if (appData.expRatio === undefined) appData.expRatio = 0.6;
    if (appData.napEnergy === undefined || appData.napEnergy === 40) appData.napEnergy = 50;
    if (appData.breakEnergy === undefined || appData.breakEnergy === 15) appData.breakEnergy = 20;
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