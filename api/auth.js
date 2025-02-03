const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const siteUrl = 'https://r34cat.online';

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// Log Supabase connection details for debugging
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key present:', !!supabaseKey);

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Handle signup
        if (req.method === 'POST' && req.url.includes('/signup')) {
            const { email, password, username } = req.body;

            if (!email || !password || !username) {
                return res.status(400).json({
                    error: 'Missing required fields'
                });
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { username }
                }
            });

            if (error) throw error;

            return res.status(200).json({ data });
        }

        // Handle signin
        if (req.method === 'POST' && req.url.includes('/signin')) {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    error: 'Missing email or password'
                });
            }

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                if (!data.session) {
                    throw new Error('No session returned from Supabase');
                }

                // Set auth cookie
                const { access_token, refresh_token } = data.session;
                res.setHeader('Set-Cookie', [
                    `sb-access-token=${access_token}; Path=/; HttpOnly; Secure; SameSite=Lax`,
                    `sb-refresh-token=${refresh_token}; Path=/; HttpOnly; Secure; SameSite=Lax`
                ]);

                return res.status(200).json({
                    user: data.user,
                    session: data.session
                });
            } catch (error) {
                console.error('Sign in error:', error);
                return res.status(401).json({
                    error: error.message
                });
            }
        }

        // Handle callback from email verification
        if (req.method === 'GET' && req.url.includes('/callback')) {
            const hashParams = new URLSearchParams(req.url.split('#')[1] || '');
            const queryParams = new URLSearchParams(req.url.split('?')[1] || '');
            
            const access_token = hashParams.get('access_token') || queryParams.get('access_token');
            const refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token');
            const error = hashParams.get('error') || queryParams.get('error');
            const error_description = hashParams.get('error_description') || queryParams.get('error_description');

            if (error) {
                return res.redirect(`/auth?error=${error}&error_description=${error_description}`);
            }

            if (!access_token) {
                return res.redirect('/auth?error=no_access_token');
            }

            // Set auth cookies
            res.setHeader('Set-Cookie', [
                `sb-access-token=${access_token}; Path=/; HttpOnly; Secure; SameSite=Lax`,
                refresh_token ? `sb-refresh-token=${refresh_token}; Path=/; HttpOnly; Secure; SameSite=Lax` : ''
            ].filter(Boolean));

            return res.redirect('/gallery');
        }

        // Handle signout
        if (req.method === 'POST' && req.url.includes('/signout')) {
            // Clear auth cookies
            res.setHeader('Set-Cookie', [
                'sb-access-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
                'sb-refresh-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
            ]);
            
            await supabase.auth.signOut();
            return res.status(200).json({ success: true });
        }

        // Handle get user
        if (req.method === 'GET' && req.url.includes('/user')) {
            const token = req.cookies['sb-access-token'] || req.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                return res.status(401).json({
                    error: 'No authorization token'
                });
            }

            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error) {
                return res.status(401).json({
                    error: error.message
                });
            }

            return res.status(200).json({ user });
        }

        // Handle unknown routes
        return res.status(404).json({
            error: 'Not found'
        });

    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error'
        });
    }
}; 