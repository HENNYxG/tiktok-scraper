const TikTokScraper = require("tiktok-scraper");

/**
 * Vercel Serverless Function
 * Endpoint: GET /api/scrape?username=@exampleUser&hashtag=quantumfocus
 *
 * Query Parameters:
 * - username: TikTok username (include the @ if desired)
 * - hashtag: The hashtag to filter videos (e.g., "quantumfocus" or "#quantumfocus")
 *
 * Returns: JSON array of video objects:
 *   [{
 *     id: "videoId",
 *     datePosted: "2023-03-01T12:00:00.000Z",
 *     url: "https://www.tiktok.com/@exampleUser/video/123456789",
 *     description: "Video description text",
 *     stats: {
 *       views: 12345,
 *       likes: 678,
 *       comments: 90
 *     }
 *   }, ... ]
 */
module.exports = async (req, res) => {
  const { username, hashtag } = req.query;

  if (!username || !hashtag) {
    res
      .status(400)
      .json({
        error: "Missing required query parameters: username and hashtag",
      });
    return;
  }

  // Remove any leading '#' from the hashtag if provided.
  const normalizedHashtag = hashtag.startsWith("#")
    ? hashtag.slice(1)
    : hashtag;

  try {
    // Fetch the user posts (adjust the number option as needed)
    const posts = await TikTokScraper.user(username, { number: 50 });

    // Filter posts that include the hashtag (case-insensitive search)
    const filteredPosts = posts.collector.filter((post) => {
      return (
        post.text &&
        post.text.toLowerCase().includes(`#${normalizedHashtag.toLowerCase()}`)
      );
    });

    // Map the filtered posts to the desired output structure.
    const results = filteredPosts.map((video) => {
      // Convert the creation timestamp to an ISO string.
      const date = new Date(video.createTime * 1000).toISOString();

      return {
        id: video.id,
        datePosted: date,
        url: video.webVideoUrl || video.videoUrl, // use whichever is available
        description: video.text,
        stats: {
          views: video.stats ? video.stats.playCount : 0,
          likes: video.stats ? video.stats.diggCount : 0,
          comments: video.stats ? video.stats.commentCount : 0,
        },
      };
    });

    res.status(200).json(results);
  } catch (error) {
    console.error("Error scraping TikTok: ", error);
    res.status(500).json({ error: "Error scraping TikTok" });
  }
};
