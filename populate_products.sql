-- Clear existing data to prevent duplicates if script is run multiple times
-- The products table is cleared and repopulated at the end. Categories and admin_users use ON CONFLICT.

-- Sample Categories
INSERT INTO categories (name, description) VALUES
('Electronics', 'Gadgets, devices, and all things electronic.') ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description, parent_category_id) VALUES
('Computers & Accessories', 'Laptops, desktops, peripherals, and accessories.', (SELECT id from categories WHERE name = 'Electronics')) ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description, parent_category_id) VALUES
('Mobile Phones', 'Smartphones and mobile accessories.', (SELECT id from categories WHERE name = 'Electronics')) ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description) VALUES
('Fashion', 'Apparel, shoes, jewelry, and accessories.') ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description, parent_category_id) VALUES
('Men''s Fashion', 'Clothing and accessories for men.', (SELECT id from categories WHERE name = 'Fashion')) ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description, parent_category_id) VALUES
('Women''s Fashion', 'Clothing and accessories for women.', (SELECT id from categories WHERE name = 'Fashion')) ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description) VALUES
('Home & Garden', 'Furniture, decor, kitchen, and garden supplies.') ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description) VALUES
('Wellness', 'Health, fitness, and personal care products.') ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description) VALUES
('Office Tech', 'Technology and supplies for the office.') ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description) VALUES
('Education & Hobby', 'Educational toys, kits, and hobby supplies.') ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description) VALUES
('Novelty', 'Fun, quirky, and novelty items.') ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description) VALUES
('Gadgets & Toys', 'Various gadgets and toys, can be a parent or standalone.') ON CONFLICT (name) DO NOTHING;


-- Sample Admin User
-- API Key: "supersecretadminkey"
-- SHA256 Hash: 5f074092f70914576187788939083931737738691350389691111903a5354255
INSERT INTO admin_users (username, hashed_api_key) VALUES
('admin', '5f074092f70914576187788939083931737738691350389691111903a5354255') ON CONFLICT (username) DO NOTHING;


-- Existing MOCK_PRODUCTS population (references category names that should now exist in the categories table)
DELETE FROM products;
INSERT INTO products (id, name, description, price, image_url, category, data_ai_hint) VALUES
('1', 'Innovator''s Dream VR Headset', 'Experience the next dimension of reality with ultra-high resolution and comfort.', 350, 'https://placehold.co/600x400.png', 'Electronics', 'vr headset'),
('2', 'AI-Powered Smart Garden', 'Grow your own organic herbs and vegetables effortlessly with AI assistance.', 180, 'https://placehold.co/600x400.png', 'Home & Garden', 'smart garden'),
('3', 'Quantum Entanglement Communicator (Toy)', 'A fun toy demonstrating principles of quantum communication. Not for actual FTL.', 75, 'https://placehold.co/600x400.png', 'Gadgets & Toys', 'toy communicator'),
('4', 'Sustainable Algae Leather Wallet', 'A stylish and eco-conscious wallet made from innovative algae-based leather.', 55, 'https://placehold.co/600x400.png', 'Fashion', 'leather wallet'),
('5', 'Personalized Bio-Harmonic Soundtrack', 'AI-generated music tuned to your unique biological rhythms for ultimate relaxation.', 30, 'https://placehold.co/600x400.png', 'Wellness', 'wellness music'),
('6', 'Holographic Desk Projector', 'Transform your workspace with interactive 3D holographic projections.', 250, 'https://placehold.co/600x400.png', 'Office Tech', 'desk projector'),
('7', 'Modular Robotics Kit', 'Build and program your own robots with this versatile and expandable kit.', 120, 'https://placehold.co/600x400.png', 'Education & Hobby', 'robotics kit'),
('8', 'Zero-G Coffee Mug', 'Enjoy your coffee in any orientation with this specially designed mug (for simulated zero-g environments).', 40, 'https://placehold.co/600x400.png', 'Novelty', 'coffee mug');
