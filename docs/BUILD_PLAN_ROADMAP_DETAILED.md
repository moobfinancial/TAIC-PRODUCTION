# TAIC Platform: Build Plan Roadmap (Updated)

## 1. Introduction & Vision

This document outlines the strategic build plan for the TAIC (Transformative AI Commerce) platform. It serves as a consolidated roadmap, integrating insights from previous project plans and the initial comprehensive issue statement. It aligns development efforts with the platform's evolving architecture and database schema (`schema.sql`). Its purpose is to guide the phased development of new features and enhancements, ensuring a cohesive and strategic approach to building a robust, scalable, and innovative e-commerce solution.

The overall vision for the TAIC platform is to be a global e-commerce ecosystem powered by blockchain technology and enhanced by artificial intelligence. Key pillars of this vision include:
*   **Empowering Global Merchants:** Providing tools for entrepreneurs and businesses worldwide to establish their online presence, manage products (including variants and services), and reach a global customer base.
*   **Seamless Crypto & Fiat Integration:** Supporting TAIC cryptocurrency as a primary payment method alongside traditional fiat currency options, offering flexibility and choice to users.
*   **Incentivized Shopping Experience:** Leveraging cashback rewards in TAIC cryptocurrency to drive user engagement and loyalty.
*   **AI-Driven Enhancements:** Utilizing a sophisticated AI agent architecture (FastAPI backend with MCPUs library for core backend agents, and Genkit/Next.js for specific frontend-facing AI flows) to deliver intelligent shopping assistance, personalized recommendations, virtual try-on capabilities, and efficient platform administration.
*   **Multi-Vendor Marketplace:** Establishing a comprehensive marketplace where multiple merchants can list products, subject to admin approval, fostering a diverse and competitive environment.

This build plan is the primary source for future planning and development tracking.

## 2. Key Development Areas (Phased Approach)

This section details planned features and enhancements, organized into logical development phases. Each feature description includes its key components.
**Status Legend:**
*   `[COMPLETED - Backend]`
*   `[COMPLETED - DB Schema]`
*   `[COMPLETED - Documentation]`
*   `[COMPLETED - Policy]`
*   `[IN PROGRESS]`
*   `[PENDING - Frontend]`
*   `[PENDING - Backend]`
*   `[PENDING - Further AI Dev/Integration]`
*   `[NEEDS CLARIFICATION/DECISION]`

### Phase 1: Core Platform Enhancements, Foundational AI, & Homepage/Pioneer Launch

This phase focuses on strengthening the core platform, introducing critical product management features, laying the groundwork for the FastAPI AI agent architecture, and launching initial homepage/Pioneer Program elements.

*   **Product Variants Support:**
    *   **Description:** Allow products to have multiple variations.
    *   **Status:** `[COMPLETED - DB Schema]`, `[COMPLETED - Backend APIs for Variant CRUD]`, `[COMPLETED - Backend for Bulk Upload CSV Parsing]`, `[COMPLETED - Documentation for Bulk Upload Template]`.
    *   **Confirmations:**
        *   Variant-Level Inventory: `[COMPLETED - Backend]` Logic in place for `product_variants.stock_quantity`.
        *   Bulk Upload Template: `[COMPLETED - Documentation]` (`docs/merchant_bulk_product_upload_template_guide.md`).
    *   **Frontend (Shopper):** `[PENDING - Frontend]` Display product variants on Product Details Page, allow selection and cart addition.
    *   **Admin Portal:** `[PENDING - Frontend]` View/manage product variants.
    *   **Merchant Portal:** `[PENDING - Frontend]` UI for adding products with variants, UI for bulk upload.
    *   **Backend/DB:** `[COMPLETED - DB Schema]` `product_variants` table created and linked to `products`. `products` table enhanced for unification.

*   **Service Categories:**
    *   **Description:** Clear categorization system for services.
    *   **Status:** `[COMPLETED - DB Schema]`, `[COMPLETED - Backend APIs for Category CRUD]`.
    *   **Confirmations:**
        *   Unique Attributes for Services: `[COMPLETED - DB Schema]` `categories.custom_attributes` (JSONB) added. `categories.category_type` added.
    *   **Admin Portal:** `[PENDING - Frontend]` UI for managing service categories and their custom attributes.
    *   **Frontend (Shopper):** `[PENDING - Frontend]` Display and filtering for services.

*   **Homepage Enhancements (from Issue):**
    *   **Status:** `[COMPLETED - Initial Structure & Content Backend/Static]` for many items. Complex AI integrations are `[PENDING - Further AI Dev/Integration]`. Analytics setup is `[IN PROGRESS]`.
    *   Homepage Messaging & Branding: `[COMPLETED - Initial Structure & Content Backend/Static]` (Text updates in `src/app/page.tsx`).
    *   Interactive "AMA AI for TAIC Coin" Experience:
        *   UI Structure: `[COMPLETED - Initial Structure & Content Backend/Static]` (Placeholder section and dialog skeleton in `src/app/page.tsx` and `InteractiveAIMADialog.tsx`).
        *   Technical Integration (HeyGen, LiveKit): `[PENDING - Further AI Dev/Integration]`.
        *   Interaction Logic, Escape Hatch: `[PENDING - Further AI Dev/Integration]`.
        *   Telephony Integration & Consent: `[PENDING - Further AI Dev/Integration]`.
    *   Canvas View Interaction Features: `[PENDING - Further AI Dev/Integration]`.
    *   TAIC Coin & Pioneer Program Promotion Section: `[COMPLETED - Initial Structure & Content Backend/Static]` (Added to `src/app/page.tsx`).
    *   CTA Sections (Consolidated): `[COMPLETED - Initial Structure & Content Backend/Static]` (Added to `src/app/page.tsx`).
    *   Crypto & Rewards Highlights Section: `[COMPLETED - Initial Structure & Content Backend/Static]` (Added to `src/app/page.tsx`).
    *   Influencer & Community Engagement Section: `[COMPLETED - Initial Structure & Content Backend/Static]` (Added to `src/app/page.tsx`).
    *   Analytics & Testing: `[IN PROGRESS]` Basic CTA click tracking framework in place (`src/lib/analytics.ts`). Full analytics and A/B testing `[PENDING - Further AI Dev/Integration]`.

*   **Pioneer Program Implementation (from Issue):**
    *   **Status:** `[COMPLETED - Documentation]` for Tiers and Application Process. Backend/Smart Contract/Frontend `[PENDING]`.
    *   Tier Setup & Documentation: `[COMPLETED - Documentation]` (`docs/pioneer_program_tiers_definition.md`).
    *   Application Process (Form Fields, SLA): `[COMPLETED - Documentation]` (`docs/pioneer_program_application_process.md`).
    *   Application Portal (Frontend/Backend): `[PENDING - Frontend]`, `[PENDING - Backend]`.
    *   Verification Tools & Checks: `[PENDING - Backend]`.
    *   MOU/Agreement Creation: `[PENDING - Policy]` (Legal task).
    *   Token Allocation & Vesting (Smart Contract): `[PENDING - Further AI Dev/Integration]` (Specialized blockchain dev).
    *   Backend for application management, deliverable tracking: `[PENDING - Backend]`.
    *   Marketing & Outreach: `[PENDING]` (Execution task).
    *   Community Channel Integration: `[PENDING]` (Execution task).

*   **Foundational AI Agent Architecture (FastAPI/MCP):**
    *   **Status:** `[COMPLETED - Backend]` Core Shopping Assistant & Product Service functional with A2A communication and real data.
    *   FastAPI Backend Infrastructure for AI Agents: `[COMPLETED - Backend]` (`fastapi_ai_backend`).
    *   MCPUs Library Integration: `[COMPLETED - Backend]` (using `mcp` and `mcp-use`).
    *   Initial AI Shopping Assistant: `[COMPLETED - Backend]` (`shopping_assistant_agent.py` capable of understanding queries, calling Product Service, handling CJ product enrichment via CJ Agent, and generating responses).
    *   Foundational Product Data Access Tools (Product Service Agent): `[COMPLETED - Backend]` (`product_service_agent.py` serving unified product/variant data from DB with advanced filtering).

*   **Advanced Product Filtering (from Issue "Critical Taken for Granted"):**
    *   **Status:** `[COMPLETED - Backend]` APIs support it. `[PENDING - Frontend]` UI.
    *   Backend API in Product Service Agent: `[COMPLETED - Backend]` (Supports price and attribute filters).
    *   Shopping Assistant understanding of advanced filters: `[COMPLETED - Backend]`.
    *   Frontend UI for filters: `[PENDING - Frontend]`.

*   **Notification Service - Welcome Emails (from Issue "Expanded Transactional Email Flows"):**
    *   **Status:** `[COMPLETED - Backend]` Utilities and placeholder integration. `[PENDING - Backend]` for actual integration with live registration.
    *   Email Sending Utilities & Templates: `[COMPLETED - Backend]` (`email_utils.py` with simulated sending).
    *   Placeholder Integration with conceptual registration endpoints: `[COMPLETED - Backend]` (`auth_placeholder.py`).
    *   Actual integration with live registration flows: `[PENDING - Backend]`.

### Phase 2: Admin & Merchant Empowerment

This phase focuses on providing robust tools for administrators and merchants.

*   **Multi-vendor Marketplace Controls (Admin):**
    *   **Status:** `[COMPLETED - Backend APIs for Product Approval]`, `[COMPLETED - Policy for Edit Re-approval]`. `[PENDING - Frontend]` for Admin Portal. `[PENDING - Backend]` for implementing re-approval logic in merchant product update APIs.
    *   Admin APIs for Product Approval/Rejection: `[COMPLETED - Backend]` (`admin.py` router). Sets `is_active`.
    *   Policy for Product Edit Re-Approvals: `[COMPLETED - Policy]` (`docs/product_edit_re_approval_policy.md`).
    *   Admin Portal UI for review: `[PENDING - Frontend]`.

*   **Admin Dashboard Enhancements:**
    *   **Status:** `[COMPLETED - Backend APIs for Audit Log & Stats]`. `[PENDING - Frontend]` for dashboard UI.
    *   Admin Audit Log:
        *   DB Schema: `[COMPLETED - DB Schema]` (`admin_audit_log` table, `products.admin_review_notes` column).
        *   Backend Utility & Integration: `[COMPLETED - Backend]` (`audit_utils.py` and integration into product review).
        *   API to View Audit Logs: `[COMPLETED - Backend]` (GET `/api/admin/audit-logs` with filters/pagination).
    *   Aggregated Data for Dashboard Widgets: `[COMPLETED - Backend]` (API `GET /api/admin/dashboard/stats`).
    *   Admin Portal UI (Dashboard, Panels, Navigation): `[PENDING - Frontend]`.

*   **Merchant Store Pages:**
    *   **Status:** `[COMPLETED - DB Schema]`, `[COMPLETED - Backend APIs for Profile & Reviews]`. `[PENDING - Frontend]`.
    *   DB Schema: `[COMPLETED - DB Schema]` (`merchant_store_profiles`, `store_reviews` tables).
    *   Backend APIs for Merchant Store Profile Management: `[COMPLETED - Backend]` (CRUD, slug generation).
    *   Backend APIs for Store-Level Reviews & Ratings: `[COMPLETED - Backend]` (Create, List).
    *   Frontend (Shopper view, Merchant customization): `[PENDING - Frontend]`.

*   **Shipping Management for Merchants (from Issue "Critical Taken for Granted"):**
    *   **Status:** `[PENDING - Backend]`, `[PENDING - Frontend]`.
    *   Merchant Portal UI for defining shipping (zones, rates): `[PENDING - Frontend]`.
    *   Backend logic to store configs & integrate with checkout: `[PENDING - Backend]`.

*   **Tax Calculation Engine V1 (from Issue "Critical Taken for Granted"):**
    *   **Status:** `[PENDING - Backend]`, `[PENDING - Frontend]`.
    *   Merchant Portal UI for basic tax settings: `[PENDING - Frontend]`.
    *   Backend for initial tax calculation: `[PENDING - Backend]`

*   **AI Product Idea Generator (for Merchants):**
    *   **Description:** Provides merchants with an AI-powered tool to generate new product concepts, refine existing ideas, explore market niches, and foster innovation. Leverages the underlying Genkit flow (`src/ai/flows/product-idea-generator.ts`) adapted with a "Product Idea" mode persona for merchants.
    *   **Status:** `[PENDING - Backend]`, `[PENDING - Frontend]`, `[PENDING - Further AI Dev/Integration]`.
    *   **Strategic Placement:** Merchant Portal.
    *   **Roadmap Alignment:** Supports empowering merchants (Phase 2) and leverages existing AI capabilities for a new target audience.
.

*   **User Social Sharing (from Issue):**
    *   **Status:** `[PENDING - Frontend]`.
    *   Frontend buttons on product/store pages: `[PENDING - Frontend]`.

*   **On-Platform Messaging Center (from Issue "Potential New Features"):**
    *   **Status:** `[PENDING - Backend]`, `[PENDING - Frontend]`.
    *   Backend/DB for messages/conversations: `[PENDING - Backend]`.
    *   Frontend UI: `[PENDING - Frontend]`.

*   **Global Search Enhancement (from Issue "Potential New Features"):**
    *   **Status:** `[PENDING - Backend]`, `[PENDING - Frontend]`.
    *   Backend search API enhancements: `[PENDING - Backend]`.
    *   Frontend UI for categorized results: `[PENDING - Frontend]`.

*   **Notification Service - Phase 2 Expansion (from Issue "System-Wide Notification Service"):**
    *   **Status:** `[PENDING - Backend]`.
    *   Functionality for order updates, low stock, new messages: `[PENDING - Backend]`.

### Phase 3: User Experience & Advanced AI Features

This phase concentrates on refining the shopper experience, introducing advanced authentication, and rolling out sophisticated AI capabilities.

*   **User Authentication Options:**
    *   **Status:** `[COMPLETED - Backend APIs for Email/Password & Wallet Auth, Account Linking]`. `[PENDING - Frontend]` for UI integration.
    *   DB Schema: `[COMPLETED - DB Schema]` (`users` table).
    *   Backend APIs:
        *   Email/Password Registration & Login (JWT): `[COMPLETED - Backend]`.
        *   Wallet-Based Login/Registration (Signature Verification, JWT): `[COMPLETED - Backend]`.
        *   Account Linking (Wallet-to-Email, Email-to-Wallet): `[COMPLETED - Backend]`.
    *   Frontend (Shopper) UI for all auth flows: `[PENDING - Frontend]`.
    *   Confirmations:
        *   Account Linking Flow (Backend logic): `[COMPLETED - Backend]`. Seamless frontend flow: `[PENDING - Frontend]`.

*   **Shopper Account Management:**
    *   **Status:** `[COMPLETED - Backend APIs for Profile, Export, Deletion]`. `[PENDING - Frontend]` for UI.
    *   Backend APIs:
        *   Fetch User Profile (`GET /me`): `[COMPLETED - Backend]`.
        *   Update User Profile (`PUT /me` for `full_name`): `[COMPLETED - Backend]`.
        *   Data Portability (Data Export API): `[COMPLETED - Backend]`.
        *   Account Deletion (Soft delete/anonymize API): `[COMPLETED - Backend]`.
    *   Frontend (Shopper) Dashboard for these features: `[PENDING - Frontend]`.
    *   Confirmations:
        *   Data Portability & Deletion (Backend APIs): `[COMPLETED - Backend]`. Self-service frontend options: `[PENDING - Frontend]`.

*   **AI Agent Architecture Rollout (FastAPI/MCP & Genkit/Next.js):**
    *   **Status:** FastAPI foundation `[COMPLETED - Backend]`. Specific agent development `[IN PROGRESS]`.
    *   FastAPI Backend & MCP Integration: `[COMPLETED - Backend]`.
    *   AI Shopping Assistant (FastAPI): `[COMPLETED - Backend]` (core logic with A2A to Product & CJ Agents).
    *   Product Service Agent (FastAPI): `[COMPLETED - Backend]` (serves unified product data with advanced filters).
    *   Gift Recommendation AI Agent: `[REVISED - See Phase 4]`.
    *   AI Agent Feedback Loop:
        *   Backend API for feedback submission: `[COMPLETED - Backend]`.
        *   DB Schema: `[COMPLETED - DB Schema]` (`ai_agent_feedback` table).
        *   Frontend Integration: `[PENDING - Frontend]`.

### Phase 4: Advanced AI Capabilities, Long-term & Optimization

This phase will build upon the AI architecture, introducing more sophisticated AI agents and focusing on platform optimization.

*   **Gift Recommendation AI Agent (Enhancement of Existing Genkit Flow):**
    *   **Description:** Enhance the existing Gift Recommendation capability (within `src/ai/flows/product-idea-generator.ts` using Genkit/Gemini) for shoppers.
    *   **Status:** `[COMPLETED - Backend]` (Enhanced prompt engineering in existing Genkit flow for strategic tool use). `[PENDING - Frontend]` (Integration improvements if needed).
    *   **Backend:** `[COMPLETED - Backend]` Refined prompt in `product-idea-generator.ts` (gift mode) to better utilize the `getProductCatalogTool` and synthesize results. Refactored for better code structure.
    *   **Confirmations (AI Agent Feedback Loop):** Applicable here. Feedback API `[COMPLETED - Backend]`. Frontend integration `[PENDING - Frontend]`.

*   **Merchant-Specific AI Agents (Initial - CJ Dropshipping Agent):**
    *   **Status:** `[COMPLETED - Backend]` (Agent with tools for details, stock, placeholder shipping from local DB; A2A with Shopping Assistant).
    *   CJ Dropshipping Agent (FastAPI, MCP-compatible): `[COMPLETED - Backend]` (`cj_dropshipping_agent.py`).
        *   Tool for Details (improved variant summary): `[COMPLETED - Backend]`.
        *   Tool for Stock: `[COMPLETED - Backend]`.
        *   Tool for Shipping (placeholder/heuristic): `[COMPLETED - Backend]`.
    *   A2A Communication with Shopping Assistant: `[COMPLETED - Backend]` (Shopping Assistant calls CJ Agent for details, stock, and shipping).

*   **Virtual Try-On (Full Integration - Strategy Update Needed):**
    *   **Description:** Existing VTO flow in Next.js/TypeScript using OpenAI. Roadmap also mentions Genkit/Gemini VTO. Strategy needs clarification.
    *   **Status:** `[NEEDS CLARIFICATION/DECISION]` on whether to enhance existing OpenAI VTO or migrate to/build new Genkit/Gemini VTO.
    *   **Work Done (towards a potential FastAPI/Genkit VTO, may be redundant):**
        *   DB Schema for VTO image metadata: `[COMPLETED - DB Schema]` (`vto_images` table).
        *   VTO Data Privacy Policy: `[COMPLETED - Documentation]` (`docs/vto_data_privacy_policy.md`).
        *   FastAPI Image Upload API for VTO: `[COMPLETED - Backend]`.
        *   FastAPI VTO Trigger API (placeholder AI logic): `[COMPLETED - Backend]`.
    *   **Frontend (Shopper):** `[PARTIALLY COMPLETE - Existing UI]` (Existing UI calls Next.js API). Needs update if backend changes.
    *   **Backend (AI Model Integration):** `[PENDING - Further AI Dev/Integration]` (Actual AI model calls for Genkit/Gemini path, or enhancing existing OpenAI flow).
    *   **Confirmations (VTO Data Privacy):** Policy document `[COMPLETED - Documentation]`. Implementation of user controls for data `[PENDING - Frontend]`.

*   **Promotions & Discount Engine (from Issue "Potential New Features" - moved to Phase 4 or Future):**
    *   **Status:** `[PENDING - Backend]`, `[PENDING - Frontend]`.
    *   Merchant Portal for creating promotions: `[PENDING - Frontend]`.
    *   Backend logic & DB for discounts: `[PENDING - Backend]`.

*   **Merchant Financial Dashboard (from Issue "Potential New Features" - moved to Phase 4 or Future):**
    *   **Status:** `[PENDING - Backend]`, `[PENDING - Frontend]`.
    *   Merchant Portal dashboard: `[PENDING - Frontend]`.
    *   Backend data aggregation: `[PENDING - Backend]`.

*   **Advanced User Reviews & Q&A (from Issue "Potential New Features" - moved to Phase 4 or Future):**
    *   **Status:** `[PENDING - Backend]`, `[PENDING - Frontend]`.
    *   Frontend for media uploads with reviews, Q&A section: `[PENDING - Frontend]`.
    *   Backend for extended reviews/Q&A, media storage: `[PENDING - Backend]`.

## 3. Database (SQL) Considerations (Updated Summary)

*   **Unified Product Model:** `products` table enhanced to accommodate `cj_products` data (new columns: `base_price`, `additional_image_urls`, `cashback_percentage`, `external_shipping_rules_id`, `original_source_data`). Migration strategy documented in `docs/cj_products_migration_strategy.md`. `cj_products` table still exists pending migration. `products.id` to store `cj_products.cj_product_id` for migrated items.
*   **Product Variants:** `product_variants` table implemented and linked to `products`. APIs for CRUD and bulk upload backend exist.
*   **Merchant Store Profiles & Reviews:** `merchant_store_profiles` and `store_reviews` tables implemented. APIs for profile and review management exist.
*   **Service Categories:** `categories` table enhanced with `category_type` and `custom_attributes`. APIs for management exist.
*   **Users Table:** Comprehensive `users` table implemented supporting email/password and wallet auth, roles, and profile info. APIs for registration, login, account linking, profile management, data export, and account deletion exist.
    *   `orders.user_id` type changed to `VARCHAR(255)` and FK to `users.id` added. Documented in `docs/schema_evolution_notes.md`.
*   **Admin Features:** `admin_audit_log` table implemented for audit trails. `products` table has `admin_review_notes`. APIs for product review, audit log viewing, and dashboard stats exist.
*   **AI-Related Tables:** `ai_agent_feedback` table implemented for user feedback on AI. `vto_images` table implemented for VTO image metadata.
*   **General Schema Notes:** Continue to maintain consistency, define relationships, use appropriate types, and ensure indexing.

## 4. Suggestions & Potential Improvements (Future Considerations - from original roadmap & issue)

(This section can largely remain as is, or items can be moved into phased rollouts if prioritized)
*   Variant Inventory Management (Alerts)
*   Pricing Rules (Dynamic, Bulk)
*   Store Customization for Merchants (Advanced)
*   Analytics Dashboard for Merchants
*   SEO for Merchant Stores/Products
*   System-Wide Notification Service (Full - beyond welcome/Phase 2 emails)
*   TAIC "Stake to Shop" Program
*   Community Building Features (Forums, Q&A)
*   (Items moved from "Potential New Features" in issue if not yet placed in a phase)

## 5. Document Review & Consolidation Notes

This "Build Plan Roadmap" document consolidates and synthesizes information from previous project plans and the initial comprehensive issue statement. It aims to provide a unified and comprehensive view of the development trajectory for the TAIC platform. For future planning and tracking, this document shall be considered the primary source of truth. The `schema.sql` will continue to be the source of truth for database structure, and this roadmap will reflect its implications for feature development.

This document is intended to be a living document and will be updated as the project evolves, priorities shift, and new information becomes available.
