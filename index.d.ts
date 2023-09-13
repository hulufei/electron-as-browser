import type { BrowserWindowConstructorOptions, WebPreferences, Rectangle } from 'electron';
import type { EventEmitter } from 'events';

type TabID = number;

interface Tab {
    url: string;
    href: string;
    title: string;
    favicon: string;
    isLoading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
}

interface Tabs {
    [key: number]: Tab;
}

interface BrowserLikeWindowOptions {
    width?: number;
    height?: number;
    controlPanel: string;
    controlHeight?: number;
    viewReferences?: WebPreferences;
    controlReferences?: WebPreferences;
    winOptions?: BrowserWindowConstructorOptions;
    startPage?: string;
    blankPage?: string;
    blankTitle?: string;
    onNewWindow?: (e: any, newUrl: string, frameName: string, disposition: string, winOptions: BrowserWindowConstructorOptions) => void;
    debug?: boolean;
}

class BrowserLikeWindow extends EventEmitter {
    constructor(options: BrowserLikeWindowOptions);
    getControlBounds(): Rectangle;
    setContentBounds(): void;
    readonly currentView: {
        id: TabID;
        webContents: {
            id: number;
            canGoBack(): boolean;
            canGoForward(): boolean;
            loadURL(url: string): void;
            getURL(): string;
            getTitle(): string;
            [key: string]: any; // To allow for additional methods/properties not specified
        };
        [key: string]: any; // To allow for additional methods/properties not specified
    };
    readonly currentWebContents: BrowserLikeWindow['currentView']['webContents'];
    currentViewId: TabID;
    tabConfigs: Tabs;
    setTabConfig(viewId: TabID, kv: Partial<Tab>): Tabs;
    loadURL(url: string): void;
    setCurrentView(viewId: TabID): void;
    newTab(url?: string, appendTo?: TabID, references?: WebPreferences): BrowserLikeWindow['currentView'];
    switchTab(viewId: TabID): void;
    destroyView(viewId: TabID): void;
}

export = BrowserLikeWindow;
