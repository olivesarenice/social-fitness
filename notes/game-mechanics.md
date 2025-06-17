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
        * **Value:** `100 Energy`
    * **Streak Multiplier:** This multiplier increases with each workout completed for a *specific* goal within the weekly cycle (e.g., Monday to Sunday).
        * 1st workout for a Goal: **1x** (100 Energy)
        * 2nd workout for a Goal: **2x** (200 Energy)
        * 3rd workout for a Goal: **3x** (300 Energy)
        * The multiplier continues to increase up to the goal's target frequency.
    * **Multiplier Reset:** Once a weekly goal's frequency is met, the multiplier for that specific goal resets to **1x** for any additional workouts of that type within the same week. All goal multipliers reset to 1x at the beginning of the new week.

#### 2.3. Momentum

Momentum is the user's persistent level, reflecting their long-term consistency.

* **Leveling Up:** Momentum progression is **automatic**.
    * When `Current Energy >= Energy Cost for Next Level`, the user's Momentum level instantly increases by one.
    * Upon leveling up, the `Energy Cost` is subtracted from the user's `Current Energy` (effectively resetting it to zero plus any overflow).
* **Level Structure:** The Energy cost to advance to the next level increases exponentially to ensure a sense of achievement.

| Level | Momentum Title | Energy Cost to Reach |
| :---- | :------------- | :------------------- |
| 1     | Spark          | 500                  |
| 2     | Flicker        | 1,200                |
| 3     | Glow           | 2,500                |
| 4     | Flame          | 5,000                |
| 5     | Blaze          | 9,000                |
| 6     | Inferno        | 15,000               |
| *...* | *...*          | *Continues to scale* |

#### 2.4. The Consistency Timer & Momentum Decay

This mechanic is designed to prevent long-term inactivity and protect the value of Momentum.

* **Consistency Timer:** A countdown timer that is reset after every completed workout.
* **Timer Duration Calculation:** The timer's duration is dynamically set based on the user's *least frequent* weekly goal.
    * **Formula:** `Timer Duration (in days) = floor(7 days / Lowest Goal Frequency)`
    * **Example 1 (Mixed Goals):** User has a "Run 3x/week" goal and a "Yoga 2x/week" goal. The lowest frequency is 2.
        * `floor(7 / 2) = 3`. The timer is set to **72 hours**.
    * **Example 2 (Infrequent Goal):** User has one "Hike 1x/week" goal.
        * `floor(7 / 1) = 7`. The timer is set to **168 hours**.
    * **Example 3 (Frequent Goals):** User has a "Walk 5x/week" goal and a "Stretch 7x/week" goal. The lowest frequency is 5.
        * `floor(7 / 5) = 1`. The timer is set to **24 hours**.
* **Momentum Decay:** If the Consistency Timer expires (reaches zero), the user's Momentum is considered "at risk."
    * **Consequence:** The user's **Momentum level drops by one.**
    * **Recovery Mechanic:** To mitigate frustration, the user does not start the previous level at zero. Instead, they are placed at the top of the demoted level, with their Energy set to **90% of the cost required to level up again.** This makes re-earning their lost rank feel achievable.