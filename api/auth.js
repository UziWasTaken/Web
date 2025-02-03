const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://wxyrrhgxrtrmpqmrljih.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eXJyaGd4cnRybXBxbXJsamloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1NDk2NTksImV4cCI6MjA1NDEyNTY1OX0.UpolAYjTGn3d8_RyTI16moca_7liYZfLHIS7t4a4tGg';

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Sign Up
        if (req.method === 'POST' && req.url.includes('/api/auth/signup')) {
            const { email, password, username } = req.body;

            if (!email || !password || !username) {
                return res.status(400).json({
                    error: 'Email, password, and username are required'
                });
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                        full_name: username
                    },
                    emailRedirectTo: `${req.headers.origin}/auth`
                }
            });

            if (error) {
                console.error('Signup error:', error);
                return res.status(400).json({
                    error: error.message
                });
            }

            return res.status(200).json({
                success: true,
                user: data.user,
                session: data.session
            });
        }

        // Sign In
        if (req.method === 'POST' && req.url.includes('/api/auth/signin')) {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    error: 'Email and password are required'
                });
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('Signin error:', error);
                return res.status(400).json({
                    error: error.message
                });
            }

            return res.status(200).json({
                success: true,
                session: data.session,
                user: data.user
            });
        }

        // Sign Out
        if (req.method === 'POST' && req.url.includes('/api/auth/signout')) {
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                console.error('Signout error:', error);
                return res.status(400).json({
                    error: error.message
                });
            }

            return res.status(200).json({
                success: true
            });
        }

        // Get User
        if (req.method === 'GET' && req.url.includes('/api/auth/user')) {
            const token = req.headers['authorization']?.split('Bearer ')[1];
            
            if (!token) {
                return res.status(401).json({
                    error: 'No authorization token provided'
                });
            }

            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error) {
                console.error('Get user error:', error);
                return res.status(401).json({
                    error: error.message
                });
            }

            return res.status(200).json({
                user
            });
        }

        // Handle unknown endpoints
        return res.status(404).json({
            error: 'Not found'
        });

    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}; 