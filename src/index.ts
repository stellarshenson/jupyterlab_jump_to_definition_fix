import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './request';

/**
 * Initialization data for the jupyterlab_jump_to_definition_fix extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_jump_to_definition_fix:plugin',
  description: 'Jupyterlab fix disguised as extension to fix action \'jump to definition\' from notebook to the source file / definition within the context of the notebook\'s kernel. Without the fix package would need to be installed in the same environment as jupyterlab to allo jump to definition',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyterlab_jump_to_definition_fix is activated!');

    requestAPI<any>('hello')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The jupyterlab_jump_to_definition_fix server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default plugin;
