import { ipcRenderer } from 'electron';

// Used in Renderer process

/**
 * Tell browser view to load url
 * @param {string} url
 */
export const sendEnterURL = url => ipcRenderer.send('url-enter', url);

/**
 * Tell browser view url in address bar changed
 * @param {string} url
 */
export const sendChangeURL = url => ipcRenderer.send('url-change', url);

const sendAct = actName => {
  ipcRenderer.send('act', actName);
};

/**
 * Tell browser view to goBack
 */
export const sendGoBack = () => sendAct('goBack');

/**
 * Tell browser view to goForward
 */
export const sendGoForward = () => sendAct('goForward');

// Tell browser view to reload
export const sendReload = () => sendAct('reload');

// Tell browser view to stop load
export const sendStop = () => sendAct('stop');

/**
 * Tell browser view to close tab
 * @param {number} id - BrowserView's id of the tab to be closed
 */
export const sendCloseTab = id => ipcRenderer.send('close-tab', id);

/**
 * Create a new tab
 * @param {string} [url]
 */
export const sendNewTab = url => ipcRenderer.send('new-tab', url);

/**
 * Tell browser view to switch to specified tab
 * @param {number} id - Target BrowserView's id
 */
export const sendSwitchTab = id => ipcRenderer.send('switch-tab', id);

