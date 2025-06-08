from typing import List, Optional
from psycopg2.extras import RealDictCursor
from ..models.product import ProductModel

def get_product_by_platform_id(db_cursor: RealDictCursor, platform_product_id: int) -> Optional[ProductModel]:
    query = """
        SELECT
            p.platform_product_id AS id,
            p.display_name AS name,
            p.display_description AS description,
            p.selling_price AS price,
            p.image_url,
            cat.name AS category_name,
            p.cj_product_id AS source_product_id
        FROM
            cj_products p
        LEFT JOIN
            categories cat ON p.platform_category_id = cat.id
        WHERE
            p.platform_product_id = %s;
    """
    try:
        db_cursor.execute(query, (platform_product_id,))
        row = db_cursor.fetchone()
        if row:
            row_data = dict(row)
            if row_data.get('price') is not None:
                row_data['price'] = float(row_data['price'])
            else:
                row_data['price'] = 0.0
            return ProductModel(**row_data)
    except Exception as e:
        print(f"Error in get_product_by_platform_id for ID {platform_product_id}: {e}")
    return None

def search_products_by_name(db_cursor: RealDictCursor, search_query: str, limit: int = 10) -> List[ProductModel]:
    query = """
        SELECT
            p.platform_product_id AS id,
            p.display_name AS name,
            p.display_description AS description,
            p.selling_price AS price,
            p.image_url,
            cat.name AS category_name,
            p.cj_product_id AS source_product_id
        FROM
            cj_products p
        LEFT JOIN
            categories cat ON p.platform_category_id = cat.id
        WHERE
            p.display_name ILIKE %s
        ORDER BY
            p.updated_at DESC, p.display_name
        LIMIT %s;
    """
    products: List[ProductModel] = []
    try:
        db_cursor.execute(query, (f"%{search_query}%", limit))
        rows = db_cursor.fetchall()
        for row in rows:
            row_data = dict(row)
            if row_data.get('price') is not None:
                row_data['price'] = float(row_data['price'])
            else:
                row_data['price'] = 0.0
            products.append(ProductModel(**row_data))
    except Exception as e:
        print(f"Error in search_products_by_name for query '{search_query}': {e}")
    return products
