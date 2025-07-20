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
  serverTimestamp,
  persistentLocalCache,
  persistentSingleTabManager,
  CACHE_SIZE_UNLIMITED,
  enableIndexedDbPersistence,
  memoryLocalCache,
  Firestore
} from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { DEFAULT_SCORING_CATEGORIES } from './scoringConfig';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDkqha2lfDvtuFhDhTR84SzauPtOlQRnbE",
  authDomain: "presentscore-5068b.firebaseapp.com",
  projectId: "presentscore-5068b",
  storageBucket: "presentscore-5068b.firebasestorage.app",
  messagingSenderId: "54064814647",
  appId: "1:54064814647:web:b6a89104282f466c627db2",
  measurementId: "G-QG21FNLV1V"
};

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

export { db, isOfflineMode };

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
  console.log(`Processing votes for presentation ${presentationId}`);
  
  return safeFirestoreOperation(
    async () => {
      // Get all votes for this presentation
      const votesRef = collection(db, 'votes');
      const q = query(votesRef, where('presentationId', '==', presentationId));
      const votesSnapshot = await getDocs(q);
      
      console.log(`Found ${votesSnapshot.docs.length} votes for this presentation`);

      // Define type for Vote
      interface Vote {
        id: string;
        userId: string;
        presentationId: string;
        role?: string;
        ratings?: Array<{ categoryId: string; score: number }>;
        totalScore?: number;
        score?: number;
        timestamp: any;
        [key: string]: any;
      }

      // Calculate judge scores with proper typing
      const judgeVotes = votesSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Vote))
        .filter(vote => vote.role === 'judge');
        
      console.log(`Found ${judgeVotes.length} judge votes`);

      let judgeScores: number[] = [];
      
      // Handle both old and new vote formats
      for (const vote of judgeVotes) {
        let scoreValue = 0;
        
        try {
          // Just use raw ratings sum - NO multiplication
          if (vote.ratings && Array.isArray(vote.ratings)) {
            // Simple sum without any multiplication
            scoreValue = vote.ratings.reduce((sum, rating) => {
              const ratingScore = typeof rating.score === 'number' ? rating.score : 0;
              return sum + ratingScore;
            }, 0);
            
            console.log(`Pure sum for vote ${vote.id}: ${scoreValue}`);
          } 
          // Use pre-stored score if no ratings available
          else if (typeof vote.totalScore === 'number' && !isNaN(vote.totalScore)) {
            scoreValue = vote.totalScore;
          } 
          // Legacy format
          else if (typeof vote.score === 'number' && !isNaN(vote.score)) {
            scoreValue = vote.score;
          }
          
          // Debug each vote calculation
          console.log(`Processing vote for ${presentationId}: userId=${vote.userId}, scoreValue=${scoreValue}`);
          
          // Validate score and add to array if valid
          if (!isNaN(scoreValue)) {
            judgeScores.push(scoreValue);
            console.log(`Added score: ${scoreValue}`);
          } else {
            console.log(`Invalid score value: ${scoreValue} - skipping`);
          }
        } catch (error) {
          console.error("Error processing judge vote:", error);
          // Skip this vote on error
        }
      }
      
      // Extra validation to ensure no invalid scores but don't filter out high values
      const validJudgeScores = judgeScores
        .map(score => Number(score))
        .filter(score => !isNaN(score) && score > 0);
      
      console.log(`Final valid scores for ${presentationId}:`, validJudgeScores);
      
      // Count spectator likes
      const spectatorLikes = votesSnapshot.docs
        .map(doc => doc.data())
        .filter(vote => vote.role === 'spectator')
        .length;

      // Calculate judge total - pure addition only
      const judgeTotal = validJudgeScores.length > 0 
        ? validJudgeScores.reduce((sum, score) => sum + score, 0)
        : 0;

      // Print each score value being summed for debugging
      console.log(`Judge scores for ${presentationId}:`, validJudgeScores);
      console.log(`Judge total for ${presentationId}: ${validJudgeScores.reduce((sum, score) => {
        console.log(`Adding ${score} to running total ${sum}`);
        return sum + score;
      }, 0)}`);

      // Add extra debug for "Performance Analysis..." presentation
      if (validJudgeScores.length > 0) {
        const { getDoc } = await import('firebase/firestore');
        const presRef = doc(db, 'presentations', presentationId);
        const presData = await getDoc(presRef);
        const title = presData.data()?.title;
        if (title && title.includes("Performance Analysis")) {
          console.log(`Processing votes for target presentation "${title}":`, {
            presentationId,
            validJudgeScores,
            judgeTotal,
            spectatorLikes
          });
        }
      }

      // ALWAYS update the presentation, even if we have no scores
      try {
        const presentationRef = doc(db, 'presentations', presentationId);
        
        // Don't filter out high scores - they are valid from the scaled calculation
        console.log(`Updating presentation ${presentationId} with judgeScores:`, validJudgeScores);
        console.log(`Judge total for presentation ${presentationId}:`, judgeTotal);
        
        // Update with consistent data structures but keep the original scores
        await updateDoc(presentationRef, {
          judgeScores: validJudgeScores,
          judgeTotal: judgeTotal, // Store the total explicitly
          spectatorLikes: spectatorLikes || 0,
          lastUpdated: serverTimestamp() || new Date()
        });
        
      } catch (updateError) {
        console.error(`Error updating presentation ${presentationId}:`, updateError);
        
        // Try one more time with a simpler update
        try {
          const presentationRef = doc(db, 'presentations', presentationId);
          
          // Calculate judge total here too
          const judgeTotal = validJudgeScores.length > 0 
            ? validJudgeScores.reduce((sum, score) => sum + score, 0)
            : 0;
            
          await updateDoc(presentationRef, {
            judgeScores: validJudgeScores.length > 0 ? validJudgeScores : [],
            judgeTotal: judgeTotal, // Store total not average
            spectatorLikes: spectatorLikes
          });
          console.log(`Retry update successful for ${presentationId}`);
        } catch (retryError) {
          console.error(`Even retry failed for ${presentationId}:`, retryError);
        }
      }

      return { judgeScores: validJudgeScores, judgeTotal, spectatorLikes };
    },
    // Fallback value if operation fails completely
    { judgeScores: [], judgeTotal: 0, spectatorLikes: 0 },
    { retries: 2, retryDelay: 1500 }
  );
};

// Recalculate stats for all presentations
export const recalculateAllPresentationStats = async () => {
  console.log('Recalculating all presentation stats...');
  try {
    const presentationsRef = collection(db, 'presentations');
    const presentationsSnapshot = await getDocs(presentationsRef);
    
    const updatePromises = presentationsSnapshot.docs.map(async (docSnapshot) => {
      const presentationId = docSnapshot.id;
      console.log(`Recalculating stats for presentation ${presentationId}`);
      return processVotes(presentationId);
    });
    
    await Promise.all(updatePromises);
    console.log(`Successfully recalculated stats for ${presentationsSnapshot.docs.length} presentations`);
    return presentationsSnapshot.docs.length;
  } catch (error) {
    console.error('Error recalculating presentation stats:', error);
    throw error;
  }
};

// Add a utility function to fix all NaN scores - improved version
export const fixNanScores = async () => {
  console.log('Fixing NaN scores in all presentations...');
  try {
    const presentationsRef = collection(db, 'presentations');
    const presentationsSnapshot = await getDocs(presentationsRef);
    
    let fixedCount = 0;
    
    for (const docSnapshot of presentationsSnapshot.docs) {
      const presentationId = docSnapshot.id;
      const presentationData = docSnapshot.data();
      
      // Check if judgeScores contains any NaN values or is missing
      let needsFixing = false;
      
      // If judgeScores is missing, undefined, or not an array
      if (!presentationData.judgeScores || !Array.isArray(presentationData.judgeScores)) {
        needsFixing = true;
        console.log(`Fixing presentation ${presentationId}: judgeScores is not an array`);
      } else {
        // Check if any scores are invalid
        for (const score of presentationData.judgeScores) {
          const numScore = Number(score);
          if (isNaN(numScore) || numScore <= 0) {
            needsFixing = true;
            console.log(`Fixing presentation ${presentationId}: contains invalid score: ${score}`);
            break;
          }
        }
      }
      
      if (needsFixing) {
        fixedCount++;
        console.log(`Fixing presentation ${presentationId}`);
        
        // Set judgeScores to an empty array
        const presentationRef = doc(db, 'presentations', presentationId);
        try {
          await updateDoc(presentationRef, {
            judgeScores: []
          });
          console.log(`Fixed presentation ${presentationId} - reset judgeScores to empty array`);
        } catch (updateError) {
          console.error(`Error fixing presentation ${presentationId}:`, updateError);
        }
      }
    }
    
    console.log(`Fixed ${fixedCount} presentations with NaN scores`);
    return fixedCount;
  } catch (error) {
    console.error('Error fixing NaN scores:', error);
    throw error;
  }
};

// Add this utility function for chart data using judge total
export const prepareChartData = (presentations: any[]) => {
  return presentations.map(presentation => {
    // Get judge total (sum of all scores)
    const judgeTotal = typeof presentation.judgeTotal === 'number' ? presentation.judgeTotal :
      (presentation.judgeScores?.length 
        ? presentation.judgeScores.reduce((sum: number, score: number) => sum + score, 0)
        : 0);
    
    // Final score is just the judge total
    const finalScore = judgeTotal;
    
    return {
      ...presentation,
      judgeTotal: judgeTotal,
      finalScore: finalScore
    };
  });
};

export default app;