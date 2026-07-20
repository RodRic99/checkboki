import { app, BrowserWindow, dialog } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

let backendProcess: ChildProcessWithoutNullStreams | undefined;

/**
 * 패키징된 실행 파일에 포함된 전용 Java로 Spring Boot 백엔드를 시작한다.
 * 개발 모드에서는 개발자가 실행한 bootRun 서버를 그대로 사용한다.
 */
function startBundledBackend() {
  if (!app.isPackaged) return;

  const java = path.join(process.resourcesPath, 'runtime', 'bin', 'java.exe');
  const jar = path.join(process.resourcesPath, 'backend', 'checkboki-backend-0.1.0.jar');
  const stockfish = path.join(process.resourcesPath, 'engine', 'stockfish.exe');

  backendProcess = spawn(java, ['-jar', jar], {
    windowsHide: true,
    env: { ...process.env, STOCKFISH_PATH: stockfish },
  });

  backendProcess.stderr.on('data', (data) => console.error(`[checkboki-backend] ${data}`));
  backendProcess.on('error', (error) => {
    void dialog.showErrorBox('쳌볶이 백엔드 실행 오류', `내장 분석 서버를 시작하지 못했습니다.\n${error.message}`);
  });
}

function stopBundledBackend() {
  if (backendProcess && !backendProcess.killed) backendProcess.kill();
  backendProcess = undefined;
}

const createWindow = () => {
  const icon = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'checkboki-icon.png')
    : path.join(__dirname, '../assets/checkboki-icon.png');

  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: '쳌볶이',
    icon,
    backgroundColor: '#101411',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });

  if (!app.isPackaged) void window.loadURL('http://localhost:5173');
  else void window.loadFile(path.join(__dirname, '../dist/index.html'));
};

app.whenReady().then(() => {
  startBundledBackend();
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('before-quit', stopBundledBackend);
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

