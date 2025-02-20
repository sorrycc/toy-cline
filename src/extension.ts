import * as vscode from 'vscode';
import { ClineProvider } from './core/ClineProvider';
import * as dotenv from 'dotenv';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	// 加载环境变量
	dotenv.config({ path: path.join(context.extensionPath, '.env') });

	// 创建输出通道
	const outputChannel = vscode.window.createOutputChannel('toy-cline');
	outputChannel.appendLine(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY}`);

	// 创建 provider 实例
	const provider = new ClineProvider(context, outputChannel);

	// 注册 provider
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, provider),
		vscode.commands.registerCommand('toy-cline.openInNewTab', () => {
			provider.openInNewTab();
		})
	);
}

export function deactivate() {}
