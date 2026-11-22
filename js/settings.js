// ===== 设置模块 =====
// 应用配置、偏好设置

import { appData } from './core.js';

class SettingsManager {
    constructor() {
        this.settings = {
            theme: 'light',
            language: 'zh-CN',
            autoSave: true,
            notifications: true,
            soundEffects: true,
            energyMax: (appData && appData.energyMax) ? appData.energyMax : 200,
            energyWarnThreshold: (appData && appData.energyWarnThreshold) ? appData.energyWarnThreshold : 30,
            expRatio: (appData && appData.expRatio) ? appData.expRatio : 0.6,
            napEnergy: (appData && appData.napEnergy) ? appData.napEnergy : 50,
            breakEnergy: (appData && appData.breakEnergy) ? appData.breakEnergy : 20,
            maxVisible: (appData && appData.maxVisible) ? appData.maxVisible : 5,
            animationEnabled: (appData && appData.animationEnabled) ? appData.animationEnabled : true,
            supplementYesterdayEnabled: (appData && appData.supplementYesterdayEnabled) ? appData.supplementYesterdayEnabled : true
        };
    }

    init() {
        // 加载已保存的设置
        this.load();
        
        // 订阅数据变化
        eventBus.on('settings:change', () => this.save());
    }

    load() {
        try {
            const saved = localStorage.getItem('workbench_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch (e) {
            console.warn('[SettingsManager] 加载设置失败', e);
        }
    }

    save() {
        try {
            localStorage.setItem('workbench_settings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('[SettingsManager] 保存设置失败', e);
        }
    }

    // ============ 主题 ============
    setTheme(theme) {
        this.settings.theme = theme;
        this.applyTheme(theme);
        this.save();
    }

    applyTheme(theme) {
        document.body.className = theme === 'dark' ? 'dark-mode' : '';
        
        // 更新所有需要主题的元素
        const elements = document.querySelectorAll('.rpg-card, .day-box, .calendar-wrapper, .week-column, .task-item, .section-box');
        elements.forEach(el => {
            const gradient = el.style.background;
            if (gradient) {
                el.style.background = gradient.includes('2a2a2a') ? 
                    (theme === 'dark' ? 'linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%)' :
                     'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)') :
                    gradient;
            }
        });
    }

    // ============ 偏好设置 ============
    setAutoSave(enabled) {
        this.settings.autoSave = enabled;
        this.save();
    }

    setNotifications(enabled) {
        this.settings.notifications = enabled;
        this.save();
    }

    setSoundEffects(enabled) {
        this.settings.soundEffects = enabled;
        this.save();
    }

    // ============ 能量设置 ============
    setEnergyMax(value) {
        this.settings.energyMax = parseInt(value) || 200;
        (appData && appData.energyMax) && (appData.energyMax = this.settings.energyMax);
        this.save();
    }

    setEnergyWarnThreshold(value) {
        this.settings.energyWarnThreshold = parseInt(value) || 30;
        (appData && appData.energyWarnThreshold) && (appData.energyWarnThreshold = this.settings.energyWarnThreshold);
        this.save();
    }

    setExpRatio(value) {
        this.settings.expRatio = parseFloat(value) || 0.6;
        (appData && appData.expRatio) && (appData.expRatio = this.settings.expRatio);
        this.save();
    }

    setNapEnergy(value) {
        this.settings.napEnergy = parseInt(value) || 50;
        (appData && appData.napEnergy) && (appData.napEnergy = this.settings.napEnergy);
        this.save();
    }

    setBreakEnergy(value) {
        this.settings.breakEnergy = parseInt(value) || 20;
        (appData && appData.breakEnergy) && (appData.breakEnergy = this.settings.breakEnergy);
        this.save();
    }

    // ============ 获取当前设置 ============
    getSettings() {
        return this.settings;
    }
}

// 导出
window.SettingsManager = SettingsManager;
window.settingsManager = new SettingsManager();
