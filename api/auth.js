const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
                    data: { username }
                }
            });

            if (error) throw error;

            return res.status(200).json(data);
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
                password
            });

            if (error) throw error;

            return res.status(200).json(data);
        }

        // Handle signout
        if (req.method === 'POST' && req.url.includes('/signout')) {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            return res.status(200).json({
                success: true
            });
        }

        // Handle get user
        if (req.method === 'GET' && req.url.includes('/user')) {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({
                    error: 'Missing authorization header'
                });
            }

            const token = authHeader.replace('Bearer ', '');
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