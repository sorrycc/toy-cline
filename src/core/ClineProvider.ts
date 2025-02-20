import * as vscode from 'vscode';
import { getNonce } from './webview/getNonce';
import { getUri } from './webview/getUri';
import { ExtensionMessage } from '../shared/ExtensionMessage';
import { WebviewMessage } from '../shared/WebviewMessage';

export class ClineProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = 'toy-cline.SidebarProvider';
	public static readonly tabPanelId = 'toy-cline.TabPanelProvider';
	private view?: vscode.WebviewView | vscode.WebviewPanel;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly outputChannel: vscode.OutputChannel
	) {}

	resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel) {
		this.view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		webviewView.webview.html = this.getHtmlContent(webviewView.webview);
		this.setWebviewMessageListener(webviewView.webview);
	}

	private getHtmlContent(webview: vscode.Webview): string {
		const stylesUri = getUri(webview, this.context.extensionUri, ['webview-ui', 'build', 'static', 'css', 'main.css']);
		const scriptUri = getUri(webview, this.context.extensionUri, ['webview-ui', 'build', 'static', 'js', 'main.js']);
		const nonce = getNonce();

		return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
            <meta name="theme-color" content="#000000">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}';">
            <link rel="stylesheet" type="text/css" href="${stylesUri}">
            <title>toy-cline</title>
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root"></div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
          </body>
        </html>
      `;
	}

	private setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(
			async (message: WebviewMessage) => {
				switch (message.type) {
					case 'webviewDidLaunch':
						this.postMessageToWebview({
							type: 'state',
							state: { version: this.context.extension.packageJSON.version },
						});
						break;
					case 'invoke':
						if (message.invoke === 'sendMessage') {
							vscode.window.showInformationMessage(`Received message from webview: ${message.text}`);
						}
						break;
				}
			},
			null,
			this.context.subscriptions
		);
	}

	public async postMessageToWebview(message: ExtensionMessage) {
		await this.view?.webview.postMessage(message);
	}
}
