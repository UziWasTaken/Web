const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const util = require('util');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configure multer for memory storage
const multerMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Custom middleware to handle file uploads
const handleUpload = (req, res) => {
    return new Promise((resolve, reject) => {
        multerMiddleware.single('image')(req, res, (err) => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    reject(new Error('File size too large. Maximum size is 5MB'));
                }
                reject(err);
            }
            resolve();
        });
    });
};

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
        if (req.method === 'GET' && req.url.includes('/api/gallery/images')) {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const tags = req.query.tags ? req.query.tags.split(',') : [];
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

        // Handle image upload
        if (req.method === 'POST' && req.url.includes('/api/gallery/upload')) {
            try {
                // Parse multipart form data
                await handleUpload(req, res);

                if (!req.file) {
                    return res.status(400).json({ error: 'No image file provided' });
                }

                // Parse tags safely
                let tags = [];
                try {
                    tags = req.body.tags ? JSON.parse(req.body.tags) : [];
                } catch (e) {
                    console.warn('Failed to parse tags:', e);
                }

                // Generate unique filename
                const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}${getExtension(req.file.originalname)}`;
                
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
                        tags,
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

// Helper function to get file extension
function getExtension(filename) {
    const ext = filename.split('.').pop();
    return ext ? `.${ext}` : '';
} 