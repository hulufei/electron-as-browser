const { ipcRenderer } = require('electron');
const { useEffect, useState } = require('react');

// Used in Renderer process

const noop = () => {};

/**
 * A custom hook to create ipc connection between BrowserView and ControlView
 *
 * @param {object} options
 * @param {function} options.onTabsUpdate - trigger after tabs updated(title, favicon, loading etc.)
 * @param {function} options.onTabActive - trigger after active tab changed
 */
module.exports = function useConnect(options = {}) {
  const { onTabsUpdate = noop, onTabActive = noop } = options;
  const [tabs, setTabs] = useState({});
  const [tabIDs, setTabIDs] = useState([]);
  const [activeID, setActiveID] = useState(null);

  const channels = [
    [
      'tabs-update',
      (e, v) => {
        setTabIDs(v.tabs);
        setTabs(v.confs);
        onTabsUpdate(v);
      }
    ],
    [
      'active-update',
      (e, v) => {
        setActiveID(v);
        const activeTab = tabs[v] || {};
        onTabActive(activeTab);
      }
    ]
  ];

  useEffect(() => {
    ipcRenderer.send('control-ready');

    channels.forEach(([name, listener]) => ipcRenderer.on(name, listener));

    return () => {
      channels.forEach(([name, listener]) => ipcRenderer.removeListener(name, listener));
    };
  }, []);

  return { tabIDs, tabs, activeID };
};
