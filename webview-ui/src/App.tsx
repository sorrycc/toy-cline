import React, { useEffect } from 'react';
import { vscode } from './utils/vscode';

const App: React.FC = () => {
	useEffect(() => {
		vscode.postMessage({ type: 'webviewDidLaunch' });
	}, []);

	return (
		<div style={{ padding: '20px' }}>
			<h1>Hello Toy Cline!</h1>
			<button
				onClick={() => vscode.postMessage({ type: 'invoke', invoke: 'sendMessage', text: 'Hello from Webview!' })}
			>
				Send Message to Extension
			</button>
		</div>
	);
};

export default App;
