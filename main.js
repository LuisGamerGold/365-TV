const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, Menu, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const server = require('./server');

let mainWindow = null;

function logUpdate(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    const logFile = path.join(app.getPath('userData'), 'update.log');
    fs.appendFileSync(logFile, line + '\n');
  } catch {
    // sem permissao de escrita no log nao deve derrubar o app
  }
}

function setupAutoUpdate() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => logUpdate('verificando atualizacoes...'));
  autoUpdater.on('update-available', (info) => logUpdate(`atualizacao disponivel: ${info.version}`));
  autoUpdater.on('update-not-available', () => logUpdate('nenhuma atualizacao disponivel'));
  autoUpdater.on('error', (err) => logUpdate(`erro ao atualizar: ${err.message}`));
  autoUpdater.on('update-downloaded', (info) => {
    logUpdate(`atualizacao ${info.version} baixada — reiniciando para instalar`);
    autoUpdater.quitAndInstall();
  });

  // Primeira checagem pouco depois de abrir (sem atrasar o boot da tela),
  // e depois a cada 4 horas — device fica sozinho, entao a atualizacao e'
  // sempre automatica (baixa e reinicia sozinho quando tem versao nova).
  setTimeout(() => autoUpdater.checkForUpdates(), 30 * 1000);
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
}

async function createWindow() {
  const { port } = await server.start();

  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      // sem isso, se a janela perder o foco por qualquer motivo (RDP,
      // manutencao remota, um popup do Windows) o Chromium reduz drasticamente
      // o ritmo das animacoes CSS (tarjeta, pilula de musica) - o mesmo
      // comportamento de economia de energia que ele aplica a uma aba em
      // segundo plano. A tela e' kiosk/fullscreen e nao deveria perder foco
      // no uso normal, mas isso garante que a animacao nunca dependa disso.
      backgroundThrottling: false
    }
  });

  mainWindow.loadURL(`http://localhost:${port}/player`);

  // Atalho de emergencia para sair do modo kiosk durante instalacao/manutencao.
  globalShortcut.register('Control+Alt+Q', () => {
    app.quit();
  });
}

app.whenReady().then(() => {
  app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
  createWindow();
  setupAutoUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
