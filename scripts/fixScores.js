import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  writeBatch 
} from 'firebase/firestore';

// Firebase configuration - must match your app config
const firebaseConfig = {
  apiKey: "AIzaSyDkqha2lfDvtuFhDhTR84SzauPtOlQRnbE",
  authDomain: "presentscore-5068b.firebaseapp.com",
  projectId: "presentscore-5068b",
  storageBucket: "presentscore-5068b.firebasestorage.app",
  messagingSenderId: "54064814647",
  appId: "1:54064814647:web:b6a89104282f466c627db2",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Calculate raw sum of ratings without any multiplication
 */
function calculateRawSum(ratings) {
  if (!Array.isArray(ratings) || ratings.length === 0) return 0;
  
  return ratings.reduce((sum, rating) => {
    const score = typeof rating.score === 'number' ? rating.score : 0;
    return sum + score;
  }, 0);
}

/**
 * Fix vote totalScores to use raw sums without multiplication
 */
async function fixVoteTotalScores() {
  console.log('Fixing vote totalScores to use raw sums...');
  
  try {
    // Get all votes that have ratings
    const votesRef = collection(db, 'votes');
    const votesSnapshot = await getDocs(votesRef);
    
    let fixedVotes = 0;
    let batch = writeBatch(db);
    let batchCount = 0;
    
    // Process each vote
    for (const voteDoc of votesSnapshot.docs) {
      const vote = voteDoc.data();
      
      // Only process votes with ratings array
      if (vote.ratings && Array.isArray(vote.ratings)) {
        const rawSum = calculateRawSum(vote.ratings);
        const storedTotal = vote.totalScore || 0;
        
        // Check for significant discrepancy
        if (Math.abs(rawSum - storedTotal) > 1) {
          console.log(`Vote ${voteDoc.id}: Fixing totalScore from ${storedTotal} to ${rawSum}`);
          
          // Update the vote to use the raw sum
          batch.update(doc(db, 'votes', voteDoc.id), {
            totalScore: rawSum,
            fixedByScript: true,
            originalTotalScore: storedTotal
          });
          
          fixedVotes++;
          batchCount++;
          
          // Commit in batches of 400 (Firestore limit is 500)
          if (batchCount >= 400) {
            await batch.commit();
            console.log(`Committed batch of ${batchCount} updates`);
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }
    }
    
    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${batchCount} updates`);
    }
    
    console.log(`Fixed ${fixedVotes} votes with incorrect totalScores`);
    return fixedVotes;
  } catch (error) {
    console.error('Error fixing vote totalScores:', error);
    throw error;
  }
}

/**
 * Recalculate judge totals for all presentations
 */
async function recalculatePresentationScores() {
  console.log('Recalculating presentation scores...');
  
  try {
    // Get all presentations
    const presentationsRef = collection(db, 'presentations');
    const presentationsSnapshot = await getDocs(presentationsRef);
    
    let updatedPresentations = 0;
    
    // Process each presentation
    for (const presentationDoc of presentationsSnapshot.docs) {
      const presentationId = presentationDoc.id;
      console.log(`Processing presentation: ${presentationId}`);
      
      // Get all votes for this presentation
      const votesRef = collection(db, 'votes');
      const q = query(votesRef, where('presentationId', '==', presentationId));
      const votesSnapshot = await getDocs(q);
      
      // Get judge votes only
      const judgeVotes = votesSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(vote => vote.role === 'judge');
      
      // Calculate judge scores using raw sums
      const judgeScores = [];
      
      for (const vote of judgeVotes) {
        let scoreValue = 0;
        
        if (vote.ratings && Array.isArray(vote.ratings)) {
          // Calculate raw sum without multiplication
          scoreValue = calculateRawSum(vote.ratings);
        } else if (typeof vote.totalScore === 'number' && !isNaN(vote.totalScore)) {
          scoreValue = vote.totalScore;
        } else if (typeof vote.score === 'number' && !isNaN(vote.score)) {
          scoreValue = vote.score;
        }
        
        if (!isNaN(scoreValue) && scoreValue > 0) {
          judgeScores.push(scoreValue);
        }
      }
      
      // Count spectator votes
      const spectatorLikes = votesSnapshot.docs
        .filter(doc => doc.data().role === 'spectator')
        .length;
      
      // Calculate judge total - pure sum
      const judgeTotal = judgeScores.length > 0 
        ? judgeScores.reduce((sum, score) => sum + score, 0) 
        : 0;
      
      // Update the presentation
      await updateDoc(doc(db, 'presentations', presentationId), {
        judgeScores: judgeScores,
        judgeTotal: judgeTotal,
        spectatorLikes: spectatorLikes || 0,
        fixedByScript: true
      });
      
      updatedPresentations++;
      console.log(`Updated presentation ${presentationId}: judgeTotal=${judgeTotal}, scores=[${judgeScores.join(', ')}]`);
    }
    
    console.log(`Successfully updated ${updatedPresentations} presentations`);
    return updatedPresentations;
  } catch (error) {
    console.error('Error recalculating presentation scores:', error);
    throw error;
  }
}

// Main function to run the script
async function main() {
  try {
    console.log('Starting vote and presentation score fix script...');
    
    // Step 1: Fix vote totalScores
    const fixedVotes = await fixVoteTotalScores();
    
    // Step 2: Recalculate presentation scores
    const updatedPresentations = await recalculatePresentationScores();
    
    console.log('Script completed successfully!');
    console.log(`- Fixed ${fixedVotes} votes`);
    console.log(`- Updated ${updatedPresentations} presentations`);
    
  } catch (error) {
    console.error('Script failed:', error);
  }
}

// Run the script
main();
