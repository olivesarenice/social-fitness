=

### 1. System Overview

This document specifies the design for a gamified progression system aimed at increasing user consistency in a fitness application. The system is built upon two interconnected attributes: **Energy** (a temporary resource earned from workouts) and **Momentum** (a persistent user level). The core philosophy is to reward users for adhering to self-defined weekly goals and to create a positive feedback loop that encourages regular activity.

### 2. Core Mechanics

#### 2.1. User-Defined Goals

The entire system is anchored to goals set by the user.

* **Functionality:** Upon onboarding and at the start of each week, the user is prompted to set or review their weekly fitness goals.
* **Goal Structure:** A goal is defined by:
    * `Activity Type` (e.g., Running, Yoga, Weightlifting)
    * `Frequency` (e.g., 3 times per week)
* **Example Goals:**
    * Goal A: Run 3x per week.
    * Goal B: Do Yoga 2x per week.

#### 2.2. Energy

Energy is the resource earned by completing workouts that count towards a goal.

* **Earning Formula:** `Energy Gained = Base Energy * Streak Multiplier`
    * **Base Energy:** A fixed constant awarded for any qualifying workout, regardless of duration or intensity. This ensures all types of effort are valued.
        * The current `BASE_ENERGY` is 20
    * **Streak Multiplier:** This multiplier increases with each workout completed for a *specific* goal within the weekly cycle (e.g., Monday to Sunday).
        * 1st/2nd/3rd/4th/5th or more workout for a Goal: **1x** (20/ 40/ 80/ 160/ 320 Energy)
        * The multiplier caps at 5x for each Goal
    * **Multiplier Reset:** Once a weekly goal's frequency is met, the multiplier for that specific goal resets to **1x** for any additional workouts of that type within the same week. All goal multipliers reset to 1x at the beginning of the new week.

#### 2.3. Momentum

Momentum is the user's persistent level, reflecting their long-term consistency.

* **Leveling Up:** Momentum progression is **automatic**.
    * When `Current Energy >= Energy Cost for Next Level`, the user's Momentum level instantly increases by one.
    * Upon leveling up, the `Energy Cost` is subtracted from the user's `Current Energy` (effectively resetting it to zero plus any overflow).
* **Level Structure:** While the important number is the energy required to get to the next level, we track the total energy to hit that level instead. The total energy accumulated at each level X is as follows: ENERGY = 100(0.05X^2+X). Thus for each subsequent level, the additional energy required will range from 100 to 300. Beyond level 100, the energy required for the next level is always capped at 300.

#### 2.4. The Consistency Timer & Momentum Decay

This mechanic is designed to prevent long-term inactivity and protect the value of Momentum.

* **Consistency Timer:** A countdown timer that is reset after every completed workout.
* **Timer Duration Calculation:** The timer's duration is dynamically set based on the user's *most frequent* weekly goal.
    * **Formula:** `Timer Duration (in days) = floor(7 days / Lowest Goal Frequency)`
    * **Example 1 (Mixed Goals):** User has a "Run 3x/week" goal and a "Yoga 2x/week" goal. The highest frequency is 3.
        * `floor(7 / 3) = 2`. The timer is set to **48 hours**.
    * **Example 2 (Infrequent Goal):** User has one "Hike 1x/week" goal.
        * `floor(7 / 1) = 7`. The timer is set to **168 hours**.
    * **Example 3 (Frequent Goals):** User has a "Walk 5x/week" goal and a "Stretch 7x/week" goal. The highest frequency is 5.
        * `floor(7 / 5) = 1`. The timer is set to **24 hours**.
* **Momentum Decay:** If the Consistency Timer expires (reaches zero), the user's Momentum is considered "at risk."
    * **Consequence:** The user's **Momentum level drops by one.**
    * **Recovery Mechanic:** To mitigate frustration, the user does not start the previous level at zero. Instead, they are placed at the top of the demoted level, with their Energy set to **90% of the cost required to level up again.** This makes re-earning their lost rank feel achievable.


---
Implemented the following items in RPC:

# Implemented [25 JUN]

1.1. Schema Modifications
We added columns to the profiles table to track the user's progress and decay timer.

SQL
```
ALTER TABLE public.profiles
ADD COLUMN consistency_timer_expires_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN energy_for_next_level INT NOT NULL DEFAULT 100;
```

1.2. Backend Logic: Helper & Main RPC Functions
We created several helper functions to calculate energy costs and multipliers, and one main RPC function that the client calls to log an activity.

log_activity_and_update_stats (The Main RPC):
This function is the core of the system. When called, it:

- Calculates the energy gained from an activity based on a streak multiplier.
- Inserts the new activity record.
- Adds the energy to the user's profile.
- Checks for and processes any Momentum level-ups in a loop.
- Resets the user's consistency timer.
- Securely updates all user stats in a single transaction.

SQL
```
CREATE OR REPLACE FUNCTION log_activity_and_update_stats(
    goal_id_input uuid,
    activity_id_input bigint,
    timestamp_input timestamptz,
    location_tag_input text,
    location_is_hidden_input boolean,
    details_value_input text,
    details_units_input text,
    proof_url_input text
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    user_profile public.profiles;
    streak_multiplier INT;
    energy_to_add INT;
    new_energy_total INT;
    new_activity_id uuid;
BEGIN
    -- 1. Calculate Energy Gained
    streak_multiplier := get_streak_multiplier(goal_id_input);
    energy_to_add := 20 * streak_multiplier;

    -- 2. Log the Activity
    INSERT INTO public.activities (...)
    VALUES (...) RETURNING id INTO new_activity_id;

    -- 3. Update User Profile Stats
    SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id FOR UPDATE;

    new_energy_total := user_profile.energy + energy_to_add;
    user_profile.lifetime_energy := user_profile.lifetime_energy + energy_to_add;

    -- 4. Check for Momentum Level Up
    WHILE new_energy_total >= user_profile.energy_for_next_level LOOP
        new_energy_total := new_energy_total - user_profile.energy_for_next_level;
        user_profile.momentum := user_profile.momentum + 1;
        user_profile.lifetime_momentum := GREATEST(user_profile.lifetime_momentum, user_profile.momentum);
        user_profile.energy_for_next_level := calculate_energy_cost_for_level(user_profile.momentum + 1) - calculate_energy_cost_for_level(user_profile.momentum);
    END LOOP;

    -- 5. Final Update to Profile
    UPDATE public.profiles
    SET
        energy = new_energy_total,
        momentum = user_profile.momentum,
        energy_for_next_level = user_profile.energy_for_next_level,
        lifetime_energy = user_profile.lifetime_energy,
        lifetime_momentum = user_profile.lifetime_momentum,
        consistency_timer_expires_at = now() + calculate_consistency_timer_duration(current_user_id),
        is_danger = false
    WHERE
        id = current_user_id;

    RETURN jsonb_build_object('success', true, 'activity_id', new_activity_id, 'energy_gained', energy_to_add);
END;
$$;
```


# TODO

This function is designed to be run automatically by Supabase on a schedule (e.g., once every few hours or once a day). It finds all users whose consistency timers have expired and applies the decay penalty.

Run this script in your Supabase SQL Editor:

SQL
```
CREATE OR REPLACE FUNCTION handle_momentum_decay()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    decayed_user RECORD;
    new_energy_value INT;
    cost_to_level_up INT;
BEGIN
    -- Find all users whose timers have expired and whose Momentum is > 1
    FOR decayed_user IN
        SELECT * FROM public.profiles
        WHERE consistency_timer_expires_at < now() AND momentum > 1
    LOOP
        -- Calculate the energy cost to get from the new, lower level back to the old one.
        cost_to_level_up := calculate_energy_cost_for_level(decayed_user.momentum) - calculate_energy_cost_for_level(decayed_user.momentum - 1);
        -- Set their new energy to 90% of that cost.
        new_energy_value := floor(cost_to_level_up * 0.9);

        UPDATE public.profiles
        SET
            momentum = decayed_user.momentum - 1, -- Decrease level by 1
            energy = new_energy_value, -- Set energy to 90% of next level cost
            energy_for_next_level = cost_to_level_up,
            is_danger = true -- Mark the user as being "in danger"
        WHERE
            id = decayed_user.id;
    END LOOP;
END;
$$;

```
How to Schedule This Function:

Go to your Supabase Dashboard.
In the sidebar, go to Database -> Functions.
You will see handle_momentum_decay in the list.
Use the pg_cron extension to schedule it. Go to the SQL Editor and run:
SQL
```
-- This schedules the function to run once every day at 3:00 AM UTC.
SELECT cron.schedule('daily-momentum-decay', '0 3 * * *', 'SELECT handle_momentum_decay()');
```
You can adjust the schedule as needed.
