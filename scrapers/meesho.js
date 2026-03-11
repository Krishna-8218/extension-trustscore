async function scrapeMeeshoReviews() {

  const reviewElements =
    document.querySelectorAll('[class*="Comment__CommentText"]');

  const reviews = [];

  reviewElements.forEach(el => {

    const text = el.innerText.trim();

    if (text) {
      reviews.push(text);
    }

  });

  return { reviews };

}