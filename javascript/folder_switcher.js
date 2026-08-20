onUiLoaded(async () => {
    // ==========================================
    // 1. DYNAMIC BASE PATH & CONFIGURATION HELPER
    // ==========================================
    let cachedBasePath = "";

    const fetchBaseAppPath = async () => {
        if (cachedBasePath) return cachedBasePath;
        try {
            const res = await fetch('/sdapi/v1/folder-switcher/get-base-dir');
            if (res.ok) {
                const data = await res.json();
                cachedBasePath = data.base_path || "";
                return cachedBasePath;
            }
        } catch (e) {
            console.error('[FolderSwitcher] Failed to fetch base path:', e);
        }
        return "";
    };

    const BASE_APP_PATH = await fetchBaseAppPath();

    const getDefaultFolderPath = (folderName) => {
        return BASE_APP_PATH ? `${BASE_APP_PATH}\\${folderName}` : folderName;
    };

    const DEFAULT_FOLDER_CONFIG = {
        position: "above_steps",
        folders: [
            ["Outputs", getDefaultFolderPath("outputs")]
        ]
    };

    const getFolderConfig = () => {
        try {
            const saved = localStorage.getItem('sd_ui_folder_switcher_config');
            return saved ? JSON.parse(saved) : DEFAULT_FOLDER_CONFIG;
        } catch (e) {
            return DEFAULT_FOLDER_CONFIG;
        }
    };

    const saveFolderConfig = (newConfig) => {
        localStorage.setItem('sd_ui_folder_switcher_config', JSON.stringify(newConfig, null, 2));
        renderFolderSwitchers();
    };

    const getActiveFolder = () => {
        return localStorage.getItem('sd_ui_active_folder_global') || getFolderConfig().folders[0]?.[1] || getDefaultFolderPath("outputs");
    };

    const setActiveFolder = (pathValue) => {
        localStorage.setItem('sd_ui_active_folder_global', pathValue);
        
        document.querySelectorAll('.folder-radio-input').forEach(radio => {
            radio.checked = (radio.value === pathValue);
        });
    };

    // ==========================================
    // 2. SENDING TO THE BACKEND
    // ==========================================
    const setOutputDirectoryOnBackend = async (folderPath) => {
        try {
            const response = await fetch('/sdapi/v1/folder-switcher/set-dir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_path: folderPath })
            });

            if (!response.ok) throw new Error(`Server status ${response.status}`);
            
            const data = await response.json();
            console.log('[FolderSwitcher] Paths updated:', data.updated_paths);
        } catch (error) {
            console.error('[FolderSwitcher] Error changing paths:', error);
        }
    };

    // ==========================================
    // 3. DYNAMIC ROW RENDERING & HANDLE-ONLY DRAG
    // ==========================================
    let draggedRow = null;

    const getFoldersFromUI = () => {
        const rows = document.querySelectorAll('#folder-list-container .folder-input-row');
        const folders = [];
        rows.forEach(row => {
            const labelInput = row.querySelector('.folder-input-label');
            const pathInput = row.querySelector('.folder-input-path');
            const label = labelInput ? labelInput.value.trim() : "";
            const pathValue = pathInput ? pathInput.value.trim() : "";
            folders.push([label || "Outputs", pathValue || getDefaultFolderPath("outputs")]);
        });
        return folders;
    };

    const updateDeleteButtonsVisibility = () => {
        const rows = document.querySelectorAll('#folder-list-container .folder-input-row');
        const showDelete = rows.length > 1;
        rows.forEach(row => {
            const btn = row.querySelector('.delete-folder-btn');
            if (btn) btn.style.display = showDelete ? 'inline-flex' : 'none';
        });
    };

    const setupDragAndDrop = (listContainer) => {
        listContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            if (!draggedRow) return;

            const target = e.target.closest('.folder-input-row');
            if (target && target !== draggedRow && target.parentNode === listContainer) {
                const rect = target.getBoundingClientRect();
                const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
                listContainer.insertBefore(draggedRow, next ? target.nextSibling : target);
            }
        });
    };

    const createFolderRowElement = (label, pathValue, defaultLabel, defaultSubfolder) => {
        const row = document.createElement('div');
        row.className = 'folder-input-row';
        row.style.cssText = `
            display: grid; 
            grid-template-columns: 24px 1fr 2fr 34px 34px;
            gap: 8px; 
            align-items: center; 
            margin-bottom: 6px; 
            padding: 6px 8px;
            border-radius: 6px;
            background: var(--background-fill-secondary, #2b3544);
            border: 1px solid var(--border-color-primary, #374151);
            box-sizing: border-box;
            width: 100%;
        `;

        const squareBtnStyle = `
            width: 34px !important;
            height: 34px !important;
            min-width: 34px !important;
            max-width: 34px !important;
            min-height: 34px !important;
            max-height: 34px !important;
            aspect-ratio: 1 / 1 !important;
            flex: 0 0 34px !important;
            padding: 0 !important;
            margin: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 0.85em !important;
            border-radius: 4px !important;
            box-sizing: border-box !important;
            line-height: 1 !important;
        `;

        row.innerHTML = `
            <div class="drag-handle" draggable="true" style="cursor: grab; user-select: none; text-align: center; color: #9ca3af; font-weight: bold; font-size: 1.1em; line-height: 1;" title="Drag to reorder">⋮⋮</div>
            <input type="text" class="folder-input-label" value="${label}" placeholder="UI Label" style="width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 4px; border: 1px solid var(--border-color-primary, #374151); background: var(--input-bg, #1f2937); color: var(--text-normal, #f3f4f6); pointer-events: auto; font-size: 0.9em; height: 34px;" />
            <input type="text" class="folder-input-path" value="${pathValue}" placeholder="Folder path" style="width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 4px; border: 1px solid var(--border-color-primary, #374151); background: var(--input-bg, #1f2937); color: var(--text-normal, #f3f4f6); pointer-events: auto; font-size: 0.9em; height: 34px;" />
            
            <button type="button" class="reset-path-btn scale-preset-btn btn-secondary" title="Reset label & path to default" style="${squareBtnStyle}">🔄</button>
            <button type="button" class="delete-folder-btn scale-preset-btn btn-danger" title="Delete" style="${squareBtnStyle}">🗑️</button>
        `;

        const handleEl = row.querySelector('.drag-handle');

        handleEl.addEventListener('dragstart', (e) => {
            draggedRow = row;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
            setTimeout(() => {
                row.style.opacity = '0.4';
                row.style.border = '1px dashed #60a5fa';
            }, 0);
        });

        handleEl.addEventListener('dragend', () => {
            if (draggedRow) {
                draggedRow.style.opacity = '1';
                draggedRow.style.border = '1px solid var(--border-color-primary, #374151)';
                draggedRow = null;
            }
        });

        const resetBtn = row.querySelector('.reset-path-btn');
        resetBtn.onclick = () => {
            const labelInput = row.querySelector('.folder-input-label');
            const pathInput = row.querySelector('.folder-input-path');
            labelInput.value = defaultLabel;
            pathInput.value = getDefaultFolderPath(defaultSubfolder);
        };

        const deleteBtn = row.querySelector('.delete-folder-btn');
        deleteBtn.onclick = () => {
            row.remove();
            updateDeleteButtonsVisibility();
        };

        return row;
    };

    const renderFolderRows = (folders) => {
        const listContainer = document.getElementById('folder-list-container');
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        setupDragAndDrop(listContainer);

        folders.forEach(([label, pathValue], index) => {
            const defaultLabel = index === 0 ? "Outputs" : `Outputs ${index + 1}`;
            const defaultSubfolder = index === 0 ? "outputs" : `outputs_${index + 1}`;
            const row = createFolderRowElement(label, pathValue, defaultLabel, defaultSubfolder);
            listContainer.appendChild(row);
        });

        updateDeleteButtonsVisibility();
    };

    // ==========================================
    // 4. MODAL SETTINGS WINDOW
    // ==========================================
    const createFolderEditorModal = () => {
        if (document.getElementById('folder-json-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'folder-json-modal';
        modal.className = 'preset-modal-backdrop';
        modal.style.display = 'none';

        modal.innerHTML = `
            <div class="preset-modal-content" style="max-width: 640px; width: 90%; border-radius: 8px; padding: 16px; background: var(--background-fill-primary, #1f2937); box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 style="margin: 0; font-size: 1.1em; font-weight: 600;">⚙️ Configure Output Directories</h3>
                    <button class="preset-modal-close" id="close-folder-modal" style="background: none; border: none; font-size: 1.2em; cursor: pointer; color: inherit; line-height: 1;">&times;</button>
                </div>

                <div style="max-height: 65vh; overflow-y: auto; padding-right: 2px;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                        <label style="color:#9ca3af; font-size:0.85em;">Panel location:</label>
                        <select id="folder-panel-position" class="folder-select-input" style="padding: 4px 8px; border-radius: 4px; background: var(--input-bg, #111827); border: 1px solid var(--border-color-primary, #374151); color: inherit;">
                            <option value="above_steps">Above parameters (Steps / Sampling)</option>
                            <option value="above_tools">Above action buttons (Generate / Tools)</option>
                        </select>
                    </div>

                    <div style="display: grid; grid-template-columns: 24px 1fr 2fr 34px 34px; gap: 8px; padding: 0 8px; margin-bottom: 4px; color: #9ca3af; font-size: 0.8em; font-weight: 600;">
                        <span></span>
                        <span>UI Label</span>
                        <span>Output Directory Path</span>
                        <span></span>
                        <span></span>
                    </div>

                    <div id="folder-list-container" style="margin-bottom: 0px; padding: 0px;"></div>

                    <button id="add-folder-row" class="scale-preset-btn btn-secondary" style="width: 100%; padding: 6px; margin-bottom: 12px; font-weight: 500;">+ Add Directory Mapping</button>
                </div>

                <div style="display: flex; justify-content: flex-end; align-items: center; border-top: 1px solid var(--border-color-primary, #374151); padding-top: 12px; gap: 8px;">
                    <button id="apply-folder-json" class="scale-preset-btn btn-secondary" style="padding: 6px 12px;">Apply</button>
                    <button id="save-folder-json" class="scale-preset-btn btn-primary" style="padding: 6px 12px;">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => { modal.style.display = 'none'; };
        document.getElementById('close-folder-modal').onclick = closeModal;

        document.getElementById('add-folder-row').onclick = () => {
            const listContainer = document.getElementById('folder-list-container');
            const currentCount = listContainer.children.length;
            const folderIndex = currentCount + 1;
            const defaultLabel = `Outputs ${folderIndex}`;
            const subfolder = `outputs_${folderIndex}`;
            const newRow = createFolderRowElement(defaultLabel, getDefaultFolderPath(subfolder), defaultLabel, subfolder);
            
            listContainer.appendChild(newRow);
            updateDeleteButtonsVisibility();
        };

        const executeSave = async () => {
            const positionSelect = document.getElementById('folder-panel-position');
            const folders = getFoldersFromUI();
            
            if (folders.length === 0) {
                alert("At least one folder mapping is required!");
                return false;
            }

            const currentActive = getActiveFolder();
            const activeFolderStillExists = folders.some(([_, path]) => path === currentActive);

            const newConfig = {
                position: positionSelect.value,
                folders: folders
            };

            saveFolderConfig(newConfig);

            if (!activeFolderStillExists && folders.length > 0) {
                const fallbackPath = folders[0][1];
                setActiveFolder(fallbackPath);
                await setOutputDirectoryOnBackend(fallbackPath);
            }

            return true;
        };

        document.getElementById('apply-folder-json').onclick = async () => {
            await executeSave();
        };

        document.getElementById('save-folder-json').onclick = async () => {
            if (await executeSave()) {
                closeModal();
            }
        };
    };

    const openFolderEditor = () => {
        createFolderEditorModal();
        const config = getFolderConfig();
        const modal = document.getElementById('folder-json-modal');
        const positionSelect = document.getElementById('folder-panel-position');
        
        if (positionSelect) positionSelect.value = config.position || "above_steps";
        renderFolderRows(config.folders || DEFAULT_FOLDER_CONFIG.folders);

        modal.style.display = 'flex';
    };

    // ==========================================
    // 5. POSITIONING & RENDER
    // ==========================================
    const getTargetAnchorElement = (tabPrefix, position) => {
        if (position === "above_tools") {
            return document.getElementById(`${tabPrefix}_tools`) || 
                   document.getElementById(`${tabPrefix}_generate_box`) ||
                   document.querySelector(`#${tabPrefix}_toprow`);
        }
        return document.getElementById(`${tabPrefix}_steps`) || 
               document.getElementById(`${tabPrefix}_sampling`);
    };

    const renderFolderSwitcherForTab = (tabPrefix) => {
        const config = getFolderConfig();
        const anchorEl = getTargetAnchorElement(tabPrefix, config.position);

        if (!anchorEl || !anchorEl.parentNode) return;

        const oldPanel = document.querySelector(`.folder-switcher-container-${tabPrefix}`);
        if (oldPanel) oldPanel.remove();

        const panelContainer = document.createElement('div');
        panelContainer.className = `folder-radio-group-container folder-switcher-container-${tabPrefix}`;
        
        panelContainer.style.border = 'none';
        panelContainer.style.borderWidth = '0px';

        const activePath = getActiveFolder();

        config.folders.forEach(([label, pathValue]) => {
            const radioLabel = document.createElement('label');
            radioLabel.className = 'folder-radio-label';

            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = `folder_switcher_radio_${tabPrefix}`;
            radioInput.value = pathValue;
            radioInput.className = 'folder-radio-input';
            radioInput.checked = (pathValue === activePath);

            radioInput.onchange = async () => {
                setActiveFolder(pathValue);
                await setOutputDirectoryOnBackend(pathValue);
            };

            const textSpan = document.createElement('span');
            textSpan.className = 'folder-radio-text';
            textSpan.innerText = label;

            radioLabel.appendChild(radioInput);
            radioLabel.appendChild(textSpan);
            panelContainer.appendChild(radioLabel);
        });

        const settingsBtn = document.createElement('button');
        settingsBtn.type = 'button';
        settingsBtn.className = 'folder-settings-icon-btn';
        settingsBtn.title = 'Configure folders';
        settingsBtn.innerText = '⚙️';
        settingsBtn.onclick = (e) => {
            e.preventDefault();
            openFolderEditor();
        };

        panelContainer.appendChild(settingsBtn);

        anchorEl.parentNode.insertBefore(panelContainer, anchorEl);
    };

    const renderFolderSwitchers = () => {
        renderFolderSwitcherForTab('txt2img');
        renderFolderSwitcherForTab('img2img');
    };

    renderFolderSwitchers();

    const currentActiveFolder = getActiveFolder();
    setOutputDirectoryOnBackend(currentActiveFolder);
});