/**
 * Enterprise Zalo AI Bot Dashboard Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  currentTab: 'overview',
  activeConversation: null,
  conversations: [],
  currentUser: null,

  async init() {
    this.bindEvents();
    this.initAuth();
  },

  // 1. Authentication & Session Initialization
  async initAuth() {
    const token = API.getToken();
    if (!token) {
      this.showLoginModal(true);
      return;
    }

    try {
      const meRes = await API.auth.getMe();
      this.currentUser = meRes.user;
      this.renderUserProfile();
      this.showLoginModal(false);

      // Initialize Real-time WebSocket
      SocketHandler.init();

      // Load initial tab data
      this.switchTab('overview');
    } catch {
      this.showLoginModal(true);
    }
  },

  renderUserProfile() {
    if (!this.currentUser) return;
    document.getElementById('headerUserName').textContent = this.currentUser.full_name;
    document.getElementById('headerUserRole').textContent = this.currentUser.role;
    document.getElementById('headerUserAvatar').textContent = (this.currentUser.full_name || 'U')[0].toUpperCase();

    // Show admin-only tabs
    const isAdmin = this.currentUser.role === 'admin';
    const staffTabBtn = document.querySelector('[data-tab="staff"]');
    if (staffTabBtn) {
      staffTabBtn.style.display = isAdmin ? 'flex' : 'none';
    }
    const webhookTabBtn = document.querySelector('[data-tab="webhook"]');
    if (webhookTabBtn) {
      webhookTabBtn.style.display = isAdmin ? 'flex' : 'none';
    }
  },

  showLoginModal(show) {
    const modal = document.getElementById('loginModal');
    if (modal) {
      if (show) modal.classList.add('active');
      else modal.classList.remove('active');
    }
  },

  // 2. Global Event Bindings
  bindEvents() {
    // Navigation tabs
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });

    // Login Form Submit
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Đang đăng nhập...';
          const loginRes = await API.auth.login(username, password);
          this.showToast('Đăng nhập thành công!', 'success');
          if (loginRes.warning) {
            setTimeout(() => this.showToast(loginRes.warning, 'warning'), 1200);
          }
          this.initAuth();
        } catch (err) {
          this.showToast(err.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Đăng Nhập';
        }
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        API.clearAuth();
        window.location.reload();
      });
    }

    // Auth required event
    window.addEventListener('auth:required', () => {
      this.showLoginModal(true);
      this.showToast('Vui lòng đăng nhập lại.', 'warning');
    });

    // Socket Event: New Message
    window.addEventListener('socket:new_message', (e) => {
      const { message, user } = e.detail;
      this.handleIncomingMessage(message, user);
    });

    // Socket Event: User Update
    window.addEventListener('socket:user_updated', (e) => {
      const updatedUser = e.detail;
      this.handleUserUpdated(updatedUser);
    });

    // Socket Event: Handoff Alert
    window.addEventListener('socket:handoff_alert', (e) => {
      const { user, reason } = e.detail;
      this.showToast(`🚨 ${user.display_name || user.zalo_user_id} cần CSKH can thiệp: ${reason}`, 'warning');
      this.playNotificationSound();
    });

    // Live chat send button & Enter key
    const sendChatBtn = document.getElementById('btnSendChat');
    const chatInput = document.getElementById('chatInput');
    if (sendChatBtn && chatInput) {
      sendChatBtn.addEventListener('click', () => this.sendAgentMessage());
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendAgentMessage();
        }
      });
    }

    // Live chat conversation search & filters
    const searchConvInput = document.getElementById('searchConvInput');
    if (searchConvInput) {
      searchConvInput.addEventListener('input', (e) => {
        this.filterConversations(e.target.value);
      });
    }

    document.querySelectorAll('.filter-pills .pill-btn').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pills .pill-btn').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        const filter = pill.getAttribute('data-filter');
        this.loadConversations(filter);
      });
    });

    // Knowledge upload form & dropzone
    const uploadForm = document.getElementById('uploadKnowledgeForm');
    const dropzone = document.getElementById('knowledgeDropzone');
    const fileInput = document.getElementById('knowledgeFileInput');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          fileInput.files = e.dataTransfer.files;
          this.updateDropzoneLabel(e.dataTransfer.files[0].name);
        }
      });
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
          this.updateDropzoneLabel(fileInput.files[0].name);
        }
      });
    }

    if (uploadForm) {
      uploadForm.addEventListener('submit', (e) => this.handleKnowledgeUpload(e));
    }

    // RAG Search Simulator
    const btnTestRAG = document.getElementById('btnTestRAG');
    const ragQueryInput = document.getElementById('ragQueryInput');
    if (btnTestRAG && ragQueryInput) {
      btnTestRAG.addEventListener('click', () => this.runRAGTest());
      ragQueryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.runRAGTest();
        }
      });
    }

    // CRM Search
    const crmSearchInput = document.getElementById('crmSearchInput');
    if (crmSearchInput) {
      crmSearchInput.addEventListener('input', () => this.loadCRMUsers());
    }

    // Staff form
    const staffForm = document.getElementById('createStaffForm');
    if (staffForm) {
      staffForm.addEventListener('submit', (e) => this.handleCreateStaff(e));
    }

    // Webhook configuration form
    const webhookConfigForm = document.getElementById('webhookConfigForm');
    if (webhookConfigForm) {
      webhookConfigForm.addEventListener('submit', (e) => this.handleSaveWebhookConfig(e));
    }

    const btnTestZaloApi = document.getElementById('btnTestZaloApi');
    if (btnTestZaloApi) {
      btnTestZaloApi.addEventListener('click', () => this.handleTestZaloApi());
    }

    const btnCopyWebhookUrl = document.getElementById('btnCopyWebhookUrl');
    if (btnCopyWebhookUrl) {
      btnCopyWebhookUrl.addEventListener('click', () => this.copyWebhookUrl());
    }

    const btnSimulateWebhook = document.getElementById('btnSimulateWebhook');
    if (btnSimulateWebhook) {
      btnSimulateWebhook.addEventListener('click', () => this.handleSimulateWebhook());
    }

    // Socket Event: Webhook Event Received
    window.addEventListener('socket:webhook_event_received', (e) => {
      this.handleIncomingWebhookLog(e.detail);
    });
  },

  updateDropzoneLabel(fileName) {
    const label = document.getElementById('dropzoneLabel');
    if (label) label.textContent = `Đã chọn: ${fileName}`;
  },

  // 3. Tab Switching
  switchTab(tabName) {
    this.currentTab = tabName;

    // Toggle active tab buttons
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Toggle tab contents
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // Load data for selected tab
    switch (tabName) {
      case 'overview':
        this.loadOverviewData();
        break;
      case 'livechat':
        this.loadConversations();
        break;
      case 'knowledge':
        this.loadKnowledgeDocs();
        break;
      case 'crm':
        this.loadCRMUsers();
        break;
      case 'staff':
        this.loadStaffList();
        break;
      case 'webhook':
        this.loadWebhookTab();
        break;
    }
  },

  // 4. Overview Tab Logic
  async loadOverviewData() {
    try {
      const res = await API.crm.getStats();
      const stats = res.stats;
      document.getElementById('statTotalUsers').textContent = stats.totalUsers || 0;
      document.getElementById('statTodayMessages').textContent = stats.todayMessages || 0;
      document.getElementById('statHumanMode').textContent = stats.humanModeUsers || 0;
      document.getElementById('statKnowledgeChunks').textContent = stats.totalKnowledgeChunks || 0;
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  },

  // 5. Live Chat Logic
  async loadConversations(filter = 'all') {
    try {
      let isHumanMode = null;
      if (filter === 'human') isHumanMode = true;
      if (filter === 'ai') isHumanMode = false;

      const res = await API.cskh.getConversations({ isHumanMode });
      this.conversations = res.users || [];
      this.renderConversationList(this.conversations);

      // Auto-select first conversation if none selected
      if (!this.activeConversation && this.conversations.length > 0) {
        this.selectConversation(this.conversations[0]);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  },

  renderConversationList(conversations) {
    const listEl = document.getElementById('conversationList');
    if (!listEl) return;

    if (conversations.length === 0) {
      listEl.innerHTML = '<div style="padding:24px;text-align:center;color:#6b7280;font-size:0.85rem">Chưa có hội thoại nào</div>';
      return;
    }

    listEl.innerHTML = conversations
      .map((c) => {
        const isSelected = this.activeConversation && this.activeConversation.id === c.id;
        const initial = (c.display_name || 'U')[0].toUpperCase();
        const snippet = c.last_message_content || 'Bắt đầu tương tác';
        const isHuman = c.is_human_mode;
        const tags = (c.tags || []).slice(0, 2);

        return `
        <div class="conv-item ${isSelected ? 'active' : ''}" onclick="App.selectConversationById('${c.id}')">
          <div class="conv-avatar-box">
            <div class="conv-avatar">${initial}</div>
            <div class="status-badge-dot ${isHuman ? 'human' : 'ai'}"></div>
          </div>
          <div class="conv-meta">
            <div class="conv-top">
              <span class="conv-name">${this.escapeHtml(c.display_name || c.zalo_user_id)}</span>
              <span class="conv-time">${this.formatTime(c.last_interaction_at)}</span>
            </div>
            <div class="conv-bottom">
              <span class="conv-snippet">${this.escapeHtml(snippet)}</span>
            </div>
            <div class="conv-tags-row">
              ${isHuman ? '<span class="mini-tag" style="background:rgba(245,158,11,0.2);color:#fbbf24">Can thiệp</span>' : ''}
              ${tags.map((t) => `<span class="mini-tag">${this.escapeHtml(t)}</span>`).join('')}
            </div>
          </div>
        </div>
      `;
      })
      .join('');
  },

  selectConversationById(userId) {
    const found = this.conversations.find((c) => c.id === userId);
    if (found) {
      this.selectConversation(found);
    }
  },

  async selectConversation(user) {
    this.activeConversation = user;
    SocketHandler.setActiveConversation(user.id);
    this.renderConversationList(this.conversations);

    // Update Chat Header
    document.getElementById('chatHeaderName').textContent = user.display_name || user.zalo_user_id;
    document.getElementById('chatHeaderZaloId').textContent = `Zalo ID: ${user.zalo_user_id}`;
    this.renderHandoffControls(user);
    this.renderCustomerHeaderTags(user);

    // Load Chat Messages
    const container = document.getElementById('chatMessagesContainer');
    container.innerHTML = '<div style="padding:24px;text-align:center;color:#9ca3af">Đang tải tin nhắn...</div>';

    try {
      const res = await API.cskh.getMessages(user.id);
      this.renderMessages(res.messages || []);
    } catch (err) {
      container.innerHTML = `<div style="padding:24px;text-align:center;color:#ef4444">Lỗi tải tin nhắn: ${err.message}</div>`;
    }
  },

  renderHandoffControls(user) {
    const container = document.getElementById('chatHandoffControls');
    if (!container) return;

    if (user.is_human_mode) {
      container.innerHTML = `
        <div class="handoff-badge human">🎧 Chế độ Nhân viên (CSKH)</div>
        <button class="btn-handoff-action handback" onclick="App.toggleHumanMode(false)">
          <span>🤖 Trả lại cho AI</span>
        </button>
      `;
    } else {
      container.innerHTML = `
        <div class="handoff-badge ai">🤖 Trợ lý AI đang phục vụ</div>
        <button class="btn-handoff-action takeover" onclick="App.toggleHumanMode(true)">
          <span>🎧 Can thiệp CSKH</span>
        </button>
      `;
    }
  },

  renderCustomerHeaderTags(user) {
    const container = document.getElementById('chatHeaderTags');
    if (!container) return;

    const tagsHtml = (user.tags || [])
      .map(
        (t) => `
        <span class="crm-tag-badge">
          ${this.escapeHtml(t)}
          <button class="btn-tag-action" onclick="App.removeUserTag('${user.id}', '${this.escapeHtml(t)}')">×</button>
        </span>
      `
      )
      .join('');

    container.innerHTML = `
      ${tagsHtml}
      <button class="pill-btn" onclick="App.promptAddTag('${user.id}')" style="margin-left:4px">+ Thẻ</button>
    `;
  },

  renderMessages(messages) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#6b7280">Chưa có tin nhắn nào trong hội thoại này</div>';
      return;
    }

    container.innerHTML = messages
      .map((m) => {
        let senderLabel = 'Khách hàng';
        let senderClass = 'user';

        if (m.sender_type === 'bot') {
          senderLabel = '🤖 Trợ lý AI (Gemini)';
          senderClass = 'bot';
        } else if (m.sender_type === 'agent') {
          senderLabel = '🎧 CSKH Trực tiếp';
          senderClass = 'agent';
        }

        const timeStr = this.formatDateTime(m.created_at);
        const imageHtml = m.media_url ? `<img src="${m.media_url}" class="msg-image" alt="Attachment" />` : '';

        return `
        <div class="msg-wrapper ${senderClass}">
          <span class="msg-sender-title">${senderLabel}</span>
          <div class="msg-bubble">
            ${imageHtml}
            <div>${this.escapeHtml(m.content || '')}</div>
          </div>
          <span class="msg-time">${timeStr}</span>
        </div>
      `;
      })
      .join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  },

  async sendAgentMessage() {
    if (!this.activeConversation) {
      this.showToast('Vui lòng chọn một cuộc hội thoại trước.', 'warning');
      return;
    }

    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';

    try {
      await API.cskh.sendMessage(this.activeConversation.id, message);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async toggleHumanMode(isHumanMode) {
    if (!this.activeConversation) return;

    try {
      const res = await API.cskh.toggleHumanMode(this.activeConversation.id, isHumanMode);
      this.activeConversation = res.user;
      this.renderHandoffControls(res.user);
      this.showToast(
        isHumanMode ? 'Đã kích hoạt chế độ CSKH. AI sẽ tạm dừng.' : 'Đã trao lại hội thoại cho Trợ lý AI.',
        'success'
      );
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  handleIncomingMessage(message, user) {
    // If active conversation is open, append message
    if (this.activeConversation && message.user_id === this.activeConversation.id) {
      const container = document.getElementById('chatMessagesContainer');
      let senderLabel = 'Khách hàng';
      let senderClass = 'user';

      if (message.sender_type === 'bot') {
        senderLabel = '🤖 Trợ lý AI (Gemini)';
        senderClass = 'bot';
      } else if (message.sender_type === 'agent') {
        senderLabel = '🎧 CSKH Trực tiếp';
        senderClass = 'agent';
      }

      const msgEl = document.createElement('div');
      msgEl.className = `msg-wrapper ${senderClass}`;
      const imageHtml = message.media_url ? `<img src="${message.media_url}" class="msg-image" alt="Attachment" />` : '';

      msgEl.innerHTML = `
        <span class="msg-sender-title">${senderLabel}</span>
        <div class="msg-bubble">
          ${imageHtml}
          <div>${this.escapeHtml(message.content || '')}</div>
        </div>
        <span class="msg-time">${this.formatDateTime(message.created_at)}</span>
      `;

      container.appendChild(msgEl);
      container.scrollTop = container.scrollHeight;
    }

    // Refresh conversation list
    this.loadConversations();
  },

  handleUserUpdated(updatedUser) {
    if (this.activeConversation && this.activeConversation.id === updatedUser.id) {
      this.activeConversation = updatedUser;
      this.renderHandoffControls(updatedUser);
      this.renderCustomerHeaderTags(updatedUser);
    }
    this.loadConversations();
  },

  filterConversations(query) {
    if (!query) {
      this.renderConversationList(this.conversations);
      return;
    }
    const filtered = this.conversations.filter(
      (c) =>
        (c.display_name && c.display_name.toLowerCase().includes(query.toLowerCase())) ||
        (c.zalo_user_id && c.zalo_user_id.includes(query))
    );
    this.renderConversationList(filtered);
  },

  // 6. Knowledge Base (RAG) Logic
  async loadKnowledgeDocs() {
    const tbody = document.getElementById('knowledgeDocsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#9ca3af">Đang tải danh mục tài liệu...</td></tr>';

    try {
      const res = await API.knowledge.listDocs();
      const docs = res.docs || [];

      if (docs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#6b7280">Kho tri thức chưa có tài liệu nào. Hãy tải lên tài liệu bên trên!</td></tr>';
        return;
      }

      tbody.innerHTML = docs
        .map(
          (d, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${this.escapeHtml(d.title)}</strong></td>
          <td>${this.escapeHtml(d.file_name)}</td>
          <td><span class="mini-tag">${d.file_type.toUpperCase()}</span></td>
          <td><strong>${d.total_chunks}</strong> đoạn</td>
          <td>${this.formatDateTime(d.created_at)}</td>
          <td>
            <button class="btn-icon-danger" onclick="App.deleteKnowledgeDoc('${d.id}')">Xóa</button>
          </td>
        </tr>
      `
        )
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:#ef4444;text-align:center">Lỗi tải tài liệu: ${err.message}</td></tr>`;
    }
  },

  async handleKnowledgeUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('knowledgeFileInput');
    const titleInput = document.getElementById('knowledgeTitleInput');
    const submitBtn = document.getElementById('btnSubmitKnowledge');

    if (!fileInput.files || fileInput.files.length === 0) {
      this.showToast('Vui lòng chọn một tệp văn bản (PDF, DOCX, TXT)!', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    if (titleInput.value.trim()) {
      formData.append('title', titleInput.value.trim());
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Đang trích xuất văn bản & nhúng Vector...';

      const res = await API.knowledge.upload(formData);
      this.showToast(`✅ ${res.message} (${res.totalChunks} đoạn vector)`, 'success');

      // Reset form
      fileInput.value = '';
      titleInput.value = '';
      this.updateDropzoneLabel('Kéo thả tệp hoặc bấm vào đây');
      this.loadKnowledgeDocs();
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Tải Lên & Nhúng Vào pgvector</span>';
    }
  },

  async deleteKnowledgeDoc(docId) {
    if (!confirm('Bạn có chắc chắn muốn xóa tài liệu này và toàn bộ các đoạn vector liên quan?')) return;

    try {
      await API.knowledge.deleteDoc(docId);
      this.showToast('Đã xóa tài liệu khỏi kho tri thức.', 'success');
      this.loadKnowledgeDocs();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async runRAGTest() {
    const input = document.getElementById('ragQueryInput');
    const query = input.value.trim();
    const resultsContainer = document.getElementById('ragTestResults');

    if (!query) {
      this.showToast('Nhập câu hỏi để thử nghiệm truy vấn RAG.', 'warning');
      return;
    }

    resultsContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#9ca3af">Đang tính toán Cosine Distance trong pgvector...</div>';

    try {
      const res = await API.knowledge.testSearch(query);
      const chunks = res.chunks || [];

      if (chunks.length === 0) {
        resultsContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#f59e0b">Không tìm thấy đoạn văn bản nào vượt qua ngưỡng tương đồng similarity.</div>';
        return;
      }

      resultsContainer.innerHTML = chunks
        .map(
          (c) => `
        <div class="chunk-card">
          <div class="chunk-header">
            <span><strong>${this.escapeHtml(c.doc_title || 'Tài liệu')}</strong> (Đoạn #${c.chunk_index + 1})</span>
            <span class="similarity-badge">Độ khớp: ${(c.similarity * 100).toFixed(1)}%</span>
          </div>
          <div class="chunk-text">${this.escapeHtml(c.content)}</div>
        </div>
      `
        )
        .join('');
    } catch (err) {
      resultsContainer.innerHTML = `<div style="padding:20px;text-align:center;color:#ef4444">Lỗi truy vấn: ${err.message}</div>`;
    }
  },

  // 7. Mini CRM Logic
  async loadCRMUsers() {
    const tbody = document.getElementById('crmUsersTableBody');
    const searchInput = document.getElementById('crmSearchInput');
    const tagFilter = document.getElementById('crmTagFilter');

    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#9ca3af">Đang tải danh sách khách hàng...</td></tr>';

    try {
      const params = {};
      if (searchInput && searchInput.value.trim()) params.search = searchInput.value.trim();
      if (tagFilter && tagFilter.value) params.tag = tagFilter.value;

      const res = await API.crm.getUsers(params);
      const users = res.users || [];

      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#6b7280">Chưa có dữ liệu khách hàng.</td></tr>';
        return;
      }

      tbody.innerHTML = users
        .map((u) => {
          const tags = u.tags || [];
          return `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <div class="conv-avatar" style="width:34px;height:34px;font-size:0.8rem">${(u.display_name || 'U')[0].toUpperCase()}</div>
                <div>
                  <strong>${this.escapeHtml(u.display_name || 'Chưa đặt tên')}</strong>
                  <div style="font-size:0.75rem;color:#6b7280">ID: ${u.zalo_user_id}</div>
                </div>
              </div>
            </td>
            <td>
              <div class="tags-cell">
                ${tags.map((t) => `<span class="crm-tag-badge">${this.escapeHtml(t)}</span>`).join('')}
                <button class="pill-btn" onclick="App.promptAddTag('${u.id}')">+</button>
              </div>
            </td>
            <td>
              ${u.is_human_mode
              ? '<span class="handoff-badge human" style="display:inline-flex;padding:3px 10px;font-size:0.75rem">🎧 Can thiệp CSKH</span>'
              : '<span class="handoff-badge ai" style="display:inline-flex;padding:3px 10px;font-size:0.75rem">🤖 Tự động AI</span>'
            }
            </td>
            <td>${u.total_messages || 0} tin</td>
            <td>${this.formatDateTime(u.last_interaction_at)}</td>
            <td>
              <button class="pill-btn" style="background:var(--primary);color:#fff" onclick="App.jumpToChat('${u.id}')">Nhắn tin</button>
            </td>
          </tr>
        `;
        })
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444;text-align:center">Lỗi: ${err.message}</td></tr>`;
    }
  },

  async promptAddTag(userId) {
    const tag = prompt('Nhập tên thẻ phân loại (VD: Hỏi giá, Kỹ thuật, Khách VIP, Khiếu nại):');
    if (!tag || !tag.trim()) return;

    try {
      const userRes = await API.crm.getUserDetails(userId);
      const user = userRes.user;
      const currentTags = user.tags || [];

      if (!currentTags.includes(tag.trim())) {
        currentTags.push(tag.trim());
        await API.crm.updateTags(userId, currentTags);
        this.showToast('Đã thêm thẻ phân loại.', 'success');
        if (this.currentTab === 'livechat') {
          this.loadConversations();
          if (this.activeConversation && this.activeConversation.id === userId) {
            this.activeConversation.tags = currentTags;
            this.renderCustomerHeaderTags(this.activeConversation);
          }
        } else if (this.currentTab === 'crm') {
          this.loadCRMUsers();
        }
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async removeUserTag(userId, tagToRemove) {
    try {
      const userRes = await API.crm.getUserDetails(userId);
      const user = userRes.user;
      const updatedTags = (user.tags || []).filter((t) => t !== tagToRemove);

      await API.crm.updateTags(userId, updatedTags);
      this.showToast('Đã xóa thẻ.', 'info');

      if (this.activeConversation && this.activeConversation.id === userId) {
        this.activeConversation.tags = updatedTags;
        this.renderCustomerHeaderTags(this.activeConversation);
      }
      this.loadConversations();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  jumpToChat(userId) {
    this.switchTab('livechat');
    setTimeout(() => {
      this.selectConversationById(userId);
    }, 150);
  },

  // 8. Staff Management (Admin only)
  async loadStaffList() {
    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;

    try {
      const res = await API.auth.listStaff();
      const staff = res.staff || [];

      tbody.innerHTML = staff
        .map(
          (s) => `
        <tr>
          <td><strong>${this.escapeHtml(s.username)}</strong></td>
          <td>${this.escapeHtml(s.full_name)}</td>
          <td><span class="mini-tag" style="background:${s.role === 'admin' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)'};color:#fff">${s.role.toUpperCase()}</span></td>
          <td>${s.is_active ? '<span style="color:#10b981">Đang hoạt động</span>' : '<span style="color:#ef4444">Bị khóa</span>'}</td>
          <td>${this.formatDateTime(s.created_at)}</td>
        </tr>
      `
        )
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:#ef4444;text-align:center">Lỗi: ${err.message}</td></tr>`;
    }
  },

  async handleCreateStaff(e) {
    e.preventDefault();
    const username = document.getElementById('staffUsername').value.trim();
    const fullName = document.getElementById('staffFullName').value.trim();
    const password = document.getElementById('staffPassword').value.trim();
    const role = document.getElementById('staffRole').value;

    try {
      await API.auth.createStaff({ username, fullName, password, role });
      this.showToast('Tạo tài khoản nhân viên thành công!', 'success');
      document.getElementById('createStaffForm').reset();
      this.loadStaffList();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // 9. Webhook Configuration Logic
  currentWebhookLogs: [],

  async loadWebhookTab() {
    await this.loadWebhookConfig();
    await this.loadWebhookLogs();
  },

  async loadWebhookConfig() {
    try {
      const res = await API.webhookConfig.get();
      const cfg = res.config || {};
      const stats = res.stats || {};

      const urlInput = document.getElementById('webhookUrlDisplay');
      if (urlInput) urlInput.value = cfg.webhookUrl || `${window.location.origin}/webhook`;

      const botTokenLabel = document.getElementById('lblCurrentBotToken');
      if (botTokenLabel) botTokenLabel.textContent = cfg.botTokenMasked;

      const appSecretLabel = document.getElementById('lblCurrentAppSecret');
      if (appSecretLabel) appSecretLabel.textContent = cfg.appSecretMasked;

      const chkVerify = document.getElementById('cfgVerifyMac');
      if (chkVerify) chkVerify.checked = cfg.verifyMac !== false;

      const statusBadge = document.getElementById('webhookStatusBadge');
      if (statusBadge) {
        if (cfg.hasBotToken) {
          statusBadge.textContent = '● Đã Cấu Hình';
          statusBadge.style.color = '#10b981';
          statusBadge.style.borderColor = 'rgba(16,185,129,0.4)';
        } else {
          statusBadge.textContent = '○ Chưa Có Token';
          statusBadge.style.color = '#ef4444';
          statusBadge.style.borderColor = 'rgba(239,68,68,0.4)';
        }
      }

      const lastActivity = document.getElementById('webhookLastActivity');
      if (lastActivity) {
        lastActivity.textContent = stats.lastActivityAt ? this.formatDateTime(stats.lastActivityAt) : 'Chưa có dữ liệu';
      }
    } catch (err) {
      console.error('Lỗi tải cấu hình Webhook:', err);
    }
  },

  async handleSaveWebhookConfig(e) {
    e.preventDefault();
    const tokenInput = document.getElementById('cfgBotToken');
    const secretInput = document.getElementById('cfgAppSecret');
    const verifyMacChk = document.getElementById('cfgVerifyMac');

    const payload = {
      verifyMac: verifyMacChk.checked
    };

    if (tokenInput.value.trim()) payload.botToken = tokenInput.value.trim();
    if (secretInput.value.trim()) payload.appSecret = secretInput.value.trim();

    try {
      await API.webhookConfig.update(payload);
      this.showToast('Lưu cấu hình Webhook Zalo thành công!', 'success');
      tokenInput.value = '';
      secretInput.value = '';
      this.loadWebhookConfig();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async handleTestZaloApi() {
    const btn = document.getElementById('btnTestZaloApi');
    btn.disabled = true;
    btn.textContent = '⏳ Đang kiểm tra...';

    try {
      const res = await API.webhookConfig.testZalo();
      if (res.success) {
        this.showToast('✅ ' + res.message, 'success');
      } else {
        this.showToast('⚠️ ' + res.message, 'warning');
      }
    } catch (err) {
      this.showToast('❌ ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔄 Test Zalo API';
    }
  },

  copyWebhookUrl() {
    const input = document.getElementById('webhookUrlDisplay');
    if (!input) return;
    navigator.clipboard.writeText(input.value)
      .then(() => this.showToast('Đã sao chép Webhook URL vào clipboard!', 'success'))
      .catch(() => this.showToast('Không thể sao chép tự động. Vui lòng copy thủ công.', 'warning'));
  },

  async handleSimulateWebhook() {
    const input = document.getElementById('simulateMsgInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    try {
      await API.webhookConfig.simulate({ text });
      this.showToast('Đã gửi sự kiện Webhook mẫu! Kiểm tra tab Live Chat.', 'success');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async loadWebhookLogs() {
    const tbody = document.getElementById('webhookLogsTableBody');
    if (!tbody) return;

    try {
      const res = await API.webhookConfig.getLogs(30);
      this.currentWebhookLogs = res.logs || [];

      if (this.currentWebhookLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#6b7280">Chưa ghi nhận sự kiện Webhook nào. Hãy gửi tin nhắn từ Zalo để kiểm tra!</td></tr>';
        return;
      }

      tbody.innerHTML = this.currentWebhookLogs.map((log, index) => {
        let statusBadge = '<span class="status-pill" style="padding:2px 8px;font-size:0.75rem;">' + log.status + '</span>';
        if (log.status === 'success') {
          statusBadge = '<span class="status-pill" style="background:rgba(16,185,129,0.15);color:#34d399;border-color:rgba(16,185,129,0.3);padding:2px 8px;font-size:0.75rem;">Thành công</span>';
        } else if (log.status === 'ignored') {
          statusBadge = '<span class="status-pill" style="background:rgba(245,158,11,0.15);color:#fbbf24;border-color:rgba(245,158,11,0.3);padding:2px 8px;font-size:0.75rem;">Bỏ qua</span>';
        } else {
          statusBadge = '<span class="status-pill" style="background:rgba(239,68,68,0.15);color:#ef4444;border-color:rgba(239,68,68,0.3);padding:2px 8px;font-size:0.75rem;">Lỗi</span>';
        }

        return `
          <tr>
            <td>${this.formatDateTime(log.created_at)}</td>
            <td><code style="color:#818cf8;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;">${this.escapeHtml(log.event_type)}</code></td>
            <td><strong>${this.escapeHtml(log.sender_id)}</strong></td>
            <td>${statusBadge}</td>
            <td>
              <button class="pill-btn" onclick="App.viewPayload(${index})">Xem Payload JSON 🔍</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ef4444;padding:20px;">Lỗi tải nhật ký: ${err.message}</td></tr>`;
    }
  },

  async clearWebhookLogs() {
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ nhật ký Webhook?')) return;
    try {
      await API.webhookConfig.clearLogs();
      this.showToast('Đã xóa sạch nhật ký Webhook.', 'success');
      this.loadWebhookLogs();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  viewPayload(logIndex) {
    const log = this.currentWebhookLogs[logIndex];
    if (!log) return;
    const modal = document.getElementById('payloadModal');
    const content = document.getElementById('payloadModalContent');
    if (modal && content) {
      content.textContent = JSON.stringify(log.payload, null, 2);
      modal.classList.add('active');
    }
  },

  handleIncomingWebhookLog(logEntry) {
    if (this.currentTab === 'webhook') {
      this.loadWebhookLogs();
    }
    const lastActivity = document.getElementById('webhookLastActivity');
    if (lastActivity && logEntry.created_at) {
      lastActivity.textContent = this.formatDateTime(logEntry.created_at);
    }
  },

  togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  },

  // Helpers
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio autoplay may be blocked until user gesture
    }
  },

  formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  formatDateTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

