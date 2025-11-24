import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado


class HelloRouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({
            "data": (
                "Hello, world!"
                " This is the '/jupyterlab-jump-to-definition-fix/hello' endpoint."
                " Try visiting me in your browser!"
            ),
        }))


class IntrospectionCodeHandler(APIHandler):
    """Provides the Python introspection code to be executed in kernels"""

    @tornado.web.authenticated
    def get(self):
        self.log.info("IntrospectionCodeHandler: GET request received")
        # Use Jedi for static analysis in kernel's environment
        introspection_code = """
import sys
import json

_result = {'file': None, 'line': None, 'error': None}

try:
    # Import Jedi
    try:
        import jedi
    except ImportError:
        _result['error'] = 'Jedi not installed in kernel environment. Install with: pip install jedi'
        print(json.dumps(_result))
        raise SystemExit

    # Parameters from frontend
    _notebook_source = __NOTEBOOK_SOURCE__
    _cursor_line = __CURSOR_LINE__
    _cursor_column = __CURSOR_COLUMN__
    _notebook_path = __NOTEBOOK_PATH__

    print(f'[Jedi] Analyzing at line {_cursor_line}, column {_cursor_column}', file=sys.stderr)
    print(f'[Jedi] Notebook source length: {len(_notebook_source)} chars', file=sys.stderr)
    print(f'[Jedi] Kernel sys.path has {len(sys.path)} entries', file=sys.stderr)

    # Create Jedi project with kernel's sys.path
    _project = jedi.Project(path=_notebook_path, sys_path=sys.path)

    # Create Jedi script
    _script = jedi.Script(code=_notebook_source, path=_notebook_path, project=_project)

    # Find definitions
    _definitions = _script.goto(
        line=_cursor_line,
        column=_cursor_column,
        follow_imports=True,
        follow_builtin_imports=True
    )

    print(f'[Jedi] Found {len(_definitions)} definition(s)', file=sys.stderr)

    if _definitions:
        _defn = _definitions[0]
        print(f'[Jedi] Definition: {_defn.name} at {_defn.module_path}:{_defn.line}', file=sys.stderr)

        if _defn.module_path:
            _result['file'] = str(_defn.module_path)
            _result['line'] = _defn.line if _defn.line else 1
        else:
            _result['error'] = f'Definition found but no source file available (builtin or compiled module)'
    else:
        _result['error'] = 'No definition found'

except SystemExit:
    pass
except Exception as _e:
    import traceback
    _result['error'] = f'Jedi error: {str(_e)}'
    print(f'[Jedi] Exception: {traceback.format_exc()}', file=sys.stderr)

print(json.dumps(_result))
"""
        self.finish(json.dumps({
            "code": introspection_code
        }))


def setup_route_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    hello_route_pattern = url_path_join(base_url, "jupyterlab-jump-to-definition-fix", "hello")
    introspection_pattern = url_path_join(base_url, "jupyterlab-jump-to-definition-fix", "introspection-code")

    handlers = [
        (hello_route_pattern, HelloRouteHandler),
        (introspection_pattern, IntrospectionCodeHandler)
    ]

    web_app.add_handlers(host_pattern, handlers)
