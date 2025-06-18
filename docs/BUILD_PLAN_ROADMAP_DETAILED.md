# TAIC Platform: Build Plan Roadmap (Updated)

## 1. Introduction & Vision

This document outlines the strategic build plan for the TAIC (Transformative AI Commerce) platform. It serves as a consolidated roadmap, integrating insights from the comprehensive documentation review. It aligns development efforts with the platform's evolving architecture and database schema (`schema.sql`). Its purpose is to guide the phased development of new features and enhancements, ensuring a cohesive and strategic approach to building a robust, scalable, and innovative e-commerce solution.

The overall vision for the TAIC platform is to be a global e-commerce ecosystem powered by blockchain technology and enhanced by artificial intelligence. Key pillars of this vision include:
*   **Empowering Global Merchants:** Providing tools for entrepreneurs and businesses worldwide to establish their online presence, manage products (including variants and services), and reach a global customer base.
*   **Seamless Crypto & Fiat Integration:** Supporting TAIC cryptocurrency as a primary payment method alongside traditional fiat currency options, offering flexibility and choice to users.
*   **Incentivized Shopping Experience:** Leveraging cashback rewards in TAIC cryptocurrency to drive user engagement and loyalty.
*   **AI-Driven Enhancements:** Utilizing a sophisticated, hybrid AI agent architecture. Core backend agents (Shopping Assistant, Product Service) are built with FastAPI and MCP for robust, scalable services. Specific, self-contained AI flows (VTO, Idea Generators) are built with Genkit and exposed via Next.js for model-agnostic flexibility.
*   **Multi-Vendor Marketplace:** Establishing a comprehensive marketplace where multiple merchants can list products, subject to admin approval, fostering a diverse and competitive environment.

This build plan is the primary source for future planning and development tracking.

## 2. Definition of Production Ready (MVP)

To achieve a production-ready Minimum Viable Product (MVP), the following criteria must be met. This list represents the critical path to a functional marketplace for shoppers, merchants, and admins.

*   **[BUGFIX] Product Variant Display:** The issue causing variant attribute names to display as generic placeholders (e.g., "Color 1") must be resolved.
*   **[FRONTEND] Core Shopper Experience:**
    *   Product Discovery: Functional browsing, searching, and filtering.
    *   Product Detail Page: All product information, including correctly functioning variant selection, is displayed.
    *   Shopping Cart & Checkout: Users can add items to the cart, proceed to checkout, and complete a simulated purchase.
*   **[FRONTEND] Core Merchant Experience:**
    *   Product Management: Merchants must have a functional UI to create, view, update, and delete their products, including products with variants.
    *   Bulk Upload: A UI for the CSV bulk upload feature must be available.
*   **[FRONTEND] Core Admin Experience:**
    *   Product Approval: Admins must have a functional UI to review and approve/reject pending products.
*   **[INTEGRATION] Critical Transactional Emails:**
    *   User registration (welcome email) and order confirmation emails must be fully integrated and functional.

## 3. Key Development Areas (Phased Approach)

This section details planned features and enhancements, organized into logical development phases. Each feature description includes its key components.
**Status Legend:**
*   `[COMPLETED - Backend]`
*   `[COMPLETED - DB Schema]`
*   `[COMPLETED - Documentation]`
*   `[COMPLETED - Policy]`
*   `[IN PROGRESS]`
*   `[PENDING - Frontend]`
*   `[PENDING - Backend]`
*   `[PENDING - AI Refactor/Integration]`
*   `[BUG - ACTIVE]`

### Phase 1: Core Platform Enhancements, Foundational AI, & Homepage/Pioneer Launch

This phase focuses on strengthening the core platform, introducing critical product management features, laying the groundwork for the FastAPI AI agent architecture, and launching initial homepage/Pioneer Program elements.

*   **Known Issues / Bugs:**
    *   **Price Display Consistency (TAIC Suffix):**
        *   **Description:** Ensured product prices on the detail page use 'TAIC' as a suffix (e.g., '8.38 TAIC') for consistency with the product listing page.
        *   **Impact:** Improves UI consistency.
        *   **Status:** `[FIXED]` - Updated `src/app/products/[id]/page.tsx`.

    *   **Product Variant Attribute Naming:**
        *   **Description:** Variant attributes (e.g., colors, sizes) were displayed on the frontend with generic placeholder names like "Color 1" instead of their actual values. This was due to a regression that was subsequently reverted.
        *   **Status:** `[FIXED]`
        *   **Impact:** Critical. Prevented shoppers from making informed purchasing decisions on products with variants.
        *   **Next Step:** `[COMPLETED]` - Issue resolved by reverting faulty logic in `src/app/products/[id]/page.tsx`.
    *   **Extra Character in Price Display (Product Detail & Listing Pages):**
        *   **Description:** An extra '0' character was appearing after product prices due to faulty conditional rendering of cashback info (evaluating to the number 0 instead of null).
        *   **Impact:** Minor visual bug, made pricing look incorrect.
        *   **Status:** `[FIXED]` - Corrected conditional logic in `src/app/products/[id]/page.tsx` and `src/components/products/ProductCard.tsx`.

*   **Product Variants Support:**
    *   **Description:** Allow products to have multiple variations.
    *   **Status:** `[COMPLETED - DB Schema]`, `[COMPLETED - Backend APIs for Variant CRUD]`, `[COMPLETED - Backend for Bulk Upload CSV Parsing]`, `[COMPLETED - Documentation for Bulk Upload Template]`.
    *   **Frontend (Shopper):** `[PENDING - Frontend]` Display product variants on Product Details Page, allow selection and cart addition.
    *   **Admin Portal:** `[PENDING - Frontend]` View/manage product variants.
    *   **Merchant Portal:** `[PENDING - Frontend]` UI for adding products with variants, UI for bulk upload.

*   **Transactional Email & Notification Integration:**
    *   **Description:** Integrate the existing email utilities with core application events to send critical transactional notifications to users and merchants.
    *   **Status:** `[COMPLETED - Backend Utilities & Templates]`, `[PENDING - Integration]`
    *   **Pending Integrations (based on `notification_service_catalog.md`):**
        *   Shopper - User Registration Welcome Email: `[PENDING - Integration]`
        *   Shopper - Order Confirmation Email: `[PENDING - Integration]`
        *   Shopper - Shipping Update Email: `[PENDING - Integration]`
        *   Merchant - New Order Notification: `[PENDING - Integration]`
        *   Merchant - Product Approved/Rejected Notification: `[PENDING - Integration]`
        *   Merchant - Low Stock Warning: `[PENDING - Integration]`

*   **Pioneer Program Implementation:**
    *   **Status:** `[COMPLETED - Documentation]` for Tiers and Application Process. Backend/Smart Contract/Frontend `[PENDING]`.
    *   Application Portal (Frontend/Backend): `[PENDING - Frontend]`, `[PENDING - Backend]`.

*   **Foundational AI Agent Architecture (FastAPI/MCP):**
    *   **Status:** `[COMPLETED - Backend]` Core Shopping Assistant & Product Service functional with A2A communication and real data. `[IN PROGRESS - MCP Integration]` Refactoring to use fastapi-mcp library.
    *   FastAPI Backend Infrastructure for AI Agents: `[COMPLETED - Backend]` (`fastapi_ai_backend`).
    *   Initial AI Shopping Assistant: `[COMPLETED - Backend]` (`shopping_assistant_agent.py`).
    *   Foundational Product Data Access Tools (Product Service Agent): `[COMPLETED - Backend]` (`product_service_agent.py`).
    *   **CJ Products Database Integration:** `[COMPLETED - Backend]` (2025-06-18) Integrated real CJ imported products from the database into the frontend product listings and detail pages.
    *   **MCP Integration Plan (2025-06-17):**
        *   **Description:** Refactoring the AI Shopping Assistant backend by replacing the Genkit-based MCP integration with a streamlined MCP system modeled after the RESORT-FINAL repository pattern. This involves implementing the fastapi-mcp library for tool-based LLM responses, integrating authentication, and mounting MCP endpoints within the FastAPI server.
        *   **Status:** `[IN PROGRESS]` Implementation plan drafted, core dependencies identified.
        *   **Implementation Phases:**
            *   **Phase 1 - Setup & Dependencies:** Add fastapi-mcp>=0.2.0 and mcp-use>=0.4.0 to backend requirements, update environment configuration.
            *   **Phase 2 - Backend MCP Implementation:** Create MCP tools module, authentication, configure FastApiMCP server, integrate with FastAPI, create AI Shopping Assistant endpoint.
            *   **Phase 3 - Frontend Integration:** Create MCP client, update AI Shopping Assistant page, update product display logic.
            *   **Phase 4 - Testing & Optimization:** Unit testing, integration testing, performance optimization.
            *   **Phase 5 - Documentation & Deployment:** Update documentation, configure deployment.

*   **Automated Testing Strategy & Infrastructure:**
    *   **Description:** Establish a robust automated testing strategy and infrastructure to ensure code quality, prevent regressions, and facilitate continuous integration for both frontend and backend components.
    *   **Status:** `[COMPLETED - Backend Test Infrastructure]`, `[COMPLETED - Initial Backend Test Coverage]`, `[COMPLETED - CI Workflow (GitHub Actions)]`, `[COMPLETED - Test DB Seeding]`
    *   **Key Accomplishments & Current State:**
        *   **Centralized Test Directory:** A `/tests` directory has been established at the project root, with subdirectories for `backend`, `frontend`, and `e2e` tests.
        *   **Backend Testing (FastAPI):**
            *   **Framework:** Pytest is used as the primary testing framework.
            *   **Environment:** A dedicated Python virtual environment (`fastapi_ai_backend/venv`) is used, managed by `fastapi_ai_backend/run_tests.sh`. This script handles venv creation, dependency installation (from `requirements.txt` and `requirements-test.txt`), and test execution.
            *   **Configuration:** `fastapi_ai_backend/pytest.ini` and `fastapi_ai_backend/tests/conftest.py` provide core pytest configuration and shared fixtures.
            *   **Database:** Tests run against a dedicated, isolated test database. The `test_db` fixture in `conftest.py` manages the creation, seeding (via `scripts/seed_test_db.py`), and teardown of this database for each test session. Verbose connection logging (`verbose_db_conn` fixture) was implemented to diagnose and resolve connection pool issues.
            *   **Coverage:** Initial unit and integration tests have been implemented for critical backend components, including product and product variant CRUD operations, and search functionalities.
            *   **Key Fixes:** Successfully diagnosed and resolved significant issues related to database connection pool timeouts and test discovery, ensuring reliable test execution.
        *   **Frontend & E2E Testing (Next.js):**
            *   Initial setup for Jest (unit/integration) and Cypress (E2E) is in place within `tests/frontend` and `tests/e2e` respectively, though further development of test suites is pending.
        *   **Continuous Integration (CI):**
            *   A GitHub Actions workflow (`.github/workflows/ci.yml`) has been set up to automatically run backend tests on pushes and pull requests to the main branches.
    *   **Requirements for Running & Maintaining Tests (Backend - FastAPI):**
        *   **Environment Setup:**
            *   Ensure Python 3.11 (or as specified in `fastapi_ai_backend/.python-version`) is installed.
            *   A running PostgreSQL instance accessible to the test environment (connection details typically managed via environment variables like `DATABASE_URL` or individual `DB_USER`, `DB_PASSWORD`, etc., for the test database).
        *   **Running Tests:**
            *   Navigate to the `fastapi_ai_backend` directory.
            *   Execute `./run_tests.sh`. This script will create/update the virtual environment, install dependencies, and run pytest.
            *   Alternatively, activate the venv (`source venv/bin/activate`) and run `pytest` directly.
        *   **Adding New Tests:**
            *   Follow pytest conventions for test file (`test_*.py`) and test function (`test_*`) naming.
            *   Place new backend tests in appropriate subdirectories within `fastapi_ai_backend/tests/`.
            *   Utilize existing fixtures in `conftest.py` for database access (`test_db`, `client`, `auth_client`, `verbose_db_conn`) and HTTP client interactions.
            *   Ensure new Pydantic models or dependencies are added to `requirements.txt` and/or `requirements-test.txt` as needed.
            *   Update `scripts/seed_test_db.py` if new foundational data is required for tests.
    *   **Next Steps (Testing):**
        *   **Backend (FastAPI & Next.js API Routes):**
            *   Expand Pytest coverage for all remaining FastAPI backend API endpoints, service logic, and AI agent interactions.
            *   Implement integration tests for critical Next.js API routes, particularly for Genkit-based AI features like Virtual Try-On (VTO).
            *   Develop tests for transactional email triggering logic (e.g., for user registration, order confirmation), likely by mocking email services.
        *   **Frontend (Next.js with Jest & RTL):**
            *   Develop comprehensive unit and integration tests for all React components, pages, and user interface logic.
            *   Ensure coverage for user authentication UIs (including various login/registration methods, account linking, password reset, and future 2FA), account management, product display (including variants), cart, and checkout components.
            *   Test frontend integrations with AI features (VTO, Idea Generators).
        *   **End-to-End (E2E with Cypress):**
            *   Build out E2E test scenarios covering all critical user flows:
                *   **Shopper:** Registration (Email/Password & Wallet), Login (Email/Password & Wallet), Account Linking, Password Reset flow, 2FA flow (when implemented), Product Search & Discovery, Product Detail Page interaction (including variant selection), Cart Management, Full Checkout Process, Virtual Try-On (VTO) usage, AI Idea Generator usage.
                *   **Merchant:** Product Creation (manual & via bulk upload, including variants), Product Management, Merchant Store Page interactions.
                *   **Admin:** Product Approval/Rejection processes, Admin Dashboard interactions.
            *   Post-investigation of wallet modal behavior, implement E2E tests for wallet connection stability across different providers if deemed feasible and reliable.
        *   **CI/CD Integration:**
            *   Integrate frontend (Jest) and E2E (Cypress) tests into the existing GitHub Actions CI workflow.
            *   Ensure the CI pipeline provides clear and actionable feedback on test failures for all types of tests.

### Phase 2: Admin & Merchant Empowerment

This phase focuses on providing robust tools for administrators and merchants.

*   **Multi-vendor Marketplace Controls (Admin):**
    *   **Status:** `[COMPLETED - Backend APIs for Product Approval]`, `[COMPLETED - Policy for Edit Re-approval]`. `[PENDING - Frontend]` for Admin Portal.
    *   Admin APIs for Product Approval/Rejection: `[COMPLETED - Backend]` (`admin.py` router).
    *   Policy for Product Edit Re-Approvals: `[COMPLETED - Policy]` (`docs/product_edit_re_approval_policy.md`).
    *   Admin Portal UI for review: `[PENDING - Frontend]`.

*   **Admin Dashboard Enhancements:**
    *   **Status:** `[COMPLETED - Backend APIs for Audit Log & Stats]`. `[PENDING - Frontend]` for dashboard UI.
    *   Admin Audit Log & Dashboard APIs: `[COMPLETED - Backend]`.
    *   Admin Portal UI (Dashboard, Panels, Navigation): `[PENDING - Frontend]`.

*   **Merchant Store Pages:**
    *   **Status:** `[COMPLETED - DB Schema]`, `[COMPLETED - Backend APIs for Profile & Reviews]`. `[PENDING - Frontend]`.
    *   Backend APIs for Merchant Store Profile & Reviews: `[COMPLETED - Backend]`.
    *   Frontend (Shopper view, Merchant customization): `[PENDING - Frontend]`.

### Phase 3: User Experience & Advanced AI Features

This phase concentrates on refining the shopper experience, introducing advanced authentication, and rolling out sophisticated AI capabilities.

*   **User Authentication Options:**
    *   **Status:** `[COMPLETED - Backend APIs for Email/Password & Wallet Auth, Account Linking]`. `[PENDING - Frontend]` for UI integration.
    *   Backend APIs for all auth flows: `[COMPLETED - Backend]`.
    *   Frontend (Shopper) UI for all auth flows: `[PENDING - Frontend]`.
    *   **Authentication User Journeys:**
        *   **Email/Password First → Wallet Later:**
            *   User registers with email/password
            *   User logs in with email/password
            *   While logged in, user connects wallet from dashboard
            *   User can now authenticate with either method
        *   **Wallet First → Email/Password Later:**
            *   User connects wallet to register
            *   User logs in by connecting wallet
            *   While logged in, user adds email/password
            *   User can now authenticate with either method
        *   **Edge Cases:**
            *   Account unlinking (ensuring at least one auth method remains)
            *   Failed authentication attempts handling
            *   Session management and token refresh
    *   **Password Reset Flow:** `[PENDING - Backend]`, `[PENDING - Frontend]`
        *   Backend endpoint to generate reset tokens
        *   Email integration to send reset links
        *   Frontend pages for reset flow
        *   Token validation and password update logic
    *   **Two-Factor Authentication (2FA):** `[PENDING - Backend]`, `[PENDING - Frontend]`
        *   Integration with authenticator apps or SMS
        *   Database schema updates for 2FA secrets
        *   UI for enabling/disabling 2FA
        *   Recovery codes mechanism

*   **Shopper Account Management:**
    *   **Status:** `[COMPLETED - Backend APIs for Profile, Export, Deletion]`. `[PENDING - Frontend]` for UI.
    *   Backend APIs for profile management, data export, deletion: `[COMPLETED - Backend]`.
    *   Frontend (Shopper) Dashboard for these features: `[PENDING - Frontend]`.
    *   **Shipping Address Management:** `[PENDING - Frontend]`
        *   User shipping address remains blank until first order placement
        *   Address is stored after first order for future use
        *   User can edit or delete stored address from account dashboard
        *   Multiple shipping addresses support (future enhancement)

*   **AI Agent Feedback Loop:**
    *   **Status:** `[COMPLETED - Backend API & DB Schema]`. `[PENDING - Frontend]`.
    *   Backend API for feedback submission: `[COMPLETED - Backend]`.
    *   Frontend Integration: `[PENDING - Frontend]`.

### Phase 4: Advanced AI Capabilities, Long-term & Optimization

This phase will build upon the AI architecture, introducing more sophisticated AI agents and focusing on platform optimization.

*   **Virtual Try-On (VTO) Genkit Refactor:**
    *   **Description:** Refactor the VTO feature to use the model-agnostic Genkit framework, as detailed in `docs/vto_genkit_refactor_detailed_design.md`. This will enable switching between image generation providers (e.g., OpenAI, Gemini) and leverage advanced features like LLM-powered prompt generation for better results.
    *   **Status:** `[PENDING - AI Refactor/Integration]`
    *   **Strategy:** The detailed Genkit refactor plan is the approved path forward.
    *   **Completed Groundwork:**
        *   DB Schema for VTO image metadata: `[COMPLETED - DB Schema]` (`vto_images` table).
        *   VTO Data Privacy Policy: `[COMPLETED - Documentation]`.
        *   FastAPI Image Upload & Trigger APIs: `[COMPLETED - Backend]`.
    *   **Pending Work:**
        *   Implementation of Genkit flows, tools, and actions: `[PENDING - AI Refactor/Integration]`.
        *   Updating the Next.js API route (`/api/virtual-try-on`) to call the new Genkit flow and handle results.
        *   Updating the frontend UI to align with any API changes and implement user controls for data privacy.

*   **Gift Recommendation & Merchant Product Idea AI Agents:**
    *   **Description:** Provide AI-powered idea generation tools for both shoppers (gifts) and merchants (new products) by leveraging and adapting the existing Genkit flow (`product-idea-generator.ts`).
    *   **Status:** `[COMPLETED - Backend Genkit Flow]`, `[PENDING - Frontend Integration]`.

*   **Merchant-Specific AI Agents (Initial - CJ Dropshipping Agent):**
    *   **Status:** `[COMPLETED - Backend]` (Agent with tools for details, stock, placeholder shipping; A2A with Shopping Assistant).

## 4. Database (SQL) Considerations (Updated Summary)

*   **Unified Product Model:** `products` table enhanced to accommodate `cj_products` data. Migration strategy documented. `cj_products` table still exists pending migration.
*   **Product Variants:** `product_variants` table implemented and linked to `products`.
*   **Merchant & Admin Features:** `merchant_store_profiles`, `store_reviews`, `admin_audit_log` tables implemented with corresponding APIs.
*   **Users & Orders:** `users` table is comprehensive. `orders.user_id` type changed to `VARCHAR(255)` and linked to `users.id`.
*   **AI-Related Tables:** `ai_agent_feedback` and `vto_images` tables implemented.

## 5. Future Considerations

(This section can largely remain as is, or items can be moved into phased rollouts if prioritized)
*   Variant Inventory Management (Alerts)
*   Pricing Rules (Dynamic, Bulk)
*   Store Customization for Merchants (Advanced)
*   Analytics Dashboard for Merchants
*   SEO for Merchant Stores/Products
*   System-Wide Notification Service (Full - beyond MVP emails)
*   TAIC "Stake to Shop" Program
*   Community Building Features (Forums, Q&A)

## 6. Document Review & Consolidation Notes

This "Build Plan Roadmap" document consolidates and synthesizes information from the comprehensive documentation review. It aims to provide a unified and comprehensive view of the development trajectory for the TAIC platform. For future planning and tracking, this document shall be considered the primary source of truth. The `schema.sql` will continue to be the source of truth for database structure, and this roadmap will reflect its implications for feature development.

This document is intended to be a living document and will be updated as the project evolves, priorities shift, and new information becomes available.


## Wallet Login Modal - UI/UX Investigation (as of 2025-06-14)

**Objective**: Ensure wallet login is user-friendly and behaves consistently. Currently, the primary concern is the modal opening in a new window under certain conditions.

**Current Findings**:
*   **Trigger**: The wallet connection modal (Web3Modal) is triggered from:
    *   `/src/app/(auth)/login/page.tsx` (when "Connect Wallet & Log In" is clicked).
    *   `/src/app/(auth)/register/page.tsx` (when "Connect Wallet & Register" is clicked).
    *   `/src/components/dashboard/ProfileSection.tsx` (for linking a wallet to an existing account).
*   **Web3Modal Configuration**:
    *   Initialized in `/src/components/providers/Web3ModalProvider.tsx`.
    *   Current configuration includes theme settings but no explicit display mode options that would prevent new windows.
*   **Observed Behavior (Phantom Wallet)**:
    *   **Chrome**: When Phantom Wallet is selected from Web3Modal, it opens its UI in a **new, separate browser window**. This behavior is likely controlled by the Phantom Chrome extension itself.
    *   **Firefox**: When Phantom Wallet is selected, it appears to integrate more smoothly (details to be confirmed, but user reported it "worked fine," implying no new window).
*   **Hypothesis**: The "new window" behavior with Phantom in Chrome is specific to that extension's design in that browser environment and may not be directly controllable by Web3Modal's configuration.

**Outstanding Questions / Next Steps for Investigation**:
*   **MetaMask Test (Chrome)**:
    *   Verify if selecting MetaMask in Chrome also results in a new browser window or if it uses the standard extension pop-up. This will help determine if the issue is Phantom-specific or more general to Chrome.
*   **MetaMask Test (Firefox)**:
    *   Verify MetaMask behavior in Firefox for a complete comparison.
*   **Phantom Behavior in Firefox (Details)**:
    *   Confirm the exact behavior of Phantom in Firefox (e.g., in-page overlay, extension pop-up).
*   **User Experience (UX) for Login/Register Pages**:
    *   Review the default presentation on `/login` (currently defaults to "Login with Wallet") and `/register` (defaults to email form).
    *   Consider a more balanced initial presentation of login/registration options (e.g., Email/Password, Wallet, Register links clearly and neutrally presented).
*   **Expectation Setting**:
    *   If new window behavior is unavoidable for certain wallets/browsers, consider adding a small UI note to inform users (e.g., "Wallet interactions may open your extension or a new window.").

**Proposed Solution Path (High-Level)**:
1.  Complete the above tests to fully understand cross-browser and cross-wallet behavior.
2.  Based on findings, if the "new window" issue is largely uncontrollable (due to extension behavior):
    *   Focus on improving the on-page UX for selecting login/registration methods.
    *   Implement UI notes to set user expectations.
3.  If any Web3Modal configuration changes *can* mitigate undesirable behavior without breaking functionality, explore and test them.
4.  Update this section with definitive findings and a concrete implementation plan.

---
