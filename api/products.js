// Sample product data - in production, this would come from a database
const products = [
    {
        id: 1,
        name: "Premium Widget",
        price: 99.99,
        description: "High-quality widget",
        created_at: "2024-01-20T10:00:00Z"
    }
];

export default function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json({
            status: "success",
            data: {
                products: products
            }
        });
    } else if (req.method === 'POST') {
        const { name, price, description } = req.body;
        
        // Validate required fields
        if (!name || !price) {
            return res.status(400).json({
                status: "error",
                message: "Name and price are required"
            });
        }

        // Create new product
        const newProduct = {
            id: products.length + 1,
            name,
            price,
            description,
            created_at: new Date().toISOString()
        };

        products.push(newProduct);

        return res.status(201).json({
            status: "success",
            data: {
                product: newProduct
            }
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
} 