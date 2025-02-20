import React, { useState, useEffect } from 'react';
import { vscode } from './utils/vscode';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

function App() {
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: '你好！我是 Toy Cline 助手。' }]);
  const [inputValue, setInputValue] = useState('');

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      const newMessage: Message = { role: 'user', content: inputValue };
      setMessages([...messages, newMessage]);
      vscode.postMessage({ type: 'invoke', invoke: 'sendMessage', text: inputValue });
      setInputValue('');
    }
  };

  useEffect(() => {
    const messageListener = (event: MessageEvent<any>) => {
      const message = event.data;
      switch (message.type) {
        case 'invoke':
          if (message.invoke === 'sendMessage' && message.text) {
            const assistantMessage: Message = { role: 'assistant', content: message.text };
            setMessages((prevMessages) => [...prevMessages, assistantMessage]);
          }
          break;
      }
    };

    window.addEventListener('message', messageListener);
    return () => {
      window.removeEventListener('message', messageListener);
    };
  }, []);

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
        <button onClick={handleSendMessage} style={{ marginLeft: '10px' }}>
          发送
        </button>
      </div>
    </div>
  );
}

export default App;
