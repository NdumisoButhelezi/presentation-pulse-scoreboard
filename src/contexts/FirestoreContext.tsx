import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, handleNetworkConnection, isOfflineMode } from '@/lib/firebase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface FirestoreContextType {
  isOffline: boolean;
  isInitializing: boolean;
  reconnect: () => Promise<void>;
}

const FirestoreContext = createContext<FirestoreContextType>({
  isOffline: false,
  isInitializing: true,
  reconnect: async () => {}
});

export const useFirestore = () => useContext(FirestoreContext);

export const FirestoreProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [isOffline, setIsOffline] = useState(isOfflineMode);
  const [isInitializing, setIsInitializing] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);

  // Track network status
  useEffect(() => {
    const handleOnline = () => {
      console.log("Device is online, attempting to reconnect...");
      reconnect();
    };

    const handleOffline = () => {
      console.log("Device is offline");
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state and initialize Firestore
    const initialize = async () => {
      try {
        setIsInitializing(true);
        setIsOffline(isOfflineMode);
        await handleNetworkConnection();
      } catch (error) {
        console.error("Error initializing Firestore:", error);
        setIsOffline(true);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();

    // Check offline status periodically
    const intervalId = setInterval(() => {
      setIsOffline(isOfflineMode);
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, []);

  // Provide a way to manually reconnect
  const reconnect = async () => {
    try {
      setReconnecting(true);
      await handleNetworkConnection(false); // false means don't force offline
      setIsOffline(isOfflineMode);
    } catch (error) {
      console.error("Error reconnecting:", error);
    } finally {
      setReconnecting(false);
    }
  };

  return (
    <FirestoreContext.Provider value={{ isOffline, isInitializing, reconnect }}>
      {isOffline && !isInitializing && (
        <Alert className="fixed bottom-4 right-4 max-w-md z-50 border border-orange-200 bg-orange-50 text-orange-800 shadow-lg animate-slide-in-bottom">
          <div className="flex items-center">
            <WifiOff className="h-5 w-5 mr-2" />
            <div>
              <AlertTitle>Offline Mode</AlertTitle>
              <AlertDescription>
                You're currently working offline with limited functionality. 
                Some changes may not be saved until connection is restored.
              </AlertDescription>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 border-orange-300 text-orange-700 hover:bg-orange-100"
                onClick={reconnect}
                disabled={reconnecting || !navigator.onLine}
              >
                {reconnecting ? (
                  <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Reconnecting...</>
                ) : (
                  <><Wifi className="h-3.5 w-3.5 mr-1.5" /> Reconnect</>
                )}
              </Button>
            </div>
          </div>
        </Alert>
      )}
      {children}
    </FirestoreContext.Provider>
  );
};
