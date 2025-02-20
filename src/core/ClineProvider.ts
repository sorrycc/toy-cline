import * as vscode from 'vscode';
import { getNonce } from './webview/getNonce';
import { getUri } from './webview/getUri';
import { ExtensionMessage } from '../shared/ExtensionMessage';
import { WebviewMessage } from '../shared/WebviewMessage';
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ClineProvider implements vscode.WebviewViewProvider {
  public static readonly sideBarId = 'toy-cline.SidebarProvider';
  public static readonly tabPanelId = 'toy-cline.TabPanelProvider';
  private view?: vscode.WebviewView | vscode.WebviewPanel;
  private openai: OpenAI;

  private systemPrompt = `你是 Cline，一个专业的软件工程师助手。你可以使用以下工具来帮助用户完成任务：

	工具列表:

	1. read_file: 读取文件内容
	   - 参数: path (文件路径)
	   - XML 格式: <tool_use><tool_name>read_file</tool_name><path>文件路径</path></tool_use>

	2. write_file: 写入文件内容
	   - 参数: path (文件路径), content (文件内容)
	   - XML 格式: <tool_use><tool_name>write_file</tool_name><path>文件路径</path><content>文件内容</content></tool_use>

	请根据用户需求，合理使用工具。工具调用必须使用 XML 格式。`;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    // 初始化 OpenAI 客户端
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY, // 从环境变量获取 API key
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
    const panel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, 'Cline', vscode.ViewColumn.One, {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    });
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
                  messages: [
                    { role: 'system', content: this.systemPrompt },
                    { role: 'user', content: userMessage },
                  ],
                });
                let generatedText = completion.choices[0]?.message?.content || 'API 返回为空';

                // 检测工具调用
                if (generatedText.includes('<tool_use>')) {
                  const toolCall = this.parseToolCall(generatedText);
                  if (toolCall) {
                    const toolResult = await this.executeTool(toolCall);
                    generatedText = `${generatedText}\n\n工具执行结果:\n${toolResult}`;
                  }
                }

                this.postMessageToWebview({ type: 'invoke', invoke: 'sendMessage', text: generatedText });
                this.outputChannel.appendLine(`Assistant Message: ${generatedText}`);
              } catch (error) {
                console.error('API 调用失败:', error);
                this.outputChannel.appendLine(`API 调用失败: ${error}`);
                this.postMessageToWebview({
                  type: 'invoke',
                  invoke: 'sendMessage',
                  text: 'API 调用失败，请检查 Output 面板。',
                });
              }
            }
            break;
        }
      },
      null,
      this.context.subscriptions
    );
  }

  private parseToolCall(text: string) {
    const toolUseRegex = /<tool_use>(.*?)<\/tool_use>/s;
    const match = text.match(toolUseRegex);
    if (!match) return null;

    const toolContent = match[1];
    const toolNameRegex = /<tool_name>(.*?)<\/tool_name>/;
    const toolNameMatch = toolContent.match(toolNameRegex);
    const toolName = toolNameMatch ? toolNameMatch[1].trim() : '';

    const pathRegex = /<path>(.*?)<\/path>/;
    const pathMatch = toolContent.match(pathRegex);
    const filePath = pathMatch ? pathMatch[1].trim() : '';

    const contentRegex = /<content>(.*?)<\/content>/;
    const contentMatch = toolContent.match(contentRegex);
    const fileContent = contentMatch ? contentMatch[1].trim() : '';

    return {
      tool_name: toolName,
      path: filePath,
      content: fileContent,
    };
  }

  private async executeTool(toolCall: any): Promise<string> {
    // Get workspace path - use the first workspace folder
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      return '错误: 未找到工作区路径';
    }

    // Resolve the full file path
    const fullPath = path.resolve(workspacePath, toolCall.path);

    // Verify the path is within workspace for security
    if (!fullPath.startsWith(workspacePath)) {
      return '错误: 文件路径必须在工作区内';
    }

    switch (toolCall.tool_name) {
      case 'read_file': {
        const allowed = await vscode.window.showInformationMessage(
          `Cline 想要读取文件: ${toolCall.path}, 是否允许?`,
          '允许',
          '拒绝'
        );
        if (allowed !== '允许') {
          return '用户拒绝读取文件';
        }
        return this.readFileTool(fullPath);
      }
      case 'write_file': {
        const allowed = await vscode.window.showInformationMessage(
          `Cline 想要写入文件: ${toolCall.path}, 是否允许?`,
          '允许',
          '拒绝'
        );
        if (allowed !== '允许') {
          return '用户拒绝写入文件';
        }
        return this.writeFileTool(fullPath, toolCall.content);
      }
      default:
        return '未知的工具调用: ' + toolCall.tool_name;
    }
  }

  private async readFileTool(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return `文件内容:\n${content}`;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return `文件未找到: ${filePath}`;
      } else {
        return `读取文件失败: ${filePath}\n错误信息: ${error.message}`;
      }
    }
  }

  private async writeFileTool(filePath: string, content: string): Promise<string> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return `文件写入成功: ${filePath}`;
    } catch (error: any) {
      return `文件写入失败: ${filePath}\n错误信息: ${error.message}`;
    }
  }

  private postMessageToWebview(message: ExtensionMessage) {
    if (this.view?.webview) {
      this.view.webview.postMessage(message);
    }
  }
}
