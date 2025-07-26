let fileHandle = null;
let currentFile = null;
const fileModels = {};
const fileHandles = {};
const dirtyFlags = {};
const fileExtensions = {};
const fileViewStates = {};
let Openedfolders = [];

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
  tab.style.padding = "4px 4px 4px 8px";
  tab.style.marginRight = "4px";
  tab.style.backgroundColor = currentFile === filename ? "#555" : "#333";
  tab.style.cursor = "pointer";
  tab.style.display = "flex";
  tab.style.alignItems = "center";
  tab.setAttribute("data-filename", filename);

  // Make tabs draggable
  tab.setAttribute("draggable", "true");

  const title = document.createElement("span");
  title.textContent = dirtyFlags[filename] ? `${filename} *` : filename;
  tab.appendChild(title);

  const closeBtn = document.createElement("span");
  closeBtn.textContent = "×";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "16px";
  closeBtn.style.padding = "3px";
  closeBtn.style.lineHeight = "1";
  closeBtn.style.marginLeft = "2px";
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

  // 中クリックイベントリスナーを追加
  tab.addEventListener("mouseup", (e) => {
    if (e.button === 1) {
      // マウスの中ボタン（ホイールボタン）
      e.preventDefault();
      closeFile(filename);
    }
  });

  // Drag and Drop Event Listeners
  tab.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", filename);
    e.currentTarget.classList.add("dragging");
  });

  tab.addEventListener("dragover", (e) => {
    e.preventDefault(); // Allow drop
    const draggingTab = document.querySelector(".dragging");
    const boundingBox = e.currentTarget.getBoundingClientRect();
    const offset = e.clientX - boundingBox.left;

    if (draggingTab && draggingTab !== e.currentTarget) {
      if (offset > boundingBox.width / 2) {
        // ドロップ位置がタブの右半分の場合、右側にインジケーターを表示
        e.currentTarget.style.borderRight = "3px solid #007bff";
        e.currentTarget.style.borderLeft = "none";
      } else {
        // ドロップ位置がタブの左半分の場合、左側にインジケーターを表示
        e.currentTarget.style.borderLeft = "3px solid #007bff";
        e.currentTarget.style.borderRight = "none";
      }
    }
  });

  tab.addEventListener("dragleave", (e) => {
    // ドラッグ要素がタブから離れたらインジケーターを消す
    e.currentTarget.style.borderLeft = "none";
    e.currentTarget.style.borderRight = "none";
  });

  tab.addEventListener("drop", (e) => {
    e.preventDefault();
    const draggedFilename = e.dataTransfer.getData("text/plain");
    const targetFilename = e.currentTarget.dataset.filename;

    // インジケーターを消す
    e.currentTarget.style.borderLeft = "none";
    e.currentTarget.style.borderRight = "none";

    if (draggedFilename === targetFilename) {
      return; // 同じタブにドロップした場合は何もしない
    }

    const currentTabOrder = Object.keys(fileModels);
    const draggedIndex = currentTabOrder.indexOf(draggedFilename);
    const targetIndex = currentTabOrder.indexOf(targetFilename);

    if (draggedIndex > -1 && targetIndex > -1) {
      // 1. タブの順序を新しい配列で再構築
      const newTabOrder = [...currentTabOrder];
      const [removed] = newTabOrder.splice(draggedIndex, 1);
      newTabOrder.splice(targetIndex, 0, removed);

      // 2. 関連する全てのファイル情報を新しい順序で再構築するオブジェクトにコピー
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

      // 3. グローバルオブジェクトを完全に新しいデータで置き換える
      // 既存のオブジェクトをクリアしてから新しいデータを割り当てることで、
      // 順序のずれや古いデータの残留を防ぐ
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

      updateTabs(); // タブバーを更新して新しい順序を反映
      saveEditorState(); // エディタの状態を保存
    }
  });

  tab.addEventListener("dragend", (e) => {
    e.currentTarget.classList.remove("dragging");
    // ドラッグ終了時に全てのタブのインジケーターを消す
    document.querySelectorAll(".tab").forEach((t) => {
      t.style.borderLeft = "none";
      t.style.borderRight = "none";
    });
  });

  tabBar.appendChild(tab);
}

function updateTabs() {
  tabBar.innerHTML = "";
  Object.keys(fileModels).forEach(addTab);
}

// モデル切り替え
function switchToFile(filename) {
  // 1. 切り替える前のファイルの状態を保存
  if (currentFile && fileModels[currentFile] && window.editor) {
    fileViewStates[currentFile] = window.editor.saveViewState();
  }

  const model = fileModels[filename];
  if (model) {
    window.editor.setModel(model);

    // 2. 新しいファイルの保存された状態を復元
    if (fileViewStates[filename]) {
      window.editor.restoreViewState(fileViewStates[filename]);
    }
    window.editor.focus(); // エディタにフォーカスを当てる

    const langSelect = document.getElementById("langSelect");
    langSelect.value = model.getLanguageId();
    currentFile = filename;
    updateTabs();
  }
}

// モデル作成共通
const fileHandleUriMap = new Map();
let nextUriId = 0;

function createModel(content, filename, lang, fileHandle = null) {
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

  fileModels[filename] = model; // filenameをキーとしてモデルを保存
  fileHandles[filename] = fileHandle; // fileHandleを関連付ける
  dirtyFlags[filename] = false;

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
  // 現在アクティブなファイルの状態も保存対象に含める
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
    viewStates: fileViewStates, // 表示状態も保存する
  };
  localStorage.setItem("editorState", JSON.stringify(state));
}

let OpenedfolderMessage = false;
// 復元

async function loadEditorState() {
  const newWidth = localStorage.getItem("newWidth");
  explorerContainer.style.width = `${newWidth}px`;
  editor.style.left = `${newWidth}px`;
  editor.style.width = `calc(100vw - ${newWidth}px)`;
  const stateStr = localStorage.getItem("editorState");
  if (!stateStr) return;
  const state = JSON.parse(stateStr);

  state.files.forEach((file) => {
    const model = createModel(file.content, file.name, file.language);
    dirtyFlags[file.name] = file.dirty;
  });
  if (state.currentFile && fileModels[state.currentFile]) {
    switchToFile(state.currentFile);
  } else if (Object.keys(fileModels).length > 0) {
    // currentFileがない場合は最初のファイルに切り替え
    switchToFile(Object.keys(fileModels)[0]);
  }

  updateTabs();

  // 追加の処理: Monaco Editorのレイアウトを強制的に再計算
  if (window.editor) {
    window.editor.layout();
  }
  // ... (残りのコード)

  Openedfolders = JSON.parse(localStorage.getItem("openedFolders")) || [];
  // フォルダ履歴復元（ユーザーに再選択してもらう）
  if (Openedfolders.length > 0) {
    showMessage(
      `前回開いたフォルダは"${Openedfolders.join(",")}"です`,
      6000,
      "info"
    );
    OpenedfolderMessage = true;
  }
}
// 新規ファイル
newFileBtn.addEventListener("click", () => {
  const suggestedName = `untitled.js`;
  const filename = prompt("新規ファイル名を入力", suggestedName);
  if (filename) {
    const uniqueFilename = getUniqueFilename(filename); // これはタブ表示用
    const lang = getLanguageFromExtension(uniqueFilename);
    // 新規ファイルの場合、fileHandleはnullまたはundefined
    createModel("", uniqueFilename, lang, null); // fileHandleを渡さない
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
    uniqueName = `${base}${counter}.${ext}`;
  }
  return uniqueName;
}

openBtn.addEventListener("click", async () => {
  [fileHandle] = await window.showOpenFilePicker();
  const file = await fileHandle.getFile();
  const contents = await file.text();
  const originalName = file.name;
  const uniqueName = getUniqueFilename(originalName); // この uniqueName はタブ表示用
  const lang = getLanguageFromExtension(originalName);
  // createModel に fileHandle を渡す
  const model = createModel(contents, uniqueName, lang, fileHandle);
  // fileHandles[uniqueName] は createModel 内で設定されるので不要になるが、
  // 既存ロジックとの互換性のため残すか、createModel内で一元管理するか検討
  fileHandles[uniqueName] = fileHandle; // この行は createModel 内で処理するべきか要検討
  currentFile = uniqueName;
  switchToFile(uniqueName);
  updateTabs();
  saveEditorState();
});

// フォルダ選択ボタンを追加
const openFolderBtn = document.getElementById("openFolderBtn");
// フォルダからファイルをまとめて開く
openFolderBtn.addEventListener("click", async () => {
  try {
    const dirHandle = await window.showDirectoryPicker();
    await showFileExplorer(dirHandle);
    saveEditorState();
    dirHistory = [dirHandle]; // 履歴を更新
    backBtn.style.color = "rgb(121, 121, 121)";
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
    null;
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
  folderNameDiv.className = "explorer-item";
  folderNameDiv.textContent = "Opened : " + dirHandle.name || "フォルダ";
  folderNameDiv.style.fontWeight = "bold";
  folderNameDiv.style.cursor = "default";
  folderNameDiv.style.padding = "8px";
  folderNameDiv.style.borderLeft = "2.5px solid #365668";
  explorer.appendChild(folderNameDiv);
  // 履歴に追加
  if (!dirHistory.length || dirHistory[dirHistory.length - 1] !== dirHandle) {
    dirHistory.push(dirHandle);
  }
  // 戻るボタンの有効/無効切り替え
  backBtn.disabled = dirHistory.length <= 1;
  backBtn.style.color =
    dirHistory.length <= 1 ? "rgb(121, 121, 121)" : "#ffffff";

  for await (const [name, handle] of dirHandle.entries()) {
    const item = document.createElement("div");
    item.textContent = name;
    item.id = "explorer-item";
    item.className = "explorer-item";
    item.addEventListener("click", () => {
      // 他の選択を解除
      document
        .querySelectorAll(".explorer-item")
        .forEach((i) => i.classList.remove("selected"));
      // 現在のアイテムを選択
      item.classList.add("selected");
    });
    if (handle.kind === "file") {
      item.onclick = async () => {
        const file = await handle.getFile();
        const contents = await file.text();
        const uniqueName = getUniqueFilename(file.name); // この uniqueName はタブ表示用
        const lang = getLanguageFromExtension(file.name);
        // createModel に handle (fileHandle) を渡す
        const model = createModel(contents, uniqueName, lang, handle);
        fileHandles[uniqueName] = handle; // この行もcreateModel内で処理するべきか検討
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
const fileExplorer = document.getElementById("fileExplorer"); // fileExplorerも取得
const toggleBtn = document.getElementById("toggleExplorerBtn");
const editor = document.getElementById("editor"); // editorも取得

const resizer = document.getElementById("resizer");
let isResizing = false;
let lastExplorerWidth = 230; // 最後に開いていた時の幅を記憶する変数 (初期値: 220px)

resizer.addEventListener("mousedown", (e) => {
  // ... resizerのイベントリスナーは変更なし ...
  isResizing = true;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  explorerContainer.style.transition = "none"; // リサイズ中はアニメーションを無効化
  e.preventDefault(); // デフォルトのドラッグ動作を抑制
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
    // 開いている状態 -> 閉じる
    lastExplorerWidth = currentWidth; // 現在の幅を記憶
    explorerContainer.style.width = "0px";
    editor.style.left = "0px";
    editor.style.width = "100vw";
    hideBackExplorerBtn();
  } else {
    // 閉じている状態 -> 開く
    // 記憶していた幅に戻す（0の場合はデフォルト値220px）
    const restoreWidth = lastExplorerWidth > 0 ? lastExplorerWidth : 220;
    explorerContainer.style.width = `${restoreWidth}px`;
    editor.style.left = `${restoreWidth}px`;
    editor.style.width = `calc(100vw - ${restoreWidth}px)`;
    showBackExplorerBtn();
  }

  // アニメーション完了後にエディタのレイアウトを更新
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
  if (isCtrlOrCmd && event.key === "k") {
    event.preventDefault();
    openFolderBtn.click();
  }
  if (isCtrlOrCmd && event.key === "e") {
    // キーが押しっぱなしの場合は無視
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    toggleBtn.click();
  }
}

document.addEventListener("keydown", handleKeyEvent);
//document.addEventListener("keyup", handleKeyEvent);

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
