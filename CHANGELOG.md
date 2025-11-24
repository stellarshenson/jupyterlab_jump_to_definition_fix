# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

<!-- <END NEW CHANGELOG ENTRY> -->

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
