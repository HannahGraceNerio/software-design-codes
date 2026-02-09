// Global state and configuration
export const GLOBAL_STATE = {
    currentUser: null,
    currentUserRole: 'user',
    products: [],
    orders: [],
    conversations: [],
    currentConversationId: null,
    currentOrderStep: 1,
    selectedProduct: null,
    selectedOrderType: 'pre-listed',
    selectedOrdersForBulkAction: new Set()
};

export const SAMPLE_PRODUCTS = [
    {
        id: '1',
        name: 'Custom Trophy',
        category: 'Awards',
        material: 'Metal',
        basePrice: 89.99,
        dimensions: '10" x 6"',
        image: 'https://images.unsplash.com/photo-1580831800257-f83135932664?auto=format&fit=crop&w=600&h=600&q=80',
        description: 'Premium metal trophy with custom engraving.',
        sku: 'TRP-001',
        tags: ['popular', 'award'],
        isVisible: true
    },
    // ... ALL your sample products (copy from original)
];

export const CATEGORIES = ['Awards', 'Gifts', 'Home', 'Corporate', 'Jewelry'];
export const MATERIALS = ['Wood', 'Metal', 'Glass', 'Stone', 'Acrylic', 'Composite'];