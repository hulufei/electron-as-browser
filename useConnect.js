import { ipcRenderer } from 'electron';
import { useEffect, useState } from 'react';

// Used in Renderer process

const noop = () => {};

/**
 * A custom hook to create ipc connection between BrowserView and ControlView
 *
 * @param {object} options
 * @param {function} options.onTabsUpdate - trigger after tabs updated(title, favicon, loading etc.)
 * @param {function} options.onTabActive - trigger after active tab changed
 */
export default function useConnect({ onTabsUpdate = noop, onTabActive = noop }) {
  const [tabs, setTabs] = useState({});
  const [tabIDs, setTabIDs] = useState([]);
  const [activeID, setActiveID] = useState(null);

  useEffect(() => {
    ipcRenderer.send('control-ready');

    ipcRenderer.on('tabs-update', (e, v) => {
      setTabIDs(v.tabs);
      setTabs(v.confs);
    });

    ipcRenderer.on('active-update', (e, v) => {
      setActiveID(v);
      const activeTab = tabs[v] || {};
      onTabActive(activeTab);
    });

    return () => {
      ipcRenderer.removeAllListeners('tabs-update');
      ipcRenderer.removeAllListeners('active-update');
    };
  }, []);

  return { tabIDs, tabs, activeID };
}
