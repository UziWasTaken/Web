require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the tools page
app.get('/tools', (req, res) => {
    res.sendFile(path.join(__dirname, 'tools.html'));
});

// Initialize YouTube API client
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

// Helper function to extract video ID from URL
function extractVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : false;
}

// API endpoint to fetch video information
app.get('/api/youtube/info', async (req, res) => {
    try {
        const videoId = extractVideoId(req.query.url);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Get video details
        const videoResponse = await youtube.videos.list({
            part: ['snippet', 'contentDetails', 'statistics'],
            id: [videoId]
        });

        if (!videoResponse.data.items.length) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const video = videoResponse.data.items[0];
        const duration = video.contentDetails.duration;
        
        // Convert ISO 8601 duration to seconds
        const durationInSeconds = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
            .slice(1)
            .map(x => x ? parseInt(x.replace(/\D/, '')) : 0)
            .reduce((acc, x, i) => acc + x * [3600, 60, 1][i], 0);

        const response = {
            title: video.snippet.title,
            channel: video.snippet.channelTitle,
            duration: durationInSeconds,
            view_count: parseInt(video.statistics.viewCount),
            thumbnail: video.snippet.thumbnails.maxres?.url || 
                      video.snippet.thumbnails.high?.url ||
                      video.snippet.thumbnails.medium?.url,
            description: video.snippet.description
        };

        res.json(response);
    } catch (error) {
        console.error('YouTube API Error:', error);
        res.status(500).json({ error: 'Error fetching video information' });
    }
});

// Download endpoint (placeholder for now)
app.get('/api/youtube/download', (req, res) => {
    const { url, format } = req.query;
    // TODO: Implement actual download functionality
    res.status(501).json({ message: 'Download functionality coming soon' });
});

// Error handler for invalid routes
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handler for server errors
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 