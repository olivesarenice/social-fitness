Updating a `count` column on a change to another table:

```
CREATE OR REPLACE FUNCTION update_activities_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Increment the post_count for the user who created the post
    UPDATE public.profiles
    SET total_activities = total_activities + 1
    WHERE id = NEW.user_id; -- 'NEW.user_id' refers to the user_id of the new post
  ELSIF (TG_OP = 'DELETE') THEN
    -- Decrement the post_count for the user whose post was deleted
    UPDATE public.profiles
    SET total_activities = total_activities - 1
    WHERE id = OLD.user_id; -- 'OLD.user_id' refers to the user_id of the deleted post
  END IF;
  RETURN NULL; -- The result is ignored since this is an AFTER trigger
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



CREATE TRIGGER on_activity_created_or_deleted
AFTER INSERT OR DELETE ON public.activities
FOR EACH ROW
EXECUTE FUNCTION update_activities_count();


UPDATE public.profiles p
SET total_activities = (
  SELECT COUNT(*)
  FROM public.activities
  WHERE user_id = p.id
);

```

# See all profiles (redacted data)

```
DROP VIEW IF EXISTS public.all_profile_usernames;

CREATE VIEW public.all_profile_usernames AS
  SELECT
    id,
    username,
    display_name,
    avatar_url,
    is_public
  FROM
    public.profiles;
```

# RLS for Follow-Following concept

Core Philosophy
The goal of these RLS policies is to enforce these key rules:

A user can always manage their own side of a relationship (following, unfollowing, approving, denying).
The privacy of pending requests between other users is paramount. You should not be able to see who has requested to follow another private user.
accepted relationships are generally considered public information (e.g., for displaying follower/following counts).
Prerequisites & Assumptions
For these policies to work, we must assume:

You have a profiles table with a user's id and a boolean column named is_private.
The status column in your follows table is an ENUM with at least two values: 'pending' and 'accepted'.
auth.uid() correctly returns the UUID of the currently authenticated user.
You will use RPC Functions (as discussed previously) for the actual logic of creating and accepting requests, as this is far more secure than allowing direct INSERT or UPDATE operations from the client.
(Note: I will use your column name following_id to refer to the user who is being followed).

The RLS Policies
Here are the policies for your follows table, broken down by operation.

1. SELECT Policy
Goal: Allow users to see all accepted follows, plus any pending requests that involve them directly (either as the follower or the one being followed).

SQL

CREATE POLICY "Users can view relevant follow relationships" ON public.follows
FOR SELECT
USING (
  -- Rule 1: The follow relationship is accepted and public.
  (status = 'accepted') OR

  -- Rule 2: You are the one who sent the follow request.
  (follower_id = auth.uid()) OR

  -- Rule 3: You are the one who received the follow request.
  (following_id = auth.uid())
);
Explanation: This is the most complex policy. The OR conditions ensure that you can see your own pending requests and accepted follows, but you can only see the accepted follows of other users, protecting their privacy.

2. INSERT Policy
Goal: Prevent users from creating follow relationships directly. This is a critical security measure. A malicious user could otherwise try to insert a row with status = 'accepted', bypassing the request system entirely.

Best Practice: Force all follow requests through a secure RPC function (request_follow).

SQL

CREATE POLICY "Disallow direct inserts on follows" ON public.follows
FOR INSERT
WITH CHECK (false);
Explanation: By setting the WITH CHECK condition to false, this policy makes it impossible for any user to directly INSERT into the follows table. They must call your request_follow RPC function, which contains the correct logic.

3. UPDATE Policy
Goal: Similar to INSERT, prevent users from directly updating the status of a follow. This forces them to use a secure RPC function (manage_follow_request) to accept a request.

Best Practice: This prevents a user from, for example, changing someone else's request status or updating an already-accepted relationship.

SQL

CREATE POLICY "Disallow direct updates on follows" ON public.follows
FOR UPDATE
USING (false)
WITH CHECK (false);
Explanation: This policy completely locks down UPDATE operations on the follows table for all users. Your manage_follow_request function will bypass this because it is defined with SECURITY DEFINER.

4. DELETE Policy
Goal: Allow a user to end a follow relationship if they are one of the two parties involved.

SQL

CREATE POLICY "Users can delete their own follow relationships" ON public.follows
FOR DELETE
USING (
  -- Rule 1: You are the follower (unfollowing or canceling a pending request).
  (follower_id = auth.uid()) OR

  -- Rule 2: You are the one being followed (removing a follower or denying a request).
  (following_id = auth.uid())
);
Explanation: This policy allows for all necessary "delete" actions:

The follower can cancel their own pending request.
The follower can unfollow an accepted relationship.
The following_id (the user being followed) can deny a pending request.
The following_id can remove an existing follower from an accepted relationship.
Complete Script for Production
Here is the complete script you should use for a secure, production-ready system. It assumes you will use RPC functions for creating and approving follows.

SQL

-- Ensure RLS is enabled on the table first
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Drop any old policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view relevant follow relationships" ON public.follows;
DROP POLICY IF EXISTS "Disallow direct inserts on follows" ON public.follows;
DROP POLICY IF EXISTS "Disallow direct updates on follows" ON public.follows;
DROP POLICY IF EXISTS "Users can delete their own follow relationships" ON public.follows;


-- 1. SELECT POLICY
CREATE POLICY "Users can view relevant follow relationships" ON public.follows
FOR SELECT USING (
  (status = 'accepted') OR
  (follower_id = auth.uid()) OR
  (following_id = auth.uid())
);

-- 2. INSERT POLICY (LOCKED)
CREATE POLICY "Disallow direct inserts on follows" ON public.follows
FOR INSERT WITH CHECK (false);

-- 3. UPDATE POLICY (LOCKED)
CREATE POLICY "Disallow direct updates on follows" ON public.follows
FOR UPDATE USING (false) WITH CHECK (false);

-- 4. DELETE POLICY
CREATE POLICY "Users can delete their own follow relationships" ON public.follows
FOR DELETE USING (
  (follower_id = auth.uid()) OR
  (following_id = auth.uid())
);
By implementing these RLS policies alongside your RPC functions, you create a robust and secure system that perfectly models the logic of an Instagram-style follower system.