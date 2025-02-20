interface VSCodeAPI {
	postMessage(message: any): void;
	getState(): any;
	setState(state: any): void;
}

declare global {
	interface Window {
		acquireVsCodeApi(): VSCodeAPI;
	}
}

export const vscode = window.acquireVsCodeApi();
