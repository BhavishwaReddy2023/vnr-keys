import axios from 'axios';
import { handleError } from '../utils/errorHandler.js';
import { config } from '../utils/config.js';

const API_URL = config.api.keysUrl;

/**
 * Process QR code scan for batch key return
 * @param {Object|string} qrData - The QR code data (object or JSON string)
 * @returns {Promise<Object>} The API response
 */
export const processBatchQRScanReturn = async (qrData) => {
  try {
    console.log('Processing batch QR scan return:', qrData);

    // Extract the inner qrData if nested
    const qrDataToSend = qrData.qrData || qrData;

    const response = await axios.post(`${API_URL}/qr/return`, {
      qrData: qrDataToSend
    }, {
      withCredentials: true,
    });

    return response.data;
  } catch (error) {
    console.error('Batch QR scan return error:', error);
    const errorMessage = handleError(error);
    throw new Error(errorMessage);
  }
};

/**
 * Process QR code scan for key return
 * @param {Object|string} qrData - The QR code data (object or JSON string)
 * @returns {Promise<Object>} The API response
 */
export const processQRScanReturn = async (qrData) => {
  try {
    console.log('Processing QR scan return:', qrData);

    // Try the primary route first
    let response;
    try {
      response = await axios.post(`${API_URL}/qr-scan/return`, {
        qrData
      }, {
        withCredentials: true,
      });
    } catch (primaryError) {
      console.log('Primary route failed, trying alternative route:', primaryError.message);

      // If primary route fails with routing error, try alternative route
      if (primaryError.response?.status === 404 || primaryError.message.includes('Invalid ID format')) {
        response = await axios.post(`${API_URL}/qr-scan-return`, {
          qrData
        }, {
          withCredentials: true,
        });
      } else {
        throw primaryError;
      }
    }

    // Don't show automatic success toast here - let the UI handle it
    // handleSuccess(response.data.message);
    return response.data;
  } catch (error) {
    console.error('QR scan return error:', error);
    const errorMessage = handleError(error);
    throw new Error(errorMessage);
  }
};

/**
 * Process QR code scan for key request
 * @param {Object|string} qrData - The QR code data (object or JSON string)
 * @returns {Promise<Object>} The API response
 */
export const processQRScanRequest = async (qrData) => {
  try {
    console.log('Processing QR scan request:', qrData);

    const response = await axios.post(`${API_URL}/qr-scan/request`, {
      qrData
    }, {
      withCredentials: true,
    });

    // Don't show automatic success toast here - let the UI handle it
    // handleSuccess(response.data.message);
    return response.data;
  } catch (error) {
    console.error('QR scan request error:', error);
    const errorMessage = handleError(error);
    throw new Error(errorMessage);
  }
};

/**
 * Validate QR code data structure
 * @param {Object} qrData - The QR code data to validate
 * @returns {Object} Validation result
 */
export const validateQRData = (qrData) => {
  const result = {
    isValid: false,
    type: null,
    errors: []
  };

  if (!qrData || typeof qrData !== 'object') {
    result.errors.push('QR data must be a valid object');
    return result;
  }

  // Timestamp validation logic (more lenient for testing)
  const now = Date.now();
  const maxTimeValidForQR = config.qr.validitySeconds;
  let qrTimestamp = null;
  
  console.log('🔍 QR Validation: Checking timestamp...', {
    qrData,
    maxTimeValidForQR,
    now: new Date(now).toISOString()
  });
  
  if (qrData.timestamp) {
    try {
      qrTimestamp = new Date(qrData.timestamp).getTime();
      if (isNaN(qrTimestamp)) {
        console.log('❌ QR Validation: Invalid timestamp format');
        result.errors.push('QR timestamp is invalid');
        return result;
      }
      
      const ageInSeconds = (now - qrTimestamp) / 1000;
      console.log('🔍 QR Validation: Timestamp age:', ageInSeconds, 'seconds');
      
      if (ageInSeconds > maxTimeValidForQR) {
        console.log('❌ QR Validation: QR code expired');
        result.errors.push(`QR code is expired (${Math.floor(ageInSeconds)} seconds old, max ${maxTimeValidForQR} seconds)`);
        return result;
      }
      
      console.log('✅ QR Validation: Timestamp is valid');
    } catch (e) {
      console.log('❌ QR Validation: Timestamp parsing error:', e);
      result.errors.push('QR timestamp parsing failed');
      return result;
    }
  } else {
    console.log('⚠️ QR Validation: No timestamp found, allowing for backward compatibility');
    // For backward compatibility, allow QR codes without timestamps
    // result.errors.push('QR code does not contain a timestamp');
    // return result;
  }

  // Check for batch return QR code
  if (qrData.type === 'KEY_RETURN' && Array.isArray(qrData.keyIds)) {
    console.log('✅ QR Validation: Valid KEY_RETURN QR code');
    result.isValid = true;
    result.type = 'KEY_RETURN';
    return result;
  }

  // Check for key return QR code
  if ((qrData.type === 'key-return' || qrData.type === 'KEY_RETURN') && qrData.keyId) {
    console.log('✅ QR Validation: Valid key-return QR code');
    result.isValid = true;
    result.type = 'key-return';
    return result;
  }

  // Check for key request QR code
  if (qrData.requestId && qrData.keyId && qrData.userId) {
    console.log('✅ QR Validation: Valid key-request QR code');
    result.isValid = true;
    result.type = 'key-request';
    return result;
  }

  // Check for legacy QR code formats (backward compatibility)
  if (qrData.type && qrData.keyId && qrData.userId) {
    console.log('✅ QR Validation: Valid legacy QR code format');
    result.isValid = true;
    result.type = qrData.type === 'KEY_RETURN' ? 'key-return' : 'key-request';
    return result;
  }

  console.log('❌ QR Validation: Invalid QR code data structure');
  result.errors.push('QR code does not contain valid key data (missing keyId, userId, or action identifier)');
  return result;
};

/**
 * Generate QR data for key request
 * @param {string} keyId - The key ID
 * @param {string} userId - The user ID
 * @returns {Object} QR data object
 */
export const generateKeyRequestQRData = (keyId, userId) => {
  // Validate input parameters
  if (!keyId) {
    throw new Error('Key ID is required for QR generation');
  }

  if (!userId) {
    throw new Error('User ID is required for QR generation');
  }

  // Ensure IDs are strings (MongoDB ObjectIds should be strings)
  const keyIdStr = String(keyId);
  const userIdStr = String(userId);

  return {
    type: 'key-request',
    keyId: keyIdStr,
    userId: userIdStr,
    timestamp: new Date().toISOString(),
    requestId: `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  };
};

/**
 * Generate QR data for key return
 * @param {string} keyId - The key ID
 * @param {string} userId - The user ID
 * @returns {Object} QR data object
 */
export const generateKeyReturnQRData = (keyId, userId) => {
  if (!keyId) {
    throw new Error('Key ID is required for QR generation');
  }

  if (!userId) {
    throw new Error('User ID is required for QR generation');
  }

  const keyIdStr = String(keyId);
  const userIdStr = String(userId);

  return {
    type: 'key-return',
    keyId: keyIdStr,
    userId: userIdStr,
    timestamp: new Date().toISOString(),
    returnId: `ret-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  };
};

/**
 * Parse QR code string data
 * @param {string} qrString - The QR code string
 * @returns {Object} Parsed QR data
 */
/**
 * Generate QR data for batch key return
 * @param {string[]} keyIds - Array of key IDs
 * @param {string} userId - The user ID
 * @returns {Object} QR data object
 */
export const generateBatchReturnQRData = (keyIds, userId) => {
  if (!Array.isArray(keyIds) || keyIds.length === 0) {
    throw new Error('At least one key ID is required for batch return QR generation');
  }

  if (!userId) {
    throw new Error('User ID is required for QR generation');
  }

  const keyIdsStr = keyIds.map(id => String(id));
  const userIdStr = String(userId);

  return {
    type: 'KEY_RETURN',
    keyIds: keyIdsStr,
    userId: userIdStr,
    timestamp: new Date().toISOString(),
    returnId: `batch-ret-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  };
};

export const parseQRString = (qrString) => {
  try {
    return JSON.parse(qrString);
  } catch (error) {
    throw new Error('Invalid QR code format - not valid JSON');
  }
};
