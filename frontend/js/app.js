if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
document.addEventListener('click', e => {
  const toastTrigger = e.target.closest('[data-toast]');
  if (toastTrigger) {
    e.preventDefault();
    toast(toastTrigger.dataset.toast);
    return;
  }
});

const page = document.body.dataset.page;
const currentUser = getCurrentUser();
renderUserAvatar();

window.addEventListener('storage', e => {
  if (e.key && (e.key === STORAGE_PREFIX + USER_KEY || e.key.startsWith(STORAGE_PREFIX + 'perfilLocal:'))) renderUserAvatar();
});
window.addEventListener('pageshow', e => { if (e.persisted) renderUserAvatar(); });
if (getToken() && page !== 'perfil') {
  refreshCurrentUser()
    .then(syncLocalPhoto)
    .then(() => renderUserAvatar())
    .catch(err => { if (err?.status === 401) reportApiError(err); });
}

renderNav(page);
renderIcons();
pages[page]?.();
