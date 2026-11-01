let methodsEditorInitialized = false;
let methodsSavedRange = null;
let methodsSaveTimer = null;
let methodsStatusTimer = null;
let activeEditorId = 'methods-content';
let searchMatches = [];
let searchIndex = -1;
function cleanupMethodsTimers() {
    if (methodsSaveTimer) { clearTimeout(methodsSaveTimer); methodsSaveTimer = null; }
    if (methodsStatusTimer) { clearTimeout(methodsStatusTimer); methodsStatusTimer = null; }
    methodsSavedRange = null;
}
function methodsGetEditor() { return document.getElementById(activeEditorId); }
function methodsSaveSelection() {
    const editor = methodsGetEditor();
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editor.contains(range.startContainer) && editor.contains(range.endContainer)) methodsSavedRange = range.cloneRange();
}
function methodsRestoreSelection() {
    if (!methodsSavedRange) return;
    const editor = methodsGetEditor();
    if (!editor) return;
    const sel = window.getSelection();
    try { sel.removeAllRanges(); sel.addRange(methodsSavedRange); } catch(e) {}
    editor.focus();
}
function methodsApplyFontSize(px) {
    const editor = methodsGetEditor();
    if (!editor) return;
    methodsRestoreSelection();
    try { document.execCommand('fontSize', false, '7'); } catch(e) {}
    editor.querySelectorAll('font[size="7"]').forEach(font => {
        const span = document.createElement('span');
        span.style.fontSize = px + 'px';
        span.innerHTML = font.innerHTML;
        font.parentNode.replaceChild(span, font);
    });
}
function methodsSetStatus(txt, color) {
    const el = document.getElementById('methods-save-status');
    if (!el) return;
    if (txt) el.innerText = txt;
    if (color) el.style.color = color;
    clearTimeout(methodsStatusTimer);
    methodsStatusTimer = setTimeout(() => { if (el) { el.innerText = '💾 自动保存'; el.style.color = ''; } }, 1600);
}
function getCurrentMethodsFile(idStr) {
    if (!Array.isArray(appData.methodsFiles) || appData.methodsFiles.length === 0) return null;
    const targetId = idStr || appData.activeMethodsFileId;
    const f = appData.methodsFiles.find(f => f.id === targetId);
    return (f && f.type === 'file') ? f : appData.methodsFiles.find(f => f.type === 'file');
}
function renderKaTeX(el) {
    if (!el || typeof renderMathInElement === 'undefined') return;
    try {
        renderMathInElement(el, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false, ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"] });
    } catch (e) { console.warn("KaTeX render error", e); }
}
function clearSearchHighlight() {
    document.querySelectorAll('.methods-content').forEach(editor => {
        const marks = editor.querySelectorAll('mark.search-hl');
        marks.forEach(m => {
            const parent = m.parentNode;
            parent.replaceChild(document.createTextNode(m.textContent), m);
            parent.normalize();
        });
        if (editor.innerHTML.trim() === '') editor.innerHTML = '';
    });
    searchMatches = [];
    searchIndex = -1;
    document.getElementById('search-count').innerText = '0/0';
}
function commitMethodsEditorToFile() {
    let changed = false;
    const cleanHTML = (html) => html.replace(/<mark class="search-hl[^"]*">/g, '').replace(/<\/mark>/g, '');
    const editor1 = document.getElementById('methods-content');
    const f1 = getCurrentMethodsFile(appData.activeMethodsFileId);
    if (editor1 && f1) {
        const newHtml = cleanHTML(editor1.innerHTML);
        const newText = editor1.innerText || '';
        if (f1.contentHtml !== newHtml || f1.contentText !== newText) {
            f1.contentHtml = newHtml; f1.contentText = newText; f1.updatedAt = Date.now();
            changed = true;
        }
    }
    if (appData.splitScreenMode) {
        const editor2 = document.getElementById('methods-content-2');
        const f2 = getCurrentMethodsFile(appData.activeMethodsFileId2);
        if (editor2 && f2) {
            const newHtml = cleanHTML(editor2.innerHTML);
            const newText = editor2.innerText || '';
            if (f2.contentHtml !== newHtml || f2.contentText !== newText) {
                f2.contentHtml = newHtml; f2.contentText = newText; f2.updatedAt = Date.now();
                changed = true;
            }
        }
    }
    if (changed) {
        const curFile = getCurrentMethodsFile(appData.activeMethodsFileId);
        appData.learningMethodsHtml = curFile ? curFile.contentHtml || '' : '';
        appData.learningMethods = curFile ? curFile.contentText || '' : '';
    }
    return changed;
}
function methodsTriggerSave() {
    const editor = methodsGetEditor();
    if (!editor) return;
    clearTimeout(methodsSaveTimer);
    methodsSaveTimer = setTimeout(() => {
        if (document.activeElement !== editor) {
            renderKaTeX(editor);
            if (appData.splitScreenMode) renderKaTeX(document.getElementById('methods-content-2'));
        }
        const changed = commitMethodsEditorToFile();
        if (changed) saveDataToFile(appData);
        methodsSetStatus('✅ 已保存', '#2e7d32');
    }, 500);
}
function performSearch() {
    clearSearchHighlight();
    const kw = document.getElementById('methods-search-input').value.trim();
    if (!kw) return;
    let editors = [];
    if (appData.splitScreenMode && document.getElementById('search-both-sides').checked) editors = [document.getElementById('methods-content'), document.getElementById('methods-content-2')];
    else editors = [methodsGetEditor()];
    editors.forEach(editor => {
        if (!editor) return;
        const walk = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
        let node;
        const textNodes = [];
        while(node = walk.nextNode()) textNodes.push(node);
        textNodes.forEach(node => {
            const text = node.nodeValue;
            const lowerText = text.toLowerCase();
            const lowerKw = kw.toLowerCase();
            let idx = lowerText.indexOf(lowerKw);
            if (idx === -1) return;
            const frag = document.createDocumentFragment();
            let lastIdx = 0;
            while (idx !== -1) {
                frag.appendChild(document.createTextNode(text.substring(lastIdx, idx)));
                const mark = document.createElement('mark');
                mark.className = 'search-hl';
                mark.textContent = text.substring(idx, idx + kw.length);
                frag.appendChild(mark);
                searchMatches.push(mark);
                lastIdx = idx + kw.length;
                idx = lowerText.indexOf(lowerKw, lastIdx);
            }
            frag.appendChild(document.createTextNode(text.substring(lastIdx)));
            node.parentNode.replaceChild(frag, node);
        });
    });
    if (searchMatches.length > 0) { searchIndex = 0; highlightMatch(); }
    else document.getElementById('search-count').innerText = '无结果';
}
function highlightMatch() {
    if (searchMatches.length === 0) return;
    searchMatches.forEach(m => m.classList.remove('active'));
    const match = searchMatches[searchIndex];
    match.classList.add('active');
    match.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('search-count').innerText = `${searchIndex + 1}/${searchMatches.length}`;
}
window.prevSearch = function() { if (searchMatches.length === 0) return; searchIndex = (searchIndex - 1 + searchMatches.length) % searchMatches.length; highlightMatch(); };
window.nextSearch = function() { if (searchMatches.length === 0) return; searchIndex = (searchIndex + 1) % searchMatches.length; highlightMatch(); };
window.clearSearch = function() { document.getElementById('methods-search-input').value = ''; clearSearchHighlight(); };
function methodsUpdateToolbarState() {
    const editor = methodsGetEditor();
    const toolbar = document.getElementById('methods-toolbar');
    if (!editor || !toolbar) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) return;
    ['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','justifyLeft','justifyCenter','justifyRight','justifyFull'].forEach(cmd => {
        const btn = toolbar.querySelector(`button[data-cmd="${cmd}"]`);
        if (!btn) return;
        let state = false;
        try { state = document.queryCommandState(cmd); } catch(e) {}
        btn.classList.toggle('active', state);
    });
}
function methodsExecCommand(cmd, val) {
    const editor = methodsGetEditor();
    if (!editor) return;
    methodsRestoreSelection();
    try {
        if (cmd === 'fontSize') methodsApplyFontSize(parseInt(val) || 14);
        else if (cmd === 'removeFormat') { document.execCommand('removeFormat', false, null); document.execCommand('formatBlock', false, 'p'); }
        else document.execCommand(cmd, false, val);
    } catch(e) { console.warn(e); }
    editor.focus();
    methodsUpdateToolbarState();
    methodsTriggerSave();
}
function getFileFullPath(fileId) {
    let path = [];
    let current = appData.methodsFiles.find(f => f.id === fileId);
    while (current) { path.unshift(current.name); current = appData.methodsFiles.find(f => f.id === current.parentId); }
    return path.join('/');
}
function buildFileTree(parentId = null) { return appData.methodsFiles.filter(f => (f.parentId || null) === parentId); }
function renderMethodsFileTree(node, listElement, depth = 0) {
    node.forEach(f => {
        const isFolder = f.type === 'folder';
        const isExpanded = expandedMethodFolders.has(f.id);
        const item = document.createElement('div');
        item.className = 'methods-file-item' + (f.id === appData.activeMethodsFileId && !isFolder ? ' active' : '');
        item.style.paddingLeft = (10 + depth * 12) + 'px';
        item.title = f.name + '\n双击重命名';
        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = isFolder ? (isExpanded ? '📂' : '📁') : '📄';
        const toggle = document.createElement('span');
        toggle.className = 'folder-toggle';
        toggle.textContent = isFolder ? (isExpanded ? '▼' : '▶') : '';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'methods-file-name';
        nameSpan.textContent = f.name;
        const delSpan = document.createElement('span');
        delSpan.className = 'methods-file-del';
        delSpan.textContent = '✕';
        delSpan.title = '删除';
        if (isFolder) toggle.onclick = (e) => { e.stopPropagation(); if (isExpanded) expandedMethodFolders.delete(f.id); else expandedMethodFolders.add(f.id); renderMethodsFileList(); };
        item.appendChild(toggle); item.appendChild(icon); item.appendChild(nameSpan); item.appendChild(delSpan);
        item.onclick = (e) => { if (e.target === delSpan || e.target === toggle) return; if (isFolder) { if (isExpanded) expandedMethodFolders.delete(f.id); else expandedMethodFolders.add(f.id); renderMethodsFileList(); } else switchMethodsFile(f.id); };
        item.ondblclick = (e) => { if (e.target === delSpan || e.target === toggle) return; renameMethodsFile(f.id); };
        delSpan.onclick = (e) => { e.stopPropagation(); deleteMethodsFile(f.id); };
        listElement.appendChild(item);
        if (isFolder && isExpanded) {
            const children = buildFileTree(f.id);
            if (children.length > 0) renderMethodsFileTree(children, listElement, depth + 1);
        }
    });
}
function renderMethodsFileList() {
    const list = document.getElementById('methods-file-list');
    if (!list) return;
    list.innerHTML = '';
    if (!Array.isArray(appData.methodsFiles) || appData.methodsFiles.length === 0) { list.innerHTML = '<div class="methods-file-empty">暂无文件<br>点右上角 ➕ 新建</div>'; return; }
    const roots = buildFileTree(null);
    renderMethodsFileTree(roots, list);
    const files = appData.methodsFiles.filter(f => f.type === 'file');
    const leftSel = document.getElementById('split-left-select');
    const rightSel = document.getElementById('split-right-select');
    if (leftSel && rightSel) {
        const buildOpts = (selectedId) => files.map(f => { const fullPath = getFileFullPath(f.id); return `<option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>${fullPath}</option>`; }).join('');
        leftSel.innerHTML = buildOpts(appData.activeMethodsFileId);
        rightSel.innerHTML = buildOpts(appData.activeMethodsFileId2);
    }
}
function switchMethodsFile(id) {
    if (appData.activeMethodsFileId === id) return;
    commitMethodsEditorToFile();
    appData.activeMethodsFileId = id;
    refreshMethodsEditorContent();
    renderMethodsFileList();
    saveDataToFile(appData);
}
window.switchMethodsFile2 = function(id) {
    if (appData.activeMethodsFileId2 === id) return;
    commitMethodsEditorToFile();
    appData.activeMethodsFileId2 = id;
    refreshMethodsEditorContent();
    renderMethodsFileList();
    saveDataToFile(appData);
};
window.createMethodsFolder = function() {
    const name = prompt('新文件夹名称：', '新建文件夹');
    if (name === null || !name.trim()) return;
    let parentId = null;
    const activeFile = appData.methodsFiles.find(f => f.id === appData.activeMethodsFileId);
    if (activeFile && activeFile.parentId) parentId = activeFile.parentId;
    else if (activeFile && activeFile.type === 'folder') parentId = activeFile.id;
    const newFolder = { id: 'folder_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: name.trim(), type: 'folder', parentId: parentId };
    appData.methodsFiles.push(newFolder);
    if (parentId) expandedMethodFolders.add(parentId);
    renderMethodsFileList(); saveDataToFile(appData);
    showMiniToast('✅ 已创建文件夹「' + newFolder.name + '」');
};
window.createMethodsFile = function() {
    const name = prompt('新文件名：', '新学习方法');
    if (name === null || !name.trim()) return;
    commitMethodsEditorToFile();
    let parentId = null;
    const activeFile = appData.methodsFiles.find(f => f.id === appData.activeMethodsFileId);
    if (activeFile && activeFile.parentId) parentId = activeFile.parentId;
    else if (activeFile && activeFile.type === 'folder') parentId = activeFile.id;
    const newFile = { id: 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: name.trim(), type: 'file', parentId: parentId, contentHtml: '', contentText: '', updatedAt: Date.now() };
    appData.methodsFiles.push(newFile);
    appData.activeMethodsFileId = newFile.id;
    if (parentId) expandedMethodFolders.add(parentId);
    renderMethodsFileList(); refreshMethodsEditorContent(); saveDataToFile(appData);
    showMiniToast('✅ 已创建「' + newFile.name + '」');
};
function renameMethodsFile(id) {
    const f = appData.methodsFiles.find(x => x.id === id);
    if (!f) return;
    const name = prompt('修改名称：', f.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === f.name) return;
    f.name = trimmed;
    if (f.type === 'file') f.updatedAt = Date.now();
    renderMethodsFileList(); saveDataToFile(appData);
    showMiniToast('✏️ 已重命名');
}
function deleteMethodsFile(id) {
    const f = appData.methodsFiles.find(x => x.id === id);
    if (!f) return;
    if (f.type === 'folder') {
        const children = appData.methodsFiles.filter(x => x.parentId === id);
        if (children.length > 0) { alert('文件夹不为空，请先删除内部的文件/文件夹。'); return; }
    }
    if (appData.methodsFiles.filter(x => x.type === 'file').length <= 1 && f.type === 'file') { alert('至少保留一个文件'); return; }
    if (!confirm(`删除「${f.name}」？内容将永久丢失。`)) return;
    const deleteRecursive = (delId) => {
        const children = appData.methodsFiles.filter(x => x.parentId === delId);
        children.forEach(c => deleteRecursive(c.id));
        appData.methodsFiles = appData.methodsFiles.filter(x => x.id !== delId);
    };
    deleteRecursive(id);
    if (appData.activeMethodsFileId === id) { const firstFile = appData.methodsFiles.find(x => x.type === 'file'); appData.activeMethodsFileId = firstFile ? firstFile.id : null; }
    if (appData.activeMethodsFileId2 === id) { const secondFile = appData.methodsFiles.filter(x => x.type === 'file')[1] || appData.methodsFiles.find(x => x.type === 'file'); appData.activeMethodsFileId2 = secondFile ? secondFile.id : null; }
    renderMethodsFileList(); refreshMethodsEditorContent(); saveDataToFile(appData);
    showMiniToast('🗑️ 已删除');
}
window.toggleSplitScreen = function() {
    commitMethodsEditorToFile();
    appData.splitScreenMode = !appData.splitScreenMode;
    const container = document.getElementById('methods-paper-container');
    const editor2 = document.getElementById('methods-content-2');
    const btn = document.getElementById('btn-toggle-split');
    const splitControls = document.getElementById('methods-split-controls');
    if (appData.splitScreenMode) {
        container.classList.add('split-screen'); editor2.classList.add('mirror');
        btn.classList.add('btn-primary'); btn.innerText = '🖥️ 单栏模式';
        if (splitControls) splitControls.style.display = 'flex';
    } else {
        container.classList.remove('split-screen'); editor2.classList.remove('mirror');
        btn.classList.remove('btn-primary'); btn.innerText = '🖥️ 双栏模式';
        if (splitControls) splitControls.style.display = 'none';
    }
    renderMethodsFileList(); refreshMethodsEditorContent(); saveDataToFile(appData);
};
function initMethodsEditor() {
    if (methodsEditorInitialized) return;
    methodsEditorInitialized = true;
    const editor1 = document.getElementById('methods-content');
    const editor2 = document.getElementById('methods-content-2');
    const toolbar = document.getElementById('methods-toolbar');
    if (!editor1 || !toolbar) return;
    renderMethodsFileList(); refreshMethodsEditorContent();
    document.addEventListener('selectionchange', () => {
        if (document.activeElement === editor1) { activeEditorId = 'methods-content'; methodsSaveSelection(); methodsUpdateToolbarState(); }
        else if (document.activeElement === editor2) { activeEditorId = 'methods-content-2'; methodsSaveSelection(); methodsUpdateToolbarState(); }
    });
    [editor1, editor2].forEach(ed => {
        if (!ed) return;
        ed.addEventListener('input', () => methodsTriggerSave());
        ed.addEventListener('mouseup', methodsSaveSelection);
        ed.addEventListener('keyup', methodsSaveSelection);
        ed.addEventListener('focus', () => { activeEditorId = ed.id; });
        ed.addEventListener('blur', () => {
            clearTimeout(methodsSaveTimer);
            const changed = commitMethodsEditorToFile();
            if (changed) saveDataToFile(appData);
            renderKaTeX(ed);
        });
    });
    const searchInput = document.getElementById('methods-search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (searchMatches.length > 0 && searchMatches[searchIndex].textContent.toLowerCase() === searchInput.value.trim().toLowerCase()) nextSearch();
                else performSearch();
            }
        });
    }
    toolbar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-cmd]');
        if (!btn) return;
        e.preventDefault();
        methodsExecCommand(btn.dataset.cmd);
    });
    toolbar.querySelectorAll('select[data-cmd]').forEach(sel => {
        sel.addEventListener('change', () => methodsExecCommand(sel.dataset.cmd, sel.value));
    });
    const foreColorInput = document.getElementById('methods-forecolor');
    const foreColorSwatch = document.getElementById('forecolor-swatch');
    const hiliteColorInput = document.getElementById('methods-hilitecolor');
    const hiliteColorSwatch = document.getElementById('hilitecolor-swatch');
    if (foreColorInput) {
        foreColorInput.addEventListener('input', () => { if (foreColorSwatch) foreColorSwatch.style.background = foreColorInput.value; });
        foreColorInput.addEventListener('change', () => methodsExecCommand('foreColor', foreColorInput.value));
    }
    if (hiliteColorInput) {
        hiliteColorInput.addEventListener('input', () => { if (hiliteColorSwatch) hiliteColorSwatch.style.background = hiliteColorInput.value; });
        hiliteColorInput.addEventListener('change', () => {
            const editor = methodsGetEditor();
            if (!editor) return;
            methodsRestoreSelection();
            let ok = false;
            try { ok = document.execCommand('hiliteColor', false, hiliteColorInput.value); } catch(e) { ok = false; }
            if (!ok) { try { document.execCommand('backColor', false, hiliteColorInput.value); } catch(e) {} }
            editor.focus();
            methodsTriggerSave();
        });
    }
}
function refreshMethodsEditorContent() {
    const editor1 = document.getElementById('methods-content');
    const editor2 = document.getElementById('methods-content-2');
    const f1 = getCurrentMethodsFile(appData.activeMethodsFileId);
    if (editor1 && f1) {
        if (editor1.innerHTML !== (f1.contentHtml || '')) { editor1.innerHTML = f1.contentHtml || ''; renderKaTeX(editor1); }
    }
    if (editor2 && appData.splitScreenMode) {
        const f2 = getCurrentMethodsFile(appData.activeMethodsFileId2);
        if (f2 && editor2.innerHTML !== (f2.contentHtml || '')) { editor2.innerHTML = f2.contentHtml || ''; renderKaTeX(editor2); }
    }
    if (appData.splitScreenMode) {
        const container = document.getElementById('methods-paper-container');
        container.classList.add('split-screen');
        editor2.classList.add('mirror');
        document.getElementById('btn-toggle-split').classList.add('btn-primary');
        document.getElementById('btn-toggle-split').innerText = '🖥️ 单栏模式';
        document.getElementById('methods-split-controls').style.display = 'flex';
    }
}