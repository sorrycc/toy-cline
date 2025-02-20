import React, { useState, useEffect } from 'react';
import { vscode } from './utils/vscode';

function App() {
	const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
		{ role: 'assistant', content: '你好！我是 Cline 玩具版助手。' }
	]);
	const [inputValue, setInputValue] = useState('');

	useEffect(() => {
		// Send initial launch message
		vscode.postMessage({ type: 'webviewDidLaunch' });

		// Set up message listener
		const messageListener = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === 'invoke' && message.invoke === 'sendMessage' && message.text) {
				setMessages(prevMessages => [...prevMessages, { role: 'assistant', content: message.text }]);
			}
		};

		window.addEventListener('message', messageListener);
		return () => window.removeEventListener('message', messageListener);
	}, []);

	const handleSendMessage = () => {
		if (inputValue.trim()) {
			const newMessage = { role: 'user' as const, content: inputValue };
			setMessages(prevMessages => [...prevMessages, newMessage]);
			vscode.postMessage({ type: 'invoke', invoke: 'sendMessage', text: inputValue });
			setInputValue('');
		}
	};

	return (
		<div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
			<div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px' }}>
				{messages.map((msg, index) => (
					<div key={index} style={{ marginBottom: '10px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
						<b>{msg.role === 'user' ? '用户:' : '助手:'}</b> {msg.content}
					</div>
				))}
			</div>
			<div style={{ padding: '20px', borderTop: '1px solid #ccc', display: 'flex' }}>
				<textarea
					style={{ flexGrow: 1, resize: 'none', height: '30px' }}
					placeholder="输入消息..."
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							handleSendMessage();
						}
					}}
				/>
				<button onClick={handleSendMessage} style={{ marginLeft: '10px' }}>发送</button>
			</div>
		</div>
	);
}

export default App;
