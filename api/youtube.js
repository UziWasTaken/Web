const { google } = require('googleapis');

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

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, format } = req.query;

    // Handle info request
    if (req.url.includes('/api/youtube/info')) {
        try {
            const videoId = extractVideoId(url);
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

            return res.status(200).json(response);
        } catch (error) {
            console.error('YouTube API Error:', error);
            return res.status(500).json({ error: 'Error fetching video information' });
        }
    }

    // Handle download request
    if (req.url.includes('/api/youtube/download')) {
        // TODO: Implement download functionality
        return res.status(501).json({ message: 'Download functionality coming soon' });
    }

    // Handle unknown endpoints
    return res.status(404).json({ error: 'Not found' });
}; 