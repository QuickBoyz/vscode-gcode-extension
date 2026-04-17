# Issue #138 External Research Brief

## 1. vscode.workspace.findFiles(include, exclude) Semantics

**Return type & behavior**: Returns `Promise<Uri[]>` — batched, not streaming. All results collected before promise resolves.

**Exclude parameter**:

- Type: `string` (glob pattern) or `undefined`
- When `undefined`: VS Code applies default excludes (typically node_modules, .git, etc.)
- When explicit: Override defaults — provide full exclude pattern
- **Critical**: `findFiles()` does NOT automatically read `files.exclude` or `search.exclude` from workspace settings. Client must construct exclude glob from config values manually

**RelativePattern support**: Both `include` and `exclude` accept `RelativePattern` type (`{ baseUri, pattern }`), allowing per-workspace-folder scans. Essential for multi-root workspaces.

**Edge cases**:

- **Inconsistency with user excludes** (GitHub issue #151211): `findFiles()` may return files that `search.exclude` should hide (e.g., .md in node_modules). Behavior varies across VS Code versions
- **Symlinks**: Not followed by default; symlink targets excluded
- **Hidden files**: `.` prefixed files included unless explicitly excluded via pattern
- **Max results**: No built-in limit; cancellation via `CancellationToken` supported (second parameter: `findFiles(include, exclude, maxResults?, token?)`)

**For #138**: Client must merge `files.exclude` + `search.exclude` config, pass as explicit glob to `findFiles()`, and handle version-dependent inconsistencies via testing.

---

## 2. LSP Custom RequestType Conventions

**Declaration pattern** (vscode-languageserver):

```typescript
const CustomRequest = new RequestType<Params, Result, Error>('workspace/enumerateFiles');

// Server handler
connection.onRequest(CustomRequest, (params: Params): Result => {
  return { files: [...] };
});

// Client invocation (vscode-languageclient)
const result = await client.sendRequest(CustomRequest, params);
```

**Naming conventions**:

- Standard pattern: `<domain>/<operation>` (e.g., `workspace/enumerateFiles`, `document/semanticTokens`)
- Experimental requests: No `$/` prefix required (that's for notifications only); instead declare under `experimental` capability
- Avoid collisions with LSP built-in methods

**Experimental capability declaration**:

```typescript
// Server side (InitializeResult.capabilities)
{
  experimental: {
    "workspace/enumerateFiles": { supportsExclude: true }
  }
}

// Client side (ClientCapabilities)
{
  experimental: {
    "workspace/enumerateFiles": true
  }
}
```

**Performance**: Custom requests use same JSON-RPC machinery as built-ins; no performance penalty. Ideal for custom FS operations where standard LSP endpoints insufficient.

---

## 3. WorkDoneProgress Handoff: Client Creates Token, Passes to Server

**Pattern** (confirmed LSP 3.17):

Client generates UUID, includes in request parameters:

```typescript
// Client side
const token = generateUUID(); // e.g., "550e8400-e29b-41d4-a716-446655440000"
const result = await client.sendRequest(CustomRequest, {
  folders: [...],
  workDoneToken: token  // Client provides token
});

// Server side
connection.onRequest(CustomRequest, (params: Params, token?: ProgressToken) => {
  // Use token directly via $/progress notification
  connection.sendProgress(WorkDoneProgress.type, token, { kind: 'begin', ... });
  // ... do work ...
  connection.sendProgress(WorkDoneProgress.type, token, { kind: 'report', ... });
  connection.sendProgress(WorkDoneProgress.type, token, { kind: 'end' });
});
```

**Key advantage**: No `window/workDoneProgress/create` round-trip from server. Simpler, lower-latency progress reporting. Server capability declaration optional; client capability `window.workDoneProgress` sufficient.

---

## 4. files.exclude vs search.exclude Semantics

| Setting          | Scope                  | Effect                                                                      |
| ---------------- | ---------------------- | --------------------------------------------------------------------------- |
| `files.exclude`  | Global file operations | Hides from explorer, file picker, file watching, _and_ search               |
| `search.exclude` | Search only            | Additional exclusion layer for search-in-files; superset of `files.exclude` |

**Practical**: `search.exclude` is always more restrictive. For indexing files (which mimics search behavior), union both: exclude glob = `files.exclude ∪ search.exclude`.

**Pattern format**: Both use glob syntax; OS case-sensitivity rules apply (case-insensitive Windows/macOS, case-sensitive Linux).

---

## 5. Prior Art

**Deno LSP**: Uses custom `deno/virtualTextDocument` request for LSP-side FS access; client handles workspace enumeration separately via VS Code API.

**rust-analyzer**: Declarative manifest for workspace indexing; no custom requests for FS enumeration (server scans server-side).

**TypeScript LSP**: Delegates file discovery to client via LSP `workspace/didChangeWatchedFiles` notifications; no custom enumeration request.

**Pattern**: Client-side enumeration via `findFiles()` + custom request for index updates is a modern, explicit pattern. Fewer LSP-version compatibility issues than server-side scanning.

---

## Sources

- [VS Code Workspace Semantics Issue #151211](https://github.com/microsoft/vscode/issues/151211)
- [VS Code findFiles API Reference](https://code.visualstudio.com/api/references/vscode-api#workspace.findFiles)
- [Language Server Protocol 3.17 Specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)
- [vscode-languageserver RequestType Documentation](https://github.com/Microsoft/vscode-languageserver-node)
- [WorkDoneProgress Specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#workDoneProgress)
