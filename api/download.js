const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

module.exports = async (req, res) => {
    try {
        const { url, quality } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Get video info
        const info = await ytdl.getInfo(url);
        const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '');

        // Set response headers for audio download
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${videoTitle}.mp3"`);

        // Get audio stream
        const audioStream = ytdl(url, {
            quality: quality === 'high' ? 'highestaudio' : 'lowestaudio',
            filter: 'audioonly',
        });

        // Process with ffmpeg
        ffmpeg(audioStream)
            .toFormat('mp3')
            .audioBitrate(quality === 'high' ? '192k' : '128k')
            .on('error', (err) => {
                console.error('FFmpeg error:', err);
                res.status(500).json({ error: 'Conversion failed' });
            })
            .pipe(res);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
}; 