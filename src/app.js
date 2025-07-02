let fileHandle = null;
const fileModels = {};
const fileHandles = {};
const dirtyFlags = {};
const fileExtensions = {};
let currentFile = null;

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
tabBar.style.display = "flex";
tabBar.style.backgroundColor = "#333";
tabBar.style.padding = "4px";
document.body.insertBefore(tabBar, document.getElementById("editor"));

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

// 復元
function loadEditorState() {
  const stateStr = localStorage.getItem("editorState");
  if (!stateStr) return;
  const state = JSON.parse(stateStr);
  state.files.forEach((file) => {
    const model = createModel(file.content, file.name, file.language);
    dirtyFlags[file.name] = file.dirty; // 復元時も未保存マーク
  });
  if (state.currentFile && fileModels[state.currentFile]) {
    switchToFile(state.currentFile);
  }
  updateTabs();
}

// 新規ファイル
newFileBtn.addEventListener("click", () => {
  const filename = prompt(
    "新規ファイル名を入力",
    `untitled${Object.keys(fileModels).length + 1}.js`
  );
  if (filename) {
    const lang = getLanguageFromExtension(filename);
    createModel("", filename, lang);
    currentFile = filename;
    switchToFile(filename);
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

// キーボードショートカットで保存
document.addEventListener("keydown", function (event) {
  const isCtrlOrCmd = event.ctrlKey || event.metaKey;
  const isSKey = event.key === "s" || event.keyCode === 83;
  if (isCtrlOrCmd && (event.key === "o" || event.keyCode === 79)) {
    event.preventDefault(); // ブラウザのデフォルトの「開く」処理を防止
    openBtn.click();
  }
  if (isCtrlOrCmd && (event.key === "c" || event.keyCode === 78)) {
    console.log("新規ファイルのショートカットが押されました");
    event.preventDefault(); // ブラウザのデフォルトの「新しいタブ」処理を防止
    newFileBtn.click();
  }
  if (isCtrlOrCmd && isSKey) {
    event.preventDefault(); // ブラウザのデフォルトの保存処理を防止
    saveBtn.click(); // 保存ボタンのクリックイベントをプログラムから発生させる
  }
});

// 🎉 初期復元
loadEditorState();
