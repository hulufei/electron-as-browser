const { BrowserWindow, BrowserView, ipcMain } = require('electron');
const EventEmitter = require('events');
const log = require('electron-log');

log.transports.file.level = false;
log.transports.console.level = false;

/**
 * @typedef {number} TabID
 * @description BrowserView's id as tab id
 */

/**
 * @typedef {object} Tab
 * @property {string} url - tab's url
 * @property {string} title - tab's title
 * @property {string} favicon - tab's favicon url
 * @property {boolean} isLoading
 * @property {boolean} canGoBack
 * @property {boolean} canGoForward
 */

/**
 * @typedef {Object.<TabID, Tab>} Tabs
 */

/**
 * @typedef {object} Bounds
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * A browser like window
 * @param {object} options
 * @param {number} [options.width = 1024] - browser window's width
 * @param {number} [options.height = 800] - browser window's height
 * @param {string} options.controlPanel - control interface path to load
 * @param {number} [options.controlHeight = 130] - control interface's height
 * @param {object} [options.viewReferences] - webReferences for every BrowserView
 * @param {object} [options.controlReferences] - webReferences for control panel BrowserView
 * @param {object} [options.winOptions] - options for BrowserWindow
 * @param {string} [options.startPage = ''] - start page to load on browser open
 * @param {string} [options.blankPage = ''] - blank page to load on new tab
 * @param {string} [options.blankTitle = 'about:blank'] - blank page's title
 * @param {boolean} [options.debug] - toggle debug
 */
class BrowserLikeWindow extends EventEmitter {
  constructor(options) {
    super();

    this.options = options;
    const {
      width = 1024,
      height = 800,
      winOptions = {},
      controlPanel,
      controlReferences
    } = options;

    this.win = new BrowserWindow({
      ...winOptions,
      width,
      height
    });

    /**
     * closed event
     *
     * @event BrowserLikeWindow#closed
     */
    this.win.on('closed', () => this.emit('closed'));

    this.defCurrentViewId = null;
    this.defTabConfigs = {};
    // Prevent browser views garbage collected
    this.views = {};
    // keep order
    this.tabs = [];
    // ipc channel
    this.ipc = null;

    this.controlView = new BrowserView({
      webPreferences: {
        nodeIntegration: true,
        // Allow loadURL with file path in dev environment
        webSecurity: false,
        ...controlReferences
      }
    });

    // BrowserView should add to window before setup
    this.win.addBrowserView(this.controlView);
    this.controlView.setBounds(this.getControlBounds());
    this.controlView.setAutoResize({ width: true });
    this.controlView.webContents.loadURL(controlPanel);

    const webContentsAct = actionName => {
      const webContents = this.currentWebContents;
      const action = webContents && webContents[actionName];
      if (typeof action === 'function') {
        if (actionName === 'reload' && webContents.getURL() === '') return;
        action.call(webContents);
        log.debug(
          `do webContents action ${actionName} for ${this.currentViewId}:${webContents &&
            webContents.getTitle()}`
        );
      } else {
        log.error('Invalid webContents action ', actionName);
      }
    };

    const channels = Object.entries({
      'control-ready': e => {
        log.debug('on control-ready');
        this.ipc = e;
        this.newTab(this.options.startPage || '');
        /**
         * control-ready event.
         *
         * @event BrowserLikeWindow#control-ready
         * @type {IpcMainEvent}
         */
        this.emit('control-ready', e);
      },
      'url-change': (e, url) => {
        this.setTabConfig(this.currentViewId, { url });
      },
      'url-enter': (e, url) => {
        this.loadURL(url);
      },
      act: (e, actName) => webContentsAct(actName),
      'new-tab': e => {
        this.newTab();
      },
      'switch-tab': (e, id) => {
        this.switchTab(id);
      },
      'close-tab': (e, id) => {
        log.debug('close tab ', { id, currentViewId: this.currentViewId });
        if (id === this.currentViewId) {
          const removeIndex = this.tabs.indexOf(id);
          const nextIndex = removeIndex === this.tabs.length - 1 ? 0 : removeIndex + 1;
          this.setCurrentView(this.tabs[nextIndex]);
        }
        this.tabs = this.tabs.filter(v => v !== id);
        this.tabConfigs = {
          ...this.tabConfigs,
          [id]: undefined
        };
        this.destroyView(id);

        if (this.tabs.length === 0) {
          this.newTab();
        }
      }
    });

    channels.forEach(([name, listener]) => ipcMain.on(name, listener));

    this.win.on('closed', () => {
      // Remember to clear all ipcMain events as ipcMain bind
      // on every new browser instance
      channels.forEach(([name, listener]) => ipcMain.removeListener(name, listener));
    });

    if (this.options.debug) {
      this.controlView.webContents.openDevTools({ mode: 'detach' });
      log.transports.console.level = 'debug';
    }
  }

  /**
   * Get control view's bounds
   *
   * @returns {Bounds} Bounds of control view(exclude window's frame)
   */
  getControlBounds() {
    const winBounds = this.win.getBounds();
    const contentBounds = this.win.getContentBounds();
    const y = process.platform === 'darwin' ? contentBounds.y - winBounds.y : 0;
    return {
      x: 0,
      y,
      width: contentBounds.width,
      height: this.options.controlHeight || 130
    };
  }

  /**
   * Set web contents view's bounds automatically
   * @ignore
   */
  setContentBounds() {
    const [contentWidth, contentHeight] = this.win.getContentSize();
    const controlBounds = this.getControlBounds();
    if (this.currentView) {
      this.currentView.setBounds({
        x: 0,
        y: controlBounds.y + controlBounds.height,
        width: contentWidth,
        height: contentHeight - controlBounds.height
      });
    }
  }

  get currentView() {
    return this.currentViewId ? this.views[this.currentViewId] : null;
  }

  get currentWebContents() {
    const { webContents } = this.currentView || {};
    return webContents;
  }

  // The most important thing to remember about the get keyword is that it defines an accessor property,
  // rather than a method. So, it can’t have the same name as the data property that stores the value it accesses.
  get currentViewId() {
    return this.defCurrentViewId;
  }

  set currentViewId(id) {
    this.defCurrentViewId = id;
    this.setContentBounds();
    if (this.ipc) {
      this.ipc.reply('active-update', id);
    }
  }

  get tabConfigs() {
    return this.defTabConfigs;
  }

  set tabConfigs(v) {
    this.defTabConfigs = v;
    if (this.ipc) {
      this.ipc.reply('tabs-update', {
        confs: v,
        tabs: this.tabs
      });
    }
  }

  setTabConfig(viewId, kv) {
    const tab = this.tabConfigs[viewId];
    const { webContents } = this.views[viewId] || {};
    this.tabConfigs = {
      ...this.tabConfigs,
      [viewId]: {
        ...tab,
        canGoBack: webContents && webContents.canGoBack(),
        canGoForward: webContents && webContents.canGoForward(),
        ...kv
      }
    };
    return this.tabConfigs;
  }

  loadURL(url) {
    const { currentView } = this;
    if (!url || !currentView) return;

    const { id, webContents } = currentView;

    webContents.on('new-window', (e, newUrl, frameName, disposition, winOptions) => {
      e.preventDefault();

      if (disposition === 'new-window') {
        log.debug('Popup in new window', { disposition, newUrl });
        const popWin = new BrowserWindow(winOptions);
        popWin.loadURL(newUrl);
        // eslint-disable-next-line no-param-reassign
        e.newGuest = popWin;
      } else {
        log.debug('Popup in new tab', { disposition, newUrl });
        this.newTab(newUrl, id);
      }
    });

    // Keep event in order
    webContents.on('did-start-loading', () => {
      log.debug('did-start-loading', { title: webContents.getTitle() });
      this.setTabConfig(id, { isLoading: true });
    });

    webContents.on('did-start-navigation', (e, href, isInPlace, isMainFrame) => {
      if (isMainFrame) {
        log.debug('did-start-navigation', {
          title: webContents.getTitle(),
          href,
          isInPlace,
          isMainFrame
        });
        this.setTabConfig(id, { url: href });
      }
    });
    webContents.on('page-title-updated', (e, title) => {
      log.debug('page-title-updated', title);
      this.setTabConfig(id, { title });
    });
    webContents.on('page-favicon-updated', (e, favicons) => {
      log.debug('page-favicon-updated', favicons);
      this.setTabConfig(id, { favicon: favicons[0] });
    });
    webContents.on('did-stop-loading', () => {
      log.debug('did-stop-loading', { title: webContents.getTitle() });
      this.setTabConfig(id, { isLoading: false });
    });

    webContents.loadURL(url);

    this.setContentBounds();

    if (this.options.debug) {
      webContents.openDevTools({ mode: 'detach' });
    }
  }

  setCurrentView(viewId) {
    if (!viewId) return;
    this.win.removeBrowserView(this.currentView);
    this.win.addBrowserView(this.views[viewId]);
    this.currentViewId = viewId;
  }

  /**
   * Create a tab
   *
   * @param {string} [url=this.options.blankPage]
   * @param {number} [appendTo] - add next to specified tab's id
   *
   * @fires BrowserLikeWindow#new-tab
   */
  newTab(url, appendTo) {
    const view = new BrowserView({
      webPreferences: {
        // Set sandbox to support window.opener
        // See: https://github.com/electron/electron/issues/1865#issuecomment-249989894
        sandbox: true,
        ...this.options.viewReferences
      }
    });

    if (appendTo) {
      const prevIndex = this.tabs.indexOf(appendTo);
      this.tabs.splice(prevIndex + 1, 0, view.id);
    } else {
      this.tabs.push(view.id);
    }
    this.views[view.id] = view;

    // Add to manager first
    this.setCurrentView(view.id);
    view.setAutoResize({ width: true, height: true });
    this.loadURL(url || this.options.blankPage);
    this.setTabConfig(view.id, {
      title: this.options.blankTitle || 'about:blank'
    });
    /**
     * new-tab event.
     *
     * @event BrowserLikeWindow#new-tab
     * @type {BrowserView}
     */
    this.emit('new-tab', view);
  }

  /**
   * Swith to tab
   * @param {TabID} viewId
   */
  switchTab(viewId) {
    log.debug('switch to tab', viewId);
    this.setCurrentView(viewId);
  }

  /**
   * Destroy tab
   * @param {TabID} viewId
   * @ignore
   */
  destroyView(viewId) {
    const view = this.views[viewId];
    if (view) {
      view.destroy();
      this.views[viewId] = undefined;
      log.debug(`${viewId} destroyed`);
    }
  }
}

module.exports = BrowserLikeWindow;
