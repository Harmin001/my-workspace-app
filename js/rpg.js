// ===== RPG 系统模块 =====
// 精力管理、经验系统、属性成长

class RPGManager {
    constructor() {
        this.level = 1;
        this.exp = 0;
        this.expToNextLevel = 100;
        
        // 基础属性
        this.attributes = {
            int: { name: '智力', base: 5, growth: 0.1, desc: '影响学习效率和笔记深度' },
            vit: { name: '体力', base: 5, growth: 0.1, desc: '影响体力和恢复速度' },
            cre: { name: '创造力', base: 5, growth: 0.1, desc: '影响创意和灵活性' },
            foc: { name: '专注', base: 5, growth: 0.1, desc: '影响专注力和任务完成' },
            wil: { name: '毅力', base: 5, growth: 0.1, desc: '影响坚持和抗压能力' }
        };
        
        // 当前属性值
        this.current = { ...this.attributes };
        
        // 能量相关
        this.energyMax = appData.energyMax || 200;
        this.energy = this.energyMax;
        this.energyWarnThreshold = appData.energyWarnThreshold || 30;
        
        // 技能树
        this.skills = {
            learning: { level: 1, exp: 0, name: '学习大师', desc: '学习效率提升' },
            exercise: { level: 1, exp: 0, name: '运动达人', desc: '体力恢复加速' },
            focus: { level: 1, exp: 0, name: '专注王者', desc: '专注时间延长' }
        };
    }

    init() {
        // 订阅数据变化
        eventBus.on('rpg:change', () => this.render());
        
        // 尝试加载已保存的进度
        this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem('workbench_rpg');
            if (saved) {
                const parsed = JSON.parse(saved);
                // 合并数据
                this.level = parsed.level || 1;
                this.exp = parsed.exp || 0;
                this.expToNextLevel = parsed.expToNextLevel || 100;
                
                if (parsed.current) {
                    this.current = { ...this.current, ...parsed.current };
                }
                
                if (parsed.skills) {
                    this.skills = { ...this.skills, ...parsed.skills };
                }
                
                if (parsed.energyMax) {
                    this.energyMax = parsed.energyMax;
                }
                
                if (parsed.energy) {
                    this.energy = parsed.energy;
                }
            }
        } catch (e) {
            console.warn('[RPGManager] 加载进度失败', e);
        }
    }

    save() {
        try {
            const data = {
                level: this.level,
                exp: this.exp,
                expToNextLevel: this.expToNextLevel,
                current: this.current,
                skills: this.skills,
                energyMax: this.energyMax,
                energy: this.energy
            };
            localStorage.setItem('workbench_rpg', JSON.stringify(data));
        } catch (e) {
            console.warn('[RPGManager] 保存进度失败', e);
        }
    }

    // ============ 经验系统 ============
    gainExp(amount) {
        const oldExp = this.exp;
        this.exp += amount;
        
        // 检查是否升级
        if (this.exp >= this.expToNextLevel) {
            const expOver = this.exp - this.expToNextLevel;
            this.levelUp();
            this.exp = this.expToNextLevel;
            this.gainExp(expOver); // 递归处理溢出经验
        }
        
        this.save();
        return { oldExp, newExp: this.exp, leveledUp: this.level !== 1 };
    }

    levelUp() {
        const oldLevel = this.level;
        this.level++;
        this.exp = 0;
        
        // 属性成长
        Object.keys(this.current).forEach(key => {
            const attr = this.current[key];
            const growth = attr.growth * this.level;
            attr.value = Math.min(attr.value + growth, attr.value * 1.2);
        });
        
        // 技能升级
        Object.keys(this.skills).forEach(skill => {
            const skill = this.skills[skill];
            if (skill.exp >= skill.level * 100) {
                skill.level++;
                skill.exp = 0;
            }
        });
        
        this.save();
        return { oldLevel, newLevel: this.level };
    }

    // ============ 能量系统 ============
    restoreEnergy(type) {
        if (type === 'nap') {
            const amount = this.energyMax * (appData.napEnergy / 100);
            this.energy = Math.min(this.energyMax, this.energy + amount);
        } else if (type === 'break') {
            const amount = this.energyMax * (appData.breakEnergy / 100);
            this.energy = Math.min(this.energyMax, this.energy + amount);
        }
        
        this.save();
        return this.energy;
    }

    getEnergyPercentage() {
        return (this.energy / this.energyMax) * 100;
    }

    isEnergyCritical() {
        return this.energy <= this.energyMax * (this.energyWarnThreshold / 100);
    }

    // ============ 属性计算 ============
    getAttrValue(attrName) {
        const attr = this.current[attrName];
        return Math.floor(attr.base + (attr.value - attr.base) * this.level);
    }

    // ============ 渲染 ============
    render() {
        // 渲染能量条
        const energyFill = document.getElementById('energy-fill');
        if (energyFill) {
            energyFill.style.width = this.getEnergyPercentage() + '%';
            if (this.isEnergyCritical()) {
                energyFill.style.background = 'var(--danger-color)';
            } else {
                energyFill.style.background = 'var(--accent-color)';
            }
        }

        // 渲染经验条
        const expFill = document.getElementById('rpg-exp-fill');
        if (expFill) {
            expFill.style.width = (this.exp / this.expToNextLevel * 100) + '%';
        }

        // 渲染属性
        this.renderAttributes();
    }

    renderAttributes() {
        const attrsWrap = document.getElementById('rpg-attrs-wrap');
        if (!attrsWrap) return;

        const html = Object.entries(this.current).map(([key, attr]) => {
            const value = this.getAttrValue(key);
            return `
                <div class="rpg-attr">
                    <span>${attr.name}</span>
                    <b id="rpg-${key}">${value}</b>
                </div>
            `;
        }).join('');
        
        attrsWrap.innerHTML = html;
    }

    // ============ 工具方法 ============
    setEnergyMax(value) {
        this.energyMax = parseInt(value) || 200;
        this.save();
    }

    setEnergy(value) {
        this.energy = parseInt(value) || this.energyMax;
        this.save();
    }

    getCurrent() {
        return this.current;
    }

    getLevel() {
        return this.level;
    }

    getExp() {
        return this.exp;
    }
}

// 导出
window.RPGManager = RPGManager;
window.rpgManager = new RPGManager();
