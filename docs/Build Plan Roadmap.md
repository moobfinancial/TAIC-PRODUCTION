# TAIC Platform: Build Plan Roadmap

## 1. Introduction & Vision

This document outlines the strategic build plan for the TAIC (Transformative AI Commerce) platform. It serves as a consolidated roadmap, integrating insights from `PROJECT_PLAN.md`, `docs/PRODUCTION_ROADMAP.md`, and `docs/ideas.md`, and aligns development efforts with the platform's evolving architecture and database schema (`schema.sql`). Its purpose is to guide the phased development of new features and enhancements, ensuring a cohesive and strategic approach to building a robust, scalable, and innovative e-commerce solution.

The overall vision for the TAIC platform is to be a global e-commerce ecosystem powered by blockchain technology and enhanced by artificial intelligence. Key pillars of this vision include:
*   **Empowering Global Merchants:** Providing tools for entrepreneurs and businesses worldwide to establish their online presence, manage products (including variants and services), and reach a global customer base.
*   **Seamless Crypto & Fiat Integration:** Supporting TAIC cryptocurrency as a primary payment method alongside traditional fiat currency options, offering flexibility and choice to users.
*   **Incentivized Shopping Experience:** Leveraging cashback rewards in TAIC cryptocurrency to drive user engagement and loyalty.
*   **AI-Driven Enhancements:** Utilizing a sophisticated AI agent architecture (FastAPI backend with MCPUs library) to deliver intelligent shopping assistance, personalized recommendations, virtual try-on capabilities, and efficient platform administration.
*   **Multi-Vendor Marketplace:** Establishing a comprehensive marketplace where multiple merchants can list products, subject to admin approval, fostering a diverse and competitive environment.

This build plan supersedes previous roadmap documents for future planning and development tracking.

## 2. Key Development Areas (Phased Approach)

This section details the planned features and enhancements, organized into logical development phases. Each feature description includes its key components (Frontend, Admin Portal, Merchant Portal, Backend/DB).

### Phase 1: Core Platform Enhancements & Foundational AI

This phase focuses on strengthening the core platform, introducing critical product management features, and laying the groundwork for the new AI agent architecture.

*   **Product Variants Support:**
    *   **Description:** Allow products to have multiple variations (e.g., size, color, material).
    *   **Frontend (Shopper):** Display product variants on the Product Details Page, allowing shoppers to select and add specific variants to their cart.
    *   **Admin Portal:**
        *   View and manage product variants for merchant-uploaded products.
        *   View and approve/manage variants for imported CJ Dropshipping products within the "Manage Imported CJ Products" section.
    *   **Merchant Portal:**
        *   Enable merchants to add new products with multiple variants.
        *   Support bulk upload (CSV/Excel) for products with variants, including pricing for each variant.
    *   **Backend/DB:** Design and implement a `product_variants` table. This table will be linked to a unified `products` table (once `cj_products` and `products` tables are consolidated or a clear relationship is established for variants). It will store SKU, attributes (e.g., size, color), price adjustments, and stock for each variant. (Addresses `variants_json` in `cj_products`).

*   **CJ Dropshipping Product Imports & Service Categories:**
    *   **Description:** Enhance CJ Dropshipping integration and introduce a clear categorization system for services.
    *   **Admin Portal:**
        *   Admin imports CJ products using existing CJ categories.
        *   Admin can view/approve CJ dropshipping product variants (managed via the new variants system) in the "Manage Imported CJ Products" section.
    *   **Backend/DB:**
        *   Define and implement a standardized, hierarchical category structure specifically for **services** within the `categories` table. This may involve a new attribute (e.g., `category_type` as 'product' or 'service') or a dedicated parent category for services.
        *   Ensure `cj_products` table data (categories, base product info) can be smoothly integrated or mapped to the main `products` and `categories` tables.

### Phase 2: Admin & Merchant Empowerment

This phase focuses on providing robust tools for administrators and merchants, enhancing platform control and usability.

*   **Multi-vendor Marketplace Controls (Admin):**
    *   **Description:** Provide administrators with comprehensive tools to manage a multi-vendor marketplace.
    *   **Admin Portal:**
        *   View a comprehensive list of all registered merchants.
        *   Review and approve/reject products uploaded by merchants before they are listed publicly on the platform, including their variants.
    *   **Backend/DB:** Utilize and potentially enhance the `products` table's `merchant_id` and `approval_status` fields. Ensure variant approvals are linked to the base product approval.

*   **Admin Dashboard Enhancements:**
    *   **Description:** Overhaul the Admin Dashboard into a centralized management hub for efficient platform oversight.
    *   **Admin Portal:**
        *   Implement quick access panels/widgets for key information: Shopper insights (e.g., new registrations, active users), Merchant insights (e.g., new applications, top performers), Sales overview (e.g., total revenue, transaction volume), Product insights (e.g., new listings, popular items).
        *   Improve navigation with clear shortcuts to essential admin functions.
    *   **Backend/DB:** Requires optimized aggregation queries and potentially new summary tables or materialized views to efficiently source data for dashboard widgets.

*   **Merchant Store Pages:**
    *   **Description:** Provide each merchant with a dedicated, customizable store page.
    *   **Frontend (Shopper):** Users can navigate to individual merchant store pages (e.g., `taic.com/store/merchant-slug`) to view all products listed by that specific merchant.
    *   **Merchant Portal:**
        *   Allow merchants to customize aspects of their store page (e.g., banner, logo, description).
        *   System generates a unique, shareable URL for their store.
        *   Enable merchants to easily copy and share their store link for customer invites.
    *   **Backend/DB:**
        *   Create a new table `merchant_store_profiles` (e.g., `merchant_id` (FK), `store_slug` (UNIQUE), `banner_url`, `logo_url`, `description`, `custom_settings` (JSONB)).
        *   Implement logic for generating unique, SEO-friendly slugs from merchant names or business names.

### Phase 3: User Experience & Advanced AI Features

This phase concentrates on refining the shopper experience, introducing advanced authentication, and rolling out sophisticated AI capabilities based on the new architecture.

*   **User Authentication Options:**
    *   **Description:** Expand user authentication methods to include crypto wallets and traditional logins, while ensuring continued support for existing payment methods.
    *   **Frontend (Shopper):**
        *   Implement Wallet Connect support for user authentication and TAIC token transactions.
        *   Provide a traditional email/password login and registration system with appropriate validation and security measures.
        *   Ensure continued support and seamless integration for credit card payments (e.g., via Stripe).
    *   **Backend/DB:**
        *   Extend or create a comprehensive `users` table (essential, though not fully detailed in the provided `schema.sql`) to store wallet addresses (for Wallet Connect), traditional login credentials (e.g., `email`, `hashed_password`, `salt`), and roles.
        *   Develop mechanisms to manage different authentication states, link multiple auth methods to a single user account if desired, and handle user profiles securely.

*   **Shopper Account Management:**
    *   **Description:** Enhance the shopper account management dashboard with comprehensive and user-friendly operations.
    *   **Frontend (Shopper):**
        *   Review existing account management features (e.g., order history, address book, as indicated in `PRODUCTION_ROADMAP.md`).
        *   Identify and implement missing/necessary user-friendly operations, such as: updating profile details, managing communication preferences, viewing TAIC token balance and cashback history, managing linked wallet addresses or payment methods.
    *   **Backend/DB:** Ensure user profile tables (`users`, and potentially related tables for addresses, etc.) can store and provide all relevant information securely and efficiently.

*   **AI Agent Architecture Rollout (Foundation):**
    *   **Description:** Implement the foundational elements of the new AI agent architecture as outlined in `PRODUCTION_ROADMAP.md`.
    *   **Backend/DB:**
        *   Develop the FastAPI backend infrastructure for hosting AI agents.
        *   Integrate the `MCPUs` library to structure agent capabilities and enable tool exposure/consumption.
        *   Develop the initial AI Shopping Assistant (focusing on conversational search, basic product queries, and information retrieval) as a FastAPI service.
        *   Create foundational product data access tools (MCP-compatible) that allow AI agents to query product information (including variants, stock, pricing) from the database.

### Phase 4: Advanced AI Capabilities, Long-term & Optimization

This phase will build upon the new AI architecture, introducing more sophisticated AI agents and focusing on platform optimization and future growth.

*   **Gift Recommendation AI Agent:**
    *   **Description:** An AI agent dedicated to helping shoppers find suitable gifts, leveraging the "Gift Idea" mode conceptualized in `docs/ideas.md`.
    *   **Frontend (Shopper):** Integrate with the main AI Shopping Assistant or provide a dedicated interface/flow for gift finding.
    *   **Backend/DB:**
        *   Built on the FastAPI/MCPUs architecture.
        *   Develop sophisticated logic for understanding recipient details (age, gender, interests), occasion, and budget.
        *   The agent will utilize the product data access tools to query the product catalog and suggest suitable gifts.

*   **Merchant-Specific AI Agents (Initial):**
    *   **Description:** Develop initial AI agents tailored for specific merchant needs or integrations, starting with a CJ Dropshipping Agent.
    *   **Backend/DB:**
        *   Create a CJ Dropshipping Agent (FastAPI service, MCP-compatible) that can be queried by the main AI Shopping Assistant for up-to-date product information, stock levels, and estimated shipping times related to CJ products.
        *   Implement robust Agent-to-Agent (A2A) communication protocols between the main Shopping Assistant and specialized agents like the CJ Agent. (Ref: `PRODUCTION_ROADMAP.md` - AI Agent Architecture Strategy)

*   **Virtual Try-On (Full Integration):**
    *   **Description:** Fully integrate the AI-powered virtual try-on feature, moving from UI mockups to a functional service.
    *   **Frontend (Shopper):** Provide a clear UI for users to upload their image and view the generated try-on image with the selected product.
    *   **Backend/DB:**
        *   Develop a Genkit flow or a dedicated FastAPI service that utilizes an advanced image generation model (e.g., Gemini or similar).
        *   Implement secure storage for user-uploaded images, adhering to privacy best practices.
        *   Ensure the AI model can accurately integrate product images with user images. (Ref: `PROJECT_PLAN.md` - Phase 3, `PRODUCTION_ROADMAP.md` - Phase 4.2)

## 3. Database (SQL) Considerations

This section summarizes necessary database schema updates based on `schema.sql` and the features outlined above. Consistent naming conventions, defined types, and clear relationships are crucial for maintainability and scalability.

*   **Product Variants:**
    *   The existing `variants_json` field in `cj_products` is a placeholder and insufficient for robust variant management.
    *   **Recommendation:** Create a new table `product_variants` (e.g., `id` (PK), `product_id` (FK to a unified `products` table), `sku` (VARCHAR, UNIQUE for inventory tracking), `attributes` (JSONB, e.g., `{"size": "M", "color": "Blue"}`), `price_modifier` (DECIMAL, if price varies from base product), `specific_price` (DECIMAL, if variant has its own price), `stock_quantity` (INTEGER), `image_url` (VARCHAR, for variant-specific image)).
    *   A unified `products` table model is the goal, encompassing both merchant-uploaded and CJ-sourced products to simplify variant and overall product management. The `product_id` in `product_variants` would then refer to this unified table.

*   **Merchant-Specific Data:**
    *   **Merchant Store Pages:** A new table `merchant_store_profiles` (e.g., `merchant_id` (FK to `users` table where role is 'merchant'), `store_slug` (VARCHAR, UNIQUE), `display_name` (VARCHAR), `banner_url` (VARCHAR), `logo_url` (VARCHAR), `store_description` (TEXT), `custom_settings` (JSONB for theme, etc.)).
    *   The `products` table already includes `merchant_id` and `approval_status`, essential for multi-vendor controls.

*   **Service-Type Categories:**
    *   The `categories` table (`id`, `name`, `description`, `parent_category_id`, `is_active`) can support services.
    *   **Recommendation:** Add a `category_type` field (e.g., ENUM('PRODUCT', 'SERVICE') or VARCHAR with a check constraint) to explicitly differentiate service categories from product categories. This aids in filtering and specific logic for services.
    *   The hierarchical structure (`parent_category_id`) should be leveraged to appropriately model service offerings (e.g., "Digital Services" > "Graphic Design").

*   **User Table Enhancements (Implicit `users` table):**
    *   A central `users` table is fundamental and needs to be fully defined. It should include:
        *   `id` (PK, e.g., UUID or SERIAL)
        *   `email` (VARCHAR, UNIQUE, for traditional login & communication)
        *   `hashed_password` (VARCHAR, for traditional login)
        *   `password_salt` (VARCHAR, for traditional login security)
        *   `wallet_address` (VARCHAR, UNIQUE, nullable, for Wallet Connect login/association)
        *   `role` (VARCHAR or ENUM, e.g., 'SHOPPER', 'MERCHANT', 'ADMIN')
        *   Profile information: `first_name`, `last_name`, `phone_number`, etc.
        *   Separate tables for shipping addresses (`user_addresses`) linked by `user_id` are recommended for normalization.
        *   `created_at`, `updated_at`, `last_login_at` (TIMESTAMPTZ).

*   **General Schema Notes:**
    *   **Consistency:** Strictly maintain consistent naming conventions (e.g., `snake_case` for columns and tables, `_id` for foreign keys, `_at` for timestamps).
    *   **Relationships:** Clearly define foreign key relationships with appropriate `ON DELETE` and `ON UPDATE` actions. Ensure comprehensive indexing for performance.
    *   **Data Types:** Use appropriate data types (`JSONB` for flexible structured data, `NUMERIC` or `DECIMAL` for currency, `TIMESTAMPTZ` for time zone aware timestamps).
    *   The existing `admin_users` table (for API key access) should be distinct from user accounts with an 'ADMIN' role in the main `users` table, who would use the standard login mechanisms for dashboard access.

## 4. Suggestions & Potential Improvements (Future Considerations)

This section lists items identified as potential future enhancements, drawn from the issue description and existing project documents. These are not yet assigned to specific phases but represent opportunities for platform growth and refinement.

*   **Variant Inventory Management:** Granular inventory tracking specifically at the product variant level, possibly with alerts.
*   **Pricing Rules:**
    *   Support for dynamic pricing strategies.
    *   Bulk pricing update tools and templates for merchants.
*   **Store Customization for Merchants (Advanced):** Beyond basic settings, allow more extensive theme customization, possibly through a templating system or controlled CSS overrides for merchant store pages.
*   **Analytics Dashboard for Merchants:** Provide merchants with detailed sales analytics, customer insights, traffic reports, and product performance metrics.
*   **SEO for Merchant Stores/Products:** Implement tools and best practices for enhancing search engine optimization of merchant pages and individual product listings (e.g., customizable meta tags, structured data).
*   **Notifications & Alerts:** Develop a comprehensive system-wide notification service for users and merchants (e.g., low stock warnings, new order confirmations, order status changes, new promotional offers).
*   **TAIC "Stake to Shop" Program:** Design and implement staking mechanisms for TAIC tokens that unlock exclusive benefits for shoppers, such as enhanced cashback or early access. (Ref: `PRODUCTION_ROADMAP.md`)
*   **Community Building Features:** Introduce features like user forums, product Q&A sections, discussion groups, or gamification elements to foster community engagement. (Ref: `PRODUCTION_ROADMAP.md`)

## 5. Document Review & Consolidation Notes

This "Build Plan Roadmap" document consolidates and synthesizes information from the following existing documents:
*   `PROJECT_PLAN.md`
*   `docs/PRODUCTION_ROADMAP.md`
*   `docs/ideas.md`

It aims to provide a unified and comprehensive view of the development trajectory for the TAIC platform. For future planning and tracking, this document shall be considered the primary source of truth, superseding the specific roadmap sections of the aforementioned files. The `schema.sql` will continue to be the source of truth for database structure, and this roadmap will reflect its implications for feature development.

This document is intended to be a living document and will be updated as the project evolves, priorities shift, and new information becomes available.
