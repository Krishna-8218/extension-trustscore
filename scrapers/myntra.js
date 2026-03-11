async function scrapeMyntraReviews() {

  const url = window.location.href;
  const match = url.match(/\/(\d+)(?:\?|$)/);
  const styleId = match ? match[1] : null;

  if (!styleId) {
    return { reviews: [] };
  }

  const reviews = [];
  let page = 0;
  const pageSize = 12;

  while (true) {

    const apiUrl =
      `https://www.myntra.com/gateway/v1/reviews/product/${styleId}?size=${pageSize}&sort=0&rating=0&page=${page}&includeMetaData=true`;

    try {

      const res = await fetch(apiUrl);
      const data = await res.json();

      if (!data.reviews || data.reviews.length === 0) {
        break;
      }

      data.reviews.forEach(r => {

        if (r.review && r.review.trim()) {
          reviews.push(r.review.trim());
        }

      });

      if (data.reviews.length < pageSize) {
        break;
      }

      page++;

    } catch (err) {
      console.error("API error:", err);
      break;
    }
  }

  return { reviews };

}