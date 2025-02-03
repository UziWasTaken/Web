const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

// Initialize Supabase client
const supabaseUrl = 'https://wxyrrhgxrtrmpqmrljih.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eXJyaGd4cnRybXBxbXJsamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1NDk2NTksImV4cCI6MjA1NDEyNTY1OX0.UpolAYjTGn3d8_RyTI16moca_7liYZfLHIS7t4a4tGg';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Verify authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    try {
        // Verify token with Supabase
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            throw new Error('Invalid or expired token');
        }

        // Handle GET request (list images)
        if (req.method === 'GET') {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const tags = req.query.tags ? req.query.tags.split(' ') : [];
            const offset = (page - 1) * limit;

            let query = supabase
                .from('images')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (tags.length > 0) {
                query = query.contains('tags', tags);
            }

            const { data: images, error: dbError, count } = await query;

            if (dbError) {
                throw dbError;
            }

            return res.status(200).json({
                images: images || [],
                page,
                totalPages: Math.ceil((count || 0) / limit),
                total: count || 0
            });
        }

        // Handle POST request (upload image)
        if (req.method === 'POST') {
            return new Promise((resolve, reject) => {
                upload.single('image')(req, res, async (err) => {
                    if (err) {
                        console.error('Upload error:', err);
                        return resolve(res.status(400).json({ 
                            error: err.message || 'Failed to process upload'
                        }));
                    }

                    try {
                        if (!req.file) {
                            throw new Error('No image file provided');
                        }

                        const tags = JSON.parse(req.body.tags || '[]');
                        const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

                        // Upload to Supabase Storage
                        const { error: uploadError } = await supabase.storage
                            .from('gallery')
                            .upload(`public/${filename}`, req.file.buffer, {
                                contentType: req.file.mimetype,
                                upsert: false
                            });

                        if (uploadError) {
                            throw uploadError;
                        }

                        // Get public URL
                        const { data: { publicUrl } } = supabase.storage
                            .from('gallery')
                            .getPublicUrl(`public/${filename}`);

                        // Store in database
                        const { data: image, error: dbError } = await supabase
                            .from('images')
                            .insert([{
                                filename,
                                url: publicUrl,
                                tags,
                                user_id: user.id,
                                created_at: new Date().toISOString()
                            }])
                            .select()
                            .single();

                        if (dbError) {
                            throw dbError;
                        }

                        resolve(res.status(200).json({
                            success: true,
                            image
                        }));
                    } catch (error) {
                        console.error('Upload processing error:', error);
                        resolve(res.status(500).json({ 
                            error: error.message || 'Failed to process upload'
                        }));
                    }
                });
            });
        }

        // Handle unknown methods
        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Gallery API error:', error);
        return res.status(error.status || 500).json({
            error: error.message || 'Internal server error'
        });
    }
}; 