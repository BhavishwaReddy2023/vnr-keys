import { io } from 'socket.io-client';
import { config } from '../utils/config.js';
import { useAuthStore } from '../store/authStore.js';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
  }

  /**
   * Initialize socket connection
   */
  connect() {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    const serverUrl = config.socket.url;

    if (import.meta.env.MODE === 'development') {
      console.log('🔌 Connecting to Socket.IO server:', serverUrl);
    }

    this.socket = io(serverUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    });

    this.setupEventListeners();
    return this.socket;
  }

  /**
   * Setup socket event listeners
   */
  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      if (import.meta.env.MODE === 'development') {
        console.log('✅ Connected to Socket.IO server');
      }
      this.isConnected = true;
      this.reconnectAttempts = 0;

      const userId = this.getCurrentUserId();
      const role = this.getCurrentUserRole();

      // Join user-specific room for personal notifications
      if (userId) {
        console.log('👤 Joining user room:', userId);
        this.socket.emit('join-user-room', userId);
      }

      // Join role-based room for notifications
      if (role) {
        console.log('👥 Joining role room:', role);
        this.socket.emit('join-role-room', role);
      }

      // Join keys updates room
      this.socket.emit('join-keys-room');
      
      // Join role-based room for notifications
      const userRole = this.getCurrentUserRole();
      if (userRole) {
        this.socket.emit('join-role-room', userRole);
      }
    });

    this.socket.on('disconnect', (reason) => {
      if (import.meta.env.MODE === 'development') {
        console.log('❌ Disconnected from Socket.IO server:', reason);
      }
      this.isConnected = false;

      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.handleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error);
      this.isConnected = false;
      this.handleReconnect();
    });

    // Key update events
    this.socket.on('key-updated', (data) => {
      console.log('🔄 Key update received:', data);
      this.emit('keyUpdated', data);
    });

    this.socket.on('user-key-updated', (data) => {
      console.log('👤 User key update received:', data);
      this.emit('userKeyUpdated', data);
    });

    // Notification events
    this.socket.on('notification', (data) => {
      console.log('🔔 Notification received:', data);
      this.emit('notification', data);
    });

    this.socket.on('notification-count-update', (data) => {
      console.log('🔢 Notification count update received:', data);
      this.emit('notification-count-update', data);
    });
  }

  /**
   * Handle reconnection logic
   */
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Get current user ID from auth store
   */
  getCurrentUserId() {
    try {
      const { user } = useAuthStore.getState();
      return user?.id || null;
    } catch (error) {
      console.warn('Could not get current user ID:', error);
      return null;
    }
  }

  /**
   * Get current user role from auth store
   */
  getCurrentUserRole() {
    try {
      const { user } = useAuthStore.getState();
      return user?.role || null;
    } catch (error) {
      console.warn('Could not get current user role:', error);
      return null;
    }
  }

  /**
   * Join user-specific room
   */
  joinUserRoom(userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-user-room', userId);
    }
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting from Socket.IO server');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  /**
   * Check if socket is connected
   */
  isSocketConnected() {
    return this.socket && this.isConnected;
  }

  /**
   * Get socket instance
   */
  getSocket() {
    return this.socket;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
