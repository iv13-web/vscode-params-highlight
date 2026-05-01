import * as vscode from 'vscode';
import { sanitizeColor, isSafeCssColor, DEFAULT_COLOR } from './cssColor';

interface PanelState {
  color: string;
  italic: boolean;
  bold: boolean;
}

export class ConfigPanel {
  private static current: ConfigPanel | undefined;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static show(): void {
    if (ConfigPanel.current) {
      ConfigPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'paramsHighlight.configure',
      'Params Highlight: Style',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      },
    );
    ConfigPanel.current = new ConfigPanel(panel);
  }

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.webview.html = this.render(this.readState());

    this.disposables.push(
      this.panel.onDidDispose(() => this.dispose()),
      this.panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg)),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('paramsHighlight')) {
          this.panel.webview.postMessage({ type: 'state', state: this.readState() });
        }
      }),
    );
  }

  private dispose(): void {
    ConfigPanel.current = undefined;
    for (const d of this.disposables) d.dispose();
    this.panel.dispose();
  }

  private async onMessage(msg: unknown): Promise<void> {
    if (!msg || typeof msg !== 'object') return;
    const m = msg as { type?: unknown; state?: unknown };
    if (m.type === 'apply' && m.state && typeof m.state === 'object') {
      const incoming = m.state as { color?: unknown; italic?: unknown; bold?: unknown };
      if (!isSafeCssColor(incoming.color)) {
        void vscode.window.showErrorMessage(
          'Params Highlight: rejected invalid color value.',
        );
        return;
      }
      const cfg = vscode.workspace.getConfiguration('paramsHighlight');
      await cfg.update('color', incoming.color, vscode.ConfigurationTarget.Global);
      await cfg.update('italic', incoming.italic === true, vscode.ConfigurationTarget.Global);
      await cfg.update('bold', incoming.bold === true, vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage('Params Highlight: style applied.');
    } else if (m.type === 'reset') {
      const cfg = vscode.workspace.getConfiguration('paramsHighlight');
      await cfg.update('color', undefined, vscode.ConfigurationTarget.Global);
      await cfg.update('italic', undefined, vscode.ConfigurationTarget.Global);
      await cfg.update('bold', undefined, vscode.ConfigurationTarget.Global);
      this.panel.webview.postMessage({ type: 'state', state: this.readState() });
    }
  }

  private readState(): PanelState {
    const cfg = vscode.workspace.getConfiguration('paramsHighlight');
    return {
      color: sanitizeColor(cfg.get<string>('color', DEFAULT_COLOR)),
      italic: cfg.get<boolean>('italic', true) === true,
      bold: cfg.get<boolean>('bold', false) === true,
    };
  }

  private render(state: PanelState): string {
    const nonce = makeNonce();
    const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
    const initial = jsonForScriptTag(state);

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Params Highlight</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 24px;
    line-height: 1.5;
  }
  h1 { font-size: 1.2em; margin-top: 0; }
  .row { display: flex; align-items: center; gap: 12px; margin: 12px 0; }
  label { min-width: 120px; }
  input[type="color"] {
    width: 48px; height: 32px; border: 1px solid var(--vscode-input-border, transparent);
    background: transparent; cursor: pointer; padding: 0;
  }
  input[type="text"] {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 4px 8px; font-family: var(--vscode-editor-font-family); width: 110px;
  }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; padding: 6px 14px; cursor: pointer;
    font-family: inherit;
  }
  button.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  .preview {
    margin-top: 20px;
    border: 1px solid var(--vscode-panel-border, #444);
    border-radius: 4px;
    padding: 16px;
    background: var(--vscode-editor-background);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    white-space: pre;
    overflow-x: auto;
  }
  .kw  { color: var(--vscode-symbolIcon-keywordForeground, #569cd6); }
  .fn  { color: var(--vscode-symbolIcon-functionForeground, #dcdcaa); }
  .str { color: var(--vscode-symbolIcon-stringForeground, #ce9178); }
  .com { color: var(--vscode-symbolIcon-textForeground, #6a9955); font-style: italic; }
  .pun { color: var(--vscode-foreground); }
  .param { /* live-styled via JS */ }
  .actions { margin-top: 20px; display: flex; gap: 8px; }
</style>
</head>
<body>
  <h1>Params Highlight — Style</h1>

  <div class="row">
    <label for="color">Color</label>
    <input type="color" id="color" value="${escapeAttr(state.color)}">
    <input type="text" id="colorText" value="${escapeAttr(state.color)}">
  </div>

  <div class="row">
    <label for="italic">Italic</label>
    <input type="checkbox" id="italic" ${state.italic ? 'checked' : ''}>
  </div>

  <div class="row">
    <label for="bold">Bold</label>
    <input type="checkbox" id="bold" ${state.bold ? 'checked' : ''}>
  </div>

  <div class="preview" id="preview"><span class="kw">function</span> <span class="fn">greet</span><span class="pun">(</span><span class="param">name</span><span class="pun">,</span> <span class="param">greeting</span> <span class="pun">=</span> <span class="str">'Hello'</span><span class="pun">) {</span>
  <span class="kw">const</span> message <span class="pun">= \`\${</span><span class="param">greeting</span><span class="pun">}, \${</span><span class="param">name</span><span class="pun">}!\`;</span>
  <span class="kw">return</span> <span class="pun">{ </span><span class="param">name</span><span class="pun">, </span><span class="param">greeting</span><span class="pun">, message };</span>
<span class="pun">}</span></div>

  <div class="actions">
    <button id="apply">Apply</button>
    <button id="reset" class="secondary">Reset to defaults</button>
  </div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const initial = ${initial};
  const colorEl = document.getElementById('color');
  const colorTextEl = document.getElementById('colorText');
  const italicEl = document.getElementById('italic');
  const boldEl = document.getElementById('bold');
  const preview = document.getElementById('preview');

  function readForm() {
    return {
      color: colorTextEl.value || colorEl.value,
      italic: italicEl.checked,
      bold: boldEl.checked,
    };
  }

  function paint(state) {
    const params = preview.querySelectorAll('.param');
    for (const p of params) {
      p.style.color = state.color;
      p.style.fontStyle = state.italic ? 'italic' : 'normal';
      p.style.fontWeight = state.bold ? 'bold' : 'normal';
    }
  }

  function setForm(state) {
    if (/^#[0-9a-fA-F]{6}$/.test(state.color)) colorEl.value = state.color;
    colorTextEl.value = state.color;
    italicEl.checked = state.italic;
    boldEl.checked = state.bold;
    paint(state);
  }

  colorEl.addEventListener('input', () => { colorTextEl.value = colorEl.value; paint(readForm()); });
  colorTextEl.addEventListener('input', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(colorTextEl.value)) colorEl.value = colorTextEl.value;
    paint(readForm());
  });
  italicEl.addEventListener('change', () => paint(readForm()));
  boldEl.addEventListener('change', () => paint(readForm()));

  document.getElementById('apply').addEventListener('click', () => {
    vscode.postMessage({ type: 'apply', state: readForm() });
  });
  document.getElementById('reset').addEventListener('click', () => {
    vscode.postMessage({ type: 'reset' });
  });

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'state') setForm(e.data.state);
  });

  setForm(initial);
</script>
</body>
</html>`;
  }
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function jsonForScriptTag(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
