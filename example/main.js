const { app } = require('electron');
const fileUrl = require('file-url');
const BrowserLikeWindow = require('../index');

let browser;

function createWindow() {
  let winOptions = {}
  if (process.platform === 'darwin') {
    winOptions = {
      titleBarStyle: 'hidden',
      trafficLightPosition: {x: 15, y: 15}
    }
  } else if (process.platform === 'win32') {
    winOptions = {
      autoHideMenuBar: true
    }
  }

  browser = new BrowserLikeWindow({
    controlHeight: 99,
    controlPanel: fileUrl(`${__dirname}/renderer/control.html`),
    startPage: 'https://google.com',
    blankTitle: 'New tab',
    // debug: true, // will open controlPanel's devtools
    winOptions: winOptions
  });

  browser.on('closed', () => {
    browser = null;
  });
}

app.on('ready', async () => {
  createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (browser === null) {
    createWindow();
  }
});
