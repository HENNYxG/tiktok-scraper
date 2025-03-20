// index.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { httpGet } = require("tiktok-scraper-without-watermark");

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
    const hashtagToSearch = hashtag || "quantumfocus";

    console.log(
      `Scraping videos for ${cleanUsername} with hashtag #${hashtagToSearch}`
    );

    // Get user videos using the correct method from the library
    const userVideos = await getUserVideos(cleanUsername);

    if (!userVideos || userVideos.length === 0) {
      return res.json([]);
    }

    // Filter by hashtag
    const filteredVideos = userVideos.filter((video) => {
      const description = video.description
        ? video.description.toLowerCase()
        : "";
      return description.includes(`#${hashtagToSearch.toLowerCase()}`);
    });

    // Format the response
    const formattedVideos = filteredVideos.map((video) => ({
      id: video.id,
      datePosted: video.createTime || Math.floor(Date.now() / 1000),
      url: `https://www.tiktok.com/@${cleanUsername}/video/${video.id}`,
      description: video.description || "",
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

// Function to get user videos
async function getUserVideos(username) {
  try {
    // Use a different approach - direct HTTP request to TikTok user page
    const userProfileUrl = `https://www.tiktok.com/@${username}`;
    const response = await httpGet(userProfileUrl);

    // Extract data from response
    const videos = [];
    if (response && response.items) {
      return response.items;
    }

    // Alternative approach if direct API fails
    const apiUrl = `https://www.tiktok.com/node/share/user/@${username}`;
    const apiResponse = await axios.get(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (apiResponse.data && apiResponse.data.itemList) {
      return apiResponse.data.itemList;
    }

    return videos;
  } catch (error) {
    console.error("Error fetching user videos:", error);
    return [];
  }
}

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
