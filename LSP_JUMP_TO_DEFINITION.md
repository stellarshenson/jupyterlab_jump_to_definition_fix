# LSP Jump-to-Definition Flow Analysis

## Stock LSP Implementation

The standard JupyterLab LSP jump-to-definition uses **static code analysis** via the Jedi library, not runtime execution.

### Flow Diagram

```
┌─────────────┐
│   User      │
│  Ctrl+B on  │
│   symbol    │
└──────┬──────┘
       │
       v
┌─────────────────────────────┐
│  @jupyterlab/lsp (Frontend) │
│  - Detects cursor position  │
│  - Sends LSP request via WS │
└──────┬──────────────────────┘
       │ WebSocket
       │ textDocument/definition
       v
┌──────────────────────────────┐
│  jupyter-lsp (Server)        │
│  - Routes to pylsp           │
└──────┬───────────────────────┘
       │
       v
┌───────────────────────────────────┐
│  pylsp (Python LSP Server)        │
│  plugins/definition.py            │
│  - Creates Jedi Script            │
│  - Calls script.goto()            │
└──────┬────────────────────────────┘
       │
       v
┌────────────────────────────────────────┐
│  Jedi (Static Analysis Library)       │
│  - Parses notebook source (AST)       │
│  - Finds import statement for symbol  │
│  - Resolves module using Project      │
│    sys_path                            │
└──────┬─────────────────────────────────┘
       │
       v
┌──────────────────────────────────────┐
│  Jedi Environment Resolution         │
│  workspace.py:get_enviroment()       │
│  - Uses configured environment_path  │
│  - OR uses default Python env        │
│  - Gets environment.get_sys_path()   │
└──────┬───────────────────────────────┘
       │
       v
┌──────────────────────────────────────┐
│  Module Location                     │
│  - Searches sys_path for module      │
│  - Finds source file                 │
│  - Returns file path + line number   │
└──────┬───────────────────────────────┘
       │
       v
┌──────────────────────────────┐
│  Frontend Opens File         │
│  - Receives location URI     │
│  - Opens in JupyterLab       │
└──────────────────────────────┘
```

### Key Code Paths

**Frontend Request** (`@jupyterlab/lsp`):
- `node_modules/@jupyterlab/lsp/src/connection.ts` - Sends LSP `textDocument/definition` request via WebSocket

**Backend Handler** (`jupyter-lsp`):
- `/opt/conda/lib/python3.12/site-packages/jupyter_lsp/handlers.py` - WebSocket endpoint
- Routes to language server process (pylsp)

**Definition Plugin** (`pylsp`):
- `/opt/conda/lib/python3.12/site-packages/pylsp/plugins/definition.py`:
  ```python
  script = document.jedi_script(use_document_path=True)
  definitions = script.goto(
      follow_imports=True,
      follow_builtin_imports=True,
      **code_position
  )
  ```

**Jedi Script Creation** (`pylsp`):
- `/opt/conda/lib/python3.12/site-packages/pylsp/workspace.py`:
  ```python
  def jedi_script(self, position=None, use_document_path=False):
      environment_path = jedi_settings.get("environment")  # Can point to kernel env
      environment = self.get_enviroment(environment_path, env_vars=env_vars)
      sys_path = self.sys_path(environment_path, env_vars, ...)

      return jedi.Script(
          code=self.source,
          path=self.path,
          environment=environment if environment_path else None,
          project=jedi.Project(path=project_path, sys_path=sys_path)
      )
  ```

**Environment Resolution**:
```python
def get_enviroment(self, environment_path=None, env_vars=None):
    if environment_path is None:
        environment = jedi.api.environment.get_cached_default_environment()
    else:
        environment = jedi.api.environment.create_environment(
            path=environment_path, safe=False, env_vars=env_vars
        )
    return environment
```

### Critical Configuration: Jedi Environment

The key to cross-environment symbol resolution is the `jedi.environment` configuration in pylsp settings.

**Default Behavior** (without configuration):
- Jedi uses JupyterLab's Python environment
- Can only resolve modules installed in that environment
- Fails for kernel-only packages

**Configured Behavior** (with `jedi.environment`):
- Jedi uses specified Python environment path (e.g., `/opt/conda/envs/my-kernel/bin/python`)
- Resolves modules installed in that environment
- Enables jump-to-definition for kernel-only packages

### Configuration Method

Edit `~/.jupyter/jupyter_lsp_config.py` or workspace settings:

```python
c.LanguageServerManager.language_servers = {
    "pylsp": {
        "serverSettings": {
            "pylsp": {
                "plugins": {
                    "jedi": {
                        "environment": "/opt/conda/envs/hk-cpfm/bin/python"
                    }
                }
            }
        }
    }
}
```

Or via JupyterLab settings UI:
- Settings → Language Server → Python Language Server
- Set `jedi.environment` to kernel's Python path

### Why "Empty Husk" Packages Work

When a package is installed in JupyterLab's environment as an "empty husk":
- The package name exists in JupyterLab's sys.path
- But it may be an **editable install** (`pip install -e /path/to/source`)
- Jedi follows the package metadata to the actual source location
- If both environments can access the same filesystem, Jedi finds the source

This works because:
1. Python's `importlib.util.find_spec('package')` returns a spec with the source location
2. Editable installs contain a `.pth` file or `__path__` pointing to the real source
3. Jedi reads this metadata and navigates to the actual files

## Alternative: Kernel-Based Introspection

The `jupyterlab_jump_to_definition_fix` extension takes a different approach by executing introspection code **in the kernel's Python environment**:

### Flow Diagram

```
┌─────────────┐
│   User      │
│  Ctrl+B on  │
│   symbol    │
└──────┬──────┘
       │
       v
┌────────────────────────────────────┐
│  jupyterlab_jump_to_definition_fix │
│  src/index.ts (Frontend)           │
│  - Extracts symbol under cursor    │
│  - Fetches introspection code      │
└──────┬─────────────────────────────┘
       │
       │ HTTP GET
       │ /jupyterlab-jump-to-definition-fix/introspection-code
       v
┌───────────────────────────────────────┐
│  routes.py (Backend)                  │
│  - Returns Python introspection code  │
│  - Template with __SYMBOL__ placeholder│
└──────┬────────────────────────────────┘
       │
       v
┌────────────────────────────────────────┐
│  Frontend (src/index.ts)               │
│  - Replaces __SYMBOL__ with actual name│
│  - Executes code in notebook kernel   │
│  - kernel.requestExecute()             │
└──────┬─────────────────────────────────┘
       │
       │ Jupyter Kernel Protocol
       │ execute_request
       v
┌─────────────────────────────────────────────┐
│  Notebook Kernel (e.g., conda env hk-cpfm) │
│  - Executes introspection code             │
│  - Uses kernel's sys.modules               │
│  - Uses kernel's sys.path                  │
│  - inspect.getsourcefile(obj)              │
│  - inspect.getsourcelines(obj)             │
└──────┬──────────────────────────────────────┘
       │
       │ IOPub stream message
       │ JSON: {file: "...", line: N}
       v
┌──────────────────────────────┐
│  Frontend Parses Result      │
│  - Extracts file path + line │
│  - Opens in JupyterLab       │
│  - docManager.openOrReveal() │
└──────────────────────────────┘
```

### Advantages

**Kernel-based approach**:
- **No configuration needed** - automatically uses kernel's environment
- **Always accurate** - resolves exactly what the kernel sees
- **Works with any environment** - conda, venv, docker, remote kernels
- **Runtime resolution** - can inspect dynamically imported modules

**LSP approach**:
- **Faster** - no kernel execution overhead
- **Works without kernel** - available immediately on file open
- **More features** - hover, completion, refactoring all use same infrastructure
- **Requires configuration** - must point Jedi to correct environment OR install stub packages

### Current Issue with Kernel Approach

The implementation searches `sys.modules` (already-imported modules) and `globals()` (user namespace), but if the cell with the import hasn't been executed yet, the module isn't available.

**Solution approaches**:
1. Parse import statements from notebook cells (static analysis like LSP)
2. Execute the import cell automatically before lookup
3. Hybrid: Try runtime first, fall back to AST parsing of imports

## Comparison

| Feature | Stock LSP (Jedi) | Kernel Introspection |
|---------|------------------|---------------------|
| Analysis Method | Static (AST) | Runtime (exec) |
| Environment | Configured or default | Always kernel's |
| Configuration | Requires setup | Zero config |
| Speed | Fast | Slower (kernel exec) |
| Unexecuted cells | Works | Requires execution |
| Dynamic imports | Limited | Full support |
| Cross-env support | Via config or stubs | Automatic |
