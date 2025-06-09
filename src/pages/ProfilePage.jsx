import { Award, LogOut, Settings as SettingsIcon } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ProfilePage = () => {
    const { userId: paramsUserId } = useParams();
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activitiesLimit, setActivitiesLimit] = useState(5);
    const [allActivitiesLoaded, setAllActivitiesLoaded] = useState(false);
    const [pendingFollowRequests, setPendingFollowRequests] = useState([]);

    // REMOVED: Redundant state variables
    // const [isFollowing, setIsFollowing] = useState(false);
    // const [isFollowedByTargetUser, setIsFollowedByTargetUser] = useState(false);
    // const [hasPendingFollowRequestFromTarget, setHasPendingFollowRequestFromTarget] = useState(false);

    const fetchUserData = useCallback(async () => {
        if (!supabase) {
            setLoading(false);
            return;
        }
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);

        const targetUserId = paramsUserId || user?.id;
        const isOwnProfile = user && targetUserId === user.id;

        if (targetUserId) {
            // OPTIMIZATION: We can modify the RPC to accept user_id as well, but for now this is fine.
            const { data: basicProfile, error: basicProfileError } = await supabase
                .from('all_profile_usernames') // Assuming this view maps user_id to username
                .select('username')
                .eq('id', targetUserId)
                .single();

            if (basicProfileError || !basicProfile) {
                console.error("Error fetching basic profile username:", basicProfileError);
                setLoading(false);
                return;
            }

            // --- SINGLE SOURCE OF TRUTH ---
            // Call the enhanced RPC to get ALL profile and follow data in one go.
            const { data: rpcProfileData, error: rpcError } = await supabase.rpc('get_profile_by_username', {
                profile_username: basicProfile.username
            });

            if (rpcError || !rpcProfileData) {
                console.error("Error fetching profile data via RPC:", rpcError);
                setLoading(false);
                return;
            }

            // REMOVED: Redundant checks for follow status. This data is now in rpcProfileData.

            // Fetch pending requests only if it's the user's own profile
            if (isOwnProfile && user) {
                const { data: pendingRequests, error: pendingRequestsError } = await supabase
                    .from('follows')
                    .select('follower_id, profiles:follower_id ( id, username, avatar_url, display_name )')
                    .eq('followed_id', user.id)
                    .eq('status', 'pending');
                if (pendingRequestsError) {
                    console.error('Error fetching pending requests:', pendingRequestsError);
                } else {
                    setPendingFollowRequests(pendingRequests || []);
                }
            }

            // The RPC now returns goals and activities if the user has full access.
            const hasFullAccess = rpcProfileData.hasOwnProperty('lifetime_energy');

            // Set the final state object, using data directly from the RPC
            setProfileData({
                ...rpcProfileData,
                goals: rpcProfileData.active_goals || [], // Use active_goals from RPC
                activityLog: rpcProfileData.activity_log || [], // Use activity_log from RPC
            });

            // Update allActivitiesLoaded based on the initial activities returned by the RPC
            setAllActivitiesLoaded((rpcProfileData.activity_log || []).length >= (rpcProfileData.total_activities || 0));
        }
        setLoading(false);
    }, [paramsUserId]); // Simplified dependencies as activitiesLimit is now handled by RPC initial fetch

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    const handleFollow = async () => {
        if (!supabase || !currentUser || !profileData) return;

        const { error } = await supabase.rpc('request_follow', {
            user_to_follow_id: profileData.id
        });

        if (error) {
            console.error('Error requesting follow:', error);
        } else {
            console.log('Follow request sent successfully!');
            // Re-fetch user data to update follow status and other potential changes
            fetchUserData();
        }
    };

    const handleUnfollow = async () => {
        if (!supabase || !currentUser || !profileData) return;

        const { error } = await supabase
            .from('follows')
            .delete()
            .eq('follower_id', currentUser.id)
            .eq('followed_id', profileData.id);

        if (error) {
            console.error("Error unfollowing user:", error);
        } else {
            console.log('Unfollowed successfully!');
            fetchUserData();
        }
    };

    const handleAcceptFollowRequest = async (requestorId) => {
        if (!supabase) return;

        const { error } = await supabase.rpc('manage_follow_request', {
            requestor_id: requestorId,
            action: 'accept'
        });

        if (error) {
            console.error('Error accepting request:', error);
        } else {
            console.log('Follow request accepted!');
            // Re-fetch data to update pending requests and potentially follower count
            fetchUserData();
        }
    };

    const handleDenyFollowRequest = async (requestorId) => {
        if (!supabase) return;

        const { error } = await supabase.rpc('manage_follow_request', {
            requestor_id: requestorId,
            action: 'deny'
        });

        if (error) {
            console.error('Error denying request:', error);
        } else {
            console.log('Follow request denied.');
            // Re-fetch data to update pending requests
            fetchUserData();
        }
    };

    const handleSeeMoreActivities = async () => {
        if (!supabase || !profileData || allActivitiesLoaded) return;

        setLoading(true);
        const nextLimit = activitiesLimit + 5; // Load 5 more activities

        const { data: moreActivities, error } = await supabase
            .from('activities')
            .select('*')
            .eq('user_id', profileData.id)
            .order('timestamp', { ascending: false })
            .range(activitiesLimit, nextLimit - 1); // Use range for pagination

        if (error) {
            console.error("Error fetching more activities:", error);
        } else {
            setProfileData(prevData => ({
                ...prevData,
                activityLog: [...(prevData.activityLog || []), ...(moreActivities || [])],
            }));
            setActivitiesLimit(nextLimit);
            if (!moreActivities || moreActivities.length < 5) {
                setAllActivitiesLoaded(true);
            }
        }
        setLoading(false);
    };

    const handleSignOut = async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error signing out:', error);
        } else {
            navigate('/login'); // Redirect to login page after sign out
        }
    };

    if (loading && !profileData) { // Only show full-page loader on initial load
        return <div className="p-6 text-center text-gray-600">Loading profile...</div>;
    }

    if (!profileData) {
        return <div className="p-6 text-center text-red-500">Could not load profile data.</div>;
    }

    const isOwnProfile = !paramsUserId || (currentUser && currentUser.id === profileData.id);
    const hasFullAccess = profileData.hasOwnProperty('lifetime_energy');

    // CHANGED: Logic now reads directly from the profileData state object
    const viewerFollowStatus = profileData.viewer_follow_status;
    const targetFollowStatus = profileData.target_follow_status;

    return (
        <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Profile Header */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                    <img
                        src={profileData.avatar_url || `https://placehold.co/128x128/E0E0E0/B0B0B0?text=${(profileData.display_name?.charAt(0) || 'U').toUpperCase()}`}
                        alt="Profile"
                        className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-blue-500"
                        onError={(e) => e.target.src = `https://placehold.co/128x128/E0E0E0/B0B0B0?text=${(profileData.display_name?.charAt(0) || 'U').toUpperCase()}`}
                    />
                    <div className="flex-1 text-center sm:text-left">
                        <h1 className="text-3xl font-bold text-gray-800">{profileData.display_name || 'Unknown User'}</h1>
                        <p className="text-md text-blue-600">@{profileData.username || 'unknown'}</p>
                        {!isOwnProfile && profileData.target_follow_status === 'accepted' && (
                            <p className="text-sm text-gray-500 mt-1">Follows You</p>
                        )}
                        <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
                            {profileData.flairs?.map(flair => (
                                <span key={flair} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium flex items-center">
                                    <Award size={14} className="mr-1" /> {flair}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="mt-6 grid grid-cols-3 sm:grid-cols-5 gap-4 text-center border-t border-gray-200 pt-4">
                    <div>
                        <p className="text-2xl font-bold text-blue-600">{hasFullAccess ? profileData.energy : '-'}{hasFullAccess && '%'}</p>
                        <p className="text-sm text-gray-500">⚡ Energy</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-orange-500">🔥 {hasFullAccess ? profileData.momentum : '-'}</p>
                        <p className="text-sm text-gray-500">Momentum</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-green-600">{hasFullAccess ? profileData.lifetime_energy : '-'}</p>
                        <p className="text-sm text-gray-500">Lifetime Points</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-purple-600">🏆 {hasFullAccess ? profileData.lifetime_momentum : '-'}</p>
                        <p className="text-sm text-gray-500">Max Momentum</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-indigo-600">{profileData.total_activities || '-'}</p>
                        <p className="text-sm text-gray-500">Total Activities</p>
                    </div>
                </div>

                {/* Action Buttons */}
                {!isOwnProfile && currentUser && (
                    <div className="mt-6 flex items-center justify-center sm:justify-start space-x-3">
                        {profileData.target_follow_status === 'pending' && (
                            <>
                                <p className="text-sm text-gray-600 font-medium">{profileData.display_name} wants to follow you.</p>
                                <button
                                    onClick={() => handleAcceptFollowRequest(profileData.id)}
                                    className="px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                    disabled={loading}
                                >
                                    Accept
                                </button>
                            </>
                        )}
                        {profileData.viewer_follow_status === 'accepted' ? (
                            <button
                                onClick={handleUnfollow}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                disabled={loading}
                            >
                                Following
                            </button>
                        ) : profileData.viewer_follow_status === 'pending' ? (
                            <button
                                onClick={handleUnfollow} // Allow canceling the request
                                className="px-4 py-2 border border-gray-400 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                                disabled={loading}
                            >
                                Request Sent
                            </button>
                        ) : profileData.target_follow_status === 'accepted' ? (
                            <button
                                onClick={handleFollow}
                                className="px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                disabled={loading}
                            >
                                Follow Back
                            </button>
                        ) : (
                            <button
                                onClick={handleFollow}
                                className="px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                disabled={loading}
                            >
                                {profileData.is_public ? 'Follow' : 'Request to Follow'}
                            </button>
                        )}
                    </div>
                )}
                {isOwnProfile && (
                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => navigate('/settings')}
                            className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            <SettingsIcon size={16} className="mr-2" /> Edit Profile / Settings
                        </button>
                        <button
                            onClick={() => navigate('/manage-goals')}
                            className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-blue-500 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                        >
                            <Award size={16} className="mr-2" /> Manage Goals
                        </button>
                    </div>
                )}
            </div>

            {/* Pending Follow Requests Section (only for own profile) */}
            {isOwnProfile && pendingFollowRequests.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-semibold text-gray-700 mb-3">Pending Follow Requests</h2>
                    <div className="space-y-3">
                        {pendingFollowRequests.map(request => (
                            <div key={request.follower_id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                                <div className="flex items-center space-x-3">
                                    <img
                                        src={request.profiles?.avatar_url || `https://placehold.co/32x32/E0E0E0/B0B0B0?text=${(request.profiles?.display_name?.charAt(0) || 'U').toUpperCase()}`}
                                        alt="Follower"
                                        className="w-8 h-8 rounded-full object-cover"
                                    />
                                    <p className="font-medium text-gray-800">{request.profiles?.display_name || 'Unknown User'}</p>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => handleAcceptFollowRequest(request.profiles.id)}
                                        className="px-3 py-1 border border-green-600 rounded-md shadow-sm text-xs font-medium text-white bg-green-600 hover:bg-green-700"
                                        disabled={loading}
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => handleDenyFollowRequest(request.profiles.id)}
                                        className="px-3 py-1 border border-red-600 rounded-md shadow-sm text-xs font-medium text-red-600 bg-white hover:bg-red-50"
                                        disabled={loading}
                                    >
                                        Deny
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Conditional Content (Goals, Activities, or Private Message) */}
            {hasFullAccess ? (
                <>
                    {/* Goals Section */}
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Active Goals</h2>
                        <div className="space-y-3">
                            {profileData.goals?.length > 0 ? (
                                profileData.goals.map((goal) => (
                                    <div key={goal.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                                        <p className="font-medium text-gray-800">{goal.activity_name}</p>
                                        <p className="text-sm text-gray-600">Target: {goal.frequency} times per {goal.period}</p>
                                        <p className="text-xs text-gray-400">Started: {new Date(goal.created_at).toLocaleDateString()}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500">No active goals found.</p>
                            )}
                        </div>
                    </div>

                    {/* Activity Log */}
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Activity Log</h2>
                        <div className="space-y-3">
                            {profileData.activityLog?.length > 0 ? (
                                profileData.activityLog.map(activity => (
                                    <div key={activity.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                        <p className="text-xs text-gray-400">{new Date(activity.timestamp).toLocaleString()}</p>
                                        <p className="text-sm font-medium text-gray-700">{activity.activity_name}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500">No activities logged yet.</p>
                            )}
                        </div>
                        {profileData.activityLog?.length > 0 && !allActivitiesLoaded && (
                            <div className="mt-4 text-center">
                                <button
                                    onClick={handleSeeMoreActivities}
                                    className="text-blue-600 hover:underline text-sm font-medium disabled:opacity-50"
                                    disabled={loading}
                                >
                                    {loading ? 'Loading...' : 'See More Activities'}
                                </button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="bg-white p-10 rounded-xl shadow-lg text-center text-gray-600">
                    <p className='font-semibold'>This account is private</p>
                    <p className='text-sm mt-1'>Follow this account to see their goals and activity.</p>
                </div>
            )}

            {/* Sign Out Button (only for own profile) */}
            {isOwnProfile && (
                <div className="mt-6 flex justify-center">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                        <LogOut size={18} className="mr-2" /> Sign Out
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
