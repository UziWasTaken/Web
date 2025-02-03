const { createClient } = require('@supabase/supabase-js');
const formidable = require('formidable');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configure formidable
const form = formidable({
    maxFileSize: 5 * 1024 * 1024, // 5MB
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
        if (authError) {
            throw authError;
        }

        // Handle image upload
        if (req.method === 'POST' && req.url.includes('/api/gallery/upload')) {
            return new Promise((resolve, reject) => {
                form.parse(req, async (err, fields, files) => {
                    if (err) {
                        console.error('Form parsing error:', err);
                        return resolve(res.status(500).json({ 
                            error: 'Failed to parse form data',
                            details: err.message 
                        }));
                    }

                    try {
                        const file = files.image?.[0];
                        if (!file) {
                            return resolve(res.status(400).json({ error: 'No image file provided' }));
                        }

                        // Parse tags safely
                        let tags = [];
                        try {
                            tags = fields.tags ? JSON.parse(fields.tags) : [];
                        } catch (e) {
                            console.warn('Failed to parse tags:', e);
                        }

                        // Read file buffer
                        const buffer = await require('fs').promises.readFile(file.filepath);

                        // Generate unique filename
                        const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}${getExtension(file.originalFilename)}`;
                        
                        console.log('Uploading file:', filename);
                        
                        // Upload to Supabase Storage
                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('gallery')
                            .upload(`public/${filename}`, buffer, {
                                contentType: file.mimetype,
                                upsert: false
                            });

                        if (uploadError) {
                            console.error('Storage upload error:', uploadError);
                            throw uploadError;
                        }

                        // Get public URL
                        const { data: { publicUrl } } = supabase.storage
                            .from('gallery')
                            .getPublicUrl(`public/${filename}`);

                        console.log('File uploaded, public URL:', publicUrl);

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
                            console.error('Database insert error:', dbError);
                            throw dbError;
                        }

                        // Clean up temp file
                        await require('fs').promises.unlink(file.filepath);

                        return resolve(res.status(200).json({
                            success: true,
                            image: dbData
                        }));

                    } catch (error) {
                        console.error('Upload processing error:', error);
                        return resolve(res.status(500).json({ 
                            error: 'Failed to process upload',
                            details: error.message
                        }));
                    }
                });
            });
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
    const ext = filename?.split('.').pop();
    return ext ? `.${ext}` : '';
} 