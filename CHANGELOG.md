# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

<!-- <END NEW CHANGELOG ENTRY> -->

## v1.0.69

- Fixed the extension build under PEP 517 isolation and CI: `build:labextension` now uses the `jupyter-builder` CLI instead of `jupyter labextension build`, which required the full jupyterlab package and failed with `ModuleNotFoundError: No module named 'jupyterlab'`
- Migrated the lint toolchain to eslint 9 flat config (eslint 9, `typescript-eslint`, `@jupyter/eslint-plugin`) to match extension-template v4.6.2
- Documented in-notebook navigation and the server-side `in_notebook` flag in the README

## v1.0.68

- Fixed in-notebook jump-to-definition 404: Jedi doubled the notebook's own directory when the kernel cwd equalled it, producing a path the contents API could not open
- Fixed cursor landing on the wrong cell for definitions resolved within the notebook
- In-notebook definitions are now detected server-side (in-kernel, so cwd-independent) and navigated in place via the notebook API instead of reconstructing a path and reopening the file
- Switched `tsconfig.json` `moduleResolution` from node to bundler so `@jupyterlab/lsp` type declarations resolve during build
- Adopted canonical Makefile v1.32 (project-local `.nodeenv`)
- Updated to jupyterlab extension-template v4.6.2

## v1.0.60

- Comprehensive README with badges (GitHub Actions, npm, PyPI, PyPI downloads, JupyterLab 4, KOLOMOLO)
- GitHub Actions CI/CD workflow (build, test, integration tests, link checking)
- Fix Implementation Details section documenting frontend and backend components
- Updated package metadata with GitHub repository URLs

## v0.9.57

- Replaced stock LSP `lsp:jump-to-definition` command for Python notebooks
- Seamless UX with identical keyboard shortcuts and menu entries
- Automatic fallback to stock LSP for non-Python notebooks
- Preserved original command icon and label
- Removed debug logging for production

## v0.9.42

- Jedi static analysis implementation executed in kernel environment
- Frontend collects all notebook cells and calculates absolute cursor position
- Backend provides Jedi introspection code template with `Script.goto(follow_imports=True)`
- Path conversion from absolute filesystem paths to JupyterLab-relative paths
- Kernel CWD-based server root calculation

## v0.1.x

- Initial kernel introspection implementation using Python `inspect` module
- Custom command `notebook:jump-to-definition-kernel` with `Ctrl+B` keyboard shortcut
- Namespace resolution via `sys.modules['__main__'].__dict__`
- Basic jump-to-definition for executed symbols in kernel environment
