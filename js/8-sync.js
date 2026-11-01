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