import * as vscode from 'vscode';
import { getNonce } from './webview/getNonce';
import { getUri } from './webview/getUri';
import { ExtensionMessage } from '../shared/ExtensionMessage';
import { WebviewMessage } from '../shared/WebviewMessage';
import OpenAI from 'openai';

export class ClineProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = 'toy-cline.SidebarProvider';
	public static readonly tabPanelId = 'toy-cline.TabPanelProvider';
	private view?: vscode.WebviewView | vscode.WebviewPanel;
	private openai: OpenAI;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly outputChannel: vscode.OutputChannel
	) {
		// 初始化 OpenAI 客户端
		this.openai = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY // 从环境变量获取 API key
		});
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		webviewView.webview.html = this.getHtmlContent(webviewView.webview);
		this.setWebviewMessageListener(webviewView.webview);
	}

	public openInNewTab(): void {
		const panel = vscode.window.createWebviewPanel(
			ClineProvider.tabPanelId,
			'Cline',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [this.context.extensionUri],
			}
		);
		this.view = panel;
		panel.webview.html = this.getHtmlContent(panel.webview);
		this.setWebviewMessageListener(panel.webview);
	}

	private getHtmlContent(webview: vscode.Webview): string {
		const stylesUri = getUri(webview, this.context.extensionUri, ['webview-ui', 'build', 'static', 'css', 'main.css']);
		const scriptUri = getUri(webview, this.context.extensionUri, ['webview-ui', 'build', 'static', 'js', 'main.js']);
		const nonce = getNonce();

		return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <link rel="stylesheet" type="text/css" href="${stylesUri}">
            <title>Cline</title>
          </head>
          <body>
            <div id="root"></div>
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
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
							const userMessage = message.text || '';
							this.outputChannel.appendLine(`User Message: ${userMessage}`);

							try {
								const completion = await this.openai.chat.completions.create({
									model: 'gpt-3.5-turbo',
									messages: [{ role: 'user', content: userMessage }],
								});
								const assistantMessage = completion.choices[0]?.message?.content || 'API 返回为空';
								this.postMessageToWebview({ type: 'invoke', invoke: 'sendMessage', text: assistantMessage });
								this.outputChannel.appendLine(`Assistant Message: ${assistantMessage}`);
							} catch (error) {
								console.error('API 调用失败:', error);
								this.outputChannel.appendLine(`API 调用失败: ${error}`);
								this.postMessageToWebview({ type: 'invoke', invoke: 'sendMessage', text: 'API 调用失败，请检查 Output 面板。' });
							}
						}
						break;
				}
			},
			null,
			this.context.subscriptions
		);
	}

	private postMessageToWebview(message: ExtensionMessage) {
		if (this.view?.webview) {
			this.view.webview.postMessage(message);
		}
	}
}
