import * as vscode from 'vscode';
import { Decorator } from './decorator';
import { LargeFileWarning } from './largeFileWarning';
import { ConfigPanel } from './configPanel';

export function activate(context: vscode.ExtensionContext): void {
  const warning = new LargeFileWarning();
  const decorator = new Decorator(warning);

  context.subscriptions.push(
    decorator,
    vscode.commands.registerCommand('paramsHighlight.configure', () => ConfigPanel.show()),
  );
}

export function deactivate(): void {}
