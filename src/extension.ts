import * as vscode from 'vscode';
import { ClineProvider } from './core/ClineProvider';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel('toy-cline');
	context.subscriptions.push(outputChannel);

	// log something
	console.log('toy-cline is activated');
	// notify the user
	vscode.window.showInformationMessage('toy-cline is activated');

	const sidebarProvider = new ClineProvider(context, outputChannel);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, sidebarProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('toy-cline.openInNewTab', async () => {
			const tabProvider = new ClineProvider(context, outputChannel);
			const panel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, 'toy-cline', vscode.ViewColumn.Two, {
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [context.extensionUri],
			});
			tabProvider.resolveWebviewView(panel);
		})
	);
}

export function deactivate() {}
