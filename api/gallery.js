const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://wxyrrhgxrtrmpqmrljih.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eXJyaGd4cnRybXBxbXJsamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1NDk2NTksImV4cCI6MjA1NDEyNTY1OX0.UpolAYjTGn3d8_RyTI16moca_7liYZfLHIS7t4a4tGg';
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to parse multipart form data
async function parseFormData(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => {
            data += chunk;
        });
        req.on('end', () => {
            try {
                // Find the boundary from Content-Type header
                const boundary = req.headers['content-type'].split('boundary=')[1];
                const parts = data.split('--' + boundary);
                const result = { fields: {}, files: {} };

                parts.forEach(part => {
                    if (part.includes('Content-Disposition: form-data;')) {
                        const lines = part.split('\r\n');
                        const header = lines[1];
                        const content = lines.slice(4).join('\r\n').trim();

                        if (header.includes('filename')) {
                            // This is a file
                            const name = header.match(/name="([^"]+)"/)[1];
                            const filename = header.match(/filename="([^"]+)"/)[1];
                            const contentType = lines[2].split(': ')[1];
                            result.files[name] = {
                                filename,
                                contentType,
                                content: Buffer.from(content, 'binary')
                            };
                        } else {
                            // This is a field
                            const name = header.match(/name="([^"]+)"/)[1];
                            result.fields[name] = content;
                        }
                    }
                });

                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    });
}

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
            try {
                const formData = await parseFormData(req);
                
                if (!formData.files.image) {
                    throw new Error('No image file provided');
                }

                const file = formData.files.image;
                const tags = JSON.parse(formData.fields.tags || '[]');
                const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

                // Upload to Supabase Storage
                const { error: uploadError } = await supabase.storage
                    .from('gallery')
                    .upload(`public/${filename}`, file.content, {
                        contentType: file.contentType,
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

                return res.status(200).json({
                    success: true,
                    image
                });
            } catch (error) {
                console.error('Upload processing error:', error);
                return res.status(500).json({ 
                    error: error.message || 'Failed to process upload'
                });
            }
        }

        // Handle DELETE request (delete image)
        if (req.method === 'DELETE') {
            try {
                const imageId = req.url.split('/').pop();
                
                // First, get the image details to verify ownership
                const { data: image, error: fetchError } = await supabase
                    .from('images')
                    .select('*')
                    .eq('id', imageId)
                    .single();

                if (fetchError) {
                    throw fetchError;
                }

                if (!image) {
                    return res.status(404).json({ error: 'Image not found' });
                }

                // Verify ownership
                if (image.user_id !== user.id) {
                    return res.status(403).json({ error: 'You can only delete your own images' });
                }

                // Delete from storage
                const { error: storageError } = await supabase.storage
                    .from('gallery')
                    .remove([`public/${image.filename}`]);

                if (storageError) {
                    throw storageError;
                }

                // Delete from database
                const { error: dbError } = await supabase
                    .from('images')
                    .delete()
                    .eq('id', imageId);

                if (dbError) {
                    throw dbError;
                }

                return res.status(200).json({ success: true });
            } catch (error) {
                console.error('Delete error:', error);
                return res.status(500).json({ 
                    error: error.message || 'Failed to delete image'
                });
            }
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