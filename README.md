# electron-as-browser
![version](https://img.shields.io/npm/v/electron-as-browser.svg?style=flat-square)![downloads](https://img.shields.io/npm/dt/electron-as-browser.svg?style=flat-square)![license](https://img.shields.io/npm/l/electron-as-browser.svg?style=flat-square)

A node module to help build	browser like windows in electron.

## Features

- Made with [BrowserView](https://electronjs.org/docs/api/browser-view) instead of [<webview>](https://electronjs.org/docs/api/webview-tag)
- Pluggable control panel(Navigation interface)
- Customizable web contents and browser windows
- Tricky auto resize just out of the box

## Install

`npm i electron-as-browser`

## Usage

### First, create BrowserLikeWindow in [Main](https://electronjs.org/docs/glossary#main-process) process

```javascript
const BrowserLikeWindow = require('electron-as-browser');
const fileUrl = require('file-url');

let browser;

browser = new BrowserLikeWindow({
	controlPanel: fileUrl('you-control-interface.html'),
	startPage: 'https://page-to-load-once-open',
	blankTitle: 'New tab',
	debug: true // will open controlPanel's devtools
});

// Trigger on new tab created
browser.on('new-tab', ({ webContents }) => {
	// Customize webContents if your like
});

browser.on('closed', () => {
	// Make it garbage collected
	browser = null;
});
```

### Second, style your own browser control interface(renderer).

To make the control interface works, there are two steps:

- Setup ipc channels to receive tabs' informations
- Send actions to control the behaviours

For react users, there is a custom hook `useConnect` to help you setup ipc channels.

```javascript
const useConnect = require('electron-as-browser/useConnect');

const ControlPanel = () => {
	const { tabs, tabIDs, activeID } = useConnect();
	return (
		<div>Use tabs informations to render your control panel</div>
	);
}
```

For non-react users, you have to setup ipc channels yourself, there are three steps:

- `ipcRenderer.send('control-ready')` on dom ready
- `ipcRenderer.on('tabs-update', (e, tabs) => { // update tabs })`
- `ipcRenderer.on('active-update', (e, activeID) => { // update active tab's id })`

Don't forget to `removeListener` on `ipcRenderer` once control panel unmounted.

Once setup ipc channels, you'll get all your control panel needed informations:

- `tabs` an object contains all the opened tab's informations, tab's id as the key(Each tab contains `{ id, url, title, favicon, isLoading, canGoBack, canGoForward }`)
- `tabIDs` array of opened tab's ids
- `activeID` current active tab's id

Construct and style your control interface as your like.

Then you can send actions to control the browser view, the actions can require from `control`:

```javascript
import {
	sendEnterURL, // sendEnterURL(url) to load url
	sendChangeURL, // sendChangeURL(url) on addressbar input change
	sendGoBack,
	sendGoForward,
	sendReload,
	sendStop,
	sendNewTab, // sendNewTab([url])
	sendSwitchTab, // sendSwitchTab(toID)
	sendCloseTab // sendCloseTab(id)
} from 'electron-as-browser/control';
```

See [examples](./examples) for a full control interface implementation.

**NOTE: make sure to setup local bundler to compile es6 code for `electron-as-browser/useConnect` and `electron-as-browser/control`, most bundler will not compile code in node_modules by default.**
