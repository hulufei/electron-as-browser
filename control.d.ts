import { IpcRenderer } from 'electron';

// Define the TabID type (assuming it's a string or number)
type TabID = string | number;

// Define the interface for the module
interface ControlActions {
  sendEnterURL: (url: string) => void;
  sendChangeURL: (url: string) => void;
  sendGoBack: () => void;
  sendGoForward: () => void;
  sendReload: () => void;
  sendStop: () => void;
  sendNewTab: (url?: string, references?: object) => void;
  sendSwitchTab: (id: TabID) => void;
  sendCloseTab: (id: TabID) => void;
}

// Declare the module
declare const control: ControlActions;

export = control;
