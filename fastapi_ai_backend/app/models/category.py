from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    parent_category_id: Optional[int] = None
    is_active: bool = True
    category_type: str = Field(default='PRODUCT', pattern="^(PRODUCT|SERVICE)$") # Ensures type is 'PRODUCT' or 'SERVICE'
    custom_attributes: Optional[Dict[str, Any]] = None

    @validator('custom_attributes', always=True)
    def check_custom_attributes_for_product_type(cls, v, values):
        # 'values' contains all previously validated fields
        if values.get('category_type') == 'PRODUCT' and v is not None and v != {}:
            # Allow None or empty dict for PRODUCT type, but not populated dict
            raise ValueError("custom_attributes must be null or empty if category_type is 'PRODUCT'")
        return v

    class Config:
        from_attributes = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    parent_category_id: Optional[int] = None # Allow setting parent to NULL
    is_active: Optional[bool] = None
    category_type: Optional[str] = Field(default=None, pattern="^(PRODUCT|SERVICE)$")
    custom_attributes: Optional[Dict[str, Any]] = None # Allow setting to None or new dict

    @validator('custom_attributes', always=True)
    def check_custom_attributes_update(cls, v, values):
        # If category_type is being set to 'PRODUCT' and custom_attributes are provided and not empty, raise error.
        # If category_type is not in values (not being updated) or is 'SERVICE', custom_attributes are fine.
        category_type_to_check = values.get('category_type')
        if category_type_to_check == 'PRODUCT' and v is not None and v != {}:
            raise ValueError("custom_attributes must be null or empty if category_type is 'PRODUCT'")
        return v

    # TODO: Add a root validator if category_type is NOT changing but custom_attributes are being set
    # for an existing PRODUCT category. This would require fetching the current category_type from DB
    # or having it passed, which is complex for a generic update model.
    # The endpoint logic should handle this: if type is PRODUCT, ensure custom_attrs are cleared.

class Category(CategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # Could add sub_categories: List['Category'] = [] if needed for nested responses,
    # but requires careful handling of circular dependencies and query complexity.
    # For now, keeping it flat.
