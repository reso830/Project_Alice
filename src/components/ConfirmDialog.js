export const ConfirmDialog = {
  show(message, { confirmLabel = 'Confirm', cancelLabel = 'Cancel' } = {}) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      const dialog = document.createElement('div');
      const body = document.createElement('p');
      const actions = document.createElement('div');
      const cancelBtn = document.createElement('button');
      const confirmBtn = document.createElement('button');

      backdrop.className = 'confirm-backdrop';
      dialog.className = 'confirm-dialog';
      dialog.setAttribute('role', 'alertdialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'confirm-dialog-message');
      body.id = 'confirm-dialog-message';
      body.className = 'confirm-dialog__message';
      body.textContent = message;
      actions.className = 'confirm-dialog__actions';
      cancelBtn.type = 'button';
      cancelBtn.className = 'confirm-dialog__btn confirm-dialog__btn--cancel';
      cancelBtn.textContent = cancelLabel;
      confirmBtn.type = 'button';
      confirmBtn.className = 'confirm-dialog__btn confirm-dialog__btn--confirm';
      confirmBtn.textContent = confirmLabel;

      function finish(result) {
        backdrop.remove();
        resolve(result);
      }

      cancelBtn.addEventListener('click', () => finish(false));
      confirmBtn.addEventListener('click', () => finish(true));
      backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) {
          finish(false);
        }
      });

      const keyHandler = (event) => {
        if (event.key === 'Escape') {
          document.removeEventListener('keydown', keyHandler);
          finish(false);
        }
      };
      document.addEventListener('keydown', keyHandler);

      actions.append(cancelBtn, confirmBtn);
      dialog.append(body, actions);
      backdrop.append(dialog);
      document.body.append(backdrop);
      confirmBtn.focus();
    });
  },
};
