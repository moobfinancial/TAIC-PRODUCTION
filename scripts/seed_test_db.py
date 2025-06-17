#!/usr/bin/env python3
"""
Test database seeding script.

This script populates the test database with sample data for testing purposes.
Run with: python -m scripts.seed_test_db
"""
import os
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import random
from datetime import datetime, timedelta
from typing import List, Dict, Any

from sqlalchemy.orm import Session

from src.database import get_db, engine, Base
from src.models import (
    User, Merchant, Product, Category, Order, OrderItem, 
    Payment, Review, SupportTicket, Notification
)
from src.auth import utils as auth_utils


def create_test_users(db: Session, count: int = 5) -> List[User]:
    """Create test users with hashed passwords."""
    users = []
    for i in range(1, count + 1):
        user = User(
            email=f"user{i}@example.com",
            hashed_password=auth_utils.get_password_hash(f"password{i}"),
            first_name=f"User{i}",
            last_name=f"Test",
            is_active=True,
            is_verified=True,
            created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
        )
        db.add(user)
        users.append(user)
    
    # Create an admin user
    admin = User(
        email="admin@example.com",
        hashed_password=auth_utils.get_password_hash("admin123"),
        first_name="Admin",
        last_name="User",
        is_active=True,
        is_verified=True,
        is_admin=True,
        created_at=datetime.utcnow() - timedelta(days=60),
    )
    db.add(admin)
    users.append(admin)
    
    db.commit()
    return users


def create_test_merchants(db: Session, users: List[User], count: int = 3) -> List[Merchant]:
    """Create test merchants associated with users."""
    merchants = []
    for i in range(1, count + 1):
        merchant = Merchant(
            user_id=users[i].id,
            business_name=f"Merchant {i} Store",
            business_email=f"merchant{i}@example.com",
            business_phone=f"+123456789{i}",
            business_address=f"{i} Merchant St, Commerce City",
            business_website=f"https://merchant{i}.example.com",
            business_description=f"Sample merchant {i} description",
            is_approved=True,
            approved_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            created_at=datetime.utcnow() - timedelta(days=random.randint(30, 60)),
        )
        db.add(merchant)
        merchants.append(merchant)
    
    db.commit()
    return merchants


def create_test_categories(db: Session) -> List[Category]:
    """Create test product categories."""
    categories = [
        Category(name="Electronics", slug="electronics", is_active=True),
        Category(name="Clothing", slug="clothing", is_active=True),
        Category(name="Home & Garden", slug="home-garden", is_active=True),
        Category(name="Books", slug="books", is_active=True),
        Category(name="Toys & Games", slug="toys-games", is_active=True),
    ]
    
    for category in categories:
        db.add(category)
    
    db.commit()
    return categories


def create_test_products(
    db: Session, 
    merchants: List[Merchant], 
    categories: List[Category],
    count_per_merchant: int = 5
) -> List[Product]:
    """Create test products for each merchant."""
    products = []
    
    product_data = [
        {"name": "Wireless Earbuds", "price": 99.99, "category": "Electronics"},
        {"name": "Smart Watch", "price": 199.99, "category": "Electronics"},
        {"name": "T-Shirt", "price": 24.99, "category": "Clothing"},
        {"name": "Jeans", "price": 59.99, "category": "Clothing"},
        {"name": "Garden Tools Set", "price": 49.99, "category": "Home & Garden"},
        {"name": "Novel", "price": 14.99, "category": "Books"},
        {"name": "Board Game", "price": 39.99, "category": "Toys & Games"},
        {"name": "Smartphone", "price": 699.99, "category": "Electronics"},
        {"name": "Laptop", "price": 1299.99, "category": "Electronics"},
        {"name": "Headphones", "price": 149.99, "category": "Electronics"},
    ]
    
    for merchant in merchants:
        for i in range(count_per_merchant):
            if i < len(product_data):
                data = product_data[i]
                category = next((c for c in categories if c.name == data["category"]), categories[0])
                
                product = Product(
                    merchant_id=merchant.id,
                    category_id=category.id,
                    name=f"{data['name']} {merchant.id}-{i+1}",
                    description=f"Description for {data['name']} from {merchant.business_name}",
                    price=data["price"],
                    discount_price=data["price"] * 0.9 if i % 3 == 0 else None,  # 10% discount on some items
                    stock_quantity=random.randint(5, 100),
                    sku=f"SKU-{merchant.id}-{i+1:03d}",
                    is_active=True,
                    is_featured=random.choice([True, False]),
                    created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
                )
                db.add(product)
                products.append(product)
    
    db.commit()
    return products


def create_test_orders(
    db: Session, 
    users: List[User], 
    products: List[Product],
    count_per_user: int = 3
) -> List[Order]:
    """Create test orders for users."""
    orders = []
    statuses = ["pending", "processing", "shipped", "delivered", "cancelled"]
    
    for user in users:
        if user.is_admin:  # Skip admin user
            continue
            
        for _ in range(count_per_user):
            order_date = datetime.utcnow() - timedelta(days=random.randint(1, 30))
            status = random.choices(
                statuses, 
                weights=[0.1, 0.2, 0.3, 0.35, 0.05],  # Weighted probabilities
                k=1
            )[0]
            
            order = Order(
                user_id=user.id,
                status=status,
                total_amount=0,  # Will be updated after adding items
                shipping_address=f"{random.randint(1, 100)} Main St, City, Country",
                created_at=order_date,
            )
            db.add(order)
            db.flush()  # Get the order ID for order items
            
            # Add 1-5 random products to the order
            order_items = []
            selected_products = random.sample(products, k=random.randint(1, min(5, len(products))))
            
            for product in selected_products:
                quantity = random.randint(1, 3)
                price = product.discount_price or product.price
                
                order_item = OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=quantity,
                    price=price,
                    subtotal=price * quantity,
                )
                db.add(order_item)
                order_items.append(order_item)
            
            # Update order total
            order.total_amount = sum(item.subtotal for item in order_items)
            orders.append(order)
    
    db.commit()
    return orders


def create_test_reviews(
    db: Session, 
    users: List[User], 
    products: List[Product],
    count_per_product: int = 2
) -> List[Review]:
    """Create test reviews for products."""
    reviews = []
    
    for product in products:
        # Get users who haven't reviewed this product yet
        eligible_users = [u for u in users if not u.is_admin]
        
        for user in random.sample(eligible_users, k=min(count_per_product, len(eligible_users))):
            review = Review(
                user_id=user.id,
                product_id=product.id,
                rating=random.randint(3, 5),  # Mostly positive reviews
                comment=f"Great product! I really like it. {product.name} is awesome!",
                is_approved=True,
                created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            )
            db.add(review)
            reviews.append(review)
    
    db.commit()
    return reviews


def create_test_support_tickets(
    db: Session, 
    users: List[User],
    count_per_user: int = 2
) -> List[SupportTicket]:
    """Create test support tickets."""
    tickets = []
    statuses = ["open", "in_progress", "resolved", "closed"]
    priorities = ["low", "medium", "high", "critical"]
    
    for user in users:
        if user.is_admin:  # Skip admin user
            continue
            
        for _ in range(count_per_user):
            status = random.choices(
                statuses,
                weights=[0.2, 0.3, 0.4, 0.1],  # Weighted probabilities
                k=1
            )[0]
            
            ticket = SupportTicket(
                user_id=user.id,
                subject=f"Help with my {random.choice(['order', 'account', 'payment', 'delivery'])}",
                description=f"I need help with {random.choice(['my order', 'my account', 'a payment', 'a delivery'])}. Please assist.",
                status=status,
                priority=random.choice(priorities),
                created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            )
            db.add(ticket)
            tickets.append(ticket)
    
    db.commit()
    return tickets


def create_test_notifications(
    db: Session,
    users: List[User],
    count_per_user: int = 5
) -> List[Notification]:
    """Create test notifications for users."""
    notifications = []
    types = ["order", "payment", "promotion", "system", "account"]
    
    for user in users:
        for _ in range(count_per_user):
            notification = Notification(
                user_id=user.id,
                type=random.choice(types),
                title=f"{random.choice(['New', 'Important', 'Update'])} {random.choice(['Order', 'Payment', 'Promotion', 'System', 'Account'])} Notification",
                message=random.choice([
                    "Your order has been shipped!",
                    "Payment received successfully.",
                    "New promotion available for you!",
                    "System maintenance scheduled.",
                    "Your account has been updated.",
                ]),
                is_read=random.choice([True, False]),
                created_at=datetime.utcnow() - timedelta(days=random.randint(0, 7)),
            )
            db.add(notification)
            notifications.append(notification)
    
    db.commit()
    return notifications


def reset_database():
    """Drop all tables and recreate them."""
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)


def main():
    print("Starting test database seeding...")
    
    # Initialize database session
    db = next(get_db())
    
    try:
        # Reset database
        reset_database()
        
        # Create test data
        print("Creating test users...")
        users = create_test_users(db, count=5)
        
        print("Creating test merchants...")
        merchants = create_test_merchants(db, users, count=3)
        
        print("Creating test categories...")
        categories = create_test_categories(db)
        
        print("Creating test products...")
        products = create_test_products(db, merchants, categories, count_per_merchant=5)
        
        print("Creating test orders...")
        orders = create_test_orders(db, users, products, count_per_user=3)
        
        print("Creating test reviews...")
        reviews = create_test_reviews(db, users, products, count_per_product=2)
        
        print("Creating test support tickets...")
        tickets = create_test_support_tickets(db, users, count_per_user=2)
        
        print("Creating test notifications...")
        notifications = create_test_notifications(db, users, count_per_user=5)
        
        print(f"\nDatabase seeded successfully!")
        print(f"- Users: {len(users)}")
        print(f"- Merchants: {len(merchants)}")
        print(f"- Categories: {len(categories)}")
        print(f"- Products: {len(products)}")
        print(f"- Orders: {len(orders)}")
        print(f"- Reviews: {len(reviews)}")
        print(f"- Support Tickets: {len(tickets)}")
        print(f"- Notifications: {len(notifications)}")
        
        print("\nAdmin credentials:")
        print(f"Email: admin@example.com")
        print(f"Password: admin123")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
