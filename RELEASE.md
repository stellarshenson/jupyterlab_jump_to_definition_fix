# Release Notes

## Version 1.0.60 - Initial Release

First public release bringing complete jump-to-definition fix for JupyterLab notebooks using Jedi static analysis in the kernel environment.

**Core Features**:
- Replaces stock LSP `lsp:jump-to-definition` command for Python notebooks
- Jedi static analysis executed directly in kernel's Python environment
- Uses kernel's `sys.path` for accurate module resolution
- Works with packages installed in kernel environment, not requiring them in JupyterLab environment
- Seamless UX - identical keyboard shortcuts (`Ctrl+B` / `Cmd+B`) and menu entries as stock LSP
- Automatic fallback to stock LSP for non-Python notebooks

**Implementation**:
- Frontend collects all notebook cells and calculates absolute cursor position across cells
- Backend provides Jedi introspection code template with `Script.goto(follow_imports=True)`
- Path conversion from absolute filesystem paths to JupyterLab-relative paths
- Kernel CWD-based server root calculation for accurate file opening

**Documentation & Infrastructure**:
- Comprehensive README with implementation details and source code references
- Complete badges (GitHub Actions, npm, PyPI, PyPI downloads, JupyterLab 4, KOLOMOLO)
- GitHub Actions CI/CD workflow (build, test, integration tests, link checking)
- Package metadata with GitHub repository URLs
