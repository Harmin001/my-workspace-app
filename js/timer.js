// ===== 全局计时器模块 =====
// 全局计时器、番茄工作法

class TimerManager {
    constructor() {
        this.running = false;
        this.intervalId = null;
        this.elapsed = 0;
        this.target = 0;
        this.workTime = 25 * 60 * 1000; // 25 分钟
        this.restTime = 5 * 60 * 1000; // 5 分钟
    }

    init() {
        // 订阅数据变化
        eventBus.on('timer:change', () => this.render());
    }

    // ============ 启动/停止 ============
    start() {
        if (this.running) return;
        
        const now = Date.now();
        this.running = true;
        this.intervalId = setInterval(() => {
            this.tick();
        }, 100);
        
        this.render();
    }

    stop() {
        if (!this.running) return;
        
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.running = false;
        
        this.render();
    }

    tick() {
        const now = Date.now();
        this.elapsed = now - this.target;
        
        // 更新进度显示
        const progress = Math.min(100, (this.elapsed / this.target) * 100);
        const minutes = Math.floor(this.elapsed / 60000);
        const seconds = Math.floor((this.elapsed % 60000) / 1000);
        const milliseconds = Math.floor((this.elapsed % 1000) / 10);
        
        const display = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}:${String(milliseconds).padStart(2,'0')}`;
        
        // 更新显示元素
        const displays = [
            document.getElementById('global-timer-display'),
            document.getElementById('timer-display-sidebar')
        ];
        
        displays.forEach(el => {
            if (el) {
                el.textContent = display;
                el.style.color = this.running ? 'var(--accent-color)' : 'var(--text-muted)';
            }
        });
        
        // 如果时间到了
        if (this.elapsed >= this.target && this.running) {
            this.complete();
        }
    }

    complete() {
        this.stop();
        
        // 通知用户
        if (appData.settings && appData.settings.notifications) {
            // 可以播放声音或显示通知
            console.log('计时器完成！');
        }
    }

    // ============ 控制 ============
    setTarget(seconds) {
        this.target = seconds * 1000;
        if (this.running) {
            this.stop();
            this.start();
        }
    }

    reset() {
        this.stop();
        this.elapsed = 0;
        this.render();
    }

    // ============ 渲染 ============
    render() {
        const workProgress = document.getElementById('work-progress');
        const restProgress = document.getElementById('rest-progress');
        
        if (workProgress) {
            workProgress.style.width = Math.min(100, (this.elapsed / this.workTime) * 100) + '%';
        }
        
        if (restProgress) {
            restProgress.style.width = Math.min(100, (this.elapsed / this.restTime) * 100) + '%';
        }
    }

    // ============ 工具方法 ============
    isRunning() {
        return this.running;
    }

    getElapsed() {
        return this.elapsed;
    }

    getTarget() {
        return this.target;
    }
}

// 导出
window.TimerManager = TimerManager;
window.timerManager = new TimerManager();
