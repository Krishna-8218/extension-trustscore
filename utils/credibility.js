/**
 * Calculates a credibility score (0-100) for reviewers.
 * Now incorporates historical profile data if available.
 */
function calculateCredibility(reviews) {
    if (!reviews || reviews.length === 0) return [];

    const reviewerStats = {};

    // 1. Group by current page name for basic frequency check
    reviews.forEach(review => {
        const name = review.reviewerName || "Anonymous";
        if (!reviewerStats[name]) {
            reviewerStats[name] = { count: 0, ratings: [] };
        }
        reviewerStats[name].count++;
        reviewerStats[name].ratings.push(review.rating);
    });

    const enrichedReviews = reviews.map(review => {
        const name = review.reviewerName || "Anonymous";
        const stats = reviewerStats[name];

        let localScore = 100;
        let historyScore = 100;

        // --- LOCAL BEHAVIOR (On-Page) ---
        // Frequency penalty
        if (stats.count > 2) localScore -= (stats.count - 2) * 20;
        
        // Rating patterns (Extreme bias)
        const allSame = stats.ratings.every(r => r === stats.ratings[0]);
        if (allSame && (stats.ratings[0] === 1 || stats.ratings[0] === 5)) localScore -= 40;

        // --- HISTORICAL BEHAVIOR (From Profile) ---
        if (review.history) {
            const h = review.history; // Expect { totalReviews: number, avgRating: number }
            
            // Suspect if: Way too many reviews (>200) or very few history (<2) but high rating bias
            if (h.totalReviews > 200) {
                historyScore -= 30; // Review farm indicator
            } else if (h.totalReviews < 3 && (review.rating === 5 || review.rating === 1)) {
                historyScore -= 20; // New/Throwaway account indicator
            }

            // Extreme average rating check (e.g., they only ever give 1s or 5s)
            if (h.avgRating > 4.8 || h.avgRating < 1.5) {
                historyScore -= 20;
            }
        } else if (name !== "Anonymous") {
            // If they have a name but no history was fetched yet, neutral starting point
            historyScore = 90;
        } else {
            // Anonymous users get a base penalty
            historyScore = 60;
        }

        const finalCredibility = Math.max(0, Math.min(100, (localScore * 0.4 + historyScore * 0.6)));
        
        return {
            ...review,
            credibilityScore: Math.round(finalCredibility)
        };
    });

    return enrichedReviews;
}

if (typeof module !== 'undefined') {
    module.exports = { calculateCredibility };
}
