/**
 * Socket.IO Real-time Handler for Live Chat & CRM
 */
const SocketHandler = {
  socket: null,
  activeUserId: null,

  init() {
    if (typeof io === 'undefined') {
      console.warn('⚠️ Socket.io client library not loaded.');
      return;
    }

    this.socket = io({
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('⚡ Connected to Socket.IO server:', this.socket.id);
      this.updateStatus(true);
      this.socket.emit('join_admin_room');

      if (this.activeUserId) {
        this.socket.emit('join_conversation', this.activeUserId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from Socket.IO server');
      this.updateStatus(false);
    });

    // Listen for new messages
    this.socket.on('new_message', (data) => {
      window.dispatchEvent(new CustomEvent('socket:new_message', { detail: data }));
    });

    // Listen for user profile/status updates
    this.socket.on('user_updated', (user) => {
      window.dispatchEvent(new CustomEvent('socket:user_updated', { detail: user }));
    });

    // Listen for Human Handoff alerts
    this.socket.on('handoff_alert', (alertData) => {
      window.dispatchEvent(new CustomEvent('socket:handoff_alert', { detail: alertData }));
    });

    // Listen for incoming Webhook live event
    this.socket.on('webhook_event_received', (logEntry) => {
      window.dispatchEvent(new CustomEvent('socket:webhook_event_received', { detail: logEntry }));
    });
  },

  setActiveConversation(userId) {
    if (this.socket && this.activeUserId) {
      this.socket.emit('leave_conversation', this.activeUserId);
    }
    this.activeUserId = userId;
    if (this.socket && userId) {
      this.socket.emit('join_conversation', userId);
    }
  },

  updateStatus(isOnline) {
    const statusPill = document.getElementById('socketStatusPill');
    const statusText = document.getElementById('socketStatusText');
    if (statusPill && statusText) {
      if (isOnline) {
        statusPill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        statusPill.style.color = '#10b981';
        statusText.textContent = 'Real-time Online';
      } else {
        statusPill.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        statusPill.style.color = '#ef4444';
        statusText.textContent = 'Đang kết nối lại...';
      }
    }
  }
};

