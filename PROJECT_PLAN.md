
# TAIC Showcase: MVP to Production Plan

This document outlines the proposed plan to evolve the TAIC Showcase application from its current MVP (Minimum Viable Product) state towards a more production-ready platform.

## Guiding Principles

*   **Iterative Development:** Implement features in phases, focusing on delivering value incrementally.
*   **User-Centric:** Prioritize features that enhance the user experience and meet core platform goals.
*   **Modular Design:** Build components and systems that are maintainable and scalable.
*   **Clarity on Scope:** Differentiate between tasks achievable within the current Next.js/Genkit frontend-focused development (where the AI Prototyper can assist) and tasks requiring dedicated backend/blockchain/external service development.

## Phase 1: Enhancing Core Demo & Scaffolding New Features (Frontend & AI Agent Focus)

This phase focuses on building out the user interface for new features and refining existing AI capabilities. The AI Prototyper can significantly assist with these tasks.

1.  [x] **Stripe Payment UI Scaffolding:**
    *   [x] **Task:** Add UI elements to the checkout page to simulate a Stripe payment option.
    *   [x] **Details:** Include a placeholder for Stripe Elements (credit card input). This will be UI-only initially.
    *   [x] **AI Prototyper Role:** Can create the React components and update the checkout page UI.
    *   **Note:** Full backend Stripe SDK integration is a Phase 2 task.

2.  [x] **Tokenomics Page:**
    *   [x] **Task:** Create a new informational page at `/tokenomics`. (Initial page created)
    *   [x] **Task:** Populate with detailed tokenomics information. (Content updated with detailed description)
    *   [x] **Task:** Major redesign of Tokenomics page UI with sticky navigation, charts, and improved styling. (Implemented with enhanced UI/UX)
    *   [x] **AI Prototyper Role:** Can create the Next.js page component, layout, and populate with provided content, implement UI enhancements. (Implemented with detailed content and enhanced UI)

3.  [x] **Staking Page UI:**
    *   [x] **Task:** Create a new page at `/staking` for users to understand staking concepts. (Detailed informational page structure and content created)
    *   [x] **Task:** Populate with detailed staking information, benefits, and Stake-to-Shop explanation. (Detailed content and calculator UI implemented)
    *   [x] **Task:** Implement simulated general staking/unstaking functionality on the staking page. (Users can virtually stake/unstake Demo TAIC, updating their general balances.)
    *   [x] **AI Prototyper Role:** Can create the Next.js page, components, and UI logic for information display and calculator.
    *   **Note:** Backend logic for actual staking and rewards calculation is a Phase 2 task.

4.  [x] **Refine Checkout Flow for Unauthenticated Users (Crypto Wallet Focus):**
    *   [x] **Task:** Enhance the "Connect Crypto Wallet (Demo)" option in the checkout dialog. (Initial dialog implemented with options)
    *   [x] **Details:** Instead of just a toast, transition to a new UI section/modal after "connecting" that simulates collecting a wallet address (displaying a dummy address) and then confirms the (simulated) Demo TAIC transaction.
    *   [x] **AI Prototyper Role:** Can modify the cart page and create new UI components for this flow.

5.  [x] **Address Collection UI:**
    *   [x] **Task:** Design and implement a UI form to collect shipping address (for physical goods) or email address (for digital goods).
    *   [x] **Details:** This form would appear after successful login/registration or after the (simulated) crypto wallet connection during checkout. Data will be stored in user state (localStorage) for now.
    *   [x] **AI Prototyper Role:** Can create the form component and integrate it into the checkout flow.

6.  [ ] **AI Shopping Agent Enhancements:**
    *   [ ] **Task:** Continue iterative improvements to the existing Genkit shopping assistant based on user feedback and identified issues (e.g., error handling, intent recognition, conversational flow). (Multiple iterations completed)
    *   [ ] **AI Prototyper Role:** Can modify the Genkit flow (`shopping-assistant.ts`) and related frontend components.

7.  [x] **Voice AI Agent UI (Conceptual):**
    *   [x] **Task:** Add UI elements to the AI Assistant page to signify voice input/output capabilities. (Microphone button added)
    *   [x] **Details:** Included a microphone button. Initially, it triggers a "feature coming soon" message. (Implemented)
    *   [x] **Task:** Add UI elements to the AI Product Idea Generator page for voice input. (Microphone button added to ai-product-ideas page)
    *   [ ] **AI Prototyper Role:** Can add UI elements to the `AIAssistantPage` and `AIProductIdeasPage`.

8.  [x] **Wishlist UI & Staking Calculator Integration:**
    *   [x] **Task:** Implement UI for users to add/remove products to a wishlist (buttons on ProductCard and ProductDetail page). (Wishlist context, buttons, and basic wishlist page implemented)
    *   [x] **Task:** Display wishlist items on a dedicated `/wishlist` page, showing total value in Demo TAIC. (Wishlist page created)
    *   [x] **Task:** Update Staking Calculator: "Stake-to-Shop" calculator now available on `/wishlist` page, pre-filled with current wishlist total. Also, a generic calculator is on `/staking`. (Implemented)
    *   [x] **Task:** Add functionality to `/wishlist` page for users to create named "Staked Wishlist Goals" based on current wishlist total, dedicate TAIC, and track progress (including progress bar and time remaining) with maturity indication. (Implemented)
    *   [x] **AI Prototyper Role:** Can create React components, update product cards/details for "Add to Wishlist", create the wishlist page, and the calculator UI. Initial state management via localStorage.
    *   **Note:** Backend for persistent wishlists and actual staking/reward logic for wishlist goals is a Phase 2 task.

9.  [x] **Enhanced AI Product/Gift Idea Generator (Frontend & Genkit Flow):**
    *   [x] **Task:** Modify the AI Product Idea Generator UI (`ai-product-ideas` page) to include modes for "product idea" vs "gift idea". (Radio button UI for mode selection implemented).
    *   [x] **Task:** Update UI to show product canvas for gift ideas. Add UI for optional image upload for recipient/space. (UI for canvas, image upload, and gift response handling implemented).
    *   [x] **Task:** Update the `product-idea-generator.ts` Genkit flow.
        *   [x] **Details:** If "gift idea" is chosen, the flow prompts for recipient details (e.g., gender, age, interests). It accepts an optional image data URI.
        *   [x] The flow has a new tool to query `MOCK_PRODUCTS` based on criteria and suggest suitable gifts.
        *   [x] If an image is provided, the flow acknowledges it.
    *   [x] **AI Prototyper Role:** Can update the UI page, and modify the Genkit flow including adding the new tool to search MOCK_PRODUCTS and associated prompt engineering.

10. [x] **AI Virtual Try-On UI Scaffolding:**
    *   [x] **Task:** Add UI for users to upload a profile picture (e.g., in the dashboard).
    *   [x] **Details:** This will be UI only; image won't be saved to a backend yet.
    *   [x] **Task:** Add a "Virtual Try-On" button/feature on product detail pages.
    *   [x] **Details:** Clicking this currently shows "coming soon" toast. (Implemented on Product Detail page and via ProductCard for gift context).
    *   [ ] **AI Prototyper Role:** Can create the UI elements.
    *   **Note:** Backend for image storage and the actual AI image generation integration (e.g., with Gemini Imagen API via Genkit) is a Phase 2/3 task.

## Phase 2: Backend Development & Core System Integrations

This phase involves significant backend work, database setup, and integration with external services. These tasks are generally outside the direct implementation scope of the AI Prototyper but are crucial for a production system.

1.  **Database Migration to PostgreSQL:**
    *   [ ] **Task:** Set up a PostgreSQL database.
    *   [ ] **Task:** Design database schemas for users, products, orders, merchants, staking information, wishlists, etc.
    *   [ ] **Task:** Migrate existing data (if any from localStorage simulations) and update all backend logic to use PostgreSQL instead of localStorage for persistence. This involves creating API endpoints in Next.js (or a separate backend service if preferred) for all CRUD operations.
    *   **Responsibility:** Developer/Backend Team.

2.  **Real Crypto Wallet Integration:**
    *   [ ] **Task:** Research and select a suitable wallet integration library (e.g., WalletConnect, RainbowKit, Web3Modal, Ethers.js, Viem).
    *   [ ] **Task:** Implement frontend components to connect to user wallets (e.g., MetaMask, Trust Wallet).
    *   [ ] **Task:** Handle wallet connection, disconnection, and account change events.
    *   [ ] **Task:** (If applicable) Develop or integrate with smart contracts for TAIC token interactions (transfers, balance checks).
    *   **Responsibility:** Developer/Blockchain Team.

3.  **Stripe SDK Full Integration (Backend):**
    *   [ ] **Task:** Implement backend logic using the Stripe SDK to process real fiat payments.
    *   [ ] **Details:** Create API endpoints to handle payment intents, webhooks for payment confirmations, and update order statuses in the database.
    *   [ ] **Responsibility:** Developer/Backend Team.

4.  **Production AI Agent Infrastructure (Genkit):**
    *   [ ] **Task:** Configure Genkit for a production environment.
    *   [ ] **Details:** Secure API key management, robust logging and monitoring for flows, error alerting, potentially scaling flow execution.
    *   [ ] **Task:** If flows become more complex or require external data not suitable for direct tool calls, consider API endpoints that Genkit tools can call (e.g., for querying the PostgreSQL product database instead of `MOCK_PRODUCTS`).
    *   [ ] **Task:** Fully implement the AI Gift Finder Genkit flow, including processing detailed recipient criteria, optional image input (for context, not direct generation yet), and using a tool to search `MOCK_PRODUCTS`.
    *   **Responsibility:** Developer/AI Team.

5.  **Merchant System Backend:**
    *   [ ] **Task:** Develop backend APIs for merchant registration, product/service management, and potentially order fulfillment updates.
    *   [ ] **Task:** Implement authentication and authorization for merchants.
    *   **Responsibility:** Developer/Backend Team.

6.  **Staking Logic Backend (General & Wishlist):**
    *   [ ] **Task:** Implement backend logic to manage general TAIC staking, unstaking, and reward distribution.
    *   [ ] **Task:** Implement backend logic for wishlist-specific staking, tracking progress towards purchase goals, and managing rewards.
    *   [ ] **Details:** This will interact with the PostgreSQL database and potentially smart contracts if TAIC is on-chain.
    *   **Responsibility:** Developer/Backend Team.

7.  **Wishlist Backend Persistence:**
    *   [ ] **Task:** Store user wishlists in the PostgreSQL database.
    *   [ ] **Responsibility:** Developer/Backend Team.

8.  **User Image Storage for Virtual Try-On:**
    *   [ ] **Task:** Implement secure backend storage for user-uploaded images (e.g., Firebase Storage, AWS S3). This includes images for gift recipients/spaces and user profile pictures for try-on.
    *   **Responsibility:** Developer/Backend Team.

## Phase 3: Advanced Features & Productionizing

This phase focuses on building out the complete merchant ecosystem, refining the user experience, and preparing for a wider launch.

1.  **Full Merchant Onboarding & Management Portal UI:**
    *   [ ] **Task:** Create a dedicated portal or section for merchants to register, list products/services, manage inventory (if applicable), view their sales/orders, configure cashback, and manage simulated payouts.
    *   [ ] **AI Prototyper Role:** Can help scaffold the UI components for this portal.
    *   **Details for Merchant Portal Development Plan:**
        *   **I. Introduction & Goals:**
            *   Purpose: Simulated Merchant Portal for TAIC Showcase.
            *   Core Principle: Realistic yet simulated merchant lifecycle with Demo TAIC.
            *   Key Objectives: Merchant self-registration, product listing/management (priced in Demo TAIC), clear commission structure, merchant-configurable cashback, simulated sales/earnings/payouts.
        *   **II. Merchant Onboarding & Account Management:**
            *   **A. Registration/Signup:** `/merchant/register` (Business Name, Contact Email, Username, Password, Business Description). Simulated approval.
            *   **B. Merchant Dashboard:** `/merchant/dashboard` (Quick Stats: Sales, Orders, Payouts. Navigation: Products, Orders, Financials, Cashback, Settings).
            *   **C. Account Settings:** Edit Store Profile, (Simulated) Payout Demo TAIC Wallet Address, Password Management.
        *   **III. Product Management:**
            *   **A. Adding New Products:** `/merchant/products/new` (Name, Description, Price in Demo TAIC, Category, Image Upload, Stock Quantity, Cashback Configuration). Product appears in main catalog.
            *   **B. Viewing & Editing Products:** `/merchant/products` (Edit details, stock, cashback, unlist/delete).
        *   **IV. Financials & Payments (Simulated):**
            *   **A. Platform Commission Model:** Global commission rate (e.g., 5-10% of Demo TAIC sale price). Displayed to merchant during listing and in reports.
            *   **B. Merchant-Funded Cashback Rewards:**
                *   **Merchant Configuration:** Enable/disable per product. Set cashback as % of Demo TAIC price or fixed Demo TAIC amount. Merchant sees cost per sale.
                *   **Shopper Experience:** Product pages show cashback. During checkout (with Demo TAIC):
                    1.  Shopper pays full price.
                    2.  Platform deducts a 1% transaction fee from the *cashback amount*. (New platform revenue stream).
                    3.  Shopper receives remaining cashback (Merchant_Cashback_Offer * 0.99) in Demo TAIC.
                    4.  Toast: "Purchase complete! You received Y Demo TAIC cashback (net of 1% fee)."
                *   **Merchant Payout Impact:** Merchant funds the *full* original cashback offer.
                    `Merchant_Net_Per_Sale = Product_Sale_Price_TAIC - Platform_Commission_TAIC - Merchant_Cashback_Offer_TAIC`.
            *   **C. Payout System (Simulated):** Financials section in dashboard (Sales history, earnings, deductions, "Available for Payout"). "Request Payout" button simulates transfer to merchant's Demo TAIC wallet.
        *   **V. Order Management (Simplified):** View orders, mark as "Shipped" (simulated status).
        *   **VI. UI/UX:** Dedicated `/merchant/*` routes, merchant auth, clean interface, clear financial presentation.
        *   **VII. Phased Development (Conceptual):**
            *   **M1 (UI Scaffolding):** AI Prototyper assists with UI pages (Registration, Login, Dashboard, Product Forms, Financials Display). Frontend only.
            *   **M2 (Frontend Logic & Simulation):** AI Prototyper assists with client-side logic for product listing (local list), simulate commission/cashback calculations, simulate cashback on shopper's balance.
            *   **M3 (Backend Integration - Developer):** DB for merchants, products, orders. Robust financial logic. Secure auth.

2.  **Real-time Order Updates & Notifications:**
    *   [ ] **Task:** Implement mechanisms for users to receive real-time updates on their order status (e.g., using WebSockets, Server-Sent Events, or email notifications).

3.  **Voice AI Agent (STT/TTS Integration):**
    *   [ ] **Task:** Integrate chosen Speech-to-Text and Text-to-Speech services (e.g., browser APIs, cloud services).
    *   [ ] **Details:** This might involve client-side JavaScript libraries for browser-based STT/TTS or backend processing for more advanced capabilities. Update Genkit flows if needed to handle text-based input from STT.
    *   [ ] **AI Prototyper Role:** Can help with frontend integration of browser APIs if applicable, or modifying Genkit flows.

4.  **AI Virtual Try-On (Full Integration):**
    *   [ ] **Task:** Develop/Integrate Genkit flow using an image generation model (e.g., Gemini's image capabilities).
    *   [ ] **Details:** The flow will take a user's uploaded image (e.g., of themselves, or the recipient/space image from the gift finder) and a product image as input, and generate an image of the user "wearing" the product or the product in the space. This is a complex AI task involving careful prompting and image handling.
    *   [ ] **Task:** Integrate this flow with the frontend UI, displaying the generated image from the "Virtual Try-On (Demo)" button.
    *   **Responsibility:** Developer/AI Team.
    *   [ ] **AI Prototyper Role:** Can assist with the Genkit flow definition and frontend display of generated images.

5.  **Advanced Analytics & Reporting:**
    *   [ ] **Task:** Implement analytics for user behavior, sales trends, AI interaction patterns, etc.

6.  **Security Hardening & Performance Optimization:**
    *   [ ] **Task:** Conduct security audits, implement necessary security measures (e.g., input validation, rate limiting, CSRF protection).
    *   [ ] **Task:** Optimize frontend and backend performance for scalability.

7.  **"Adding Demo TAIC to User's Wallet" (If TAIC is an external testnet/mainnet token):**
    *   [ ] **Task:** Develop a faucet or a system (potentially admin-controlled) to distribute Demo TAIC tokens to user-provided wallet addresses on a test network. This is complex if TAIC is a real ERC20-style token. If "Demo TAIC" remains an internal ledger, this would be an admin function to credit accounts.
    *   **Responsibility:** Developer/Blockchain Team.

8.  **TAIC Admin Center (TODO - New Item):**
    *   [ ] **Task:** Design and implement a dedicated administrative portal for TAIC platform administrators.
    *   [ ] **Features:**
        *   Merchant Management: View, approve/suspend merchants.
        *   Product Oversight: Review product listings, flag inappropriate content.
        *   Global Platform Settings: Configure platform commission rates, cashback transaction fee percentages.
        *   Financial Overview: Monitor overall platform transaction volume, revenue.
        *   User Management (Basic): View user list, potentially manage roles.
    *   [ ] **AI Prototyper Role:** Can help scaffold the UI components for this admin center.
    *   **Note:** This is a significant backend and frontend endeavor, essential for platform operations.

## Future Considerations

*   Decentralized Identity (DID) integration.
*   Expansion of AI tools and agents.
*   Community features (reviews, forums).
*   Mobile application development.

This plan provides a roadmap. Priorities may shift based on user feedback and business goals.

    