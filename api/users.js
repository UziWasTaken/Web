// Sample user data - in production, this would come from a database
const users = [
    {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-20T10:00:00Z"
    },
    {
        id: 2,
        name: "Jane Smith",
        email: "jane@example.com",
        created_at: "2024-01-21T10:00:00Z"
    }
];

export default function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    // Get paginated users
    const paginatedUsers = users.slice(startIndex, endIndex);
    
    return res.status(200).json({
        status: "success",
        data: {
            users: paginatedUsers,
            pagination: {
                current_page: page,
                total_pages: Math.ceil(users.length / limit),
                total_items: users.length
            }
        }
    });
} 