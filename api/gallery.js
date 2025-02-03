const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://wxyrrhgxrtrmpqmrljih.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eXJyaGd4cnRybXBxbXJsamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1NDk2NTksImV4cCI6MjA1NDEyNTY1OX0.UpolAYjTGn3d8_RyTI16moca_7liYZfLHIS7t4a4tGg';
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Handle image upload
    if (req.method === 'POST' && req.url.includes('/api/gallery/upload')) {
        try {
            const { image, tags } = req.body;
            
            if (!image) {
                return res.status(400).json({ error: 'No image provided' });
            }

            // Generate a unique filename
            const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
            
            // Upload image to Supabase Storage
            const { data, error: uploadError } = await supabase.storage
                .from('gallery')
                .upload(`public/${filename}`, image, {
                    contentType: image.type,
                    upsert: false
                });

            if (uploadError) {
                throw uploadError;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('gallery')
                .getPublicUrl(`public/${filename}`);

            // Store metadata in database
            const { data: metaData, error: dbError } = await supabase
                .from('images')
                .insert([
                    {
                        filename,
                        url: publicUrl,
                        tags: tags || [],
                        uploaded_at: new Date()
                    }
                ]);

            if (dbError) {
                throw dbError;
            }

            return res.status(200).json({
                success: true,
                url: publicUrl,
                id: metaData[0].id
            });

        } catch (error) {
            console.error('Upload error:', error);
            return res.status(500).json({ error: 'Failed to upload image' });
        }
    }

    // Handle image retrieval
    if (req.method === 'GET' && req.url.includes('/api/gallery/images')) {
        try {
            const { page = 1, limit = 20, tags } = req.query;
            const offset = (page - 1) * limit;

            let query = supabase
                .from('images')
                .select('*')
                .order('uploaded_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (tags) {
                const tagArray = tags.split(',');
                query = query.contains('tags', tagArray);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            return res.status(200).json({
                images: data,
                total: count,
                page: parseInt(page),
                totalPages: Math.ceil(count / limit)
            });

        } catch (error) {
            console.error('Retrieval error:', error);
            return res.status(500).json({ error: 'Failed to retrieve images' });
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

    return res.status(404).json({ error: 'Not found' });
}; 