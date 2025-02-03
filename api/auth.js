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
        detectSessionInUrl: true,
        flowType: 'implicit',
        redirectTo: `${siteUrl}/auth/callback`
    }
});

// Log Supabase connection details for debugging
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key present:', !!supabaseKey);

module.exports = async (req, res) => {
    try {
        // Enable CORS
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Credentials', true);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            return res.status(200).end();
        }

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
                    data: { username },
                    emailRedirectTo: `${siteUrl}/auth/callback`
                }
            });

            if (error) throw error;

            return res.status(200).json({
                data,
                redirectTo: `${siteUrl}/auth/callback`
            });
        }

        // Handle callback
        if (req.method === 'GET' && req.url.includes('/callback')) {
            // Extract access token from hash or query parameters
            const accessToken = req.query.access_token || req.headers.authorization?.replace('Bearer ', '');
            
            if (!accessToken) {
                return res.redirect(`${siteUrl}/auth?error=no_access_token`);
            }

            try {
                const { data: { user }, error } = await supabase.auth.getUser(accessToken);
                
                if (error) throw error;

                // Set session cookie
                res.setHeader('Set-Cookie', `sb-access-token=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax`);
                
                // Redirect to gallery
                return res.redirect(`${siteUrl}/gallery`);
            } catch (error) {
                return res.redirect(`${siteUrl}/auth?error=${error.message}`);
            }
        }

        // Handle signin
        if (req.method === 'POST' && req.url.includes('/signin')) {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    error: 'Missing email or password'
                });
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
                options: {
                    redirectTo: `${siteUrl}/auth/callback`
                }
            });

            if (error) throw error;

            return res.status(200).json({
                data,
                redirectTo: `${siteUrl}/auth/callback`
            });
        }

        // Handle signout
        if (req.method === 'POST' && req.url.includes('/signout')) {
            // Clear session cookie
            res.setHeader('Set-Cookie', 'sb-access-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
            
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            return res.status(200).json({
                success: true,
                redirectTo: `${siteUrl}/auth`
            });
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

            if (error) throw error;

            return res.status(200).json({ user });
        }

        // Handle unknown routes
        return res.status(404).json({
            error: 'Not found'
        });

    } catch (error) {
        console.error('Error:', error.message);
        return res.status(error.status || 500).json({
            error: error.message
        });
    }
}; 