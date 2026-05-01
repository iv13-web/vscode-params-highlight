import * as vscode from 'vscode';

export class LargeFileWarning {
  private notifiedSize = new Set<string>();
  private notifiedDepth = new Set<string>();

  notifyOnce(uri: vscode.Uri, sizeBytes: number, limitBytes: number): void {
    const key = uri.toString();
    if (this.notifiedSize.has(key)) return;
    this.notifiedSize.add(key);

    const sizeKb = (sizeBytes / 1024).toFixed(0);
    const limitKb = (limitBytes / 1024).toFixed(0);

    void vscode.window.showWarningMessage(
      `Params Highlight: "${shortName(uri)}" is ${sizeKb} KB (limit ${limitKb} KB). Highlighting is disabled for this file.`,
      'Open Settings',
    ).then((choice) => {
      if (choice === 'Open Settings') {
        void vscode.commands.executeCommand(
          'workbench.action.openSettings',
          'paramsHighlight.maxFileSize',
        );
      }
    });
  }

  notifyDeep(uri: vscode.Uri, depthLimit: number): void {
    const key = uri.toString();
    if (this.notifiedDepth.has(key)) return;
    this.notifiedDepth.add(key);

    void vscode.window.showWarningMessage(
      `Params Highlight: "${shortName(uri)}" exceeds the parser depth limit (${depthLimit}). Highlighting is disabled for this file.`,
    );
  }

  forget(uri: vscode.Uri): void {
    const key = uri.toString();
    this.notifiedSize.delete(key);
    this.notifiedDepth.delete(key);
  }
}

function shortName(uri: vscode.Uri): string {
  return uri.path.split('/').pop() ?? uri.toString();
}
