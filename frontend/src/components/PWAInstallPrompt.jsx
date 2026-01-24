import { useState, useEffect } from 'react';
import '../styles/PWAInstallPrompt.css';

/**
 * PWA Install Prompt Component
 * Shows a banner prompting users to install the app on mobile/desktop
 */
function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if running on iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if already installed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches
                        || window.navigator.standalone
                        || localStorage.getItem('pwa-install-dismissed');

    if (isInstalled) {
      return;
    }

    // Listen for the beforeinstallprompt event (Chrome, Edge, etc.)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Show prompt after a short delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // Wait 3 seconds before showing
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show instructions after delay
    if (iOS && !isInstalled) {
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000); // Wait 5 seconds on iOS
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If on iOS, show instructions
      if (isIOS) {
        setShowIOSInstructions(true);
      }
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSInstructions(false);
    // Remember dismissal for 7 days
    const dismissedUntil = new Date().getTime() + (7 * 24 * 60 * 60 * 1000);
    localStorage.setItem('pwa-install-dismissed', dismissedUntil);
  };

  const handleIOSClose = () => {
    setShowIOSInstructions(false);
  };

  if (!showPrompt && !showIOSInstructions) {
    return null;
  }

  return (
    <>
      {/* Install Prompt Banner */}
      {showPrompt && !showIOSInstructions && (
        <div className="pwa-install-prompt">
          <div className="pwa-prompt-content">
            <div className="pwa-prompt-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
              </svg>
            </div>
            <div className="pwa-prompt-text">
              <div className="pwa-prompt-title">Install DOT Corridor Communicator</div>
              <div className="pwa-prompt-description">
                {isIOS
                  ? 'Add to your home screen for quick access and offline support'
                  : 'Install our app for faster access, offline support, and push notifications'
                }
              </div>
            </div>
            <div className="pwa-prompt-actions">
              <button
                className="pwa-btn pwa-btn-install"
                onClick={handleInstallClick}
              >
                {isIOS ? 'Show Me How' : 'Install'}
              </button>
              <button
                className="pwa-btn pwa-btn-dismiss"
                onClick={handleDismiss}
                aria-label="Dismiss install prompt"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="pwa-ios-modal-overlay" onClick={handleIOSClose}>
          <div className="pwa-ios-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pwa-ios-modal-header">
              <h3>Install on iOS</h3>
              <button
                className="pwa-ios-close"
                onClick={handleIOSClose}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="pwa-ios-modal-body">
              <ol className="pwa-ios-instructions">
                <li>
                  <span className="pwa-ios-step-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                    </svg>
                  </span>
                  Tap the <strong>Share</strong> button in Safari (bottom of screen)
                </li>
                <li>
                  <span className="pwa-ios-step-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                  </span>
                  Scroll down and tap <strong>"Add to Home Screen"</strong>
                </li>
                <li>
                  <span className="pwa-ios-step-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                    </svg>
                  </span>
                  Tap <strong>"Add"</strong> to confirm
                </li>
              </ol>
              <p className="pwa-ios-note">
                The app will appear on your home screen like a native app!
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PWAInstallPrompt;
