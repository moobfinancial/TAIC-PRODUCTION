# Tech Context: TAIC - The AI E-commerce Platform

**Version:** 1.0
**Date:** June 9, 2025

## 1. Technologies Used

*   **Frontend Framework:** Next.js (Version 13+ with App Router)
*   **Programming Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **UI Components/Icons:** `lucide-react` for icons.
*   **State Management:** (To be fully defined - currently using React Context API where appropriate, may explore Zustand or Redux Toolkit for more complex global state).
*   **Routing:** Next.js App Router.
*   **Blockchain:** Fantom Opera Mainnet (for TAIC Coin).
*   **Cryptocurrency:** TAIC Coin (native token on Fantom).
*   **AI Technologies:** (Specific models, libraries, or platforms are yet to be detailed - conceptual at this stage).
*   **Version Control:** Git (hosted on a platform like GitHub, GitLab - assumed).

## 2. Development Setup (Frontend Focus)

*   **Node.js & npm/yarn:** Required for managing dependencies and running Next.js development server.
*   **Code Editor:** VS Code (recommended with extensions for TypeScript, ESLint, Prettier, Tailwind CSS IntelliSense).
*   **Linters & Formatters:** ESLint and Prettier configured for code quality and consistency.
*   **Development Server:** `npm run dev` (or `yarn dev`) to start the Next.js local development server.
*   **Build Process:** `npm run build` (or `yarn build`) to create a production-ready build.

## 3. Technical Constraints

*   **Browser Compatibility:** Target modern evergreen browsers (Chrome, Firefox, Safari, Edge).
*   **Performance:** Strive for fast load times and smooth user interactions (LCP, FID, CLS metrics).
*   **Security:** Adherence to web security best practices (OWASP Top 10) is critical, especially for e-commerce and crypto transactions.
*   **Scalability:** While the frontend is largely static/client-rendered, backend APIs and database must be designed for scalability.
*   **Blockchain Interaction Latency:** Fantom is fast, but blockchain interactions inherently have some latency compared to centralized systems.

## 4. Dependencies (Key Frontend Packages - from `package.json`)

*   `next`: Core Next.js framework.
*   `react`, `react-dom`: React library.
*   `typescript`: TypeScript language support.
*   `tailwindcss`: Utility-first CSS framework.
*   `lucide-react`: Icon library.
*   `autoprefixer`, `postcss`: For Tailwind CSS processing.
*   `eslint`, `eslint-config-next`: Linting.
*   (Other dependencies as added to the project)

## 5. Tool Usage Patterns

*   **Component Creation:** New pages are typically created within the `src/app/` directory following Next.js App Router conventions (e.g., `src/app/new-page/page.tsx`). Reusable components are often placed in a `src/components/` directory.
*   **Styling:** Primarily using Tailwind CSS utility classes directly in JSX. Global styles or base component styles might reside in `src/app/globals.css`.
*   **State Management:** Simple local state with `useState`/`useReducer`. For shared state, React Context or a dedicated state management library.
*   **API Calls:** Using `fetch` API or a library like `axios` (if added) for interacting with backend services.
*   **Memory Bank Updates:** Maintained by Cascade AI based on user requests and project progress, stored in Markdown files within the `memory-bank` directory.

This document will be updated as new technologies are adopted or development practices evolve.
