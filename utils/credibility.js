/**
 * credibility.js - Merged Premium Version
 * Calculates a credibility score (0-100) for reviewers by combining
 * Local Behavioral patterns and Deep Historical History.
 */
function calculateCredibility(reviews) {
  if (!reviews || reviews.length === 0) return [];

  const reviewerStats = {};
  const genericNames = [
    "Anonymous", "Verified User", "Verified Guest", "Foodie", "Diner", 
    "Verified Buyer", "Snapdeal User", "Nykaa User", "Ajio Customer", 
    "Meesho Buyer", "Amazon Customer", "Flipkart Customer"
  ];

  // 1. Group by identifier
  reviews.forEach(review => {
    const id = review.profileUrl || review.reviewerName || "Unknown";
    if (!reviewerStats[id]) {
      reviewerStats[id] = { count: 0, ratings: [], texts: [] };
    }
    reviewerStats[id].count++;
    reviewerStats[id].ratings.push(review.rating);
    reviewerStats[id].texts.push(review.text || "");
  });

  return reviews.map(review => {
    const id = review.profileUrl || review.reviewerName || "Unknown";
    const isGeneric = genericNames.includes(review.reviewerName || "");
    const stats = reviewerStats[id];

    let localScore = 90; // Start high, deduct for patterns
    let historyScore = 70; // Neutral start for profile-less users

    // --- A. LOCAL BEHAVIOR RUBRIC ---
    const text = (review.text || "").trim();
    
    // 1. Effort Check
    if (text.length < 15) localScore -= 30; // Very low effort
    else if (text.length < 50) localScore -= 10;
    if (text.length > 200) localScore += 5; // Detailed bonus

    // 2. Local Frequency (Spam check on current page)
    if (stats.count > 1 && !isGeneric) {
      localScore -= (stats.count - 1) * 35; 
    }

    // 3. Local Rating Bias
    if (stats.ratings.length > 1) {
      const allSame = stats.ratings.every(r => r === stats.ratings[0]);
      if (allSame && (stats.ratings[0] === 5 || stats.ratings[0] === 1)) {
        localScore -= 20;
      }
    }

    // --- B. HISTORICAL PROFILE RUBRIC (Deep Scan) ---
    if (review.history && review.history.length > 0) {
      const h = review.history; // Array of past ratings
      historyScore = 100;

      const totalPast = h.length;
      const ratings = h.map(x => x.rating).filter(r => r != null);
      const avgRating = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : 0;

      // 1. Lifetime Activity
      if (totalPast > 200) historyScore -= 60; // Professional review account/Bot
      else if (totalPast > 100) historyScore -= 40;
      else if (totalPast < 3) historyScore = 65; // New/Low-activity account

      // 2. Historical Rating Bias (The Red Flag)
      // Genuine users have a spread. Bots usually post only 5s.
      if (avgRating >= 4.9 && totalPast > 5) {
        historyScore -= 50; // "Perfectly" biased
      } else if (avgRating > 4.7) {
        historyScore -= 20; 
      } else if (avgRating >= 3.0 && avgRating <= 4.5) {
        historyScore += 10; // "Organic" user bonus
      }

      // Check for identical rating streaks
      const firstRating = ratings[0];
      const isOneNote = ratings.every(r => r === firstRating);
      if (isOneNote && totalPast > 10) historyScore -= 30;

    } else {
      // Default heuristics for users with no profile scan
      if (isGeneric) historyScore = 50;
      else if (review.profileUrl) historyScore = 75; // Has a profile, just not scanned yet
      else historyScore = 60;
    }

    // --- C. FINAL WEIGHTED AGGREGATION ---
    // 75% History (Reliable records) / 25% Local (Current behavior)
    let finalCred = (localScore * 0.25) + (historyScore * 0.75);
    finalCred = Math.max(2, Math.min(100, finalCred));

    return {
      ...review,
      credibilityScore: Math.round(finalCred)
    };
  });
}

if (typeof module !== 'undefined') {
  module.exports = { calculateCredibility };
}
