// ===== 笔记/方法模块 =====
// 笔记编辑器、Markdown 渲染

class MethodsManager {
    constructor() {
        this.notes = [];
    }

    init() {
        // 订阅数据变化
        eventBus.on('methods:change', () => this.renderNotes());
    }

    // ============ CRUD ============
    addNote(note) {
        const newNote = {
            id: crypto.randomUUID(),
            ...note,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.notes.unshift(newNote);
        this.save();
        return newNote;
    }

    updateNote(id, updates) {
        const idx = this.notes.findIndex(n => n.id === id);
        if (idx === -1) return null;
        
        const oldNote = this.notes[idx];
        const newNote = {
            ...oldNote,
            ...updates,
            updatedAt: Date.now()
        };
        this.notes[idx] = newNote;
        this.save();
        return newNote;
    }

    deleteNote(id) {
        const idx = this.notes.findIndex(n => n.id === id);
        if (idx === -1) return false;
        this.notes.splice(idx, 1);
        this.save();
        return true;
    }

    getNote(id) {
        return this.notes.find(n => n.id === id) || null;
    }

    // ============ 渲染 ============
    renderNotes() {
        const container = document.getElementById('notes-list');
        if (!container) return;

        const notes = this.notes;
        
        if (notes.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-muted);">📭 暂无笔记</div>`;
            return;
        }

        const html = notes.map(note => {
            const preview = note.content.substring(0, 80) + (note.content.length > 80 ? '...' : '');
            return `
                <div class="note-card" data-id="${note.id}" onclick="window.openNoteDetail('${note.id}')">
                    <div class="note-header">
                        <h3>${escapeHtml(note.title)}</h3>
                        <span class="note-meta">${new Date(note.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div class="note-preview">${escapeHtml(preview)}</div>
                    <div class="note-actions">
                        <button onclick="window.editNote('${note.id}')" title="编辑">✏️</button>
                        <button onclick="window.deleteNote('${note.id}')" title="删除">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }

    // ============ 工具方法 ============
    getNotes() {
        return this.notes;
    }

    save() {
        saveDataToFile({ methods: this.notes });
    }
}

// 导出
window.MethodsManager = MethodsManager;
window.methodsManager = new MethodsManager();

// ============ Markdown 渲染工具 ============
function renderMarkdown(text) {
    // 简单的 Markdown 渲染
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // 标题
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    
    // 列表
    html = html.replace(/^[\s]*- (.*)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/gim, '<ul>$&</ul>');
    
    // 代码块
    html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');
    
    // 引用
    html = html.replace(/^> (.*)/gim, '<blockquote>$1</blockquote>');
    
    // 链接
    html = html.replace(/\[(.+?)\]\((.*?)\)/gim, '<a href="$2" target="_blank">$1</a>');
    
    return html;
}

// ============ 工具函数 ============
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
}
