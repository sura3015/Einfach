let fileHandle = null;
let currentFile = null;
const fileModels = {};
const fileHandles = {};
const dirtyFlags = {};
const fileExtensions = {};
const fileViewStates = {};
const markerCounts = {};
let Openedfolders = [];

const langExtMap = {
  javascript: "js",
  python: "py",
  html: "html",
  css: "css",
  java: "java",
  csharp: "cs",
  cpp: "cpp",
  ruby: "rb",
  php: "php",
  go: "go",
  typescript: "ts",
  json: "json",
  markdown: "md",
  sql: "sql",
  yaml: "yaml",
  xml: "xml",
  kotlin: "kt",
  swift: "swift",
  rust: "rs",
  dart: "dart",
  r: "r",
  vb: "vb",
  plaintext: "txt",
};

function getLanguageFromExtension(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const map = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    pyw: "python",
    html: "html",
    htm: "html",
    css: "css",
    java: "java",
    cs: "csharp",
    cpp: "cpp",
    c: "cpp",
    rb: "ruby",
    php: "php",
    go: "go",
    json: "json",
    md: "markdown",
    sql: "sql",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    xaml: "xml",
    kt: "kotlin",
    swift: "swift",
    rs: "rust",
    sh: "shell",
    bat: "bat",
    ps1: "powershell",
    pug: "jade",
    lua: "lua",
    dart: "dart",
    r: "r",
    vb: "vb",
    m: "objective-c",
    txt: "plaintext",
  };
  return map[ext] || "plaintext";
}

let currentTheme = localStorage.getItem("editorTheme") || "vs-dark";
function setEditorTheme(theme) {
  monaco.editor.setTheme(theme);
  localStorage.setItem("editorTheme", theme);
  currentTheme = theme;
}
setEditorTheme(currentTheme);
modeToggleBtn.addEventListener("click", () => {
  const newTheme = currentTheme === "vs-dark" ? "vs-light" : "vs-dark";
  setEditorTheme(newTheme);
});

const tabBar = document.getElementById("tabBar");
tabBar.style.display = "flex";
tabBar.style.backgroundColor = "#333";
tabBar.style.padding = "4px";
tabBar.style.overflowX = "auto";
tabBar.style.whiteSpace = "nowrap";
tabBar.style.position = "relative";
document.body.insertBefore(tabBar, document.getElementById("editor"));

tabBar.addEventListener("wheel", (e) => {
  if (e.deltaY !== 0) {
    tabBar.scrollLeft += e.deltaY;
    e.preventDefault();
  }
});

const contextMenu = document.getElementById("tabContextMenu");
document.addEventListener("click", (e) => {
  if (contextMenu && !contextMenu.contains(e.target)) {
    contextMenu.style.display = "none";
  }
});

tabBar.addEventListener("wheel", (e) => {
  if (e.deltaY !== 0) {
    tabBar.scrollLeft += e.deltaY;
    e.preventDefault();
  }
});

monaco.editor.onDidChangeMarkers(() => {
  for (const filename in fileModels) {
    const model = fileModels[filename];
    if (!model) continue;

    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    const errors = markers.filter(
      (m) => m.severity === monaco.MarkerSeverity.Error
    ).length;
    const warnings = markers.filter(
      (m) => m.severity === monaco.MarkerSeverity.Warning
    ).length;

    markerCounts[filename] = { errors, warnings };
  }
  updateTabs();
});

function addTab(filename) {
  const tab = document.createElement("div");
  tab.className = "tab";
  tab.style.padding = "4px 4px 4px 8px";
  tab.style.backgroundColor = currentFile === filename ? "#555" : "#333";
  tab.style.cursor = "pointer";
  tab.style.display = "flex";
  tab.style.alignItems = "center";
  tab.setAttribute("data-filename", filename);

  tab.setAttribute("draggable", "true");

  const title = document.createElement("span");
  let displayName = filename;

  if (dirtyFlags[filename]) {
    displayName += `<span class="dirty-indicator">*</span>`;
  }

  const counts = markerCounts[filename];
  if (counts && (counts.errors > 0 || counts.warnings > 0)) {
    displayName += "";

    if (counts.errors > 0) {
      displayName += `<span style="color:#ff4d4f; font-size:14px"> ${counts.errors}</span>`;
    }
    if (counts.warnings > 0) {
      displayName += ` <span style="color:#fadb14;">${counts.warnings}</span>`;
    }
  }

  title.innerHTML = displayName;
  tab.appendChild(title);

  const closeBtn = document.createElement("span");
  closeBtn.textContent = "×";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "16px";
  closeBtn.style.padding = "3px";
  closeBtn.style.lineHeight = "1";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeFile(filename);
  });
  tab.appendChild(closeBtn);

  tab.addEventListener("click", () => switchToFile(filename));

  tab.addEventListener("contextmenu", (e) => {
    e.preventDefault();

    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.style.display = "block";

    contextMenu.dataset.targetFile = filename;
  });

  tab.addEventListener("mouseup", (e) => {
    if (e.button === 1) {
      e.preventDefault();
      closeFile(filename);
    }
  });

  tab.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", filename);
    e.currentTarget.classList.add("dragging");
  });

  tab.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer != e.currentTarget) {
      e.currentTarget.style.border = "2px solid #007bff";
      e.currentTarget.style.padding = "2px 2px 2px 6px";
    }
  });

  tab.addEventListener("dragleave", (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.style.border = "";
      e.currentTarget.style.padding = "4px 4px 4px 8px";
    }
  });

  tab.addEventListener("dragend", (e) => {
    e.currentTarget.classList.remove("dragging");
    e.currentTarget.style.border = "";
    e.currentTarget.style.padding = "4px 4px 4px 8px";
  });

  tab.addEventListener("drop", (e) => {
    e.preventDefault();
    e.currentTarget.style.border = "";
    e.currentTarget.style.padding = "4px 4px 4px 8px";

    const draggedFilename = e.dataTransfer.getData("text/plain");
    const targetFilename = e.currentTarget.dataset.filename;
    const dropPosition = e.currentTarget.dataset.dropPosition || "left";

    if (draggedFilename === targetFilename) return;

    const currentTabOrder = Object.keys(fileModels);
    const draggedIndex = currentTabOrder.indexOf(draggedFilename);
    const targetIndex = currentTabOrder.indexOf(targetFilename);

    if (draggedIndex > -1 && targetIndex > -1) {
      const newTabOrder = [...currentTabOrder];
      const [removed] = newTabOrder.splice(draggedIndex, 1);

      let insertIndex = targetIndex;
      insertIndex = targetIndex;
      newTabOrder.splice(insertIndex, 0, removed);

      reorderTabData(newTabOrder);
    }
  });
  tabBar.appendChild(tab);
}

function reorderTabData(newTabOrder) {
  const tempFileModels = {};
  const tempFileHandles = {};
  const tempDirtyFlags = {};
  const tempFileExtensions = {};
  const tempFileViewStates = {};

  newTabOrder.forEach((name) => {
    if (fileModels[name]) {
      tempFileModels[name] = fileModels[name];
      tempFileHandles[name] = fileHandles[name];
      tempDirtyFlags[name] = dirtyFlags[name];
      tempFileExtensions[name] = fileExtensions[name];
      tempFileViewStates[name] = fileViewStates[name];
    }
  });

  Object.keys(fileModels).forEach((key) => delete fileModels[key]);
  Object.assign(fileModels, tempFileModels);

  Object.keys(fileHandles).forEach((key) => delete fileHandles[key]);
  Object.assign(fileHandles, tempFileHandles);

  Object.keys(dirtyFlags).forEach((key) => delete dirtyFlags[key]);
  Object.assign(dirtyFlags, tempDirtyFlags);

  Object.keys(fileExtensions).forEach((key) => delete fileExtensions[key]);
  Object.assign(fileExtensions, tempFileExtensions);

  Object.keys(fileViewStates).forEach((key) => delete fileViewStates[key]);
  Object.assign(fileViewStates, tempFileViewStates);

  updateTabs();
  saveEditorState();
}

function updateTabs() {
  const tabs = tabBar.querySelectorAll(".tab");
  tabs.forEach((tab) => tab.remove());
  Object.keys(fileModels).forEach(addTab);
}

function switchToFile(filename, skipViewRestore = false) {
  if (currentFile && fileModels[currentFile] && window.editor) {
    fileViewStates[currentFile] = window.editor.saveViewState();
  }

  const model = fileModels[filename];
  if (model) {
    window.editor.setModel(model);

    if (!skipViewRestore && fileViewStates[filename]) {
      window.editor.restoreViewState(fileViewStates[filename]);
    } else {
      window.editor.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
      window.editor.setPosition({ lineNumber: 1, column: 1 });
    }
    window.editor.focus();

    const langSelect = document.getElementById("langSelect");
    langSelect.value = model.getLanguageId();
    currentFile = filename;
    updateTabs();
    saveEditorState();
  }
}

const fileHandleUriMap = new Map();
let nextUriId = 0;

function createModel(
  content,
  filename,
  lang,
  fileHandle = null,
  initialViewState = undefined
) {
  let modelUri;
  if (fileHandle) {
    let handleId = fileHandleUriMap.get(fileHandle);
    if (!handleId) {
      handleId = `handle_${nextUriId++}`;
      fileHandleUriMap.set(fileHandle, handleId);
    }
    modelUri = monaco.Uri.parse(`file:///${handleId}/${filename}`);
  } else {
    const uniqueId = `untitled_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    modelUri = monaco.Uri.parse(`inmemory:///${uniqueId}/${filename}`);
  }

  const existingModel = monaco.editor.getModel(modelUri);
  if (existingModel) {
    existingModel.dispose();
  }

  const model = monaco.editor.createModel(content, lang, modelUri);

  fileModels[filename] = model;
  fileHandles[filename] = fileHandle;
  dirtyFlags[filename] = false;

  fileViewStates[filename] = initialViewState;

  const ext = filename.split(".").pop().toLowerCase();
  fileExtensions[filename] = ext;

  model.onDidChangeContent(() => {
    dirtyFlags[filename] = true;
    updateTabs();
    saveEditorState();
  });
  return model;
}

function saveEditorState() {
  if (currentFile && fileModels[currentFile]) {
    fileViewStates[currentFile] = window.editor.saveViewState();
  }

  const state = {
    files: Object.keys(fileModels).map((name) => ({
      name,
      content: fileModels[name].getValue(),
      language: fileModels[name].getLanguageId(),
      dirty: dirtyFlags[name],
    })),
    currentFile,
    viewStates: fileViewStates,
  };
  localStorage.setItem("editorState", JSON.stringify(state));
}

let OpenedfolderMessage = false;
async function loadEditorState() {
  const newWidth = localStorage.getItem("newWidth");
  explorerContainer.style.width = `${newWidth}px`;
  editor.style.left = `${newWidth}px`;
  editor.style.width = `calc(100vw - ${newWidth}px)`;
  const stateStr = localStorage.getItem("editorState");
  if (!stateStr) return;
  const state = JSON.parse(stateStr);

  state.files.forEach((file) => {
    const initialViewState = state.viewStates
      ? state.viewStates[file.name]
      : undefined;
    const model = createModel(
      file.content,
      file.name,
      file.language,
      null,
      initialViewState
    );
    dirtyFlags[file.name] = file.dirty;
  });
  if (state.currentFile && fileModels[state.currentFile]) {
    switchToFile(state.currentFile, false);
  } else if (Object.keys(fileModels).length > 0) {
    switchToFile(Object.keys(fileModels)[0]);
  }

  updateTabs();

  if (window.editor) {
    window.editor.layout();
  }

  Openedfolders = JSON.parse(localStorage.getItem("openedFolders")) || [];
  if (Openedfolders.length > 0) {
    showMessage(
      `前回開いたフォルダは"${Openedfolders.join(",")}"です`,
      6000,
      "info"
    );
    OpenedfolderMessage = true;
  }
}
newFileBtn.addEventListener("click", () => {
  const suggestedName = `untitled.js`;
  const filename = prompt("新規ファイル名を入力", suggestedName);
  if (filename) {
    const uniqueFilename = getUniqueFilename(filename);
    const lang = getLanguageFromExtension(uniqueFilename);
    createModel("", uniqueFilename, lang, null);
    currentFile = uniqueFilename;
    switchToFile(uniqueFilename);
    updateTabs();
    saveEditorState();
  }
});

function getUniqueFilename(filename) {
  let uniqueName = filename;
  let counter = 1;
  while (fileModels[uniqueName]) {
    counter++;
    const base = filename.replace(/\.[^/.]+$/, "");
    const ext = filename.split(".").pop();
    uniqueName = `${base}${counter}.${ext}`;
  }
  return uniqueName;
}

openBtn.addEventListener("click", async () => {
  [fileHandle] = await window.showOpenFilePicker();
  const file = await fileHandle.getFile();
  const contents = await file.text();
  const originalName = file.name;
  const uniqueName = getUniqueFilename(originalName);
  const lang = getLanguageFromExtension(originalName);
  const model = createModel(contents, uniqueName, lang, fileHandle);
  fileHandles[uniqueName] = fileHandle;
  currentFile = uniqueName;
  switchToFile(uniqueName, true);
  updateTabs();
  saveEditorState();
});

const openFolderBtn = document.getElementById("openFolderBtn");
openFolderBtn.addEventListener("click", async () => {
  try {
    const dirHandle = await window.showDirectoryPicker();
    await showFileExplorer(dirHandle);
    saveEditorState();
    dirHistory = [dirHandle];
    backBtn.style.color = "rgb(121, 121, 121)";
    if (OpenedfolderMessage) {
      Openedfolders = [];
      OpenedfolderMessage = false;
    }
    if (!Openedfolders.includes(dirHandle.name)) {
      Openedfolders.push(dirHandle.name);
      localStorage.setItem("openedFolders", JSON.stringify(Openedfolders));
    }
    showMessage("フォルダ内のファイルを開きました", 3000, "success");
  } catch (e) {
    null;
  }
});

saveBtn.addEventListener("click", async () => {
  if (!currentFile)
    return showMessage(
      `保存するファイルがありません。新規作成または開いてください。`,
      3000,
      "info"
    );
  const model = fileModels[currentFile];
  let handle = fileHandles[currentFile];

  try {
    if (!handle) {
      showMessage(
        `"${currentFile}" は自動復元、新規作成されたファイルです。保存先を指定して上書きや保存をしてください。`,
        6500,
        "info"
      );

      const ext =
        fileExtensions[currentFile] ||
        langExtMap[model.getLanguageId()] ||
        "txt";
      const suggestedName = currentFile.endsWith(`.${ext}`)
        ? currentFile
        : `${currentFile}.${ext}`;

      handle = await window.showSaveFilePicker({
        suggestedName: suggestedName,
        types: [
          {
            description: `${model.getLanguageId()} ファイル`,
            accept: { [`text/${ext}`]: [`.${ext}`] },
          },
        ],
      });
      fileHandles[currentFile] = handle;
    }

    const writable = await handle.createWritable();
    await writable.write(model.getValue());
    await writable.close();
    dirtyFlags[currentFile] = false;
    updateTabs();
    saveEditorState();
    showMessage(`"${currentFile}" を保存しました`, 3000, "success");
  } catch (e) {
    null;
  }
});

function closeFile(filename) {
  const model = fileModels[filename];
  if (model) model.dispose();
  delete fileModels[filename];
  delete fileHandles[filename];
  delete dirtyFlags[filename];
  delete fileExtensions[filename];
  delete fileViewStates[filename];
  if (currentFile === filename) {
    currentFile = Object.keys(fileModels)[0] || null;
    if (currentFile) switchToFile(currentFile);
    else window.editor.setValue("");
  }
  updateTabs();
  saveEditorState();
}

function showMessage(msg, duration = 2000, type = "info") {
  const icons = {
    info: "info",
    success: "check_circle",
  };
  const bgColors = {
    info: "#1a2b3c",
    success: "#27ae60",
  };
  const iconName = icons[type] || "info";
  const bgColor = bgColors[type] || "#2c3e50";

  let message = document.getElementById("saveMessage");
  if (!message) {
    message = document.createElement("div");
    message.id = "saveMessage";
    message.style.position = "fixed";
    message.style.bottom = "-100px";
    message.style.left = "20px";
    message.style.backgroundColor = bgColor;
    message.style.color = "#fff";
    message.style.padding = "12px 16px";
    message.style.borderRadius = "8px";
    message.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";
    message.style.fontSize = "14px";
    message.style.display = "flex";
    message.style.alignItems = "center";
    message.style.gap = "8px";
    message.style.transition = "bottom 0.5s ease";
    message.style.zIndex = "9999";
    document.body.appendChild(message);
  }

  message.innerHTML = `
    <span class="material-symbols-outlined" style="font-size: 20px;">${iconName}</span>
    <span>${msg}</span>
  `;

  setTimeout(() => {
    message.style.bottom = "20px";
  }, 10);
  setTimeout(() => {
    message.style.bottom = "-100px";
    setTimeout(() => message.remove(), 10000);
  }, duration);
}

langSelect.addEventListener("change", (e) => {
  const lang = e.target.value;
  if (currentFile) {
    const model = fileModels[currentFile];
    monaco.editor.setModelLanguage(model, lang);
    console.log(`言語を${lang}に変更`);
    saveEditorState();
  }
});

let dirHistory = [];

const backBtn = document.getElementById("backExplorerBtn");
backBtn.onclick = async () => {
  if (dirHistory.length > 1) {
    dirHistory.pop();
    const prevDir = dirHistory[dirHistory.length - 1];
    await showFileExplorer(prevDir);
  }
};

function hideBackExplorerBtn() {
  document.getElementById("backExplorerBtn").style.display = "none";
}
function showBackExplorerBtn() {
  document.getElementById("backExplorerBtn").style.display = "flex";
}

async function showFileExplorer(dirHandle) {
  const explorer = document.getElementById("fileExplorer");
  explorer.innerHTML = "";

  const folderNameDiv = document.createElement("div");
  folderNameDiv.id = "currentFolderName";
  folderNameDiv.className = "explorer-item";
  folderNameDiv.textContent = "Opened : " + dirHandle.name || "フォルダ";
  folderNameDiv.style.fontWeight = "bold";
  folderNameDiv.style.cursor = "default";
  folderNameDiv.style.padding = "8px";
  folderNameDiv.style.borderLeft = "2.5px solid #365668";
  explorer.appendChild(folderNameDiv);
  if (!dirHistory.length || dirHistory[dirHistory.length - 1] !== dirHandle) {
    dirHistory.push(dirHandle);
  }

  backBtn.disabled = dirHistory.length <= 1;
  backBtn.style.color =
    dirHistory.length <= 1 ? "rgb(121, 121, 121)" : "#ffffff";

  for await (const [name, handle] of dirHandle.entries()) {
    const item = document.createElement("div");
    item.textContent = name;
    item.id = "explorer-item";
    item.className = "explorer-item";
    item.addEventListener("click", () => {
      document
        .querySelectorAll(".explorer-item")
        .forEach((i) => i.classList.remove("selected"));

      item.classList.add("selected");
    });
    if (handle.kind === "file") {
      item.onclick = async () => {
        const file = await handle.getFile();
        const contents = await file.text();
        const uniqueName = getUniqueFilename(file.name);
        const lang = getLanguageFromExtension(file.name);

        const model = createModel(contents, uniqueName, lang, handle);
        fileHandles[uniqueName] = handle;
        currentFile = uniqueName;
        switchToFile(uniqueName, true);
        updateTabs();
        saveEditorState();
      };
    } else if (handle.kind === "directory") {
      item.style.fontWeight = "bold";
      item.onclick = async () => {
        await showFileExplorer(handle);
      };
    }
    explorer.appendChild(item);
  }
}

const explorerContainer = document.getElementById("fileExplorerContainer");
const fileExplorer = document.getElementById("fileExplorer");
const toggleBtn = document.getElementById("toggleExplorerBtn");
const editor = document.getElementById("editor");

const resizer = document.getElementById("resizer");
let isResizing = false;
let lastExplorerWidth = 230;

resizer.addEventListener("mousedown", (e) => {
  isResizing = true;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  explorerContainer.style.transition = "none";
  e.preventDefault();
  const mouseMoveHandler = (e) => {
    if (!isResizing) return;
    let newWidth = e.clientX;

    if (newWidth < 120) newWidth = 120;
    if (newWidth > 600) newWidth = 600;

    explorerContainer.style.width = `${newWidth}px`;
    editor.style.left = `${newWidth}px`;
    editor.style.width = `calc(100vw - ${newWidth}px)`;
    localStorage.setItem("newWidth", JSON.stringify(newWidth));
  };

  const mouseUpHandler = () => {
    isResizing = false;
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";

    document.removeEventListener("mousemove", mouseMoveHandler);
    document.removeEventListener("mouseup", mouseUpHandler);

    window.editor.layout();
  };

  document.addEventListener("mousemove", mouseMoveHandler);
  document.addEventListener("mouseup", mouseUpHandler);
});

toggleBtn.addEventListener("click", () => {
  const currentWidth = explorerContainer.offsetWidth;
  explorerContainer.classList.toggle("closed");
  if (currentWidth > 0) {
    lastExplorerWidth = currentWidth;
    explorerContainer.style.width = "0px";
    editor.style.left = "0px";
    editor.style.width = "100vw";
    hideBackExplorerBtn();
  } else {
    const restoreWidth = lastExplorerWidth > 0 ? lastExplorerWidth : 220;
    explorerContainer.style.width = `${restoreWidth}px`;
    editor.style.left = `${restoreWidth}px`;
    editor.style.width = `calc(100vw - ${restoreWidth}px)`;
    showBackExplorerBtn();
  }

  setTimeout(() => {
    window.editor.layout();
  }, 310);
});

function folderclose() {
  const explorer = document.getElementById("fileExplorer");
  explorer.innerHTML = "";

  dirHistory = [];
  backBtn.disabled = true;
  backBtn.style.color = "rgb(121, 121, 121)";
}

contextMenu.addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  const targetFile = contextMenu.dataset.targetFile;

  contextMenu.style.display = "none";

  if (!targetFile && action !== "closeAll") return;

  if (action === "close") {
    closeFile(targetFile);
  } else if (action === "rename") {
    const newFilename = prompt("新しいファイル名を入力", targetFile);
    if (newFilename && newFilename !== targetFile) {
      const oldModel = fileModels[targetFile];
      const newLang = getLanguageFromExtension(newFilename);
      const oldContent = oldModel.getValue();

      const newModel = monaco.editor.createModel(oldContent, newLang);
      newModel.onDidChangeContent(() => {
        dirtyFlags[newFilename] = true;
        updateTabs();
        saveEditorState();
      });
      fileModels[newFilename] = newModel;
      fileHandles[newFilename] = fileHandles[targetFile];
      dirtyFlags[newFilename] = dirtyFlags[targetFile];
      fileExtensions[newFilename] = newFilename.split(".").pop().toLowerCase();
      fileViewStates[newFilename] = fileViewStates[targetFile];

      oldModel.dispose();
      delete fileModels[targetFile];
      delete fileHandles[targetFile];
      delete dirtyFlags[targetFile];
      delete fileExtensions[targetFile];
      delete fileViewStates[targetFile];

      if (currentFile === targetFile) {
        currentFile = newFilename;
        switchToFile(newFilename);
      }
      updateTabs();
      saveEditorState();
    }
  } else if (action === "closeAll") {
    Object.keys(fileModels).forEach((filename) => {
      closeFile(filename);
    });
    window.editor.setValue("");
    currentFile = null;
    updateTabs();
    saveEditorState();
  } else if (action === "closeOthers") {
    const filesToClose = Object.keys(fileModels).filter(
      (filename) => filename !== targetFile
    );
    filesToClose.forEach((filename) => {
      closeFile(filename);
    });
    if (currentFile !== targetFile && fileModels[targetFile]) {
      switchToFile(targetFile);
    } else if (!fileModels[targetFile]) {
      currentFile = Object.keys(fileModels)[0] || null;
      if (currentFile) switchToFile(currentFile);
      else window.editor.setValue("");
    }
    updateTabs();
    saveEditorState();
  }
});

function handleKeyEvent(event) {
  const isCtrlOrCmd = event.ctrlKey || event.metaKey;
  const isSKey = event.key === "s" || event.keyCode === 83;
  if (isCtrlOrCmd && (event.key === "o" || event.keyCode === 79)) {
    event.preventDefault();
    openBtn.click();
  }
  if (
    (isCtrlOrCmd && event.key === "n") ||
    (isCtrlOrCmd && event.key === "u")
  ) {
    event.preventDefault();
    newFileBtn.click();
  }
  if (isCtrlOrCmd && isSKey) {
    event.preventDefault();
    saveBtn.click();
  }
  if (isCtrlOrCmd && event.key === "k") {
    event.preventDefault();
    openFolderBtn.click();
  }
  if (isCtrlOrCmd && event.key === "e") {
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    toggleBtn.click();
  }
  if (isCtrlOrCmd && event.key === "f") {
    event.preventDefault();
    openFolderBtn.click();
  }
}

document.addEventListener("keydown", handleKeyEvent);

loadEditorState();
if (Object.keys(fileModels).length === 0) {
  const sampleCode = `console.log("Hello, Einfach Code Editor!");`;
  const filename = "sample.js";
  const lang = getLanguageFromExtension(filename);
  createModel(sampleCode, filename, lang);
  currentFile = filename;
  switchToFile(filename);
  updateTabs();
  saveEditorState();
}
