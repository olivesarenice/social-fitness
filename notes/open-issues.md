
# TODO:

11 June
1. Beautify the HomePage with icons - including abstracting the timestamp conversion and activity_class > emoji conversion functions
2. Enable 'give support' like button on activities on home page
3. Host app on Vercel for user feedback

12 June
1. Add gamification elements

# Features

## Implementations

- Created overall skeleton Next.js
- Created supabase and `profiles` table
- Added signup flow and profile update flow
- Added env to [Infiscal](https://infisical.com/docs/documentation/getting-started/api) for easier management

## Gemini TODO:

Okay, here is the roadmap formatted into Markdown for better readability and structure:

## Phase 1: Solidifying Core User Experience & Data Structures

This phase focuses on making user profiles, goals, and activity logging robust.

### Step 1: Enhance User Profiles

**Database (Supabase):**

* **Finalize `profiles` Table:** Ensure your `profiles` table in Supabase has all the necessary columns as per your spec and our previous discussion:
    * `id` (UUID, Primary Key, references `auth.users.id`)
    * `username` (TEXT, UNIQUE, NOT NULL)
    * `display_name` (TEXT)
    * `avatar_url` (TEXT, for custom photo or Boulder skin config)
    * `current_energy` (INTEGER, default `0` or an initial value)
    * `current_momentum` (INTEGER, default `1` or an initial value)
    * `max_momentum_achieved` (INTEGER, default `1` or an initial value)
    * `is_in_danger_zone` (BOOLEAN, default `FALSE`)
    * `goal_slots` (INTEGER, default `1`, based on initial momentum)
    * `created_at` (TIMESTAMPTZ, default `now()`)
    * `updated_at` (TIMESTAMPTZ, default `now()`) - *Consider an auto-update trigger for this.*
* **Row Level Security (RLS):**
    * Users can select their own profile: `auth.uid() = id`
    * Users can select other users' profiles (enable read for authenticated users).
    * Users can only update their own profile: `auth.uid() = id`
* **Supabase Storage for Avatars:** Set up a Supabase Storage bucket (e.g., `avatars`) with appropriate access policies (users can upload to their own folder, public read access for displaying).

**Frontend (React):**

* **Profile Setup (`SettingsPage.jsx` or dedicated onboarding flow):**
    * Allow users to set/update their `username` (check for uniqueness against the DB before submitting).
    * Allow users to set/update their `display_name`.
    * Implement avatar upload to Supabase Storage and update `avatar_url` in `profiles`.
    * Display the default "Boulder 🪨" if `avatar_url` is null or points to a default.
* **Display Profile Data (`ProfilePage.jsx`):**
    * Fetch and display all relevant data from the logged-in user's `profiles` record or a viewed user's record.

### Step 2: Goal Management (CRUD Operations)

**Database (Supabase):**

* **Create `goals` Table:**
    * `id` (UUID, Primary Key, default `uuid_generate_v4()`)
    * `user_id` (UUID, Foreign Key to `auth.users.id`, NOT NULL)
    * `activity_label` (TEXT, NOT NULL - e.g., "RUN", "GYM", or custom user input)
    * `frequency` (INTEGER, NOT NULL - e.g., 3 for "3 times a week")
    * `period` (TEXT, NOT NULL - e.g., "weekly", "daily")
    * `start_date` (DATE or TIMESTAMPTZ, NOT NULL)
    * `is_active` (BOOLEAN, default `TRUE`)
    * `current_completions_this_period` (INTEGER, default `0`)
    * `created_at` (TIMESTAMPTZ, default `now()`)
* **RLS for `goals`:** Users can CRUD their own goals (`user_id = auth.uid()`).

**Frontend (React):**

* **Goal Creation/Management UI (e.g., within `SettingsPage.jsx` or a new `ManageGoalsPage.jsx`):**
    * Form to create new goals (respecting `goal_slots` from `profiles`).
    * List current active goals.
    * Allow users to edit or delete/deactivate their goals.
    * Implement the "Create a goal from template" as part of the signup flow or goal creation page.

### Step 3: Implement Activity Logging

**Database (Supabase):**

* **Create `activities` Table:**
    * `id` (UUID, Primary Key, default `uuid_generate_v4()`)
    * `user_id` (UUID, Foreign Key to `auth.users.id`, NOT NULL)
    * `goal_id` (UUID, Foreign Key to `goals.id`, NULLABLE but recommended to link to a goal)
    * `activity_label` (TEXT, NOT NULL)
    * `timestamp` (TIMESTAMPTZ, NOT NULL, default `now()`)
    * `location_tag` (TEXT)
    * `location_hidden` (BOOLEAN, default `FALSE`)
    * `details_value` (TEXT or NUMERIC)
    * `details_units` (TEXT)
    * `proof_url` (TEXT, link to Supabase Storage if proof is uploaded)
    * `energy_gained` (NUMERIC, for auditing/display)
    * `created_at` (TIMESTAMPTZ, default `now()`)
* **RLS for `activities`:** Users can create their own (`user_id = auth.uid()`). Read access will be handled by feed logic.
* **Supabase Storage for Proof:** Set up a bucket (e.g., `activity-proofs`) for proof uploads.

**Frontend (React):**

* **Enhance `LogActivityPage.jsx`:**
    * Populate "Activity Label" (pre-configured + custom option).
    * Populate "Contributes to Goal" dropdown with the user's active goals from the `goals` table.
    * Implement all fields as per your "User content" spec.
    * On submit:
        * Save data to the `activities` table.
        * If proof is provided, upload it to Supabase Storage and save the URL.
    * **Trigger Gamification (Next Phase):** After successfully logging an activity, you'll need to trigger the energy calculation logic.

---

## Phase 2: Implementing Core Gamification Logic

This is where the app starts to feel like a game. This will heavily involve Supabase Edge Functions.

### Step 4: Backend Gamification Engine (Supabase Edge Functions)

* **Energy Calculation Function:**
    * Create a Supabase Edge Function (e.g., `calculate-energy-on-activity`).
    * **Trigger:** This function can be triggered by a database webhook on `INSERT` into the `activities` table, or called directly from the client after a successful activity log.
    * **Logic:**
        1.  Get the newly created activity and the user who logged it.
        2.  Identify the associated `goal_id` from the activity.
        3.  Fetch the goal details.
        4.  Check for cooldowns: Has this specific type of activity (for that goal) been logged by the user today? You might need to store `last_activity_timestamp_for_goal_category_today` on the `goals` table or in a temporary user state.
        5.  Calculate `energy_gained` based on your rules (base energy, diminishing returns if in cooldown).
        6.  Update `current_completions_this_period` on the `goals` table.
        7.  Update the user's `current_energy` in their `profiles` table.
        8.  Store the `energy_gained` on the activity record itself for auditing.
* **Momentum & Weekly Reset Function:**
    * Create a scheduled Supabase Edge Function (e.g., `weekly-momentum-reset`) using `pg_cron`.
    * **Schedule:** To run weekly (e.g., every Sunday at 2 AM user's local time. This is the trickiest part; often, a fixed UTC time is used for simplicity, e.g., Sunday 02:00 UTC, and users understand this).
    * **Logic (for each active user):**
        1.  Fetch all active goals for the user.
        2.  Calculate the percentage of `current_completions_this_period` against `frequency` for each goal to determine if they were met.
        3.  Calculate overall energy percentage for the week based on how many goals were met or partial progress (as per your "total number of energy points required depends on the number of goals set" logic).
        4.  **Update `current_momentum`:**
            * Increase if ALL goals completed (by number of completed goals).
            * Stays same if energy >= 50% and not all goals met (escapes DANGER).
            * Drops to DANGER if energy < 50%.
            * Decreases by -1 if already in DANGER and energy < 50%.
            * Drops regardless if energy is 0%.
        5.  Update `is_in_danger_zone` in `profiles`.
        6.  Update `max_momentum_achieved` if `current_momentum` is higher.
        7.  Update `goal_slots` in `profiles` based on the new `current_momentum` tiers.
        8.  Reset `current_completions_this_period` to 0 for all weekly goals.
        9.  Reset `current_energy` in `profiles` (or adjust as per your rules for the start of a new week).
* **Initial Values:** Ensure that when a user signs up, their `current_energy`, `current_momentum`, and `goal_slots` are initialized correctly in their `profiles` record (possibly via a trigger on `auth.users` insert or in your signup client logic).

### Step 5: Frontend Gamification Display

* **`ProfilePage.jsx` & Activity Cards (`HomePage.jsx`):**
    * Fetch and display `current_energy` (as a progress bar), `current_momentum` (with 🔥), `max_momentum_achieved`, and `goal_slots`.
    * Consider using Supabase Realtime to update these values live if they change due to backend functions.
* **Goal Progress:** On the profile or goals page, show progress for each goal (e.g., "Gym 2/3 times this week").

---

## Phase 3: Building Social Features

Now, make it social!

### Step 6: Follow System

**Database (Supabase):**

* **Create `follows` Table:**
    * `follower_id` (UUID, Foreign Key to `auth.users.id`)
    * `following_id` (UUID, Foreign Key to `auth.users.id`)
    * `created_at` (TIMESTAMPTZ, default `now()`)
    * Primary Key: (`follower_id`, `following_id`)
* **RLS:** Users can manage their own follow entries.

**Frontend (React):**

* **Follow/Unfollow Buttons:** On other users' `ProfilePage.jsx`, add buttons to follow/unfollow. These will insert/delete records in the `follows` table.
* **Display Followers/Following (Optional):** You might add lists of followers/following on profiles.

### Step 7: Home Feed (`HomePage.jsx`)

**Backend Logic (Supabase Database Function - RPC or Edge Function):**

* Create a function (e.g., `get_home_feed(current_user_id UUID, page_limit INT, page_offset INT)`).
* **Logic:**
    1.  Get the list of `following_id`s for the `current_user_id` from the `follows` table.
    2.  Fetch `activities` from users in this list.
    3.  Join with `profiles` to get the poster's `username`, `display_name`, `avatar_url`, `current_energy`, `current_momentum`.
    4.  Order by `activities.timestamp` DESC.
    5.  Implement pagination using `page_limit` and `page_offset`.

**Frontend (React):**

* Call this function to fetch feed data.
* Render activity cards as per your "Altogether" spec.
* Implement infinite scrolling or pagination.
* **Likes:**
    * **Database:** Add a `likes_count` (INTEGER, default `0`) to the `activities` table. Or, an `activity_likes` table: `activity_id` (FK), `user_id` (FK), `created_at` (PK on `activity_id`, `user_id`)). The latter is better for "anonymous but can't like twice".
    * **Backend:** Create a Supabase function `toggle_like(activity_id_to_like UUID, liking_user_id UUID)` to handle liking/unliking and update counts.
    * **Frontend:** Add like buttons and display counts.

### Step 8: User Search (`UserSearchPage.jsx` - placeholder in nav)

**Backend Logic (Supabase Database Function or Edge Function):**

* Function to search `profiles` by `username` or `display_name` (use `ILIKE` for case-insensitive search, and consider `pg_trgm` for fuzzy search).

**Frontend (React):**

* Input field.
* Display results with links to profiles and follow/unfollow buttons.

---

## Phase 4: Rewards & Notifications

### Step 9: Rewards - Flairs

**Database (Supabase):**

* `flairs_master` table: `id`, `name`, `description`, `icon_url_or_style`, `min_momentum_range`, `max_momentum_range`, `rarity_tier`.
* `user_unlocked_flairs` table: `user_id` (FK), `flair_id` (FK), `unlocked_at`. (PK on `user_id`, `flair_id`).
* Add `selected_flair_id` (FK to `flairs_master.id`) to the `profiles` table.

**Backend Logic (Edge Function):**

* Triggered when a user's `max_momentum_achieved` in `profiles` is updated.
* Checks `flairs_master` for any new flairs the user qualifies for based on `max_momentum_achieved` and rarity.
* Inserts new unlocks into `user_unlocked_flairs`.

**Frontend:**

* Display selected flair next to activity posts and on profiles.
* In `SettingsPage.jsx`, allow users to see their unlocked flairs and select one to display.

### Step 10: Rewards - Boulder Skins 🪨

**Database (Supabase):**

* `skin_items_master` table: `id`, `name`, `type` (e.g., 'boulder_color', 'accessory'), `asset_identifier` (e.g., hex color, SVG name, image URL), `unlock_condition_type` (e.g., 'momentum_level'), `unlock_condition_value`.
* `user_unlocked_skin_items` table: `user_id` (FK), `skin_item_id` (FK).
* Modify `profiles.avatar_url` or add a new JSONB column like `boulder_configuration` to store selected skin items (e.g., `{ "base_color_id": "xxx", "accessory_id": "yyy" }`).

**Backend Logic:**

* Similar to flairs, unlock skin items based on momentum/level progression.

**Frontend:**

* Component to render the Boulder avatar dynamically based on `boulder_configuration`. This might involve layering SVGs, applying CSS filters, or selecting pre-composed images.
* UI for users to customize their Boulder from unlocked items.

### Step 11: Notifications (Browser Push or In-App)

**Database (Supabase - for in-app):**

* `notifications` table: `id`, `recipient_user_id` (FK), `actor_user_id` (FK, optional), `type` (e.g., 'new_activity_from_followed', 'momentum_levelup_from_followed', 'new_flair_unlocked'), `reference_id` (e.g., activity ID, flair ID), `is_read` (BOOLEAN, default `FALSE`), `created_at`.

**Backend Logic (Edge Functions):**

* When relevant events occur (new activity by followed user, momentum level up by followed user), create records in the `notifications` table.

**Frontend:**

* If using browser push: integrate with Web Push API (can use Supabase for storing subscriptions).
* If in-app: Poll or use Supabase Realtime on the `notifications` table to display new notifications. Mark as read.

---

## Phase 5: Advanced Features & Polish

### Step 12: Content Verification (Initial - Proof Display)

**Frontend:**

* Display 🪪 icon on activity cards if `proof_url` exists.
* Clicking it opens a modal to display the image from Supabase Storage.
* **Future:** Actual verification (✅) is a complex feature (manual admin, AI, etc.).

### Step 13: Refinement, Testing, Deployment

* **UI/UX Polish:** Consistent styling, loading states, error handling, empty states, accessibility.
* **Thorough Testing:** All user flows, gamification edge cases, different browsers.
* **Deployment:**
    * **Frontend:** Vercel or Netlify are excellent for React apps.
    * **Supabase** handles the backend. Ensure your Supabase project is scaled appropriately if needed.
* **Monitoring:** Set up basic monitoring for your Supabase project and frontend application.

---

## General Advice:

* **Iterate:** Build one feature or sub-feature at a time. Test it, then move on.
* **Git:** Use version control diligently. Create branches for features.
* **Supabase CLI:** Get comfortable using the Supabase CLI for local development, schema migrations, and deploying Edge Functions.
* **Security:** Continuously review and test your RLS policies and Edge Function security.
* **User Feedback:** Once you have an MVP, get feedback from real users to guide further development.