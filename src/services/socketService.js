const { Server } = require('socket.io');

class SocketService {
  constructor() {
    this.io = null;
  }

  /**
   * Initialize Socket.IO with HTTP server
   */
  init(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`🔌 [SocketService] Client connected: ${socket.id}`);

      // Join admin dashboard room
      socket.on('join_admin_room', () => {
        socket.join('admin_room');
        console.log(`📡 [SocketService] Socket ${socket.id} joined admin_room`);
      });

      // Join specific conversation room (for live chat view)
      socket.on('join_conversation', (userId) => {
        if (userId) {
          socket.join(`conv_${userId}`);
          console.log(`📡 [SocketService] Socket ${socket.id} joined conv_${userId}`);
        }
      });

      socket.on('leave_conversation', (userId) => {
        if (userId) {
          socket.leave(`conv_${userId}`);
        }
      });

      socket.on('disconnect', () => {
        console.log(`🔌 [SocketService] Client disconnected: ${socket.id}`);
      });
    });

    console.log('✅ [SocketService] Socket.IO initialized successfully.');
  }

  /**
   * Broadcast a new message to admin dashboard and conversation room
   */
  emitNewMessage(message, user) {
    if (!this.io) return;

    const payload = {
      message,
      user: user
        ? {
            id: user.id,
            zalo_user_id: user.zalo_user_id,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            is_human_mode: user.is_human_mode,
            tags: user.tags
          }
        : null
    };

    // Emit to general admin room
    this.io.to('admin_room').emit('new_message', payload);

    // Emit to specific user conversation room
    if (message.user_id) {
      this.io.to(`conv_${message.user_id}`).emit('new_message', payload);
    }
  }

  /**
   * Emit user status changes (e.g., human mode toggled, tags updated)
   */
  emitUserUpdate(user) {
    if (!this.io || !user) return;
    this.io.to('admin_room').emit('user_updated', user);
    this.io.to(`conv_${user.id}`).emit('user_updated', user);
  }

  /**
   * Broadcast alert when a user requests human handoff
   */
  emitHandoffAlert(user, reason = 'Yêu cầu gặp nhân viên tư vấn') {
    if (!this.io || !user) return;
    this.io.to('admin_room').emit('handoff_alert', {
      user,
      reason,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new SocketService();

