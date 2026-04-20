export function showConfirm({
  title,
  message = '',
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'presentation');

    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h3 class="modal-title" id="modal-title">${escapeHtml(title)}</h3>
        ${message ? `<p class="modal-message">${escapeHtml(message)}</p>` : ''}
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary modal-btn" data-action="cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} modal-btn" data-action="confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const modal = overlay.querySelector('.modal');
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const confirmBtn = modal.querySelector('[data-action="confirm"]');
    const previouslyFocused = document.activeElement;

    const close = (result) => {
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKeyDown);
      overlay.classList.remove('modal-open');
      overlay.classList.add('modal-closing');
      setTimeout(() => {
        overlay.remove();
        if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
      }, 160);
      resolve(result);
    };

    const onOverlayClick = (e) => {
      if (e.target === overlay) close(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'Tab') {
        const focusables = [cancelBtn, confirmBtn];
        const i = focusables.indexOf(document.activeElement);
        e.preventDefault();
        const next = e.shiftKey ? (i <= 0 ? focusables.length - 1 : i - 1) : (i + 1) % focusables.length;
        focusables[next].focus();
      }
    };

    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeyDown);
    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));

    requestAnimationFrame(() => {
      overlay.classList.add('modal-open');
      cancelBtn.focus();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}
