from pydantic import BaseModel, HttpUrl
from typing import Optional, Any # Using Any for variants_json for now

# This model represents the core product data structure that will be used
# by services and API endpoints within the AI services.
# It's designed to be compatible with data fetched from tables like cj_products,
# merchant_products, or a unified products view.

class ProductModel(BaseModel):
    # Assuming platform_product_id (from cj_products) or a similar numeric ID from other tables
    # will be the primary identifier used internally by AI services for now.
    # It can be converted to string when presented if needed by specific API contracts.
    id: str  # Unified ID for AI services, typically the string representation of original_id # e.g., platform_product_id from cj_products or id from merchant_products

    name: str
    description: Optional[str] = None

    # Using float for price, ensure consistency with DB NUMERIC type
    price: float

    # HttpUrl ensures that the URL is valid
    image_url: Optional[HttpUrl] = None

    # Category name, usually joined from a categories table or directly on the product record
    category_name: Optional[str] = None

    # For CJ products, this would be cj_product_id. For others, it might be null or a different SKU.
    # This helps in uniquely identifying the product from its source if needed.
    source_product_id: Optional[str] = None # ID from the external supplier system (e.g., CJ's cj_product_id)

    # Fields to track the product's origin within our system
    original_id: str # The primary key from our source database table (e.g., cj_products.platform_product_id or products.id)
    source: str      # Indicates the source table or system within our platform (e.g., 'cj_products', 'products_main')

    # Potentially other fields useful for AI:
    # stock_quantity: Optional[int] = None
    # is_active: Optional[bool] = None
    # variants_json: Optional[Any] = None # If variants are stored as JSONB

    # Allow extra fields to be present in the input data but not part of the model
    # This can be useful when parsing DB rows that have more columns than defined here.
    # class Config:
    #     extra = "ignore"
    # Pydantic V2 way:
    model_config = {
        "extra": "ignore"
    }

# Example of how it might be used if fetching from DB with RealDictCursor
# from your db session:
# db_row = {'id': 123, 'name': 'Awesome Gadget', 'description': 'Description here',
#           'price': 29.99, 'image_url': 'http://example.com/image.jpg',
#           'category_name': 'Electronics', 'source_product_id': 'CJXYZ789',
#           'some_other_db_column': 'value'}
# product = ProductModel(**db_row)
# print(product.model_dump_json())
