/**
 * API Client with JWT authentication handling
 */
const API = {
  getToken() {
    return localStorage.getItem('zalo_admin_token') || '';
  },

  setToken(token) {
    localStorage.setItem('zalo_admin_token', token);
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('zalo_user_info') || 'null');
    } catch {
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem('zalo_user_info', JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem('zalo_admin_token');
    localStorage.removeItem('zalo_user_info');
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    };

    // If body is not FormData, set Content-Type to JSON
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      if (response.status === 401) {
        this.clearAuth();
        window.dispatchEvent(new CustomEvent('auth:required'));
        throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Lỗi HTTP ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth Endpoints
  auth: {
    async login(username, password) {
      const res = await API.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      if (res.token) {
        API.setToken(res.token);
        API.setUser(res.user);
      }
      return res;
    },
    async getMe() {
      return API.request('/api/auth/me');
    },
    async createStaff(staffData) {
      return API.request('/api/auth/staff', {
        method: 'POST',
        body: JSON.stringify(staffData)
      });
    },
    async listStaff() {
      return API.request('/api/auth/staff');
    }
  },

  // CSKH / Live Chat Endpoints
  cskh: {
    async getConversations(params = {}) {
      const query = new URLSearchParams(params).toString();
      return API.request(`/api/cskh/conversations?${query}`);
    },
    async getMessages(userId) {
      return API.request(`/api/cskh/conversations/${userId}/messages`);
    },
    async sendMessage(userId, message) {
      return API.request('/api/cskh/send-message', {
        method: 'POST',
        body: JSON.stringify({ userId, message })
      });
    },
    async toggleHumanMode(userId, isHumanMode) {
      return API.request('/api/cskh/toggle-human-mode', {
        method: 'POST',
        body: JSON.stringify({ userId, isHumanMode })
      });
    }
  },

  // CRM Endpoints
  crm: {
    async getUsers(params = {}) {
      const query = new URLSearchParams(params).toString();
      return API.request(`/api/crm/users?${query}`);
    },
    async getUserDetails(id) {
      return API.request(`/api/crm/users/${id}`);
    },
    async updateTags(id, tags) {
      return API.request(`/api/crm/users/${id}/tags`, {
        method: 'PUT',
        body: JSON.stringify({ tags })
      });
    },
    async updateNotes(id, notes) {
      return API.request(`/api/crm/users/${id}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes })
      });
    },
    async getStats() {
      return API.request('/api/crm/stats');
    }
  },

  // Knowledge Base (RAG) Endpoints
  knowledge: {
    async listDocs() {
      return API.request('/api/knowledge/docs');
    },
    async getDoc(id) {
      return API.request(`/api/knowledge/docs/${id}`);
    },
    async upload(formData) {
      return API.request('/api/knowledge/upload', {
        method: 'POST',
        body: formData
      });
    },
    async deleteDoc(id) {
      return API.request(`/api/knowledge/docs/${id}`, {
        method: 'DELETE'
      });
    },
    async testSearch(query, topK = 4, minSimilarity = 0.6) {
      return API.request('/api/knowledge/test-search', {
        method: 'POST',
        body: JSON.stringify({ query, topK, minSimilarity })
      });
    }
  },

  // Webhook Config Endpoints
  webhookConfig: {
    async get() {
      return API.request('/api/webhook-config');
    },
    async update(data) {
      return API.request('/api/webhook-config', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    async testZalo() {
      return API.request('/api/webhook-config/test-zalo', {
        method: 'POST'
      });
    },
    async getLogs(limit = 30) {
      return API.request(`/api/webhook-config/logs?limit=${limit}`);
    },
    async clearLogs() {
      return API.request('/api/webhook-config/logs', {
        method: 'DELETE'
      });
    },
    async simulate(data) {
      return API.request('/api/webhook-config/simulate', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  }
};

