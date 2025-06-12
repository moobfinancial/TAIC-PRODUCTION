# Schema Evolution Notes

This document records significant changes to the database schema, their reasons, and potential implications.

## `orders.user_id` Type Change and Foreign Key

**Date of Change:** 2023-10-28 (Placeholder date, replace with actual date of merge/deployment)

**Change Made:**
*   The `user_id` column in the `orders` table was changed from `INTEGER` to `VARCHAR(255)`.
*   The column was kept `NULLABLE`.
*   A foreign key constraint `fk_orders_user_id` was added: `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL`.

**Reason:**
*   **Alignment with `users.id`:** The `users` table uses `VARCHAR(255)` for its primary key `id` (typically a UUID or application-generated string). The `orders.user_id` needed to match this type to establish a proper relational link.
*   **Data Integrity:** Implementing a foreign key constraint ensures that `user_id` values in the `orders` table correctly reference existing users, preventing orphaned order records (or at least making the relationship explicit).
*   **Relational Operations:** Allows for easier and more reliable joins and queries between `orders` and `users`.

**Implications for Existing Data:**
*   **Data Migration Required:** If the `orders` table contains existing data where `user_id` was stored as an integer, a data migration process is crucial. This process must convert these integer `user_id` values to their corresponding new `VARCHAR(255)` user IDs from the `users` table.
*   **Migration Complexity:**
    *   If the previous integer `user_id`s directly mapped to a sequence or an old integer primary key that has a clear corresponding new `VARCHAR(255)` ID in the `users` table, the migration might involve a lookup script.
    *   If the mapping is not straightforward (e.g., user IDs were from a different system or user records were recreated with new UUIDs), the migration could be more complex, potentially requiring manual mapping or heuristics if user identification data (like email) is available in the old orders context.
    *   If the `users` table was populated *after* some orders were created with integer IDs, those orders might not have a corresponding `VARCHAR(255)` user ID, leading to data that cannot be directly mapped. These cases would need special handling (e.g., assigning to a generic user or leaving as NULL if business rules permit).

**Implications for Application Code:**
*   **Data Type Handling:** Backend and frontend code that queries, inserts, or updates records in the `orders` table must be updated to handle `user_id` as a string (VARCHAR) type, not an integer. This includes API request/response models, database interaction logic, and any data validation layers.
*   **Queries and Joins:** SQL queries involving `orders.user_id` for joins with `users.id` will now function correctly and efficiently with consistent data types.
*   **Data Transformations:** Any application logic that performs transformations, comparisons, or type casting on `orders.user_id` will need to be reviewed and adjusted for the new string type.

**Foreign Key Behavior (`ON DELETE SET NULL`):**
*   **Current Behavior:** With `ON DELETE SET NULL`, if a user record is deleted from the `users` table, the `user_id` field in all associated orders for that user will automatically be set to `NULL`.
*   **Considerations:**
    *   **Orphaned Orders (Logically):** While the order records themselves are preserved, they will no longer be directly associated with a specific user once the user is deleted. This might be acceptable if historical order data needs to be kept for accounting or analytics, regardless of user account status.
    *   **Alternative - `ON DELETE RESTRICT`:** If business rules dictate that an order must *always* be associated with an existing user, `ON DELETE RESTRICT` would be more appropriate. This would prevent the deletion of a user if they have any orders linked to them. The application would then need to handle such restrictions, perhaps by disallowing user deletion if orders exist, or by providing a mechanism to reassign orders.
    *   **Alternative - `ON DELETE CASCADE`:** If orders should be deleted when the associated user is deleted, `ON DELETE CASCADE` could be used. However, this is often too destructive for order data, as it can lead to loss of important sales records.
    *   **Nullability:** The choice of `ON DELETE SET NULL` aligns with `orders.user_id` being `NULLABLE`. If `user_id` were `NOT NULL`, then `SET NULL` would not be a valid `ON DELETE` action, and `RESTRICT` or `CASCADE` would be the primary alternatives.

**Future Considerations:**
*   If it's determined that an order must always belong to a user, the `user_id` column in `orders` should be changed to `NOT NULL`, and the `ON DELETE` action of the foreign key should be reconsidered (likely to `ON DELETE RESTRICT`).
*   The application needs robust handling for cases where `user_id` might be `NULL` in orders if that's unexpected by certain parts of the application logic.
