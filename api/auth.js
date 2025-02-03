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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Parse request body
    let body;
    try {
        body = req.body;
        if (typeof body === 'string') {
            body = JSON.parse(body);
        }
    } catch (error) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
        // Sign Up
        if (req.method === 'POST' && req.url.endsWith('/signup')) {
            const { email, password, username } = body;

            if (!email || !password || !username) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { username } }
            });

            if (error) {
                return res.status(400).json({ error: error.message });
            }

            return res.status(200).json({ data });
        }

        // Sign In
        if (req.method === 'POST' && req.url.endsWith('/signin')) {
            const { email, password } = body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Missing email or password' });
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                return res.status(400).json({ error: error.message });
            }

            return res.status(200).json({ data });
        }

        // Sign Out
        if (req.method === 'POST' && req.url.endsWith('/signout')) {
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                return res.status(400).json({ error: error.message });
            }

            return res.status(200).json({ success: true });
        }

        // Get User
        if (req.method === 'GET' && req.url.endsWith('/user')) {
            const token = req.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                return res.status(401).json({ error: 'No authorization token' });
            }

            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error) {
                return res.status(401).json({ error: error.message });
            }

            return res.status(200).json({ user });
        }

        return res.status(404).json({ error: 'Not found' });

    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}; 