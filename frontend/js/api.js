const API_BASE_URL = location.protocol === 'file:' || /^550\d$/.test(location.port)
  ? `http://${location.hostname || 'localhost'}:8000`
  : location.origin;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function apiRequest(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (networkError) {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : 'Ocorreu um erro inesperado.';
    throw new ApiError(response.status, detail);
  }

  return data;
}

const Api = {
  register: (name, email, password) =>
    apiRequest('/auth/register', { method: 'POST', body: { name, email, password } }),

  login: (email, password) =>
    apiRequest('/auth/login', { method: 'POST', body: { email, password } }),

  socialLogin: (provider, name, email) =>
    apiRequest('/auth/social', { method: 'POST', body: { provider, name, email } }),

  me: () => apiRequest('/auth/me', { auth: true }),

  updateMe: fields => apiRequest('/auth/me', { method: 'PATCH', body: fields, auth: true }),

  myStats: () => apiRequest('/auth/me/stats', { auth: true }),

  setAvatar: dataUrl => apiRequest('/auth/me/avatar', { method: 'PUT', body: { image: dataUrl }, auth: true }),
  deleteAvatar: () => apiRequest('/auth/me/avatar', { method: 'DELETE', auth: true }),

  changePassword: (currentPassword, newPassword) =>
    apiRequest('/auth/password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword },
      auth: true
    }),

  forgotPassword: email =>
    apiRequest('/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (token, newPassword) =>
    apiRequest('/auth/reset-password', { method: 'POST', body: { token, new_password: newPassword } }),

  listHistory:(queryString = '') => apiRequest(`/history${queryString}`, { auth: true }),

  createHistory: (type, text) =>
    apiRequest('/history', { method: 'POST', body: { type, text }, auth: true }),

  toggleFavorite: id => apiRequest(`/history/${id}/favorite`, { method: 'PATCH', auth: true }),

  deleteHistoryEntry: id => apiRequest(`/history/${id}`, { method: 'DELETE', auth: true }),

  clearHistory: () => apiRequest('/history', { method: 'DELETE', auth: true }),

  predictSign: frames => apiRequest('/recognition/predict', { method: 'POST', body: { frames }, auth: true }),

  recognitionInfo: () => apiRequest('/recognition/info', { auth: true }),

  listCommunities: (filtros = {}) => {
    const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== '')).toString();
    return apiRequest(`/communities${qs ? '?' + qs : ''}`, { auth: true });
  },
  getCommunity: id => apiRequest(`/communities/${id}`, { auth: true }),
  createCommunity: dados => apiRequest('/communities', { method: 'POST', body: dados, auth: true }),
  joinCommunity: id => apiRequest(`/communities/${id}/join`, { method: 'POST', auth: true }),
  leaveCommunity: id => apiRequest(`/communities/${id}/join`, { method: 'DELETE', auth: true }),
  listPosts: id => apiRequest(`/communities/${id}/posts`, { auth: true }),
  createPost: (id, text) => apiRequest(`/communities/${id}/posts`, { method: 'POST', body: { text }, auth: true }),
  deletePost: (id, postId) => apiRequest(`/communities/${id}/posts/${postId}`, { method: 'DELETE', auth: true })
};
