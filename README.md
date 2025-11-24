# jupyterlab_jump_to_definition_fix

[![GitHub Actions](https://github.com/stellarshenson/jupyterlab_jump_to_definition_fix/actions/workflows/build.yml/badge.svg)](https://github.com/stellarshenson/jupyterlab_jump_to_definition_fix/actions/workflows/build.yml)
[![npm version](https://img.shields.io/npm/v/jupyterlab_jump_to_definition_fix.svg)](https://www.npmjs.com/package/jupyterlab_jump_to_definition_fix)
[![PyPI version](https://img.shields.io/pypi/v/jupyterlab-jump-to-definition-fix.svg)](https://pypi.org/project/jupyterlab-jump-to-definition-fix/)
[![Total PyPI downloads](https://static.pepy.tech/badge/jupyterlab-jump-to-definition-fix)](https://pepy.tech/project/jupyterlab-jump-to-definition-fix)
[![JupyterLab 4](https://img.shields.io/badge/JupyterLab-4-orange.svg)](https://jupyterlab.readthedocs.io/en/stable/)
[![Brought To You By KOLOMOLO](https://img.shields.io/badge/Brought%20To%20You%20By-KOLOMOLO-00ffff?style=flat)](https://kolomolo.com)

JupyterLab extension that fixes "jump to definition" functionality for notebooks using Jedi static analysis in the kernel environment. This allows jumping to source code definitions for packages installed in the notebook's kernel, even if those packages are not installed in JupyterLab's own environment.

> [!WARNING]
> This extension is a temporary fix until the [jupyterlab-lsp](https://github.com/jupyter-lsp/jupyterlab-lsp) project implements native support for kernel-aware jump-to-definition. Track the upstream issue: [jupyter-lsp/jupyterlab-lsp#1096](https://github.com/jupyter-lsp/jupyterlab-lsp/issues/1096). Once merged and released, this extension will be deprecated.

## The Problem

JupyterLab's built-in LSP "jump to definition" only works for packages installed in the same Python environment as JupyterLab itself. Notebooks often run with kernels in different environments (conda envs, virtual envs, containers) where packages are actually installed, making the stock LSP functionality useless for kernel-installed packages.

## The Fix

This extension replaces the stock LSP "jump to definition" command for Python notebooks with a Jedi-based implementation that runs in the kernel's Python environment.

**How it works**:

- Executes Jedi static analysis directly in the notebook's kernel
- Uses kernel's `sys.path` for module resolution, finding packages installed in kernel environment
- Analyzes all notebook cells as concatenated source to understand full context
- Converts absolute filesystem paths to JupyterLab-relative paths for file opening
- Seamlessly overrides stock LSP command - same keyboard shortcut, same menu entry

**Implementation details**:

- Frontend: Collects all code cell sources, calculates cursor position across cells, sends to kernel
- Backend: Provides Jedi introspection code template executed in kernel
- Jedi: Runs `Script.goto()` with `follow_imports=True` using kernel's module search paths
- Path resolution: Calculates server root from kernel CWD and notebook path

## Fix Implementation Details

The extension consists of frontend TypeScript code and backend Python code working together to provide kernel-aware jump-to-definition.

**Frontend Implementation** (`src/index.ts`):

- **Command Registration**: `app.commands.addCommand(commandId)` creates `notebook:jump-to-definition-kernel` command that collects notebook context and executes Jedi analysis
- **Cell Source Collection**: Command execute function iterates through `notebook.content.widgets`, concatenates code cell sources, and calculates absolute cursor position accounting for multi-cell structure. Jedi requires 1-based line numbers
- **Kernel Execution**: `kernel.requestExecute()` sends Jedi introspection code to kernel, `future.onIOPub` handler captures stdout (JSON result) while filtering stderr (debug logs)
- **Path Conversion**: Secondary kernel execution gets CWD via `os.getcwd()`, calculates JupyterLab server root from notebook path, converts absolute filesystem paths to server-relative paths for `docManager.openOrReveal()`
- **Stock LSP Override**: `overrideLSPCommand()` function dynamically intercepts `lsp:jump-to-definition` command when it loads, preserves original icon and label, routes Python notebooks to Jedi implementation while delegating others to stock LSP

**Backend Implementation** (`jupyterlab_jump_to_definition_fix/routes.py`):

- **Introspection Code Template**: `IntrospectionCodeHandler.get()` method provides Python code template executed in kernel environment that imports Jedi, creates `jedi.Project` with kernel's `sys.path`, runs `Script.goto()` with `follow_imports=True`, and returns JSON with file path and line number
- **API Handler**: Route registered at `/jupyterlab_jump_to_definition_fix/introspection-code` endpoint serves template to frontend

**Key Implementation Components**:

- `jedi.Project(path=notebook_path, sys_path=sys.path)`: Creates Jedi project using kernel's module search paths for accurate resolution
- `jedi.Script(...).goto(follow_imports=True)`: Performs static analysis to find symbol definitions, following import chains
- `kernel.requestExecute()`: Executes Jedi code in kernel's Python environment where target packages are installed
- IOPub message filtering: Separates stdout (JSON result) from stderr (debug output) for clean parsing
- Path calculation: `kernelCwd.endsWith(notebookDir)` logic strips server root from absolute paths

## Features

- **Replaces stock LSP**: Overrides `lsp:jump-to-definition` command for Python notebooks
- **Kernel-aware**: Uses kernel's Python environment and `sys.path` for module resolution
- **Static analysis**: Jedi finds definitions without requiring code execution
- **Same UX**: Identical keyboard shortcut (`Ctrl+B` / `Cmd+B`) and menu entries as stock LSP
- **Automatic fallback**: Delegates to stock LSP for non-Python notebooks

## Usage

1. Open a Jupyter notebook with a Python kernel
2. Place your cursor on or select a symbol (function name, class name, module attribute, etc.)
3. Press `Ctrl+B` (or `Cmd+B` on Mac), or run "Jump to Definition (Kernel Context)" from the command palette
4. The source file will open at the definition location

**Examples of symbols you can jump to:**

- Module: `numpy` or `pandas`
- Function: `np.array`, `pd.DataFrame`
- Method: `MyClass.my_method`
- Nested attributes: `sklearn.ensemble.RandomForestClassifier`

This extension is composed of a Python package named `jupyterlab_jump_to_definition_fix`
for the server extension and a NPM package named `jupyterlab_jump_to_definition_fix`
for the frontend extension.

## Requirements

- JupyterLab >= 4.0.0
- Python kernel (IPython/ipykernel)

## Install

To install the extension, execute:

```bash
pip install jupyterlab_jump_to_definition_fix
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyterlab_jump_to_definition_fix
```
