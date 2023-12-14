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
 * @property {string} url - tab's url(address bar)
 * @property {string} href - tab's loaded page url(location.href)
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
 * @param {function} [options.onNewWindow] - custom webContents `new-window` event handler
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
        contextIsolation: false,
        nodeIntegration: true,
        // Allow loadURL with file path in dev environment
        webSecurity: false,
        ...controlReferences
      }
    });

    // BrowserView should add to window before setup
    this.win.addBrowserView(this.controlView);
    this.controlView.setAutoResize({ width: true });
    this.controlView.webContents.loadURL(controlPanel);
    // https://github.com/electron/electron/issues/31424#issuecomment-978494007
    this.controlView.webContents.on('did-finish-load', () => this.controlView.setBounds(this.getControlBounds()))

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
      'new-tab': (e, url, references) => {
        log.debug('new-tab with url', url);
        this.newTab(url, undefined, references);
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

    channels
      .map(([name, listener]) => [
        name,
        (e, ...args) => {
          // Support multiple BrowserLikeWindow
          if (this.controlView && e.sender === this.controlView.webContents) {
            log.debug(`Trigger ${name} from ${e.sender.id}`);
            listener(e, ...args);
          }
        }
      ])
      .forEach(([name, listener]) => ipcMain.on(name, listener));

    /**
     * closed event
     *
     * @event BrowserLikeWindow#closed
     */
    this.win.on('closed', () => {
      // Remember to clear all ipcMain events as ipcMain bind
      // on every new browser instance
      channels.forEach(([name, listener]) => ipcMain.removeListener(name, listener));

      // Prevent BrowserView memory leak on close
      this.tabs.forEach(id => this.destroyView(id));
      if (this.controlView) {
        this.controlView.webContents.destroy();
        this.controlView = null;
        log.debug('Control view destroyed');
      }
      this.emit('closed');
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
    const contentBounds = this.win.getContentBounds();
    return {
      x: 0,
      y: 0,
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

    // Prevent addEventListeners on same webContents when enter urls in same tab
    const MARKS = '__IS_INITIALIZED__';
    if (webContents[MARKS]) {
      webContents.loadURL(url);
      return;
    }

    const onNewWindow = ({url, frameName, disposition}) => {
      log.debug('on new-window', { disposition, url, frameName });

      if (!new URL(url).host) {
        // Handle newUrl = 'about:blank' in some cases
        log.debug('Invalid url open with default window');
        return;
      }

      this.newTab(url, id);
    };

    webContents.setWindowOpenHandler(this.options.onNewWindow || onNewWindow);

    // Keep event in order
    webContents
      .on('did-start-loading', () => {
        log.debug('did-start-loading > set loading');
        this.setTabConfig(id, { isLoading: true });
      })
      .on('did-start-navigation', (e, href, isInPlace, isMainFrame) => {
        if (isMainFrame) {
          log.debug('did-start-navigation > set url address', {
            href,
            isInPlace,
            isMainFrame
          });
          this.setTabConfig(id, { url: href, href });
          /**
           * url-updated event.
           *
           * @event BrowserLikeWindow#url-updated
           * @return {BrowserView} view - current browser view
           * @return {string} href - updated url
           */
          this.emit('url-updated', { view: currentView, href });
        }
      })
      .on('will-redirect', (e, href) => {
        log.debug('will-redirect > update url address', { href });
        this.setTabConfig(id, { url: href, href });
        this.emit('url-updated', { view: currentView, href });
      })
      .on('page-title-updated', (e, title) => {
        log.debug('page-title-updated', title);
        this.setTabConfig(id, { title });
      })
      .on('page-favicon-updated', (e, favicons) => {
        log.debug('page-favicon-updated', favicons);
        this.setTabConfig(id, { favicon: favicons[0] });
      })
      .on('did-stop-loading', () => {
        log.debug('did-stop-loading', { title: webContents.getTitle() });
        this.setTabConfig(id, { isLoading: false });
      })
      .on('dom-ready', () => {
        webContents.focus();
      });

    webContents.loadURL(url);
    webContents[MARKS] = true;

    this.setContentBounds();

    if (this.options.debug) {
      webContents.openDevTools({ mode: 'detach' });
    }
  }

  setCurrentView(viewId) {
    if (!viewId) return;
    if (this.currentView != null) {
      this.win.removeBrowserView(this.currentView);
    }
    this.win.addBrowserView(this.views[viewId]);
    this.currentViewId = viewId;
  }

  /**
   * Create a tab
   *
   * @param {string} [url=this.options.blankPage]
   * @param {number} [appendTo] - add next to specified tab's id
   * @param {object} [references=this.options.viewReferences] - custom webPreferences to this tab
   *
   * @fires BrowserLikeWindow#new-tab
   */
  newTab(url, appendTo, references) {
    const view = new BrowserView({
      webPreferences: {
        // Set sandbox to support window.opener
        // See: https://github.com/electron/electron/issues/1865#issuecomment-249989894
        sandbox: true,
        ...(references || this.options.viewReferences)
      }
    });

    view.id = view.webContents.id;

    if (appendTo) {
      const prevIndex = this.tabs.indexOf(appendTo);
      this.tabs.splice(prevIndex + 1, 0, view.id);
    } else {
      this.tabs.push(view.id);
    }
    this.views[view.id] = view;

    // Add to manager first
    const lastView = this.currentView;
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
     * @return {BrowserView} view - current browser view
     * @return {string} [source.openedURL] - opened with url
     * @return {BrowserView} source.lastView - previous active view
     */
    this.emit('new-tab', view, { openedURL: url, lastView });
    return view;
  }

  /**
   * Swith to tab
   * @param {TabID} viewId
   */
  switchTab(viewId) {
    log.debug('switch to tab', viewId);
    this.setCurrentView(viewId);
    this.currentView.webContents.focus();
  }

  /**
   * Destroy tab
   * @param {TabID} viewId
   * @ignore
   */
  destroyView(viewId) {
    const view = this.views[viewId];
    if (view) {
      view.webContents.destroy();
      this.views[viewId] = undefined;
      log.debug(`${viewId} destroyed`);
    }
  }
}

module.exports = BrowserLikeWindow;
