/* ==================== 高级立即同步逻辑 (由 AI 自动合并) ==================== */
window.manualSyncNow = async function() {
    const btn = document.getElementById('btn-sync-now');
    if (!btn || btn.disabled) return;
    
    // 1. 检查连接
    let isConnected = false;
    try {
        if (typeof conn !== 'undefined' && conn && conn.open) isConnected = true;
        else if (typeof peer !== 'undefined' && peer && !peer.destroyed && !peer.disconnected) isConnected = true;
    } catch(e) {}
    
    if (!isConnected) {
        if (typeof showMiniToast === 'function') showMiniToast('暂无连接，无法同步');
        else alert('暂无连接，无法同步');
        return;
    }
    
    // 2. 防止重复点击
    if (typeof isSyncing !== 'undefined' && isSyncing) {
        if (typeof showMiniToast === 'function') showMiniToast('同步进行中，请稍候');
        return;
    }
    
    // 3. UI 状态
    btn.disabled = true;
    btn.classList.add('syncing');
    const originalText = btn.textContent;
    btn.textContent = '同步中...';
    const startTime = Date.now();
    
    let ok = false;
    try {
        // 执行全量差异推送和合并拉取
        if (typeof resetSyncedBaseline === 'function') resetSyncedBaseline({});
        if (typeof broadcastDiffs === 'function') broadcastDiffs(appData);
        
        if (typeof conn !== 'undefined' && conn && conn.open) {
            conn.send({ 
                type: 'SYNC_MERGE', 
                payload: appData, 
                lastModified: appData._lastModified || Date.now(), 
                requestResponse: true, 
                isManualSync: true 
            });
            ok = true;
        }
    } catch (err) {
        console.error('手动同步失败', err);
    }
    
    // 4. 恢复 UI（增加一点最小延迟，让用户看到反馈）
    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, 600 - elapsed);
    setTimeout(() => {
        btn.disabled = false;
        btn.classList.remove('syncing');
        btn.textContent = originalText || '立即同步';
        if (typeof showMiniToast === 'function') {
            showMiniToast(ok ? '同步成功' : '同步失败');
        } else {
            alert(ok ? '同步成功' : '同步失败');
        }
    }, delay);
};
/* ======================================================================= */
