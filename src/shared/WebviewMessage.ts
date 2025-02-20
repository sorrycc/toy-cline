export interface WebviewMessage {
	type: 'webviewDidLaunch' | 'invoke' | 'state';
	invoke?: 'sendMessage' | 'primaryButtonClick';
	text?: string;
	state?: any;
}
