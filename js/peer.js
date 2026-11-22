// ===== P2P 同步模块 =====
// 基于 PeerJS 的对等连接同步

class PeerManager {
    constructor() {
        this.peer = null;
        this.connected = false;
        this.remotePeerId = null;
        this.connection = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
    }

    init() {
        if (typeof Peer === 'undefined') {
            console.log('[PeerManager] PeerJS 未加载，P2P 功能不可用');
            return;
        }

        try {
            this.peer = new Peer();
            
            this.peer.on('open', (id) => {
                console.log('[PeerManager] 我的 Peer ID:', id);
                this.remotePeerId = id;
                this.updateStatus('connected');
                
                // 尝试连接已知的远程 Peer ID
                if (this._knownRemoteId && !this.connection) {
                    this._tryConnect(this._knownRemoteId);
                }
            });
            
            this.peer.on('connection', (conn) => {
                console.log('[PeerManager] 收到连接请求，来自:', conn.peer);
                this.connection = conn;
                this.updateStatus('connected');
                
                conn.on('data', (data) => {
                    this._handleData(data);
                });
                
                conn.on('open', () => {
                    console.log('[PeerManager] 连接已打开');
                });
                
                conn.on('close', () => {
                    console.log('[PeerManager] 连接已关闭');
                    this.connection = null;
                    this.updateStatus('disconnected');
                });
                
                // 自动接受连接
                conn.accept();
            });
            
            this.peer.on('error', (err) => {
                console.error('[PeerManager] Peer 错误:', err);
                this.updateStatus('error');
            });
            
            this.updateStatus('connecting');
        } catch (e) {
            console.error('[PeerManager] 初始化失败:', e);
            this.updateStatus('error');
        }
    }

    _tryConnect(remoteId) {
        if (!this.peer || !remoteId) return;
        
        this.connection = new Peer(remoteId, {
            directConnection: true
        });
        
        this.connection.on('open', () => {
            console.log('[PeerManager] 成功连接到:', remoteId);
            this.updateStatus('connected');
        });
        
        this.connection.on('data', (data) => {
            this._handleData(data);
        });
        
        this.connection.on('close', () => {
            console.log('[PeerManager] 连接已关闭');
            this.connection = null;
            this.updateStatus('disconnected');
        });
        
        this.connection.on('error', (err) => {
            console.error('[PeerManager] 连接错误:', err);
            this.connection = null;
            this.updateStatus('disconnected');
        });
    }

    _handleData(data) {
        // 处理接收到的数据
        if (typeof data === 'object' && data.type === 'sync') {
            this._handleSyncData(data.payload);
        } else if (typeof data === 'object' && data.type === 'task') {
            this._handleTaskData(data);
        } else if (typeof data === 'object' && data.type === 'exercise') {
            this._handleExerciseData(data);
        }
    }

    _handleSyncData(data) {
        // 处理同步数据
        if (data.tasks) {
            // 合并任务数据
            const localTasks = appData.tasks || [];
            const remoteTasks = data.tasks;
            
            // 简单合并逻辑
            const newTasks = [...localTasks];
            remoteTasks.forEach(remoteTask => {
                const exists = newTasks.some(t => t.id === remoteTask.id);
                if (!exists) {
                    newTasks.push(remoteTask);
                } else {
                    // 更新本地任务
                    const idx = newTasks.findIndex(t => t.id === remoteTask.id);
                    if (idx !== -1) {
                        newTasks[idx] = { ...newTasks[idx], ...remoteTask };
                    }
                }
            });
            
            appData.tasks = newTasks;
            saveDataToFile({ tasks: newTasks });
        }
        
        // 处理其他同步数据...
    }

    _handleTaskData(data) {
        // 处理任务数据
        const task = data.task;
        const idx = appData.tasks.findIndex(t => t.id === task.id);
        if (idx !== -1) {
            appData.tasks[idx] = { ...appData.tasks[idx], ...task };
            saveDataToFile({ tasks: appData.tasks });
        }
    }

    _handleExerciseData(data) {
        // 处理练习数据
        const exercise = data.exercise;
        const idx = appData.exercises.findIndex(e => e.id === exercise.id);
        if (idx !== -1) {
            appData.exercises[idx] = { ...appData.exercises[idx], ...exercise };
            saveDataToFile({ exercises: appData.exercises });
        }
    }

    // ============ 状态管理 ============
    updateStatus(status) {
        this.connected = status === 'connected';
        
        const indicator = document.getElementById('p2p-indicator');
        if (indicator) {
            indicator.className = 'p2p-dot';
            indicator.title = status === 'connected' ? '已连接' : status;
            
            if (status === 'connected') {
                indicator.classList.add('connected');
            } else if (status === 'connecting') {
                indicator.classList.add('connecting');
            } else if (status === 'disconnected') {
                indicator.classList.remove('connecting');
            }
        }
    }

    // ============ 手动同步 ============
    manualSync() {
        console.log('[PeerManager] 手动同步开始');
        
        // 获取本地数据
        const localData = {
            tasks: appData.tasks,
            exercises: appData.exercises,
            settings: appData.settings
        };
        
        // 发送数据给对方
        if (this.connection) {
            this.connection.send({
                type: 'sync',
                payload: localData
            });
            console.log('[PeerManager] 已发送同步数据');
        } else {
            console.log('[PeerManager] 没有活动连接，无法手动同步');
        }
    }

    // ============ 工具方法 ============
    isConnected() {
        return this.connected && this.connection !== null;
    }

    getRemotePeerId() {
        return this.remotePeerId;
    }

    setKnownRemoteId(id) {
        this._knownRemoteId = id;
    }
}

// 导出
window.PeerManager = PeerManager;
window.peerManager = new PeerManager();
