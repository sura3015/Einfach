let fileHandle = null;
let currentFile = null;
const fileModels = {};
const fileHandles = {};
const dirtyFlags = {};
const fileExtensions = {};

// 言語拡張子マップ
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

// 言語判定
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

// Monacoテーマ
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

// タブバー
const tabBar = document.createElement("div");
tabBar.id = "tabBar";
tabBar.style.display = "flex";
tabBar.style.backgroundColor = "#333";
tabBar.style.padding = "4px";
tabBar.style.overflowX = "auto";
tabBar.style.whiteSpace = "nowrap";
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

// タブ追加・更新
function addTab(filename) {
  const tab = document.createElement("div");
  tab.className = "tab";
  tab.style.padding = "4px 8px";
  tab.style.marginRight = "4px";
  tab.style.backgroundColor = currentFile === filename ? "#555" : "#333";
  tab.style.cursor = "pointer";
  tab.style.display = "flex";
  tab.style.alignItems = "center";
  tab.setAttribute("data-filename", filename);

  const title = document.createElement("span");
  title.textContent = dirtyFlags[filename] ? `${filename} *` : filename;
  tab.appendChild(title);

  const closeBtn = document.createElement("span");
  closeBtn.textContent = " ×";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.marginLeft = "4px";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeFile(filename);
  });
  tab.appendChild(closeBtn);

  tab.addEventListener("click", () => switchToFile(filename));

  // 右クリックイベントリスナー
  tab.addEventListener("contextmenu", (e) => {
    e.preventDefault();

    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.style.display = "block";

    contextMenu.dataset.targetFile = filename;
  });

  // ★中クリックイベントリスナーを追加
  tab.addEventListener("mouseup", (e) => {
    if (e.button === 1) {
      // マウスの中ボタン（ホイールボタン）
      e.preventDefault(); // デフォルトの動作（スクロールなど）を抑制
      closeFile(filename);
    }
  });

  tabBar.appendChild(tab);
}

function updateTabs() {
  tabBar.innerHTML = "";
  Object.keys(fileModels).forEach(addTab);
}

// モデル切り替え
function switchToFile(filename) {
  const model = fileModels[filename];
  if (model) {
    window.editor.setModel(model);
    const langSelect = document.getElementById("langSelect");
    langSelect.value = model.getLanguageId();
    currentFile = filename;
    updateTabs();
  }
}

// モデル作成共通
function createModel(content, filename, lang) {
  const model = monaco.editor.createModel(content, lang);
  fileModels[filename] = model;
  fileHandles[filename] = null;
  dirtyFlags[filename] = false;

  // 🔥拡張子を記録
  const ext = filename.split(".").pop().toLowerCase();
  fileExtensions[filename] = ext;

  model.onDidChangeContent(() => {
    dirtyFlags[filename] = true;
    updateTabs();
    saveEditorState();
  });
  return model;
}

// 保存状態をローカルストレージに

function saveEditorState() {
  const state = {
    files: Object.keys(fileModels).map((name) => ({
      name,
      content: fileModels[name].getValue(),
      language: fileModels[name].getLanguageId(),
      dirty: dirtyFlags[name],
    })),
    currentFile,
  };
  localStorage.setItem("editorState", JSON.stringify(state));
}

let OpenedfolderMessage = false;
// 復元
async function loadEditorState() {
  const stateStr = localStorage.getItem("editorState");
  if (!stateStr) return;
  const state = JSON.parse(stateStr);
  state.files.forEach((file) => {
    const model = createModel(file.content, file.name, file.language);
    dirtyFlags[file.name] = file.dirty;
  });
  if (state.currentFile && fileModels[state.currentFile]) {
    switchToFile(state.currentFile);
  }
  updateTabs();

  Openedfolders = JSON.parse(localStorage.getItem("openedFolders")) || [];
  // フォルダ履歴復元（ユーザーに再選択してもらう）
  if (Openedfolders.length > 0) {
    showMessage(
      `前回開いたフォルダは"${Openedfolders.join(",")}"です`,
      6000,
      "info"
    );
    OpenedfolderMessage = true;
    try {
      const dirHandle = await window.showDirectoryPicker();

      await showFileExplorer(dirHandle);
    } catch (e) {
      // キャンセル時は何もしない
    }
  }
}

// 新規ファイル
newFileBtn.addEventListener("click", () => {
  const suggestedName = `untitled.js`;
  const filename = prompt("新規ファイル名を入力", suggestedName);
  if (filename) {
    const uniqueFilename = getUniqueFilename(filename);
    const lang = getLanguageFromExtension(uniqueFilename);
    createModel("", uniqueFilename, lang);
    currentFile = uniqueFilename;
    switchToFile(uniqueFilename);
    updateTabs();
    saveEditorState();
  }
});

// 開く
function getUniqueFilename(filename) {
  let uniqueName = filename;
  let counter = 1;
  while (fileModels[uniqueName]) {
    counter++;
    const base = filename.replace(/\.[^/.]+$/, "");
    const ext = filename.split(".").pop();
    uniqueName = `${base} (${counter}).${ext}`;
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
  const model = createModel(contents, uniqueName, lang);
  fileHandles[uniqueName] = fileHandle;
  currentFile = uniqueName;
  switchToFile(uniqueName);
  updateTabs();
  saveEditorState();
});
let Openedfolders = [];
// フォルダ選択ボタンを追加
const openFolderBtn = document.getElementById("openFolderBtn");
// フォルダからファイルをまとめて開く
openFolderBtn.addEventListener("click", async () => {
  try {
    const dirHandle = await window.showDirectoryPicker();
    await showFileExplorer(dirHandle);
    saveEditorState();
    dirHistory = [dirHandle]; // 履歴を更新
    backBtn.style.opacity = "0.5";
    //開いたフォルダを記録
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
    showMessage("フォルダの読み込みに失敗しました", 3000, "info");
  }
});

// 保存
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
      // 🌟 上書き保存メッセージを表示
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

// タブ閉じる
function closeFile(filename) {
  const model = fileModels[filename];
  if (model) model.dispose();
  delete fileModels[filename];
  delete fileHandles[filename];
  delete dirtyFlags[filename];
  if (currentFile === filename) {
    currentFile = Object.keys(fileModels)[0] || null;
    if (currentFile) switchToFile(currentFile);
    else window.editor.setValue("");
  }
  updateTabs();
  saveEditorState();
}

// メッセージ表示
function showMessage(msg, duration = 2000, type = "info") {
  // Material Iconsの名前設定
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
    message.style.bottom = "-100px"; // 初期位置
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

  // スライドイン
  setTimeout(() => {
    message.style.bottom = "20px";
  }, 10);
  // スライドアウト
  setTimeout(() => {
    message.style.bottom = "-100px";
    setTimeout(() => message.remove(), 10000);
  }, duration);
}

// 言語変更
langSelect.addEventListener("change", (e) => {
  const lang = e.target.value;
  if (currentFile) {
    const model = fileModels[currentFile];
    monaco.editor.setModelLanguage(model, lang);
    console.log(`言語を${lang}に変更`);
    saveEditorState();
  }
});

// ...existing code...

let dirHistory = []; // ディレクトリ履歴

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
// showFileExplorer関数内
async function showFileExplorer(dirHandle) {
  const explorer = document.getElementById("fileExplorer");
  explorer.innerHTML = "";

  const folderNameDiv = document.createElement("div");
  folderNameDiv.id = "currentFolderName";
  folderNameDiv.textContent = ">" + dirHandle.name || "フォルダ";
  folderNameDiv.style.padding = "6px 10px";
  folderNameDiv.style.fontWeight = "bold";
  folderNameDiv.style.overflow = "hidden";
  folderNameDiv.style.textOverflow = "ellipsis";
  folderNameDiv.style.background = "#444";
  folderNameDiv.style.borderBottom = "1px solid #444";
  explorer.appendChild(folderNameDiv);
  // 履歴に追加
  if (!dirHistory.length || dirHistory[dirHistory.length - 1] !== dirHandle) {
    dirHistory.push(dirHandle);
  }
  // 戻るボタンの有効/無効切り替え
  backBtn.disabled = dirHistory.length <= 1;
  backBtn.style.opacity = dirHistory.length <= 1 ? "0.5" : "1";

  for await (const [name, handle] of dirHandle.entries()) {
    const item = document.createElement("div");
    item.textContent = name;
    item.style.padding = "6px 12px";
    item.style.cursor = "pointer";
    item.style.overflow = "hidden";
    item.style.textOverflow = "ellipsis";
    item.style.borderBottom = "1px solid #333";
    if (handle.kind === "file") {
      item.onclick = async () => {
        const file = await handle.getFile();
        const contents = await file.text();
        const uniqueName = getUniqueFilename(file.name);
        const lang = getLanguageFromExtension(file.name);
        const model = createModel(contents, uniqueName, lang);
        fileHandles[uniqueName] = handle;
        currentFile = uniqueName;
        switchToFile(uniqueName);
        updateTabs();
        saveEditorState();
      };
    } else if (handle.kind === "directory") {
      item.style.fontWeight = "bold";
      item.onclick = async () => {
        await showFileExplorer(handle); // サブフォルダ表示
      };
    }
    explorer.appendChild(item);
  }
}

const explorerContainer = document.getElementById("fileExplorerContainer");
const toggleBtn = document.getElementById("toggleExplorerBtn");
toggleBtn.addEventListener("click", () => {
  explorerContainer.classList.toggle("closed");
  const editor = document.getElementById("editor");
  if (explorerContainer.classList.contains("closed")) {
    editor.style.left = "0";
    editor.style.width = "100vw";
    hideBackExplorerBtn();
  } else {
    showBackExplorerBtn();
    editor.style.left = "220px";
    editor.style.width = "calc(100vw - 220px)";
  }
  setTimeout(() => {
    window.editor.layout();
  }, 310);
});

contextMenu.addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  const targetFile = contextMenu.dataset.targetFile;

  contextMenu.style.display = "none"; // メニューを非表示にする

  if (!targetFile && action !== "closeAll") return; // closeAllの場合はtargetFileがなくても良い

  if (action === "close") {
    closeFile(targetFile);
  } else if (action === "rename") {
    const newFilename = prompt("新しいファイル名を入力", targetFile);
    if (newFilename && newFilename !== targetFile) {
      const oldModel = fileModels[targetFile];
      const newLang = getLanguageFromExtension(newFilename);
      const oldContent = oldModel.getValue();

      const newModel = monaco.editor.createModel(oldContent, newLang);
      fileModels[newFilename] = newModel;
      fileHandles[newFilename] = fileHandles[targetFile];
      dirtyFlags[newFilename] = dirtyFlags[targetFile];
      fileExtensions[newFilename] = newFilename.split(".").pop().toLowerCase();

      oldModel.dispose();
      delete fileModels[targetFile];
      delete fileHandles[targetFile];
      delete dirtyFlags[targetFile];
      delete fileExtensions[targetFile];

      if (currentFile === targetFile) {
        currentFile = newFilename;
        switchToFile(newFilename);
      }
      updateTabs();
      saveEditorState();
    }
  } else if (action === "closeAll") {
    // すべてのファイルを閉じる
    Object.keys(fileModels).forEach((filename) => {
      closeFile(filename);
    });
    // すべて閉じたらエディタをクリア
    window.editor.setValue("");
    currentFile = null;
    updateTabs();
    saveEditorState();
  } else if (action === "closeOthers") {
    // このファイル以外を閉じる
    const filesToClose = Object.keys(fileModels).filter(
      (filename) => filename !== targetFile
    );
    filesToClose.forEach((filename) => {
      closeFile(filename);
    });
    // 対象ファイルが残っていればそれに切り替える（既に切り替わっているはずだが念のため）
    if (currentFile !== targetFile && fileModels[targetFile]) {
      switchToFile(targetFile);
    } else if (!fileModels[targetFile]) {
      // もし対象ファイルがなぜか存在しない場合
      currentFile = Object.keys(fileModels)[0] || null;
      if (currentFile) switchToFile(currentFile);
      else window.editor.setValue("");
    }
    updateTabs();
    saveEditorState();
  }
});

// キーボードショートカットで保存
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
  if (isCtrlOrCmd && event.key === "f") {
    event.preventDefault();
    openFolderBtn.click();
  }
}

document.addEventListener("keydown", handleKeyEvent);
document.addEventListener("keyup", handleKeyEvent);

// 🎉 初期復元
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
