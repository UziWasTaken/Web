const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const util = require('util');

// Initialize Supabase client
const supabaseUrl = 'https://wxyrrhgxrtrmpqmrljih.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eXJyaGd4cnRybXBxbXJsamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1NDk2NTksImV4cCI6MjA1NDEyNTY1OX0.UpolAYjTGn3d8_RyTI16moca_7liYZfLHIS7t4a4tGg';

const supabase = createClient(supabaseUrl, supabaseKey);

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Promisify multer middleware
const uploadMiddleware = util.promisify(upload.single('image'));

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
        if (authError) {
            throw authError;
        }

        // Handle image listing
        if (req.method === 'GET') {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const tags = req.query.tags ? req.query.tags.split(' ') : [];
            const offset = (page - 1) * limit;

            let query = supabase
                .from('images')
                .select('*', { count: 'exact' });

            if (tags.length > 0) {
                query = query.contains('tags', tags);
            }

            // Get total count first
            const { count, error: countError } = await query;
            
            if (countError) {
                throw countError;
            }

            // Then get paginated results
            const { data: images, error: dbError } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

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

        // Handle image upload
        if (req.method === 'POST') {
            try {
                // Parse multipart form data
                await uploadMiddleware(req, res);
                
                if (!req.file) {
                    return res.status(400).json({ error: 'No image file provided' });
                }

                const tags = JSON.parse(req.body.tags || '[]');

                // Generate unique filename
                const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
                
                // Upload to Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
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
                const { data: dbData, error: dbError } = await supabase
                    .from('images')
                    .insert([{
                        filename,
                        url: publicUrl,
                        tags: tags,
                        user_id: user.id,
                        created_at: new Date().toISOString()
                    }])
                    .select()
                    .single();

                if (dbError) {
                    throw dbError;
                }

                return res.status(200).json({
                    success: true,
                    image: dbData
                });
            } catch (error) {
                console.error('Upload error:', error);
                return res.status(500).json({ 
                    error: 'Failed to upload image',
                    details: error.message
                });
            }
        }

        // Handle image deletion
        if (req.method === 'DELETE' && req.url.includes('/api/gallery/delete')) {
            try {
                const { id } = req.query;

                if (!id) {
                    return res.status(400).json({ error: 'No image ID provided' });
                }

                // Get image data first
                const { data: imageData, error: fetchError } = await supabase
                    .from('images')
                    .select('filename')
                    .eq('id', id)
                    .single();

                if (fetchError) {
                    throw fetchError;
                }

                // Delete from storage
                const { error: storageError } = await supabase.storage
                    .from('gallery')
                    .remove([`public/${imageData.filename}`]);

                if (storageError) {
                    throw storageError;
                }

                // Delete from database
                const { error: dbError } = await supabase
                    .from('images')
                    .delete()
                    .eq('id', id);

                if (dbError) {
                    throw dbError;
                }

                return res.status(200).json({ success: true });

            } catch (error) {
                console.error('Delete error:', error);
                return res.status(500).json({ error: 'Failed to delete image' });
            }
        }

        // Handle unknown routes
        return res.status(404).json({ error: 'Not found' });

    } catch (error) {
        console.error('Gallery error:', error);
        return res.status(error.status || 500).json({
            error: error.message || 'Internal server error'
        });
    }
}; 