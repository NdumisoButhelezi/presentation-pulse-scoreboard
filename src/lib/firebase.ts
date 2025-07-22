import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { 
  initializeFirestore, 
  getFirestore,
  enableNetwork, 
  disableNetwork,
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  addDoc,
  deleteDoc,
  orderBy,
  serverTimestamp,
  persistentLocalCache,
  persistentSingleTabManager,
  CACHE_SIZE_UNLIMITED,
  enableIndexedDbPersistence,
  memoryLocalCache,
  Firestore,
  getDoc
} from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { DEFAULT_SCORING_CATEGORIES } from './scoringConfig';
import { SpectatorQuestion } from '@/types';
import { generatePresentationQRCode, getPresentationRatingUrl } from './qrcode';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate config
for (const [key, value] of Object.entries(firebaseConfig)) {
  if (!value) {
    throw new Error(`Missing Firebase config value for: ${key}`);
  }
}

// Track if we're in offline mode
let isOfflineMode = false;

// Create a custom error class for network errors
class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Initialize Firebase with better error handling
let app: FirebaseApp;
let db: Firestore;

try {
  // Check if the app is already initialized to prevent duplicate initialization
  const existingApps = getApps();
  if (existingApps.length === 0) {
    console.log("Initializing Firebase app...");
    app = initializeApp(firebaseConfig);
  } else {
    console.log("Firebase app already initialized");
    app = existingApps[0];
  }
} catch (error) {
  console.error("Error initializing Firebase app:", error);
  // Create a new app instance with a unique name as fallback
  app = initializeApp(firebaseConfig, `backup-${Date.now()}`);
}

// Initialize Auth
export const auth = getAuth(app);

// Try to connect to emulators if in development mode
if (import.meta.env.DEV) {
  try {
    // If you're using emulators, uncomment and configure these lines
    // connectAuthEmulator(auth, "http://localhost:9099");
    console.log("Development mode detected");
  } catch (error) {
    console.warn("Failed to connect to emulators:", error);
  }
}

// Initialize Firestore with robust error handling
try {
  console.log("Initializing Firestore with persistence...");
  
  // First try with persistence enabled
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({ forceOwnership: true }),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED
    })
  });
  
  console.log("Firestore initialized successfully with persistence");
} catch (err) {
  console.warn("Failed to initialize Firestore with persistence:", err);
  
  try {
    // Instead of trying to initialize again with different options,
    // just get the already initialized instance
    console.log("Getting existing Firestore instance...");
    db = getFirestore(app);
    console.log("Using existing Firestore instance");
  } catch (fallbackError) {
    console.error("Failed to get Firestore instance:", fallbackError);
    
    // Create a last resort initialization with no options
    console.log("Creating default Firestore instance as last resort");
    db = getFirestore(app);
  }
}

export { db, isOfflineMode, firebaseConfig };

// Track connection state
let connectionAttempts = 0;
const MAX_RETRIES = 3;
let connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Handle Firestore network connection
export const handleNetworkConnection = async (forceOffline: boolean = false) => {
  if (forceOffline) {
    try {
      console.log("Forcing offline mode...");
      await disableNetwork(db);
      isOfflineMode = true;
      return;
    } catch (error) {
      console.error("Error forcing offline mode:", error);
    }
  }

  // Reset connection timeout if it exists
  if (connectionTimeoutId) {
    clearTimeout(connectionTimeoutId);
    connectionTimeoutId = null;
  }

  // Reset network connection
  try {
    await disableNetwork(db);
    console.log("Network disabled before reconnection attempt");
  } catch (disableError) {
    console.warn("Could not disable network:", disableError);
  }

  // Wait a bit before trying to reconnect
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Attempt to reconnect
  connectionAttempts = 0;
  tryEnableNetwork();
};

// Retry logic for enabling network
const tryEnableNetwork = async () => {
  if (connectionAttempts >= MAX_RETRIES) {
    console.error("Maximum connection attempts reached. Using offline mode if available.");
    isOfflineMode = true;
    
    // Try again after 30 seconds
    connectionTimeoutId = setTimeout(() => {
      console.log("Retrying connection after timeout...");
      connectionAttempts = 0;
      tryEnableNetwork();
    }, 30000);
    
    return;
  }

  connectionAttempts++;
  console.log(`Enabling Firestore network, attempt ${connectionAttempts}...`);
  
  try {
    await enableNetwork(db);
    console.log("Firestore network connection enabled");
    connectionAttempts = 0;
    isOfflineMode = false;
    
  } catch (error) {
    console.warn(`Firestore network connection failed (attempt ${connectionAttempts}):`, error);
    
    // Check for specific errors that suggest we should switch to offline mode
    if (error instanceof Error && 
        (error.message.includes('INTERNAL ASSERTION FAILED') || 
         error.message.includes('Unexpected state'))) {
      console.warn("Internal Firestore error detected. Using offline mode...");
      isOfflineMode = true;
      
      // Don't retry immediately for internal assertion failures
      const backoffMs = 30000; // 30 seconds
      console.log(`Will retry connection in ${backoffMs/1000}s`);
      connectionTimeoutId = setTimeout(() => {
        console.log("Retrying after internal error...");
        connectionAttempts = 0;
        tryEnableNetwork();
      }, backoffMs);
    } else {
      // Retry with exponential backoff for other errors
      const backoffMs = Math.min(Math.pow(2, connectionAttempts) * 1000, 30000);
      console.log(`Retrying in ${backoffMs/1000}s...`);
      
      connectionTimeoutId = setTimeout(() => {
        tryEnableNetwork();
      }, backoffMs);
    }
  }
};

// Initialize network connection - optimize to prevent duplicate connection attempts
if (typeof window !== 'undefined') {
  const initializeNetworkOnce = () => {
    // Use a flag to ensure we only initialize once
    if (!(window as any).__firestoreNetworkInitialized) {
      setTimeout(() => {
        handleNetworkConnection();
        (window as any).__firestoreNetworkInitialized = true;
      }, 1000);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNetworkOnce);
  } else {
    initializeNetworkOnce();
  }
}

// Create a wrapper for Firestore operations with error handling and offline support
export const safeFirestoreOperation = async <T>(
  operation: () => Promise<T>,
  fallback: T,
  options: { retries?: number; retryDelay?: number } = {}
): Promise<T> => {
  const { retries = 2, retryDelay = 1000 } = options;
  let attempts = 0;
  
  while (attempts <= retries) {
    try {
      return await operation();
    } catch (error) {
      attempts++;
      console.error(`Firestore operation failed (attempt ${attempts}/${retries + 1}):`, error);
      
      if (attempts > retries) {
        console.warn("Max retries reached, returning fallback value");
        return fallback;
      }
      
      // If we have an internal assertion failure, try to reset the connection
      if (error instanceof Error && error.message.includes('INTERNAL ASSERTION FAILED')) {
        console.warn("Internal assertion error detected, resetting connection...");
        await handleNetworkConnection();
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  return fallback; // This should never be reached due to the while loop, but TypeScript needs it
};

// Handle Firebase errors with fallbacks to offline functionality
export const handleFirebaseError = (error: any, operation: string = 'operation') => {
  console.error(`Firebase ${operation} error:`, error);
  
  // Handle specific Firebase errors
  if (error?.code) {
    switch (error.code) {
      case 'permission-denied':
        return 'You do not have permission to perform this action.';
      case 'unavailable':
        // Network connectivity issue - try to re-establish connection
        handleNetworkConnection();
        return 'Service temporarily unavailable. The app will continue in offline mode.';
      case 'deadline-exceeded':
        return 'Request timed out. Please check your connection and try again.';
      case 'resource-exhausted':
        return 'Too many requests. Please wait a moment and try again.';
      case 'failed-precondition':
        // This could be due to offline persistence issues
        return 'The operation failed. Please refresh the page and try again.';
      default:
        return `An error occurred during ${operation}. Please try again.`;
    }
  }
  
  // Handle internal Firestore errors
  if (error?.message) {
    if (error.message.includes('INTERNAL ASSERTION FAILED') || 
        error.message.includes('Unexpected state')) {
      // For internal errors, try to reset connection
      handleNetworkConnection();
      return "Connection error detected. Switched to offline mode.";
    }
  }
  
  return `An unexpected error occurred during ${operation}. Please try again.`;
};

// Utility function to clean up duplicate votes (ensures one vote per user per presentation)
export const cleanupDuplicateVotes = async () => {
  try {
    const { collection, getDocs, query, where, deleteDoc, doc, orderBy } = await import('firebase/firestore');
    
    // Get all votes
    const votesSnapshot = await getDocs(collection(db, 'votes'));
    const votes = votesSnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    })) as Array<{ 
      id: string; 
      userId: string; 
      presentationId: string; 
      score: number; 
      role: string; 
      timestamp: any; 
    }>;
    
    // Group votes by userId and presentationId
    const voteGroups: Record<string, typeof votes> = {};
    votes.forEach(vote => {
      const key = `${vote.userId}-${vote.presentationId}`;
      if (!voteGroups[key]) {
        voteGroups[key] = [];
      }
      voteGroups[key].push(vote);
    });
    
    // Remove duplicate votes (keep only the most recent one)
    let duplicatesRemoved = 0;
    for (const [key, groupVotes] of Object.entries(voteGroups)) {
      if (groupVotes.length > 1) {
        // Sort by timestamp (most recent first) and keep only the first one
        groupVotes.sort((a, b) => {
          const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || 0).getTime();
          const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || 0).getTime();
          return timeB - timeA;
        });
        
        // Delete all but the most recent vote
        for (let i = 1; i < groupVotes.length; i++) {
          await deleteDoc(doc(db, 'votes', groupVotes[i].id));
          duplicatesRemoved++;
        }
      }
    }
    
    console.log(`Cleaned up ${duplicatesRemoved} duplicate votes`);
    return duplicatesRemoved;
  } catch (error) {
    console.error('Error cleaning up duplicate votes:', error);
    return 0;
  }
};

// Utility function to check for existing votes before creating new ones
export const checkExistingVote = async (userId: string, presentationId: string) => {
  try {
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    
    const votesQuery = query(
      collection(db, 'votes'),
      where('userId', '==', userId),
      where('presentationId', '==', presentationId)
    );
    
    const existingVotes = await getDocs(votesQuery);
    return existingVotes.docs.length > 0 ? existingVotes.docs[0] : null;
  } catch (error) {
    console.error('Error checking existing vote:', error);
    return null;
  }
};

// Process votes for a specific presentation and update its stats
export const processVotes = async (presentationId: string) => {
  console.log(`Processing votes for presentation: ${presentationId}`);
  // TODO: Implement vote processing logic
};

export async function fixNanScores() {
  const presentationsRef = collection(db, "presentations");
  const snapshot = await getDocs(presentationsRef);
  let fixedCount = 0;

  for (const presentationDoc of snapshot.docs) {
    const data = presentationDoc.data();
    if (typeof data.judgeTotal !== "number" || isNaN(data.judgeTotal)) {
      await updateDoc(doc(db, "presentations", presentationDoc.id), {
        judgeTotal: 0,
      });
      fixedCount++;
    }
    // Optionally fix other NaN fields here
  }
  return fixedCount;
}

export async function recalculateAllPresentationStats() {
  const presentationsRef = collection(db, "presentations");
  const snapshot = await getDocs(presentationsRef);
  let updatedCount = 0;

  for (const presentationDoc of snapshot.docs) {
    const presentationId = presentationDoc.id;
    
    // Get all votes for this presentation
    const votesRef = collection(db, "votes");
    const votesQuery = query(votesRef, where("presentationId", "==", presentationId));
    const votesSnapshot = await getDocs(votesQuery);
    
    const votes = votesSnapshot.docs.map(doc => doc.data());
    
    // Calculate judge scores
    const judgeVotes = votes.filter(vote => vote.role === "judge");
    const judgeScores = judgeVotes.map(vote => {
      if (typeof vote.totalScore === "number" && !isNaN(vote.totalScore)) {
        return vote.totalScore;
      }
          if (vote.ratings && Array.isArray(vote.ratings)) {
        return vote.ratings.reduce((sum, rating) => sum + (rating.score || 0), 0);
      }
      return vote.score || 0;
    }).filter(score => !isNaN(score));
    
    // Calculate spectator likes
    const spectatorLikes = votes.filter(vote => vote.role === "spectator").length;
    
    // Calculate judge total
    const judgeTotal = judgeScores.reduce((sum, score) => sum + score, 0);
    
    // Update presentation
    await updateDoc(doc(db, "presentations", presentationId), {
      judgeScores,
            judgeTotal,
            spectatorLikes
          });
    
    updatedCount++;
  }
  
  return updatedCount;
}

// Spectator Questions Management
export async function createSpectatorQuestion(questionData: Omit<SpectatorQuestion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const questionsRef = collection(db, "spectatorQuestions");
  const docRef = await addDoc(questionsRef, {
    ...questionData,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return docRef.id;
}

export async function updateSpectatorQuestion(questionId: string, updates: Partial<SpectatorQuestion>): Promise<void> {
  const questionRef = doc(db, "spectatorQuestions", questionId);
  await updateDoc(questionRef, {
    ...updates,
    updatedAt: new Date()
  });
}

export async function deleteSpectatorQuestion(questionId: string): Promise<void> {
  const questionRef = doc(db, "spectatorQuestions", questionId);
  await deleteDoc(questionRef);
}

export async function getSpectatorQuestions(): Promise<SpectatorQuestion[]> {
  const questionsRef = collection(db, "spectatorQuestions");
  const questionsQuery = query(questionsRef, orderBy("order", "asc"));
  const snapshot = await getDocs(questionsQuery);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date()
  })) as SpectatorQuestion[];
}

export async function getActiveSpectatorQuestions(): Promise<SpectatorQuestion[]> {
  const questionsRef = collection(db, "spectatorQuestions");
  const q = query(questionsRef, where("isActive", "==", true));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as SpectatorQuestion[];
}

// QR Code Management Functions
export async function generateQRCodeForPresentation(presentationId: string): Promise<{qrCode: string, qrCodeUrl: string}> {
  try {
    // Get presentation title for better QR code generation
    const presentationRef = doc(db, "presentations", presentationId);
    const presentationDoc = await getDoc(presentationRef);
    
    if (!presentationDoc.exists()) {
      throw new Error("Presentation not found");
    }
    
    const presentationData = presentationDoc.data();
    const title = presentationData.title || "Presentation";
    
    // Generate QR code and URL
    const qrCodeUrl = getPresentationRatingUrl(presentationId);
    const qrCode = await generatePresentationQRCode(presentationId, title);
    
    // Update the presentation with QR code info
    await updateDoc(presentationRef, {
      qrCode,
      qrCodeUrl,
      updatedAt: new Date()
    });
    
    return { qrCode, qrCodeUrl };
  } catch (error) {
    console.error("Error generating QR code for presentation:", error);
    throw error;
  }
}

export async function generateQRCodesForAllPresentations(): Promise<void> {
  try {
    const presentationsRef = collection(db, "presentations");
    const snapshot = await getDocs(presentationsRef);
    
    const updatePromises = snapshot.docs.map(async (docRef) => {
      try {
        await generateQRCodeForPresentation(docRef.id); // Always regenerate
        console.log(`Regenerated QR code for presentation: ${docRef.data().title}`);
      } catch (error) {
        console.error(`Failed to regenerate QR code for presentation ${docRef.id}:`, error);
      }
    });
    
    await Promise.all(updatePromises);
    console.log("Finished regenerating QR codes for all presentations");
  } catch (error) {
    console.error("Error regenerating QR codes for all presentations:", error);
    throw error;
  }
}

export async function ensurePresentationHasQRCode(presentationId: string): Promise<void> {
  try {
    const presentationRef = doc(db, "presentations", presentationId);
    const presentationDoc = await getDoc(presentationRef);
    
    if (!presentationDoc.exists()) {
      throw new Error("Presentation not found");
    }
    
    const data = presentationDoc.data();
    
    // Generate QR code if it doesn't exist
    if (!data.qrCode || !data.qrCodeUrl) {
      await generateQRCodeForPresentation(presentationId);
    }
  } catch (error) {
    console.error("Error ensuring presentation has QR code:", error);
    throw error;
  }
}