import * as vscode from 'vscode';
import { findParameterRanges, DepthLimitExceededError, MAX_DEPTH } from './parser';
import { LargeFileWarning } from './largeFileWarning';
import { sanitizeColor, DEFAULT_COLOR } from './cssColor';

const SUPPORTED_LANGUAGES = new Set([
  'typescript',
  'javascript',
  'typescriptreact',
  'javascriptreact',
]);

const DEFAULT_MAX_FILE_SIZE = 524288;
const HARD_MAX_FILE_SIZE = 5 * 1024 * 1024;

interface StyleSettings {
  color: string;
  italic: boolean;
  bold: boolean;
  maxFileSize: number;
}

export class Decorator implements vscode.Disposable {
  private decorationType: vscode.TextEditorDecorationType;
  private debounceHandles = new WeakMap<vscode.TextDocument, NodeJS.Timeout>();
  private cache = new WeakMap<vscode.TextDocument, { version: number; ranges: vscode.Range[] }>();
  private disposables: vscode.Disposable[] = [];

  constructor(private warning: LargeFileWarning) {
    this.decorationType = createDecorationType(this.readSettings());

    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('paramsHighlight')) {
          this.rebuildDecorationType();
          this.refreshAllVisible();
        }
      }),
      vscode.window.onDidChangeVisibleTextEditors(() => this.refreshAllVisible()),
      vscode.workspace.onDidChangeTextDocument((e) => this.scheduleUpdate(e.document)),
      vscode.workspace.onDidOpenTextDocument((d) => this.scheduleUpdate(d)),
      vscode.workspace.onDidCloseTextDocument((d) => this.warning.forget(d.uri)),
    );

    this.refreshAllVisible();
  }

  dispose(): void {
    this.decorationType.dispose();
    for (const d of this.disposables) d.dispose();
  }

  refreshAllVisible(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.applyNow(editor);
    }
  }

  private scheduleUpdate(document: vscode.TextDocument): void {
    if (!SUPPORTED_LANGUAGES.has(document.languageId)) return;
    const existing = this.debounceHandles.get(document);
    if (existing) clearTimeout(existing);
    const handle = setTimeout(() => {
      this.debounceHandles.delete(document);
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document === document) this.applyNow(editor);
      }
    }, 150);
    this.debounceHandles.set(document, handle);
  }

  private applyNow(editor: vscode.TextEditor): void {
    const document = editor.document;
    if (!SUPPORTED_LANGUAGES.has(document.languageId)) return;

    const settings = this.readSettings();
    const sizeBytes = Buffer.byteLength(document.getText(), 'utf8');
    if (sizeBytes > settings.maxFileSize) {
      editor.setDecorations(this.decorationType, []);
      this.warning.notifyOnce(document.uri, sizeBytes, settings.maxFileSize);
      return;
    }

    const cached = this.cache.get(document);
    let ranges: vscode.Range[];
    if (cached && cached.version === document.version) {
      ranges = cached.ranges;
    } else {
      try {
        const found = findParameterRanges(document.getText(), document.fileName);
        ranges = found.map(
          (r) => new vscode.Range(document.positionAt(r.start), document.positionAt(r.end)),
        );
      } catch (e) {
        if (e instanceof DepthLimitExceededError) {
          this.warning.notifyDeep(document.uri, e.limit);
        } else if (e instanceof RangeError && /call stack/i.test(e.message)) {
          this.warning.notifyDeep(document.uri, MAX_DEPTH);
        }
        ranges = [];
      }
      this.cache.set(document, { version: document.version, ranges });
    }

    editor.setDecorations(this.decorationType, ranges);
  }

  private rebuildDecorationType(): void {
    this.decorationType.dispose();
    this.decorationType = createDecorationType(this.readSettings());
  }

  private readSettings(): StyleSettings {
    const cfg = vscode.workspace.getConfiguration('paramsHighlight');
    const rawSize = cfg.get<number>('maxFileSize', DEFAULT_MAX_FILE_SIZE);
    let size = DEFAULT_MAX_FILE_SIZE;
    if (typeof rawSize === 'number' && Number.isFinite(rawSize) && rawSize > 0) {
      size = Math.min(rawSize, HARD_MAX_FILE_SIZE);
    }
    return {
      color: sanitizeColor(cfg.get<string>('color', DEFAULT_COLOR)),
      italic: cfg.get<boolean>('italic', true) === true,
      bold: cfg.get<boolean>('bold', false) === true,
      maxFileSize: size,
    };
  }
}

function createDecorationType(s: StyleSettings): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    color: s.color,
    fontStyle: s.italic ? 'italic' : undefined,
    fontWeight: s.bold ? 'bold' : undefined,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });
}
