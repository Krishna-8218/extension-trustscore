/**
 * Calculates a credibility score (0-100) for reviewers.
 * Now incorporates historical profile data if available.
 */
function calculateCredibility(reviews) {
    if (!reviews || reviews.length === 0) return [];

    const reviewerStats = {};
    const genericNames = ["Anonymous", "Verified User", "Verified Guest", "Foodie", "Diner", "Verified Buyer", "Snapdeal User", "Nykaa User", "Ajio Customer"];

    // 1. Group by identifier (Name or Profile ID if available)
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

        let localScore = 85; 
        let historyScore = 70;

        // --- 1. RUBRIC: LOCAL BEHAVIOR ---
        const text = review.text || "";
        if (text.length < 15) localScore -= 30; // Low effort
        else if (text.length < 50) localScore -= 10;
        if (text.length > 150) localScore += 5; // Constructive bonus

        // RUBRIC 1: Frequency Check (Local)
        // If a user has multiple reviews on this page, it's already a slight red flag
        if (stats.count > 1 && !isGeneric) {
            localScore -= (stats.count - 1) * 30; // Aggressive frequency penalty
        }

        // RUBRIC 2: Local Rating Bias
        const localRatings = stats.ratings;
        if (localRatings.length > 1) {
            const allSame = localRatings.every(r => r === localRatings[0]);
            if (allSame && (localRatings[0] === 5 || localRatings[0] === 1)) {
                localScore -= 20; // Bias penalty
            }
        }

        // --- 2. RUBRIC: HISTORICAL BEHAVIOR (Deep Scan) ---
        if (review.history) {
            const h = review.history;
            historyScore = 100;

            // RUBRIC 1: Lifetime Frequency
            if (h.totalReviews === 0) historyScore = 60;
            else if (h.totalReviews > 200) historyScore -= 50; // Massively suspicious
            else if (h.totalReviews > 100) historyScore -= 30;
            else if (h.totalReviews < 5) historyScore = 75; // Neutral-Low history

            // RUBRIC 2: Historical Rating Bias
            // Genuine users usually have mixed ratings (3.0 to 4.5 avg)
            if (h.avgRating >= 4.9 || h.avgRating <= 1.1) {
                historyScore -= 40; // Extremely biased
            } else if (h.avgRating > 4.7 || h.avgRating < 2.0) {
                historyScore -= 15; // Moderately biased
            } else if (h.avgRating >= 3.0 && h.avgRating <= 4.5) {
                historyScore += 5; // "Balanced" bonus
            }
        } else {
            if (isGeneric) historyScore = 55;
            else if (review.profileUrl) historyScore = 75; 
            else historyScore = 60;
        }

        // --- 3. FINAL AGGREGATION ---
        // 80% History / 20% Local - Behavioral history is the strongest signal
        const finalCred = Math.max(2, Math.min(100, (localScore * 0.2 + historyScore * 0.8)));
        
        return {
            ...review,
            credibilityScore: Math.round(finalCred)
        };
    });
}

if (typeof module !== 'undefined') {
    module.exports = { calculateCredibility };
}
