# Pioneer Program: Feature Summary & Status

This document provides a comprehensive overview of the Pioneer Program feature, detailing backend work completed, current capabilities, outstanding backend requirements (if any), frontend requirements, and functional UI design considerations.

**## 1. Pioneer Program Overview & Goals**

*   The Pioneer Program aims to engage early adopters, merchants, influencers, and community builders to help grow and shape the TAIC platform. In return for their contributions, pioneers receive benefits, including potential token allocations. The program is designed to foster a strong community and gather valuable feedback during the platform's development.
*   The program includes several tiers to cater to different types of contributors:
    *   Tier 1: Visionary Partner
    *   Tier 2: Strategic Influencer
    *   Tier 3: Early Champion
    *   Tier 4: Community Advocate
    *   Tier 5: Platform Pioneer

**## 2. Backend Implementation & Current Capabilities**

This section details what has been built in the `fastapi_ai_backend`.

*   **Database Schema (`schema.sql`):**
    *   **`pioneer_applications` Table:**
        *   Stores all submitted applications with fields for personal details (`full_name`, `email`, `telegram_handle`, `discord_id`, `country_of_residence`), social profiles (`primary_social_profile_link`, `follower_subscriber_count`, `secondary_social_profile_links`), tier applied for (`applying_for_tier`), qualitative answers (`audience_demographics_description`, `engagement_statistics_overview`, `interest_reason`, `contribution_proposal`, `previous_programs_experience`), TAIC compatible wallet address (`taic_compatible_wallet_address`), agreement checkboxes (`agreed_to_terms`, `agreed_to_token_vesting`), application status (`application_status`), admin review notes (`internal_review_notes`, `reviewed_by_admin_username`), and relevant timestamps (`submitted_at`, `reviewed_at`, `updated_at`).
        *   `user_id` FK to `users` table (optional, for logged-in applicants, links via `fk_pioneer_applications_user_id`).
        *   `email` has a UNIQUE constraint (`idx_pioneer_applications_email` implies this, typically `UNIQUE` constraint is named `uq_...` or defined inline).
        *   CHECK constraints for `applying_for_tier` and `application_status` ensure data integrity.
    *   **`pioneer_deliverables` Table:**
        *   Stores deliverables assigned to approved/onboarded pioneers.
        *   Fields for `application_id` (FK to `pioneer_applications`), `title`, `description`, `due_date`, `status` (e.g., pending, submitted_for_review, requires_revision, approved, rejected), `submission_content` (from pioneer), `admin_feedback`, relevant timestamps (`submitted_at`, `reviewed_at`, `created_at`, `updated_at`), and `reviewed_by_admin_username`.
        *   CHECK constraint for `status` ensures valid deliverable states.

*   **Pydantic Models:**
    *   Located in `fastapi_ai_backend/app/models/pioneer_application_models.py` and `fastapi_ai_backend/app/models/pioneer_deliverable_models.py`.
    *   Comprehensive models for:
        *   Application Submission (`PioneerApplicationCreate`, `PioneerApplicationResponse`).
        *   Admin Update of Application Status (`PioneerApplicationUpdateAdmin`).
        *   Deliverable Creation by Admin (`PioneerDeliverableCreateAdmin`).
        *   Admin Update of Deliverable (`PioneerDeliverableUpdateAdmin`).
        *   Pioneer Submission of Deliverable (`PioneerDeliverableSubmitPioneer`).
        *   Deliverable Response (`PioneerDeliverableResponse`).
    *   Include input validation (e.g., for email, URLs, required fields, allowed tier/status values via Enums and Pydantic validators).

*   **API Endpoints:**
    *   **Application Submission (Public/User - in `fastapi_ai_backend/app/api/routers/pioneer_applications.py` - `/api/pioneer-program`):**
        *   `POST /apply`: Allows anyone to submit an application. If the user is logged in, their `user_id` is associated. Handles duplicate email checks.
    *   **Admin Management of Applications (in `fastapi_ai_backend/app/api/routers/admin.py` - `/api/admin`):**
        *   `GET /pioneer-applications`: List all applications with filters (status, tier, email) and pagination.
        *   `GET /pioneer-applications/{application_id}`: View a specific application.
        *   `PUT /pioneer-applications/{application_id}/status`: Update application status, add internal notes, log admin reviewer and review time. Records action in `admin_audit_log`.
    *   **Admin Management of Deliverables (in `fastapi_ai_backend/app/api/routers/admin.py` - `/api/admin`):**
        *   `POST /pioneer-applications/{application_id}/deliverables`: Assign a new deliverable to an approved/onboarded application. Records action in `admin_audit_log`.
        *   `GET /pioneer-applications/{application_id}/deliverables`: List deliverables for a specific application.
        *   `PUT /pioneer-deliverables/{deliverable_id}`: Admin updates deliverable (status, feedback). Records action in `admin_audit_log`.
        *   `DELETE /pioneer-deliverables/{deliverable_id}`: Admin deletes a deliverable. Records action in `admin_audit_log`.
    *   **Pioneer-Facing Deliverable Management (in `fastapi_ai_backend/app/api/routers/pioneer_portal.py` - `/api/pioneer/me`):**
        *   Protected by JWT and a dependency (`get_current_pioneer_application_id_or_403`) ensuring user is an approved/onboarded pioneer.
        *   `GET /deliverables`: Pioneers can list their own assigned deliverables.
        *   `PUT /deliverables/{deliverable_id}/submit`: Pioneers can submit their work for a deliverable (updates `submission_content`, `status` to 'submitted_for_review', `submitted_at`).

*   **Demo Content for Token/Contract Details:**
    *   The existing schema (`pioneer_applications.taic_compatible_wallet_address` as VARCHAR) and free-text fields (`interest_reason`, `contribution_proposal`) can store placeholder/example information regarding tokens, contract addresses, or rates as part of the application or program description. No specific structured fields for "example contract address" or "example rates" were added to the application data structure itself, as these are generally part of program terms rather than application inputs. The backend is flexible enough to handle textual demo content within these fields or through general program descriptions managed elsewhere.

**## 3. Overall Status of Pioneer Program Feature (from a Backend Perspective)**

*   **Application Submission & Basic Admin Review:** Backend complete. Admins can view, filter, and change the status of applications.
*   **Deliverable Tracking (V1):** Backend complete. Admins can assign deliverables to approved pioneers. Pioneers can view their deliverables and submit them. Admins can review and update status/feedback for submissions.
*   **Smart Contract Integration for Token Vesting/Allocation:** `[PENDING - Specialized Blockchain Development]`. The backend currently has no direct interaction with smart contracts. The `taic_compatible_wallet_address` is collected for future use. The "Token Allocation & Vesting" plan item from the roadmap is a separate blockchain development task.
*   **Verification Tools & Checks (Backend Integration):** `[PENDING - Backend]` (If these involve calling third-party APIs from the backend for verifying social metrics or other applicant data). Currently, all data is self-reported.
*   **Automated Notifications for Pioneers:** (e.g., application status changes, new deliverables assigned, reminders for due dates). This would be part of "Notification Service - Phase 2 Expansion" or a dedicated Pioneer Program notification module. `[PENDING - Backend]`. Requires integration with the email service for various triggers.

**## 4. Frontend Requirements (Summary from `docs/frontend_requirements_summary.md`)**

*   **Public Facing:**
    *   Pioneer Program Landing Page (details tiers, benefits - content possibly on homepage, or a dedicated page).
    *   Application Form (calling `POST /api/pioneer-program/apply`) with all fields as per `PioneerApplicationCreate` model and `docs/pioneer_program_application_process.md`. Should provide clear instructions and expectations for each field.
*   **Authenticated User (Potential Pioneer):**
    *   Ability to view their submitted application status (e.g., `GET /api/pioneer-program/my-application` - *Note: This specific endpoint for applicants to view their own application details/status needs to be created in the backend if not already present. Currently, there isn't a dedicated endpoint for an applicant to see their specific application by their user_id post-submission, other than admin views.*)
*   **Authenticated User (Approved/Onboarded Pioneer - "Pioneer Portal" e.g., `/dashboard/pioneer`):**
    *   View assigned deliverables (`GET /api/pioneer/me/deliverables`).
    *   Submit work for a deliverable (`PUT /api/pioneer/me/deliverables/{id}/submit`), including UI for `submission_content` (e.g., rich text editor, link inputs).
    *   View admin feedback on submitted deliverables.
*   **Admin Portal (`/admin/pioneer/...`):**
    *   **Application Management:**
        *   Dashboard/Queue to list applications with filters (status, tier, email) (`GET /api/admin/pioneer-applications`).
        *   View full details of a single application (`GET /api/admin/pioneer-applications/{id}`).
        *   Interface to update application status (e.g., to 'approved', 'rejected', 'onboarded', 'additional_info_requested') and add internal review notes (`PUT /api/admin/pioneer-applications/{id}/status`).
    *   **Deliverable Management (likely accessed via an approved application's view):**
        *   Assign new deliverables to an application (`POST /api/admin/pioneer-applications/{app_id}/deliverables`). Form for title, description, due date.
        *   List deliverables for an application (`GET /api/admin/pioneer-applications/{app_id}/deliverables`).
        *   Review and update submitted deliverables: View `submission_content`, update `status` (e.g., to 'approved', 'requires_revision'), add `admin_feedback` (`PUT /api/admin/pioneer-deliverables/{del_id}`).
        *   Delete deliverables (`DELETE /api/admin/pioneer-deliverables/{del_id}`).

**## 5. UI Design Considerations (Functional Perspective)**

*   **Application Form:**
    *   Clear, multi-step or well-sectioned form for better user experience.
    *   Tooltips or placeholder text to guide users on expected input for qualitative answers (reason for interest, contribution proposal, audience demographics, etc.).
    *   Clear presentation of Terms & Conditions and Token Vesting Agreement checkboxes with links to full documents.
    *   Visual feedback on successful submission and what to expect next (e.g., "Thank you, we'll review your application and be in touch.").
*   **Pioneer Portal (for approved Pioneers):**
    *   Dashboard providing an overview of assigned deliverables, their statuses (e.g., "Pending Submission", "Under Review", "Approved", "Requires Revision"), and due dates.
    *   Clear interface for viewing individual deliverable details (description, admin-provided resources/links).
    *   User-friendly way to submit work: a rich text editor for `submission_content` could allow for formatted text, links, and potentially embedded images. If direct file uploads are needed later, this would be an enhancement.
    *   Prominent display of admin feedback on submitted deliverables.
*   **Admin Portal - Application Review:**
    *   Efficient table/list view for applications with key information visible (Applicant Name, Email, Tier, Status, Submission Date).
    *   Advanced filtering and sorting capabilities (by status, tier, date).
    *   A dedicated "Application Detail View" that neatly presents all submitted information, making it easy for admins to review.
    *   Simple and clear interface (e.g., dropdowns, comment boxes) to change application status and add internal notes. Audit trail of status changes should be implicitly clear or viewable.
*   **Admin Portal - Deliverable Management:**
    *   Intuitive workflow to add, edit, or delete deliverables associated with a specific pioneer/application.
    *   When assigning deliverables, allow for clear instructions, attaching reference material (links), and setting due dates.
    *   For reviewing submissions: side-by-side view of deliverable requirements and pioneer's submission if possible. Clear fields for providing feedback and changing status.

This document should provide a clear picture of the Pioneer Program feature as it stands from a backend perspective and what's needed on the frontend, along with considerations for its user interface.
