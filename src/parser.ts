import * as ts from 'typescript';

export interface ParamRange {
  start: number;
  end: number;
}

export const MAX_DEPTH = 1000;

export class DepthLimitExceededError extends Error {
  constructor(public readonly limit: number) {
    super(`Params Highlight: parser depth limit (${limit}) exceeded`);
    this.name = 'DepthLimitExceededError';
  }
}

type Binding = 'parameter' | 'local';

class Scope {
  private bindings = new Map<string, Binding>();
  constructor(public parent: Scope | null) {}

  declare(name: string, kind: Binding) {
    this.bindings.set(name, kind);
  }

  lookup(name: string): Binding | undefined {
    return this.bindings.get(name) ?? this.parent?.lookup(name);
  }
}

class ClassContext {
  paramProps = new Set<string>();
}

export function findParameterRanges(source: string, fileName: string): ParamRange[] {
  const scriptKind = pickScriptKind(fileName);
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind,
  );

  const ranges: ParamRange[] = [];
  const root = new Scope(null);
  walk(sourceFile, root, null, ranges, 0);
  return ranges;
}

function pickScriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (fileName.endsWith('.js')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function walk(
  node: ts.Node,
  scope: Scope,
  classCtx: ClassContext | null,
  out: ParamRange[],
  depth: number,
): void {
  if (depth > MAX_DEPTH) throw new DepthLimitExceededError(MAX_DEPTH);
  const next = depth + 1;

  if (isFunctionLike(node)) {
    walkFunction(node, scope, classCtx, out, next);
    return;
  }

  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
    walkClass(node, scope, out, next);
    return;
  }

  if (ts.isBlock(node) || ts.isCaseBlock(node) || ts.isModuleBlock(node)) {
    const child = new Scope(scope);
    node.forEachChild((c) => walk(c, child, classCtx, out, next));
    return;
  }

  if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) {
    const child = new Scope(scope);
    if (ts.isForStatement(node) && node.initializer) walk(node.initializer, child, classCtx, out, next);
    if ((ts.isForInStatement(node) || ts.isForOfStatement(node)) && node.initializer) {
      walk(node.initializer, child, classCtx, out, next);
    }
    if ('condition' in node && node.condition) walk(node.condition, child, classCtx, out, next);
    if ('incrementor' in node && node.incrementor) walk(node.incrementor, child, classCtx, out, next);
    if ('expression' in node && node.expression && !ts.isForStatement(node)) {
      walk(node.expression, child, classCtx, out, next);
    }
    walk(node.statement, child, classCtx, out, next);
    return;
  }

  if (ts.isVariableDeclaration(node)) {
    declareBindingName(node.name, scope, 'local');
    if (node.initializer) walk(node.initializer, scope, classCtx, out, next);
    return;
  }

  if (ts.isFunctionDeclaration(node) && node.name) {
    scope.declare(node.name.text, 'local');
  }

  if (ts.isShorthandPropertyAssignment(node)) {
    maybeMark(node.name, scope, out);
    if (node.objectAssignmentInitializer) walk(node.objectAssignmentInitializer, scope, classCtx, out, next);
    return;
  }

  if (ts.isPropertyAssignment(node)) {
    walk(node.initializer, scope, classCtx, out, next);
    return;
  }

  if (ts.isPropertyAccessExpression(node)) {
    walk(node.expression, scope, classCtx, out, next);
    if (
      node.expression.kind === ts.SyntaxKind.ThisKeyword &&
      ts.isIdentifier(node.name) &&
      classCtx &&
      classCtx.paramProps.has(node.name.text)
    ) {
      out.push({ start: node.name.getStart(), end: node.name.getEnd() });
    }
    return;
  }

  if (ts.isQualifiedName(node)) {
    walk(node.left, scope, classCtx, out, next);
    return;
  }

  if (ts.isJsxAttribute(node)) {
    if (node.initializer) walk(node.initializer, scope, classCtx, out, next);
    return;
  }

  if (ts.isImportSpecifier(node) || ts.isExportSpecifier(node)) {
    return;
  }

  if (ts.isIdentifier(node)) {
    if (isExpressionPosition(node)) {
      maybeMark(node, scope, out);
    }
    return;
  }

  node.forEachChild((c) => walk(c, scope, classCtx, out, next));
}

function walkClass(
  node: ts.ClassDeclaration | ts.ClassExpression,
  scope: Scope,
  out: ParamRange[],
  depth: number,
): void {
  if (depth > MAX_DEPTH) throw new DepthLimitExceededError(MAX_DEPTH);

  if (node.name) scope.declare(node.name.text, 'local');

  const classCtx = new ClassContext();
  for (const member of node.members) {
    if (ts.isConstructorDeclaration(member)) {
      for (const param of member.parameters) {
        if (isParameterProperty(param) && ts.isIdentifier(param.name)) {
          classCtx.paramProps.add(param.name.text);
        }
      }
    }
  }

  if (node.heritageClauses) {
    for (const h of node.heritageClauses) walk(h, scope, null, out, depth + 1);
  }
  for (const member of node.members) {
    walk(member, scope, classCtx, out, depth + 1);
  }
}

function walkFunction(
  node: ts.SignatureDeclaration,
  parent: Scope,
  classCtx: ClassContext | null,
  out: ParamRange[],
  depth: number,
): void {
  if (depth > MAX_DEPTH) throw new DepthLimitExceededError(MAX_DEPTH);

  const fnScope = new Scope(parent);

  const inheritsThis =
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node);
  const innerCtx = inheritsThis ? classCtx : null;

  for (const param of node.parameters) {
    declareBindingName(param.name, fnScope, 'parameter');
    markBindingName(param.name, out);
    if (param.initializer) walk(param.initializer, fnScope, innerCtx, out, depth + 1);
  }

  const body = (node as ts.FunctionLikeDeclaration).body;
  if (body) {
    if (ts.isBlock(body)) {
      body.forEachChild((c) => walk(c, fnScope, innerCtx, out, depth + 1));
    } else {
      walk(body, fnScope, innerCtx, out, depth + 1);
    }
  }
}

function isParameterProperty(param: ts.ParameterDeclaration): boolean {
  const modifiers = ts.canHaveModifiers(param) ? ts.getModifiers(param) : undefined;
  if (!modifiers) return false;
  for (const m of modifiers) {
    if (
      m.kind === ts.SyntaxKind.PublicKeyword ||
      m.kind === ts.SyntaxKind.PrivateKeyword ||
      m.kind === ts.SyntaxKind.ProtectedKeyword ||
      m.kind === ts.SyntaxKind.ReadonlyKeyword ||
      m.kind === ts.SyntaxKind.OverrideKeyword
    ) {
      return true;
    }
  }
  return false;
}

function declareBindingName(name: ts.BindingName, scope: Scope, kind: Binding): void {
  if (ts.isIdentifier(name)) {
    scope.declare(name.text, kind);
    return;
  }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const elem of name.elements) {
      if (ts.isBindingElement(elem)) {
        declareBindingName(elem.name, scope, kind);
      }
    }
  }
}

function markBindingName(name: ts.BindingName, out: ParamRange[]): void {
  if (ts.isIdentifier(name)) {
    out.push({ start: name.getStart(), end: name.getEnd() });
    return;
  }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const elem of name.elements) {
      if (ts.isBindingElement(elem)) {
        markBindingName(elem.name, out);
      }
    }
  }
}

function maybeMark(id: ts.Identifier, scope: Scope, out: ParamRange[]): void {
  if (scope.lookup(id.text) === 'parameter') {
    out.push({ start: id.getStart(), end: id.getEnd() });
  }
}

function isExpressionPosition(id: ts.Identifier): boolean {
  const parent = id.parent;
  if (!parent) return false;

  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false;
  if (ts.isQualifiedName(parent) && parent.right === id) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === id) return false;
  if (ts.isMethodDeclaration(parent) && parent.name === id) return false;
  if (ts.isPropertyDeclaration(parent) && parent.name === id) return false;
  if (ts.isGetAccessorDeclaration(parent) && parent.name === id) return false;
  if (ts.isSetAccessorDeclaration(parent) && parent.name === id) return false;
  if (ts.isEnumMember(parent) && parent.name === id) return false;
  if (ts.isImportSpecifier(parent)) return false;
  if (ts.isExportSpecifier(parent)) return false;
  if (ts.isImportClause(parent) && parent.name === id) return false;
  if (ts.isNamespaceImport(parent)) return false;
  if (ts.isImportEqualsDeclaration(parent) && parent.name === id) return false;
  if (ts.isJsxAttribute(parent) && parent.name === id) return false;
  if (ts.isJsxOpeningElement(parent) && parent.tagName === id) return false;
  if (ts.isJsxClosingElement(parent) && parent.tagName === id) return false;
  if (ts.isJsxSelfClosingElement(parent) && parent.tagName === id) return false;
  if (ts.isLabeledStatement(parent) && parent.label === id) return false;
  if (ts.isBreakOrContinueStatement(parent) && parent.label === id) return false;
  if (ts.isTypeReferenceNode(parent)) return false;
  if (ts.isTypeQueryNode(parent)) return false;
  if (ts.isTypePredicateNode(parent) && parent.parameterName === id) return false;
  if (ts.isInterfaceDeclaration(parent) && parent.name === id) return false;
  if (ts.isTypeAliasDeclaration(parent) && parent.name === id) return false;
  if (ts.isEnumDeclaration(parent) && parent.name === id) return false;
  if (ts.isClassDeclaration(parent) && parent.name === id) return false;
  if (ts.isClassExpression(parent) && parent.name === id) return false;
  if (ts.isFunctionDeclaration(parent) && parent.name === id) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === id) return false;
  if (ts.isParameter(parent) && parent.name === id) return false;
  if (ts.isBindingElement(parent) && (parent.name === id || parent.propertyName === id)) return false;
  if (ts.isModuleDeclaration(parent) && parent.name === id) return false;

  return true;
}

function isFunctionLike(node: ts.Node): node is ts.SignatureDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}
