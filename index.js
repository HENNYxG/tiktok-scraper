// index.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

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

    // Use a direct approach with axios
    const videos = await scrapeUserVideos(cleanUsername);

    // Return all videos for debugging
    return res.json({
      username: cleanUsername,
      hashtag: hashtagToSearch,
      totalVideos: videos.length,
      allVideos: videos,
      filteredVideos: videos.filter((video) => {
        const description = (video.description || "").toLowerCase();
        return description.includes(`#${hashtagToSearch.toLowerCase()}`);
      }),
    });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({
      error: "Failed to scrape TikTok data",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Function to scrape user videos
async function scrapeUserVideos(username) {
  try {
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36";

    // First approach: Using TikTok web API
    const response = await axios.get(`https://www.tiktok.com/@${username}`, {
      headers: {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
      },
    });

    // Log headers and status for debugging
    console.log("Response status:", response.status);

    const html = response.data;

    // Look for the JSON data in the HTML
    const dataMatch = html.match(
      /<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/
    );

    if (dataMatch && dataMatch[1]) {
      try {
        const jsonData = JSON.parse(dataMatch[1]);

        // Debug: Log the structure of the data
        console.log("Keys in JSON data:", Object.keys(jsonData));

        // Look for user's videos in different possible locations
        let userVideos = [];

        if (jsonData.ItemModule) {
          userVideos = Object.values(jsonData.ItemModule);
        } else if (
          jsonData.ItemList &&
          jsonData.ItemList.video &&
          jsonData.ItemList.video.list
        ) {
          userVideos = jsonData.ItemList.video.list;
        } else if (jsonData.userModule && jsonData.userModule.videos) {
          userVideos = jsonData.userModule.videos;
        }

        // Transform videos to a standard format
        return userVideos.map((video) => ({
          id: video.id || "",
          description: video.desc || "",
          createTime: video.createTime || Math.floor(Date.now() / 1000),
          playCount: parseInt(video.stats?.playCount || 0),
          diggCount: parseInt(video.stats?.diggCount || 0),
          commentCount: parseInt(video.stats?.commentCount || 0),
          shareCount: parseInt(video.stats?.shareCount || 0),
        }));
      } catch (parseError) {
        console.error("Error parsing JSON data:", parseError);
      }
    }

    // If we reach here, we couldn't extract videos using the first method
    console.log(
      "Could not extract videos using primary method, trying fallback..."
    );

    // Fallback approach: Parse HTML directly
    const $ = cheerio.load(html);
    const videos = [];

    // Look for video elements
    $('div[data-e2e="user-post-item"]').each((index, element) => {
      const videoLink = $(element).find("a").attr("href");
      const videoId = videoLink ? videoLink.split("/video/")[1] : null;

      if (videoId) {
        videos.push({
          id: videoId,
          description: $(element).find("div.tt-feed-desc-text").text() || "",
          createTime: Math.floor(Date.now() / 1000),
          playCount: 0,
          diggCount: 0,
          commentCount: 0,
        });
      }
    });

    return videos;
  } catch (error) {
    console.error("Error in scrapeUserVideos:", error);
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
