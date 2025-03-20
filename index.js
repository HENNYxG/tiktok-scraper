// index.js
const express = require("express");
const { TikTokScraper } = require("tiktok-scraper-without-watermark");
const cors = require("cors");

const app = express();
app.use(cors());

// Environment variables
const PORT = process.env.PORT || 3000;

// Main scraping endpoint
app.get("/api/scrape", async (req, res) => {
  try {
    const { username, hashtag } = req.query;

    if (!username) {
      return res.status(400).json({ error: "Username parameter is required" });
    }

    // Clean username (remove @ if present)
    const cleanUsername = username.startsWith("@")
      ? username.substring(1)
      : username;

    console.log(
      `Scraping videos for ${cleanUsername} with hashtag #${
        hashtag || "quantumfocus"
      }`
    );

    const scraper = new TikTokScraper();
    const hashtagToSearch = hashtag || "quantumfocus";

    // Get user's videos
    const userData = await scraper.user(cleanUsername, { number: 100 });

    // Filter by hashtag
    const filteredVideos = userData.collector.filter((video) => {
      return video.description
        .toLowerCase()
        .includes(`#${hashtagToSearch.toLowerCase()}`);
    });

    // Format the response
    const formattedVideos = filteredVideos.map((video) => ({
      id: video.id,
      datePosted: video.createTime,
      url: `https://www.tiktok.com/@${cleanUsername}/video/${video.id}`,
      description: video.description,
      stats: {
        views: video.playCount || 0,
        likes: video.diggCount || 0,
        comments: video.commentCount || 0,
      },
    }));

    res.json(formattedVideos);
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({
      error: "Failed to scrape TikTok data",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start the server if not running in Vercel
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
