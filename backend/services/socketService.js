/**
 * Socket.IO service for real-time key management updates
 */

/**
 * Emit key status update to all connected clients
 * @param {Object} keyData - The updated key data
 * @param {string} action - The action performed (take, return, create, update, delete)
 * @param {string} userId - The user who performed the action
 */
export const emitKeyUpdate = (keyData, action, userId = null) => {
  if (!global.io) {
    console.warn('Socket.IO not initialized');
    return;
  }

  const updateData = {
    key: keyData,
    action,
    userId,
    timestamp: new Date().toISOString()
  };

  // Emit to all clients in the keys-updates room
  global.io.to('keys-updates').emit('key-updated', updateData);

  // If it's a take/return action, also emit to the specific user's room
  if (userId && (action === 'take' || action === 'return')) {
    global.io.to(`user-${userId}`).emit('user-key-updated', updateData);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`🔄 Key update emitted: ${action} - Key ${keyData.keyNumber} by user ${userId || 'system'}`);
  }
};

/**
 * Emit key taken event
 * @param {Object} keyData - The key that was taken
 * @param {string} userId - The user who took the key
 */
export const emitKeyTaken = (keyData, userId) => {
  emitKeyUpdate(keyData, 'take', userId);
};

/**
 * Emit key returned event
 * @param {Object} keyData - The key that was returned
 * @param {string} userId - The user who returned the key (or admin/security who processed it)
 */
export const emitKeyReturned = (keyData, userId) => {
  emitKeyUpdate(keyData, 'return', userId);
};

/**
 * Emit key created event
 * @param {Object} keyData - The new key data
 * @param {string} adminId - The admin who created the key
 */
export const emitKeyCreated = (keyData, adminId) => {
  emitKeyUpdate(keyData, 'create', adminId);
};

/**
 * Emit key updated event
 * @param {Object} keyData - The updated key data
 * @param {string} adminId - The admin who updated the key
 */
export const emitKeyUpdated = (keyData, adminId) => {
  emitKeyUpdate(keyData, 'update', adminId);
};

/**
 * Emit key deleted event
 * @param {Object} keyData - The deleted key data
 * @param {string} adminId - The admin who deleted the key
 */
export const emitKeyDeleted = (keyData, adminId) => {
  emitKeyUpdate(keyData, 'delete', adminId);
};

/**
 * Emit frequently used status toggle event
 * @param {Object} keyData - The key with updated frequently used status
 * @param {string} userId - The user who toggled the status
 */
export const emitFrequentlyUsedToggled = (keyData, userId) => {
  emitKeyUpdate(keyData, 'toggle-frequent', userId);
};

/**
 * Emit QR code scan event for key return
 * @param {Object} keyData - The key being returned via QR scan
 * @param {string} scannerId - The user (security) who scanned the QR code
 * @param {string} originalUserId - The original user who had the key
 */
export const emitQRScanReturn = (keyData, scannerId, originalUserId) => {
  const updateData = {
    key: keyData,
    action: 'qr-return',
    scannerId,
    originalUserId,
    timestamp: new Date().toISOString()
  };

  // Emit to all clients
  global.io.to('keys-updates').emit('key-updated', updateData);
  
  // Emit to both the scanner and original user
  global.io.to(`user-${scannerId}`).emit('user-key-updated', updateData);
  global.io.to(`user-${originalUserId}`).emit('user-key-updated', updateData);

  if (process.env.NODE_ENV === 'development') {
    console.log(`📱 QR scan return emitted: Key ${keyData.keyNumber} scanned by ${scannerId}, originally taken by ${originalUserId}`);
  }
};

/**
 * Emit QR code scan event for key request
 * @param {Object} keyData - The key being requested via QR scan
 * @param {string} scannerId - The user (security) who scanned the QR code
 * @param {string} requestingUserId - The user who requested the key
 */
export const emitQRScanRequest = (keyData, scannerId, requestingUserId) => {
  const updateData = {
    key: keyData,
    action: 'qr-request',
    scannerId,
    requestingUserId,
    timestamp: new Date().toISOString()
  };

  // Emit to all clients
  global.io.to('keys-updates').emit('key-updated', updateData);

  // Emit to both the scanner and requesting user
  global.io.to(`user-${scannerId}`).emit('user-key-updated', updateData);
  global.io.to(`user-${requestingUserId}`).emit('user-key-updated', updateData);

  if (process.env.NODE_ENV === 'development') {
    console.log(`📱 QR scan request emitted: Key ${keyData.keyNumber} scanned by ${scannerId}, requested by ${requestingUserId}`);
  }
};

/**
 * Get connected clients count
 * @returns {number} Number of connected clients
 */
export const getConnectedClientsCount = () => {
  if (!global.io) {
    return 0;
  }
  return global.io.engine.clientsCount;
};

/**
 * Get clients in a specific room
 * @param {string} room - Room name
 * @returns {Promise<Set>} Set of socket IDs in the room
 */
export const getClientsInRoom = async (room) => {
  if (!global.io) {
    return new Set();
  }
  return await global.io.in(room).allSockets();
};
