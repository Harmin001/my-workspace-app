// ===== 工具模块 =====
// 工具函数、数据持久化、辅助功能

// ============ 数据持久化 ============
function ensureStorage() {
    if (!window.localStorage) return false;
    try {
        const test = 'test';
        localStorage.setItem('workbench_test', test);
        localStorage.removeItem('workbench_test');
        return true;
    } catch (e) {
        console.warn('[util] localStorage 不可用:', e);
        return false;
    }
}

function saveDataToFile(data) {
    if (!ensureStorage()) return false;
    try {
        const toSave = JSON.parse(JSON.stringify(data));
        toSave._version = 3;
        toSave._lastModified = Date.now();
        localStorage.setItem('workbench_data', JSON.stringify(toSave));
        return true;
    } catch (e) {
        console.warn('[util] 保存数据失败:', e);
        return false;
    }
}

function loadData() {
    if (!ensureStorage()) {
        return { _version: 0 };
    }
    try {
        const saved = localStorage.getItem('workbench_data');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed._version && parsed._version >= 2) {
                return { ...parsed, _version: 3 };
            } else {
                return parsed;
            }
        }
    } catch (e) {
        console.warn('[util] 读取数据失败:', e);
    }
    return { _version: 0 };
}

// ============ 字符串工具 ============
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
}

function unescapeHtml(html) {
    return html.replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
}

function truncate(str, maxLength) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

// ============ 日期工具 ============
function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(y, m, d) {
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function parseDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function isToday(dateStr) {
    return dateStr === getTodayString();
}

function isYesterday(dateStr) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday.getUTCFullYear(), yesterday.getUTCMonth() + 1, yesterday.getUTCDate()) === dateStr;
}

function getWeekStart() {
    const d = new Date();
    const dayOfWeek = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - dayOfWeek);
    return formatDate(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate());
}

function getWeekEnd() {
    const start = getWeekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return formatDate(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate());
}

function getWeekNumber(d) {
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const startOfWeek = new Date(start);
    startOfWeek.setDate(start.getDate() - start.getDay());
    
    const diff = end - startOfWeek;
    const weekNum = Math.ceil((diff + 1) / (7 * 24 * 60 * 60 * 1000));
    
    return {
        start: formatDate(startOfWeek.getUTCFullYear(), startOfWeek.getUTCMonth() + 1, startOfWeek.getUTCDate()),
        end: formatDate(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()),
        number: weekNum
    };
}

// ============ 数组工具 ============
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function arrayDiff(arr1, arr2) {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    
    return {
        added: [...set2].filter(x => !set1.has(x)),
        removed: [...set1].filter(x => !set2.has(x)),
        common: [...set1].filter(x => set2.has(x))
    };
}

// ============ 事件工具 ============
function debounce(fn, delay) {
    let timeoutId = null;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}

function throttle(fn, limit) {
    let inThrottle = false;
    return function(...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============ 存储工具 ============
function getStorageKey(prefix) {
    return `${prefix}_${Date.now()}`;
}

function safeGetStorage(key, defaultValue) {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return defaultValue;
        return JSON.parse(value);
    } catch (e) {
        return defaultValue;
    }
}

function safeSetStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn('[util] 存储失败:', e);
        return false;
    }
}

// ============ 工具函数导出 ============
window.getTodayString = getTodayString;
window.formatDate = formatDate;
window.parseDate = parseDate;
window.isToday = isToday;
window.isYesterday = isYesterday;
window.getWeekStart = getWeekStart;
window.getWeekEnd = getWeekEnd;
window.getWeekNumber = getWeekNumber;
window.escapeHtml = escapeHtml;
window.truncate = truncate;
window.deepClone = deepClone;
window.arrayDiff = arrayDiff;
window.debounce = debounce;
window.throttle = throttle;
window.safeGetStorage = safeGetStorage;
window.safeSetStorage = safeSetStorage;
