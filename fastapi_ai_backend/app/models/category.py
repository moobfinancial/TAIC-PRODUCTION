from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime

class CategoryBase(BaseModel):
    """Base schema for category data, containing common fields for creation and representation."""
    name: str = Field(..., min_length=1, max_length=255, description="Name of the category.")
    description: Optional[str] = Field(default=None, description="Optional detailed description of the category.")
    parent_category_id: Optional[int] = Field(default=None, description="ID of the parent category, if this is a sub-category. Null for top-level categories.")
    is_active: bool = Field(default=True, description="Indicates if the category is currently active and usable.")
    category_type: str = Field(default='PRODUCT', pattern="^(PRODUCT|SERVICE)$", description="Type of the category, either 'PRODUCT' or 'SERVICE'. Defaults to 'PRODUCT'.")
    custom_attributes: Optional[Dict[str, Any]] = Field(default=None, description="For 'SERVICE' categories, a dictionary of custom attribute definitions (e.g., {'duration': 'hours', 'location_type': 'online/on-site'}). Must be null or empty for 'PRODUCT' categories.")

    @validator('custom_attributes', always=True)
    def check_custom_attributes_for_product_type(cls, v, values):
        # 'values' contains all previously validated fields
        if values.get('category_type') == 'PRODUCT' and v is not None and v != {}:
            # Allow None or empty dict for PRODUCT type, but not populated dict
            raise ValueError("custom_attributes must be null or empty if category_type is 'PRODUCT'")
        return v

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "name": "Electronics",
                "description": "All kinds of electronic gadgets and devices.",
                "parent_category_id": None,
                "is_active": True,
                "category_type": "PRODUCT",
                "custom_attributes": None
            },
            "example_service": {
                "name": "Consulting Services",
                "description": "Expert consulting for various domains.",
                "parent_category_id": None,
                "is_active": True,
                "category_type": "SERVICE",
                "custom_attributes": {"skill_level": "expert", "availability_zone": "UTC"}
            }
        }

class CategoryCreate(CategoryBase):
    """Schema for creating a new category. Inherits all fields from CategoryBase."""
    pass # Example provided in CategoryBase

class CategoryUpdate(BaseModel):
    """
    Schema for updating an existing category. All fields are optional.
    Only include the fields that need to be changed.
    """
    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="New name for the category.")
    description: Optional[str] = Field(default=None, description="New description for the category. Set to null to clear.")
    parent_category_id: Optional[int] = Field(default=None, description="New parent category ID. Set to null to make it a top-level category.") # Allow setting parent to NULL
    is_active: Optional[bool] = Field(default=None, description="New active status for the category.")
    category_type: Optional[str] = Field(default=None, pattern="^(PRODUCT|SERVICE)$", description="Change the category type. If changing to 'PRODUCT', ensure `custom_attributes` are cleared or not provided if they were set.")
    custom_attributes: Optional[Dict[str, Any]] = Field(default=None, description="New custom attributes. If `category_type` is 'PRODUCT', this must be null or empty.") # Allow setting to None or new dict

    @validator('custom_attributes', always=True)
    def check_custom_attributes_update(cls, v, values):
        # If category_type is being set to 'PRODUCT' and custom_attributes are provided and not empty, raise error.
        # If category_type is not in values (not being updated) or is 'SERVICE', custom_attributes are fine.
        category_type_to_check = values.get('category_type')
        if category_type_to_check == 'PRODUCT' and v is not None and v != {}:
            raise ValueError("custom_attributes must be null or empty if category_type is 'PRODUCT'")
        return v

    # TODO: Add a root validator if category_type is NOT changing but custom_attributes are being set

# New model for the list_all_categories MCP tool
class CategoryInfo(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    parent_category_id: Optional[int] = None
    # created_at: datetime # Not strictly needed for AI to list/select categories
    # updated_at: datetime # Not strictly needed for AI to list/select categories

    class Config:
        from_attributes = True # Pydantic v2, or orm_mode = True for v1


    # for an existing PRODUCT category. This would require fetching the current category_type from DB
    # or having it passed, which is complex for a generic update model.
    # The endpoint logic should handle this: if type is PRODUCT, ensure custom_attrs are cleared.
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated Category Name",
                "is_active": False
            }
        }

class Category(CategoryBase):
    """Represents a full category record, including database-generated fields like ID and timestamps."""
    id: int = Field(..., description="Unique identifier for the category.")
    created_at: datetime = Field(..., description="Timestamp of when the category was created.")
    updated_at: datetime = Field(..., description="Timestamp of the last update to the category.")
    # Could add sub_categories: List['Category'] = [] if needed for nested responses,
    # but requires careful handling of circular dependencies and query complexity.
    # For now, keeping it flat.
    class Config(CategoryBase.Config): # Inherit from_attributes from CategoryBase.Config
        json_schema_extra = {
             "example": {
                "id": 1,
                "name": "Digital Services",
                "description": "Various digital services offered.",
                "parent_category_id": None,
                "is_active": True,
                "category_type": "SERVICE",
                "custom_attributes": {"response_time": "24h", "deliverable_format": "pdf"},
                "created_at": "2023-01-01T10:00:00Z",
                "updated_at": "2023-01-05T14:30:00Z"
            }
        }
