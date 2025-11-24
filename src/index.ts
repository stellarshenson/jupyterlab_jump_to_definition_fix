import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { INotebookTracker } from '@jupyterlab/notebook';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { KernelMessage } from '@jupyterlab/services';
import { ICommandPalette } from '@jupyterlab/apputils';
import { showErrorMessage } from '@jupyterlab/apputils';

import { requestAPI } from './request';

/**
 * Initialization data for the jupyterlab_jump_to_definition_fix extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_jump_to_definition_fix:plugin',
  description:
    "Jupyterlab fix disguised as extension to fix action 'jump to definition' from notebook to the source file / definition within the context of the notebook's kernel. Without the fix package would need to be installed in the same environment as jupyterlab to allo jump to definition",
  autoStart: true,
  requires: [INotebookTracker, IDocumentManager],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    docManager: IDocumentManager,
    palette: ICommandPalette | null
  ) => {
    console.log(
      '[JumpToDef] Extension jupyterlab_jump_to_definition_fix is activated!'
    );

    // Test server extension
    requestAPI<any>('hello')
      .then(data => {
        console.log('[JumpToDef] Server extension test successful:', data);
      })
      .catch(reason => {
        console.error(
          '[JumpToDef] The server extension appears to be missing:',
          reason
        );
      });

    // Add command for jumping to definition using Jedi in kernel
    const commandId = 'notebook:jump-to-definition-kernel';
    app.commands.addCommand(commandId, {
      label: 'Jump to Definition (Kernel Context)',
      caption:
        'Jump to the definition of the selected symbol using Jedi in kernel environment',
      execute: async () => {
        const notebook = notebookTracker.currentWidget;
        if (!notebook) {
          console.error('[JumpToDef] No active notebook');
          await showErrorMessage(
            'Jump to Definition',
            'No active notebook found'
          );
          return;
        }

        const kernel = notebook.sessionContext.session?.kernel;
        if (!kernel) {
          console.error('[JumpToDef] No kernel available');
          await showErrorMessage(
            'Jump to Definition',
            'No kernel available. Please start a kernel first.'
          );
          return;
        }

        // Get active cell and cursor position
        const activeCell = notebook.content.activeCell;
        if (!activeCell || activeCell.model.type !== 'code') {
          await showErrorMessage(
            'Jump to Definition',
            'No active code cell'
          );
          return;
        }

        const editor = activeCell.editor;
        if (!editor) {
          await showErrorMessage(
            'Jump to Definition',
            'No editor available'
          );
          return;
        }

        const cursor = editor.getCursorPosition();

        // Collect all code cell sources and calculate absolute position
        const cells = notebook.content.widgets;
        const cellSources: string[] = [];
        let activeCellIndex = -1;

        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          if (cell === activeCell) {
            activeCellIndex = i;
          }
          if (cell.model.type === 'code') {
            cellSources.push(cell.model.sharedModel.getSource());
          }
        }

        // Concatenate all cell sources with newlines
        const notebookSource = cellSources.join('\n');

        // Calculate absolute line number
        let absoluteLine = cursor.line + 1; // Jedi uses 1-based line numbers
        for (let i = 0; i < activeCellIndex; i++) {
          const cell = cells[i];
          if (cell.model.type === 'code') {
            const source = cell.model.sharedModel.getSource();
            absoluteLine += source.split('\n').length;
          }
        }

        const absoluteColumn = cursor.column;
        const notebookPath = notebook.context.path;

        // Get introspection code from server
        const response = await requestAPI<{ code: string }>('introspection-code');

        // Replace placeholders
        let jediCode = response.code
          .replace('__NOTEBOOK_SOURCE__', JSON.stringify(notebookSource))
          .replace('__CURSOR_LINE__', String(absoluteLine))
          .replace('__CURSOR_COLUMN__', String(absoluteColumn))
          .replace('__NOTEBOOK_PATH__', JSON.stringify(notebookPath));

        // Execute in kernel
        const future = kernel.requestExecute({ code: jediCode });
        let output = '';

        future.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
          if (msg.header.msg_type === 'stream') {
            const content = msg.content as KernelMessage.IStreamMsg['content'];
            // Only capture stdout (JSON result), not stderr (debug logs)
            if (content.name === 'stdout') {
              output += content.text;
            }
          }
        };

        await future.done;

        // Parse result
        let result: { file: string | null; line: number | null; error: string | null };
        try {
          result = JSON.parse(output.trim());
        } catch (e) {
          await showErrorMessage(
            'Jump to Definition',
            `Failed to parse result: ${output}`
          );
          return;
        }

        if (result.error) {
          await showErrorMessage('Jump to Definition', result.error);
          return;
        }

        if (!result.file) {
          await showErrorMessage('Jump to Definition', 'No definition found');
          return;
        }

        console.log('[JumpToDef] Opening:', result.file, 'at line', result.line);

        // Convert absolute path to path relative to JupyterLab server root
        // Strategy: Get kernel's CWD and calculate server root from notebook path
        let filePath = result.file;

        // Get kernel's current working directory
        const cwdCode = 'import os; print(os.getcwd())';
        const cwdFuture = kernel.requestExecute({ code: cwdCode });
        let kernelCwd = '';

        cwdFuture.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
          if (msg.header.msg_type === 'stream') {
            const content = msg.content as KernelMessage.IStreamMsg['content'];
            if (content.name === 'stdout') {
              kernelCwd += content.text;
            }
          }
        };

        await cwdFuture.done;
        kernelCwd = kernelCwd.trim();

        // Calculate server root from notebook path
        const notebookDir = notebookPath.substring(0, notebookPath.lastIndexOf('/'));
        let serverRoot = kernelCwd;
        if (kernelCwd.endsWith(notebookDir)) {
          serverRoot = kernelCwd.substring(0, kernelCwd.length - notebookDir.length);
        }

        // Strip server root from definition file path
        if (filePath.startsWith(serverRoot)) {
          filePath = filePath.substring(serverRoot.length);
          if (filePath.startsWith('/')) {
            filePath = filePath.substring(1);
          }
        }

        // Open the file
        const widget = await docManager.openOrReveal(filePath);
        if (widget && result.line) {
          setTimeout(() => {
            const content = widget.content as any;
            if (content && content.editor) {
              content.editor.setCursorPosition({
                line: result.line! - 1,
                column: 0
              });
              content.editor.focus();
            }
          }, 100);
        }
      },
      isEnabled: () => {
        const notebook = notebookTracker.currentWidget;
        return (
          !!notebook &&
          !!notebook.sessionContext.session?.kernel &&
          (notebook.sessionContext.kernelDisplayName ===
            'Python 3 (ipykernel)' ||
            notebook.sessionContext.kernelDisplayName?.includes('Python'))
        );
      }
    });

    // Add to command palette
    if (palette) {
      palette.addItem({
        command: commandId,
        category: 'Notebook'
      });
    }

    // Bind keyboard shortcut (Ctrl+B or Cmd+B) for notebooks
    // This takes precedence over the built-in lsp:jump-to-definition
    app.commands.addKeyBinding({
      command: commandId,
      keys: ['Accel B'],
      selector: '.jp-Notebook.jp-mod-editMode'
    });
  }
};

export default plugin;
