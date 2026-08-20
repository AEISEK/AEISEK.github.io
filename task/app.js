(function () {
    'use strict';

    const STORAGE_KEY = 'notes_app_data';
    const THEME_KEY = 'notes_app_theme';
    const VIEW_KEY = 'notes_app_view';

    let notes = [];
    let currentFilter = 'all';
    let currentSearch = '';
    let currentView = 'grid';
    let editingNoteId = null;
    let modalTags = [];
    let modalLinks = [];
    let modalChecklist = [];
    let modalPinned = false;

    const $ = (id) => document.getElementById(id);

    const els = {
        sidebar: $('sidebar'),
        sidebarToggle: $('sidebarToggle'),
        menuBtn: $('menuBtn'),
        newNoteBtn: $('newNoteBtn'),
        tagsList: $('tagsList'),
        countAll: $('countAll'),
        exportBtn: $('exportBtn'),
        importBtn: $('importBtn'),
        importFile: $('importFile'),
        themeToggle: $('themeToggle'),
        searchInput: $('searchInput'),
        notesGrid: $('notesGrid'),
        emptyState: $('emptyState'),
        notesContainer: $('notesContainer'),
        modalOverlay: $('modalOverlay'),
        noteTitle: $('noteTitle'),
        noteContent: $('noteContent'),
        closeModal: $('closeModal'),
        tagInput: $('tagInput'),
        modalTagsList: $('modalTagsList'),
        modalDate: $('modalDate'),
        deleteNoteBtn: $('deleteNoteBtn'),
        saveNoteBtn: $('saveNoteBtn'),
        toast: $('toast'),
        addLinkBtn: $('addLinkBtn'),
        linkForm: $('linkForm'),
        linkUrl: $('linkUrl'),
        linkName: $('linkName'),
        confirmLinkBtn: $('confirmLinkBtn'),
        modalLinksList: $('modalLinksList'),
        pinNoteBtn: $('pinNoteBtn'),
        addChecklistBtn: $('addChecklistBtn'),
        checklistForm: $('checklistForm'),
        checklistInput: $('checklistInput'),
        confirmChecklistBtn: $('confirmChecklistBtn'),
        modalChecklistList: $('modalChecklistList'),
        checklistProgress: $('checklistProgress'),
        sidebarNav: document.querySelector('.sidebar-nav'),
        viewBtns: document.querySelectorAll('.view-btn'),
    };

    function init() {
        loadNotes();
        loadTheme();
        loadView();
        bindEvents();
        render();
    }

    function loadNotes() {
        localStorage.removeItem('notes_github_token');
        localStorage.removeItem('notes_gist_id');
        localStorage.removeItem('notes_autosync');
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            notes = raw ? JSON.parse(raw) : [];
        } catch (e) {
            notes = [];
        }
    }

    function saveNotes() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }

    function loadTheme() {
        const theme = localStorage.getItem(THEME_KEY) || 'light';
        document.documentElement.setAttribute('data-theme', theme);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(THEME_KEY, next);
    }

    function loadView() {
        currentView = localStorage.getItem(VIEW_KEY) || 'grid';
        applyView();
    }

    function applyView() {
        els.notesGrid.classList.toggle('list-view', currentView === 'list');
        els.viewBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === currentView);
        });
    }

    function bindEvents() {
        els.newNoteBtn.addEventListener('click', () => openModal(null));
        els.closeModal.addEventListener('click', closeModal);
        els.modalOverlay.addEventListener('click', (e) => {
            if (e.target === els.modalOverlay) closeModal();
        });
        els.saveNoteBtn.addEventListener('click', saveNote);
        els.deleteNoteBtn.addEventListener('click', deleteNote);
        els.themeToggle.addEventListener('click', toggleTheme);
        els.exportBtn.addEventListener('click', exportNotes);
        els.importBtn.addEventListener('click', () => els.importFile.click());
        els.importFile.addEventListener('change', importNotes);
        els.searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.toLowerCase();
            renderNotes();
        });
        els.tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addModalTag();
            }
        });
        els.sidebarToggle.addEventListener('click', () => {
            els.sidebar.classList.toggle('collapsed');
        });
        els.menuBtn.addEventListener('click', () => {
            els.sidebar.classList.toggle('collapsed');
        });
        els.viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentView = btn.dataset.view;
                localStorage.setItem(VIEW_KEY, currentView);
                applyView();
            });
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && els.modalOverlay.classList.contains('active')) {
                closeModal();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !els.modalOverlay.classList.contains('active')) {
                e.preventDefault();
                openModal(null);
            }
        });
        els.sidebarNav.addEventListener('click', (e) => {
            const item = e.target.closest('.nav-item');
            if (!item) return;
            currentFilter = item.dataset.filter;
            updateActiveNav();
            renderNotes();
        });
        els.addLinkBtn.addEventListener('click', () => {
            els.linkForm.style.display = 'flex';
            els.confirmLinkBtn.textContent = 'Добавить';
            delete els.confirmLinkBtn.dataset.editIndex;
            els.linkUrl.value = '';
            els.linkName.value = '';
            els.linkUrl.focus();
        });
        els.confirmLinkBtn.addEventListener('click', addModalLink);
        els.linkUrl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); els.linkName.focus(); }
        });
        els.linkName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addModalLink(); }
        });
        els.pinNoteBtn.addEventListener('click', () => {
            modalPinned = !modalPinned;
            els.pinNoteBtn.classList.toggle('active', modalPinned);
        });
        els.addChecklistBtn.addEventListener('click', () => {
            els.checklistForm.style.display = 'flex';
            els.checklistInput.focus();
        });
        els.confirmChecklistBtn.addEventListener('click', addChecklistItem);
        els.checklistInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); }
        });
    }

    function openModal(noteId) {
        editingNoteId = noteId;
        if (noteId !== null) {
            const note = notes.find(n => n.id === noteId);
            if (!note) return;
            els.noteTitle.value = note.title;
            els.noteContent.value = note.content;
            modalTags = [...note.tags];
            modalLinks = (note.links || []).map(l => ({ url: l.url, title: l.title }));
            modalChecklist = (note.checklist || []).map(c => ({ text: c.text, done: c.done }));
            modalPinned = !!note.pinned;
            els.pinNoteBtn.classList.toggle('active', modalPinned);
            els.modalDate.textContent = formatDate(note.updatedAt);
            els.deleteNoteBtn.style.display = 'inline-flex';
        } else {
            els.noteTitle.value = '';
            els.noteContent.value = '';
            modalTags = [];
            modalLinks = [];
            modalChecklist = [];
            modalPinned = false;
            els.pinNoteBtn.classList.remove('active');
            els.modalDate.textContent = '';
            els.deleteNoteBtn.style.display = 'none';
        }
        els.tagInput.value = '';
        els.linkForm.style.display = 'none';
        els.linkUrl.value = '';
        els.linkName.value = '';
        els.checklistForm.style.display = 'none';
        els.checklistInput.value = '';
        renderModalTags();
        renderModalLinks();
        renderModalChecklist();
        els.modalOverlay.classList.add('active');
        setTimeout(() => els.noteTitle.focus(), 100);
    }

    function closeModal() {
        els.modalOverlay.classList.remove('active');
        editingNoteId = null;
        modalTags = [];
        modalLinks = [];
        modalChecklist = [];
        modalPinned = false;
    }

    function addModalTag() {
        const tag = els.tagInput.value.trim().toLowerCase();
        if (tag && !modalTags.includes(tag)) {
            modalTags.push(tag);
            renderModalTags();
        }
        els.tagInput.value = '';
    }

    function removeModalTag(tag) {
        modalTags = modalTags.filter(t => t !== tag);
        renderModalTags();
    }

    function renderModalTags() {
        els.modalTagsList.innerHTML = '';
        modalTags.forEach(tag => {
            const el = document.createElement('span');
            el.className = 'modal-tag';
            el.innerHTML = '#' + escapeHtml(tag) + '<button type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
            el.querySelector('button').addEventListener('click', () => removeModalTag(tag));
            els.modalTagsList.appendChild(el);
        });
    }

    function addModalLink() {
        let url = els.linkUrl.value.trim();
        const title = els.linkName.value.trim() || url;
        if (!url) {
            showToast('Введите адрес ссылки');
            els.linkUrl.focus();
            return;
        }
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        const editIndex = els.confirmLinkBtn.dataset.editIndex;
        if (editIndex !== undefined && editIndex !== '') {
            modalLinks[parseInt(editIndex)] = { url: url, title: title };
            delete els.confirmLinkBtn.dataset.editIndex;
            els.confirmLinkBtn.textContent = 'Добавить';
        } else {
            modalLinks.push({ url: url, title: title });
        }
        els.linkUrl.value = '';
        els.linkName.value = '';
        els.linkForm.style.display = 'none';
        renderModalLinks();
    }

    function removeModalLink(index) {
        modalLinks.splice(index, 1);
        renderModalLinks();
    }

    function editModalLink(index) {
        const link = modalLinks[index];
        if (!link) return;
        els.linkForm.style.display = 'flex';
        els.linkUrl.value = link.url;
        els.linkName.value = link.title;
        els.confirmLinkBtn.textContent = 'Сохранить';
        els.confirmLinkBtn.dataset.editIndex = index;
        els.linkUrl.focus();
    }

    function reorderModalLink(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        const moved = modalLinks.splice(fromIndex, 1)[0];
        modalLinks.splice(toIndex, 0, moved);
        renderModalLinks();
    }

    function renderModalLinks() {
        els.modalLinksList.innerHTML = '';
        modalLinks.forEach((link, i) => {
            const el = document.createElement('div');
            el.className = 'modal-link-item';
            el.draggable = false;
            el.innerHTML =
                '<button type="button" class="icon-btn link-drag" title="Перетащить" draggable="true">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>' +
                '</button>' +
                '<a href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener noreferrer" class="modal-link-anchor">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
                '<span>' + escapeHtml(link.title) + '</span>' +
                '</a>' +
                '<button type="button" class="icon-btn link-edit" title="Редактировать">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
                '</button>' +
                '<button type="button" class="icon-btn link-remove" title="Удалить ссылку">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>';
            el.querySelector('.link-edit').addEventListener('click', () => editModalLink(i));
            el.querySelector('.link-remove').addEventListener('click', () => removeModalLink(i));
            els.modalLinksList.appendChild(el);
        });
        bindLinkDragDrop();
    }

    function bindLinkDragDrop() {
        const items = els.modalLinksList.querySelectorAll('.modal-link-item');
        let dragSrcIndex = null;

        items.forEach((item, i) => {
            const dragHandle = item.querySelector('.link-drag');

            dragHandle.addEventListener('dragstart', (e) => {
                dragSrcIndex = i;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(i));
            });

            dragHandle.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                items.forEach(it => {
                    it.classList.remove('drag-over-top', 'drag-over-bottom');
                });
                dragSrcIndex = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (i === dragSrcIndex) return;
                const rect = item.getBoundingClientRect();
                const above = (e.clientY - rect.top) < rect.height / 2;
                item.classList.toggle('drag-over-top', above);
                item.classList.toggle('drag-over-bottom', !above);
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (dragSrcIndex === null) return;
                const rect = item.getBoundingClientRect();
                const above = (e.clientY - rect.top) < rect.height / 2;
                let toIndex = i + (above ? 0 : 1);
                if (toIndex > dragSrcIndex) toIndex--;
                reorderModalLink(dragSrcIndex, toIndex);
            });
        });
    }

    function addChecklistItem() {
        const text = els.checklistInput.value.trim();
        if (!text) {
            els.checklistInput.focus();
            return;
        }
        modalChecklist.push({ text: text, done: false });
        els.checklistInput.value = '';
        els.checklistForm.style.display = 'none';
        renderModalChecklist();
    }

    function toggleChecklistItem(index) {
        modalChecklist[index].done = !modalChecklist[index].done;
        renderModalChecklist();
    }

    function removeChecklistItem(index) {
        modalChecklist.splice(index, 1);
        renderModalChecklist();
    }

    function renderModalChecklist() {
        els.modalChecklistList.innerHTML = '';
        const done = modalChecklist.filter(c => c.done).length;
        const total = modalChecklist.length;
        els.checklistProgress.textContent = total > 0 ? done + '/' + total : '';
        modalChecklist.forEach((item, i) => {
            const el = document.createElement('div');
            el.className = 'checklist-item' + (item.done ? ' done' : '');
            el.innerHTML =
                '<label class="checklist-checkbox">' +
                '<input type="checkbox"' + (item.done ? ' checked' : '') + '>' +
                '<span class="checkmark"></span>' +
                '</label>' +
                '<span class="checklist-text">' + escapeHtml(item.text) + '</span>' +
                '<button type="button" class="icon-btn checklist-remove" title="Удалить">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>';
            el.querySelector('input').addEventListener('change', () => toggleChecklistItem(i));
            el.querySelector('.checklist-remove').addEventListener('click', () => removeChecklistItem(i));
            els.modalChecklistList.appendChild(el);
        });
    }

    function saveNote() {
        const title = els.noteTitle.value.trim();
        const content = els.noteContent.value.trim();
        if (!title && !content) {
            showToast('Введите заголовок или текст');
            return;
        }
        const now = Date.now();
        if (editingNoteId !== null) {
            const note = notes.find(n => n.id === editingNoteId);
            if (note) {
                note.title = title;
                note.content = content;
                note.tags = [...modalTags];
                note.links = modalLinks.map(l => ({ url: l.url, title: l.title }));
                note.checklist = modalChecklist.map(c => ({ text: c.text, done: c.done }));
                note.pinned = modalPinned;
                note.updatedAt = now;
            }
            showToast('Заметка обновлена');
        } else {
            notes.unshift({
                id: now + '_' + Math.random().toString(36).substr(2, 9),
                title: title,
                content: content,
                tags: [...modalTags],
                links: modalLinks.map(l => ({ url: l.url, title: l.title })),
                checklist: modalChecklist.map(c => ({ text: c.text, done: c.done })),
                pinned: modalPinned,
                createdAt: now,
                updatedAt: now,
            });
            showToast('Заметка создана');
        }
        saveNotes();
        closeModal();
        render();
    }

    function deleteNote() {
        if (editingNoteId === null) return;
        if (!confirm('Удалить эту заметку?')) return;
        notes = notes.filter(n => n.id !== editingNoteId);
        saveNotes();
        closeModal();
        render();
        showToast('Заметка удалена');
    }

    function getFilteredNotes() {
        let result = notes;
        if (currentFilter !== 'all') {
            result = result.filter(n => n.tags.includes(currentFilter));
        }
        if (currentSearch) {
            result = result.filter(n =>
                (n.title && n.title.toLowerCase().includes(currentSearch)) ||
                (n.content && n.content.toLowerCase().includes(currentSearch)) ||
                n.tags.some(t => t.includes(currentSearch))
            );
        }
        result = result.slice().sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.updatedAt - a.updatedAt;
        });
        return result;
    }

    function getAllTags() {
        const tagMap = {};
        notes.forEach(n => {
            n.tags.forEach(t => {
                tagMap[t] = (tagMap[t] || 0) + 1;
            });
        });
        return Object.entries(tagMap)
            .sort((a, b) => a[0].localeCompare(b[0]));
    }

    function render() {
        renderTags();
        renderNotes();
        els.countAll.textContent = notes.length;
    }

    function renderTags() {
        const tags = getAllTags();
        els.tagsList.innerHTML = '';
        if (tags.length === 0) {
            els.tagsList.innerHTML = '<div class="no-tags">Нет тегов</div>';
            return;
        }
        tags.forEach(([tag, count]) => {
            const el = document.createElement('button');
            el.className = 'tag-nav-item' + (currentFilter === tag ? ' active' : '');
            el.innerHTML = '<span class="tag-dot"></span><span>#' + escapeHtml(tag) + '</span><span class="tag-count">' + count + '</span>';
            el.addEventListener('click', () => {
                currentFilter = currentFilter === tag ? 'all' : tag;
                updateActiveNav();
                renderNotes();
            });
            els.tagsList.appendChild(el);
        });
    }

    function updateActiveNav() {
        const navItems = els.sidebarNav.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.filter === currentFilter);
        });
        els.tagsList.querySelectorAll('.tag-nav-item').forEach((el, i) => {
            const tags = getAllTags();
            const tag = tags[i] && tags[i][0];
            el.classList.toggle('active', currentFilter === tag);
        });
    }

    function renderNotes() {
        const filtered = getFilteredNotes();
        els.notesGrid.innerHTML = '';
        if (filtered.length === 0) {
            els.emptyState.style.display = 'flex';
            els.notesGrid.style.display = 'none';
            if (notes.length > 0 && (currentSearch || currentFilter !== 'all')) {
                els.emptyState.querySelector('h2').textContent = 'Ничего не найдено';
                els.emptyState.querySelector('p').textContent = 'Попробуйте изменить запрос';
                els.emptyState.querySelector('button').style.display = 'none';
            } else {
                els.emptyState.querySelector('h2').textContent = 'Заметок нет';
                els.emptyState.querySelector('p').textContent = 'Создайте свою первую заметку';
                els.emptyState.querySelector('button').style.display = 'inline-flex';
            }
        } else {
            els.emptyState.style.display = 'none';
            els.notesGrid.style.display = 'grid';
            filtered.forEach(note => {
                els.notesGrid.appendChild(createNoteCard(note));
            });
        }
    }

    function createNoteCard(note) {
        const card = document.createElement('div');
        card.className = 'note-card' + (note.pinned ? ' pinned' : '');

        const body = document.createElement('div');
        body.className = 'note-body';

        const pinBtn = document.createElement('button');
        pinBtn.className = 'icon-btn pin-btn' + (note.pinned ? ' active' : '');
        pinBtn.title = note.pinned ? 'Открепить' : 'Закрепить';
        pinBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.5-3h-11z"/><path d="M9 3h6l-1 7a3 3 0 0 1-4 0z"/></svg>';
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePin(note.id);
        });
        body.appendChild(pinBtn);

        if (note.title) {
            const title = document.createElement('div');
            title.className = 'note-title';
            title.textContent = note.title;
            body.appendChild(title);
        }

        if (note.content) {
            const preview = document.createElement('div');
            preview.className = 'note-preview';
            preview.textContent = note.content;
            body.appendChild(preview);
        }

        if (note.checklist && note.checklist.length > 0) {
            const list = document.createElement('div');
            list.className = 'note-card-checklist';
            const done = note.checklist.filter(c => c.done).length;
            const total = note.checklist.length;
            const progress = document.createElement('div');
            progress.className = 'checklist-progress-bar';
            progress.innerHTML = '<span>' + done + '/' + total + '</span><div class="progress-track"><div class="progress-fill" style="width:' + (total > 0 ? (done / total * 100) : 0) + '%"></div></div>';
            list.appendChild(progress);
            note.checklist.slice(0, 5).forEach((item, i) => {
                const el = document.createElement('label');
                el.className = 'checklist-card-item' + (item.done ? ' done' : '');
                el.innerHTML = '<input type="checkbox"' + (item.done ? ' checked' : '') + '><span class="checklist-text">' + escapeHtml(item.text) + '</span>';
                el.querySelector('input').addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleCardChecklist(note.id, i);
                });
                list.appendChild(el);
            });
            if (note.checklist.length > 5) {
                const more = document.createElement('div');
                more.className = 'checklist-more';
                more.textContent = 'Ещё ' + (note.checklist.length - 5) + ' пунктов';
                list.appendChild(more);
            }
            body.appendChild(list);
        }

        if (note.tags.length > 0) {
            const tags = document.createElement('div');
            tags.className = 'note-card-tags';
            note.tags.slice(0, 4).forEach(tag => {
                const t = document.createElement('span');
                t.className = 'note-tag';
                t.textContent = '#' + tag;
                tags.appendChild(t);
            });
            if (note.tags.length > 4) {
                const more = document.createElement('span');
                more.className = 'note-tag';
                more.textContent = '+' + (note.tags.length - 4);
                tags.appendChild(more);
            }
            body.appendChild(tags);
        }

        if (note.links && note.links.length > 0) {
            const links = document.createElement('div');
            links.className = 'note-card-links';
            note.links.forEach(link => {
                const a = document.createElement('a');
                a.className = 'note-link';
                a.href = link.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span>' + escapeHtml(link.title) + '</span>';
                a.addEventListener('click', (e) => e.stopPropagation());
                links.appendChild(a);
            });
            body.appendChild(links);
        }

        const meta = document.createElement('div');
        meta.className = 'note-meta';
        const date = document.createElement('span');
        date.className = 'note-date';
        date.textContent = formatDate(note.updatedAt);
        meta.appendChild(date);
        body.appendChild(meta);

        card.appendChild(body);
        card.addEventListener('click', () => openModal(note.id));
        return card;
    }

    function togglePin(noteId) {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;
        note.pinned = !note.pinned;
        note.updatedAt = note.pinned ? note.updatedAt : Date.now();
        saveNotes();
        renderNotes();
        showToast(note.pinned ? 'Закреплено' : 'Откреплено');
    }

    function toggleCardChecklist(noteId, itemIndex) {
        const note = notes.find(n => n.id === noteId);
        if (!note || !note.checklist[itemIndex]) return;
        note.checklist[itemIndex].done = !note.checklist[itemIndex].done;
        note.updatedAt = Date.now();
        saveNotes();
        renderNotes();
    }

    function exportNotes() {
        if (notes.length === 0) {
            showToast('Нет заметок для экспорта');
            return;
        }
        const data = JSON.stringify({
            version: 1,
            exportedAt: new Date().toISOString(),
            notes: notes,
        }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notes_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Экспортировано заметок: ' + notes.length);
    }

    function importNotes(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                const imported = Array.isArray(data) ? data : data.notes;
                if (!Array.isArray(imported)) throw new Error('Invalid format');
                let added = 0;
                imported.forEach(note => {
                    if (note.title || note.content) {
                        notes.unshift({
                            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            title: note.title || '',
                            content: note.content || '',
                            tags: Array.isArray(note.tags) ? note.tags : [],
                            links: Array.isArray(note.links) ? note.links : [],
                            checklist: Array.isArray(note.checklist) ? note.checklist : [],
                            pinned: !!note.pinned,
                            createdAt: note.createdAt || Date.now(),
                            updatedAt: Date.now(),
                        });
                        added++;
                    }
                });
                saveNotes();
                render();
                showToast('Импортировано заметок: ' + added);
            } catch (err) {
                showToast('Ошибка импорта файла');
            }
        };
        reader.readAsText(file);
        els.importFile.value = '';
    }

    function formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const day = 24 * 60 * 60 * 1000;
        if (diff < day && date.getDate() === now.getDate()) {
            return 'Сегодня, ' + date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
        }
        if (diff < 2 * day && date.getDate() === now.getDate() - 1) {
            return 'Вчера, ' + date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
    }

    function showToast(message) {
        els.toast.textContent = message;
        els.toast.classList.add('show');
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => {
            els.toast.classList.remove('show');
        }, 2500);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
