import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { QrCode, Key, KeyRound, CheckCircle } from "lucide-react";
import { useKeyStore } from "../../store/keyStore";
import { useAuthStore } from "../../store/authStore";
import BottomNavigation from "../../components/ui/BottomNavigation";
import KeyCard from "../../components/keys/KeyCard";
import QRScanner from "../../components/keys/QRScanner";
import { processQRScanReturn, processQRScanRequest, validateQRData, parseQRString } from "../../services/qrService";

const SecurityDashboard = () => {
  const [activeTab, setActiveTab] = useState("scanner");
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showScanResult, setShowScanResult] = useState(false);
  const [showReturnConfirmation, setShowReturnConfirmation] = useState(false);
  const [pendingReturnData, setPendingReturnData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { user } = useAuthStore();
  const {
    getAvailableKeys,
    getUnavailableKeys,
    fetchKeys,
    returnKeyAPI
  } = useKeyStore();

  // Fetch keys on component mount
  useEffect(() => {
    if (user) {
      fetchKeys().catch(console.error);
    }
  }, [user, fetchKeys]);

  const availableKeys = getAvailableKeys();
  const unavailableKeys = getUnavailableKeys();

  const tabs = [
    {
      id: "scanner",
      label: "QR Scanner",
      icon: <QrCode className="w-6 h-6" />,
    },
    {
      id: "available",
      label: "Available Keys",
      icon: <Key className="w-6 h-6" />,
      badge: availableKeys.length,
    },
    {
      id: "unavailable",
      label: "Unavailable Keys",
      icon: <KeyRound className="w-6 h-6" />,
      badge: unavailableKeys.length,
    },
  ];

  const handleQRScan = async (qrData) => {
    try {
      console.log('QR scan received:', qrData);

      // Parse QR data if it's a string
      let parsedData = qrData;
      if (typeof qrData === 'string') {
        parsedData = parseQRString(qrData);
      }

      // Validate QR data
      const validation = validateQRData(parsedData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Handle different QR code types
      if (validation.type === 'key-return') {
        // For returns, fetch key and user details first, then show confirmation dialog
        try {
          console.log('🔍 Fetching details for keyId:', parsedData.keyId, 'userId:', parsedData.userId);

          // Create proper API URLs
          const keyUrl = `/api/keys/${parsedData.keyId}`;
          const userUrl = `/api/auth/user/${parsedData.userId}`;

          console.log('🔍 Key URL:', keyUrl);
          console.log('🔍 User URL:', userUrl);

          const [keyResponse, userResponse] = await Promise.all([
            fetch(keyUrl, {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              }
            }),
            fetch(userUrl, {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              }
            })
          ]);

          let keyData = null;
          let userData = null;

          console.log('🔍 Key response status:', keyResponse.status);
          console.log('🔍 User response status:', userResponse.status);

          if (keyResponse.ok) {
            const keyResult = await keyResponse.json();
            console.log('🔍 Key result:', keyResult);
            // Handle nested data structure: keyResult.data.key
            keyData = keyResult.data?.key || keyResult.data || keyResult;
            console.log('🔍 Extracted keyData:', keyData);
          } else {
            const errorText = await keyResponse.text();
            console.error('❌ Key fetch failed:', keyResponse.status, errorText);
          }

          if (userResponse.ok) {
            const userResult = await userResponse.json();
            console.log('🔍 User result:', userResult);
            // Handle user data structure: userResult.user
            userData = userResult.user || userResult.data || userResult;
            console.log('🔍 Extracted userData:', userData);
          } else {
            const errorText = await userResponse.text();
            console.error('❌ User fetch failed:', userResponse.status, errorText);
          }

          // Extract data with multiple fallback strategies
          const extractedKeyNumber = keyData?.keyNumber || keyData?.number || 'Unknown';
          const extractedKeyName = keyData?.keyName || keyData?.name || 'Unknown Key';
          const extractedUserName = userData?.name || userData?.username || userData?.displayName || 'Unknown User';
          const extractedUserEmail = userData?.email || userData?.emailAddress || 'Unknown Email';

          // Create display data with fallbacks
          const displayData = {
            ...parsedData,
            keyNumber: extractedKeyNumber,
            keyName: extractedKeyName,
            keyFullName: (extractedKeyNumber !== 'Unknown' && extractedKeyName !== 'Unknown Key')
              ? `Key ${extractedKeyNumber} (${extractedKeyName})`
              : `Key #${parsedData.keyId.substring(0, 8)}...`,
            userName: extractedUserName,
            userEmail: extractedUserEmail
          };

          console.log('🔍 Final display data:', displayData);

          setPendingReturnData(displayData);
          setShowReturnConfirmation(true);
          setShowScanner(false);
        } catch (error) {
          console.error("Error fetching key/user details:", error);

          // TEMPORARY: Try to process the QR scan directly to get data from backend
          console.log('🔄 Attempting direct QR scan processing to get data from backend...');
          try {
            const result = await processQRScanReturn(parsedData);
            console.log('✅ Got data from backend (direct path):', result);
            console.log('✅ Original User Data (direct path):', result.data.originalUser);

            setScanResult({
              success: true,
              message: result.message,
              keyData: {
                ...result.data.key,
                keyNumber: result.data.key.keyNumber,
                keyName: result.data.key.keyName,
                returnedBy: result.data.originalUser,
                collectedBy: result.data.scannedBy
              },
              type: 'return'
            });
            setShowScanResult(true);
            setShowScanner(false);
            return;
          } catch (directError) {
            console.error("Direct processing also failed:", directError);
          }

          // Show confirmation with basic data and shortened ID
          const shortKeyId = parsedData.keyId.substring(0, 8);
          const shortUserId = parsedData.userId.substring(0, 8);

          setPendingReturnData({
            ...parsedData,
            keyNumber: 'Unknown',
            keyName: 'Unknown Key',
            keyFullName: `Key #${shortKeyId}...`,
            userName: `User #${shortUserId}...`,
            userEmail: 'Unknown Email'
          });
          setShowReturnConfirmation(true);
          setShowScanner(false);
        }
      } else if (validation.type === 'key-request') {
        // For requests, process immediately as before
        const result = await processQRScanRequest(parsedData);
        setScanResult({
          success: true,
          message: result.message,
          keyData: {
            ...result.data.key,
            keyNumber: result.data.key.keyNumber,
            keyName: result.data.key.keyName,
            takenBy: result.data.originalUser || result.data.requestedBy, // The person who requested the key
            givenBy: result.data.scannedBy    // The security person who gave it
          },
          type: 'request'
        });
        setShowScanResult(true);
        setShowScanner(false);
      } else {
        throw new Error('Unsupported QR code type');
      }
    } catch (error) {
      console.error("QR scan error:", error);
      setScanResult({
        success: false,
        message: error.message || 'Failed to process QR code',
        type: 'error'
      });
      setShowScanResult(true);
      setShowScanner(false);
    }
  };

  const handleCollectReturn = async () => {
    if (!pendingReturnData) return;

    setIsProcessing(true);
    try {
      const result = await processQRScanReturn(pendingReturnData);
      console.log('🔍 QR Scan Return Result:', result);
      console.log('🔍 Original User Data:', result.data.originalUser);
      console.log('🔍 Scanned By Data:', result.data.scannedBy);

      setScanResult({
        success: true,
        message: result.message,
        keyData: {
          ...result.data.key,
          keyNumber: result.data.key.keyNumber,
          keyName: result.data.key.keyName,
          returnedBy: result.data.originalUser, // The person who returned the key
          collectedBy: result.data.scannedBy    // The security person who collected it
        },
        type: 'return'
      });
      setShowReturnConfirmation(false);
      setShowScanResult(true);
      setPendingReturnData(null);
    } catch (error) {
      console.error("Error processing return:", error);
      setScanResult({
        success: false,
        message: error.message || 'Failed to process key return',
        type: 'error'
      });
      setShowReturnConfirmation(false);
      setShowScanResult(true);
      setPendingReturnData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectReturn = () => {
    // For now, just close the confirmation dialog
    // In the future, you could add a rejection reason or notification
    setShowReturnConfirmation(false);
    setPendingReturnData(null);

    // Show a rejection message
    setScanResult({
      success: false,
      message: 'Key return was rejected by security',
      type: 'rejected'
    });
    setShowScanResult(true);
  };

  const handleCollectKey = async (keyId) => {
    try {
      await returnKeyAPI(keyId);
    } catch (error) {
      console.error("Collect key error:", error);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "scanner":
        return (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              <QrCode className="w-24 h-24 text-green-400 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-white mb-4">QR Scanner</h2>
              <p className="text-gray-300 mb-8">
                Scan QR codes from faculty to approve key requests or returns
              </p>
              <button
                onClick={() => setShowScanner(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors flex items-center gap-3 mx-auto"
              >
                <QrCode className="w-6 h-6" />
                Start Scanning
              </button>
            </div>
          </div>
        );

      case "available":
        return (
          <div className="flex-1 p-4 pb-20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Available Keys</h2>
              <div className="bg-green-600/20 text-green-300 px-3 py-1 rounded-full text-sm font-medium border border-green-600/30">
                {availableKeys.length} Available
              </div>
            </div>

            {availableKeys.length === 0 ? (
              <div className="text-center py-12">
                <Key className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No keys available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableKeys.map((key) => (
                  <KeyCard
                    key={key.id}
                    keyData={key}
                    variant="available"
                  />
                ))}
              </div>
            )}
          </div>
        );

      case "unavailable":
        return (
          <div className="flex-1 p-4 pb-20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Unavailable Keys</h2>
              <div className="bg-red-600/20 text-red-300 px-3 py-1 rounded-full text-sm font-medium border border-red-600/30">
                {unavailableKeys.length} Taken
              </div>
            </div>

            {unavailableKeys.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">All keys are available!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {unavailableKeys.map((key) => (
                  <KeyCard
                    key={key.id}
                    keyData={key}
                    variant="unavailable"
                    onCollectKey={handleCollectKey}
                  />
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-emerald-900 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Security Dashboard</h1>
            <p className="text-gray-300">Welcome, {user?.name}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-lg px-3 py-2">
            <span className="text-green-400 font-medium">Online</span>
          </div>
        </div>
      </div>

      {/* Content */}
      {renderTabContent()}

      {/* Bottom Navigation */}
      <BottomNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={showScanner}
        onScan={handleQRScan}
        onClose={() => setShowScanner(false)}
      />

      {/* Return Confirmation Modal */}
      {showReturnConfirmation && pendingReturnData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl p-6 max-w-md w-full"
          >
            <div className="text-center">
              <Key className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Confirm Key Return
              </h3>
              <h4 className="text-lg font-semibold text-gray-700 mb-4">
                {pendingReturnData.keyFullName}
              </h4>

              {/* Key and User Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <div className="mb-3">
                  <p className="font-medium text-gray-900 mb-1">Returning Person:</p>
                  <p className="text-gray-600">{pendingReturnData.userName}</p>
                  <p className="text-gray-500 text-sm">{pendingReturnData.userEmail}</p>
                </div>
                <div className="mb-3">
                  <p className="font-medium text-gray-900 mb-1">Key Details:</p>
                  <p className="text-gray-600">Key {pendingReturnData.keyNumber}</p>
                  <p className="text-gray-500 text-sm">{pendingReturnData.keyName}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-1">Return Time:</p>
                  <p className="text-gray-500 text-sm">{new Date().toLocaleString()}</p>
                </div>
              </div>

              <p className="text-gray-600 mb-6">
                Do you want to collect this key return?
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleRejectReturn}
                  disabled={isProcessing}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={handleCollectReturn}
                  disabled={isProcessing}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    'Collect'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Scan Result Modal */}
      {showScanResult && scanResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl p-6 max-w-sm w-full"
          >
            <div className="text-center">
              {console.log('🔍 Scan Result Data:', scanResult)}
              {console.log('🔍 Key Data:', scanResult.keyData)}
              {console.log('🔍 Returned By:', scanResult.keyData?.returnedBy)}
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Key {scanResult.keyData?.keyNumber || scanResult.key?.keyNumber || 'Unknown'}
              </h3>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">
                ({scanResult.keyData?.keyName || scanResult.key?.keyName || 'Unknown Key'})
              </h4>

              {/* User details section with dynamic text */}
              {/* <div className="bg-gray-50 rounded-lg p-4 mb-4"> */}
                {/* <p className="font-medium text-gray-900 mb-1">
                  {scanResult.type === 'return' ? 'Returned By:' :
                   scanResult.type === 'request' ? 'Collected By:' :
                   'Processed By:'}
                </p> */}
                {/* <p className="text-gray-600">
                  {scanResult.type === 'return' ?
                    (scanResult.keyData?.returnedBy?.name || 'Unknown User') :
                   scanResult.type === 'request' ?
                    (scanResult.keyData?.takenBy?.name || scanResult.key?.takenBy?.name || 'Unknown User') :
                   'Security Personnel'}
                </p> */}
                {/* <p className="text-gray-500 text-sm">
                  {scanResult.type === 'return' ?
                    (scanResult.keyData?.returnedBy?.email || 'N/A') :
                   scanResult.type === 'request' ?
                    (scanResult.keyData?.takenBy?.email || scanResult.key?.takenBy?.email || 'N/A') :
                   'N/A'}
                </p> */}
                {/* <p className="text-gray-400 text-xs mt-1">
                  {new Date().toLocaleString()}
                </p> */}
              {/* </div> */}

              <p className="text-gray-600 mb-6">
                {scanResult.message}    
              </p>
              <button
                onClick={() => setShowScanResult(false)}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                Continue
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SecurityDashboard;