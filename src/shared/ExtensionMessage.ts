export interface ExtensionMessage {
  type: 'action' | 'state' | 'invoke';
  action?: 'chatButtonClicked' | 'didBecomeVisible';
  invoke?: 'sendMessage' | 'primaryButtonClick';
  text?: string;
  state?: ExtensionState;
}

export interface ExtensionState {
  version: string;
}
