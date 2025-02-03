const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,POST');
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

        // Get user settings
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
                throw error;
            }

            return res.status(200).json({
                settings: data || {
                    user_id: user.id,
                    display_name: user.user_metadata?.username || '',
                    avatar_url: user.user_metadata?.avatar_url || '',
                    preferences: {}
                }
            });
        }

        // Update user settings
        if (req.method === 'PATCH') {
            const { display_name, avatar_url, preferences } = req.body;

            // Update auth metadata
            const { error: updateAuthError } = await supabase.auth.updateUser({
                data: {
                    username: display_name,
                    avatar_url
                }
            });

            if (updateAuthError) {
                throw updateAuthError;
            }

            // Upsert user settings
            const { data, error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: user.id,
                    display_name,
                    avatar_url,
                    preferences,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return res.status(200).json({ settings: data });
        }

        return res.status(404).json({ error: 'Not found' });

    } catch (error) {
        console.error('User settings error:', error);
        return res.status(error.status || 500).json({
            error: error.message || 'Internal server error'
        });
    }
}; 