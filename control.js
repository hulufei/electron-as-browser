const { ipcRenderer } = require('electron');

// Used in Renderer process

/**
 * Tell browser view to load url
 * @param {string} url
 */
const sendEnterURL = url => ipcRenderer.send('url-enter', url);

/**
 * Tell browser view url in address bar changed
 * @param {string} url
 */
const sendChangeURL = url => ipcRenderer.send('url-change', url);

const sendAct = actName => {
  ipcRenderer.send('act', actName);
};

/**
 * Tell browser view to goBack
 */
const sendGoBack = () => sendAct('goBack');

/**
 * Tell browser view to goForward
 */
const sendGoForward = () => sendAct('goForward');

// Tell browser view to reload
const sendReload = () => sendAct('reload');

// Tell browser view to stop load
const sendStop = () => sendAct('stop');

/**
 * Tell browser view to close tab
 * @param {TabID} id
 */
const sendCloseTab = id => ipcRenderer.send('close-tab', id);

/**
 * Create a new tab
 * @param {string} [url]
 * @param {object} [references]
 */
const sendNewTab = (url, references) => ipcRenderer.send('new-tab', url, references);

/**
 * Tell browser view to switch to specified tab
 * @param {TabID} id
 */
const sendSwitchTab = id => ipcRenderer.send('switch-tab', id);

module.exports = {
  sendEnterURL, // sendEnterURL(url) to load url
  sendChangeURL, // sendChangeURL(url) on addressbar input change
  sendGoBack,
  sendGoForward,
  sendReload,
  sendStop,
  sendNewTab, // sendNewTab([url])
  sendSwitchTab, // sendSwitchTab(toID)
  sendCloseTab // sendCloseTab(id)
};
