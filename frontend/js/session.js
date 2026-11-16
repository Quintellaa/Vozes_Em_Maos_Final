const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const DEFAULT_USER = { name: 'Gabriel Silva', email: 'gabriel.silva@gmail.com' };

function getToken() {
  return Storage.get(TOKEN_KEY, null);
}

function getCurrentUser() {
  return Storage.get(USER_KEY, null);
}

function persistSession({ access_token, user }) {
  const savedToken = Storage.set(TOKEN_KEY, access_token);
  const savedUser = Storage.set(USER_KEY, user);
  return savedToken && savedUser;
}

function finishLogin(session) {
  if (!persistSession(session)) {
    toast('Não foi possível salvar sua sessão neste navegador. Verifique o modo privado ou o bloqueio de cookies.');
    return;
  }
  location.href = Storage.get(cameraKey()) ? 'tradutor.html' : 'permissao.html';
}

function cameraKey(user = getCurrentUser()) {
  return 'cam:' + (user?.id ?? 'anon');
}

async function loginWithEmail(email, password) {
  finishLogin(await Api.login(email, password));
}

async function registerAccount(name, email, password) {
  finishLogin(await Api.register(name, email, password));
}

async function loginSocial(provider, name, email) {
  finishLogin(await Api.socialLogin(provider, name, email));
}

async function refreshCurrentUser() {
  const freshUser = await Api.me();
  Storage.set(USER_KEY, freshUser);
  return freshUser;
}

function logout() {
  Storage.remove(TOKEN_KEY);
  Storage.remove(USER_KEY);
  location.href = 'index.html';
}

function getLocalProfile(user = getCurrentUser()) {
  return Storage.get('perfilLocal:' + (user?.id ?? 'anon'), {}) || {};
}

function avatarSrc(user) {
  return user?.avatar_url ? API_BASE_URL + user.avatar_url : null;
}

async function syncLocalPhoto(user) {
  const local = getLocalProfile(user);
  if (!local.foto || !user?.id) return user;
  let atualizado = user;
  if (!user.avatar_url) {
    try {
      atualizado = await Api.setAvatar(local.foto);
      Storage.set(USER_KEY, atualizado);
    } catch (err) {
      return user;
    }
  }
  const { foto, ...resto } = local;
  Storage.set('perfilLocal:' + user.id, resto);
  return atualizado;
}

function renderUserAvatar(root = document) {
  const user = getCurrentUser() || DEFAULT_USER;
  const foto = avatarSrc(user) || getLocalProfile(user).foto;
  $$('[data-ini]', root).forEach(el => {
    if (foto) {
      el.innerHTML = '';
      const img = document.createElement('img');
      img.src = foto;
      img.alt = '';
      img.className = 'ava-img';
      el.appendChild(img);
    } else {
      el.textContent = initials(user.name || DEFAULT_USER.name);
    }
    if (el.hasAttribute('aria-label') && el.getAttribute('href')) el.setAttribute('aria-label', `Perfil de ${user.name}`);
  });
}

function initials(name) {
  return name.split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase();
}

function reportApiError(err) {
  if (err instanceof ApiError && err.status === 401) {
    Storage.remove(TOKEN_KEY);
    Storage.remove(USER_KEY);
    location.replace('index.html');
    return;
  }
  toast(err?.message || 'Ocorreu um erro. Tente novamente.');
}

if (document.body.hasAttribute('data-auth') && !getToken()) {
  location.replace('index.html');
}
