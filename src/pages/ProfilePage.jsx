import { Award, Lock, LogOut, Settings as SettingsIcon, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getEmojiForActivityClass } from '../utils/activityUtils'; // Import emoji helper

// --- SUB-COMPONENTS FOR CLARITY ---

const FollowListModal = ({ modalState, onClose, onLoadMore }) => {
    const { type, list, loadingMore, hasMore } = modalState;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm h-3/4 max-h-[500px] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center flex-shrink-0">
                    <h2 className="font-semibold text-lg capitalize">{type}</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {list.map(user => <UserRow key={user.id} user={user} onClose={onClose} />)}
                    {loadingMore && <p className="text-center text-gray-500 py-4">Loading...</p>}
                    {hasMore && !loadingMore && (
                        <button onClick={onLoadMore} className="w-full text-blue-600 font-semibold text-sm py-3 hover:bg-gray-100 rounded-md">
                            Load More
                        </button>
                    )}
                    {!hasMore && !loadingMore && list.length === 0 && (
                        <p className="text-center text-gray-500 py-4">No users to display.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const UserRow = ({ user, onClose }) => {
    const navigate = useNavigate();
    return (
        <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100">
            <img
                src={user.avatar_url || `https://placehold.co/40x40/E0E0E0/B0B0B0?text=${(user.display_name?.charAt(0) || 'U').toUpperCase()}`}
                alt="Avatar" className="w-10 h-10 rounded-full object-cover cursor-pointer"
                onClick={() => { onClose(); navigate(`/profile/${user.id}`); }}
            />
            <div className="flex-grow cursor-pointer" onClick={() => { onClose(); navigate(`/profile/${user.id}`); }}>
                <p className="font-medium text-gray-800">{user.display_name || user.username}</p>
                <p className="text-sm text-gray-500">@{user.username}</p>
            </div>
            {/* You can add a follow button component here later based on user.viewer_follow_status */}
        </div>
    );
};


// --- MAIN PROFILE PAGE COMPONENT ---

const ProfilePage = () => {
    const { userId: paramsUserId } = useParams();
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activitiesLimit, setActivitiesLimit] = useState(5);
    const [allActivitiesLoaded, setAllActivitiesLoaded] = useState(false);
    const [pendingFollowRequests, setPendingFollowRequests] = useState([]);

    // NEW: State for the followers/following modal
    const [modalState, setModalState] = useState({
        isOpen: false,
        type: null,
        profileId: null,
        list: [],
        page: 0,
        hasMore: true,
        loadingMore: false,
    });

    const fetchUserData = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);

        const targetUserId = paramsUserId || user?.id;
        if (!targetUserId) {
            setLoading(false);
            navigate('/login');
            return;
        }

        const { data: basicProfile } = await supabase.from('profiles').select('username').eq('id', targetUserId).single();
        if (!basicProfile) {
            setLoading(false);
            console.error("Profile not found");
            return;
        }

        const { data: rpcProfileData, error: rpcError } = await supabase.rpc('get_profile_by_username', {
            profile_username: basicProfile.username
        });

        if (rpcError) {
            console.error("Error fetching profile data via RPC:", rpcError);
            setLoading(false);
            return;
        }

        setProfileData(rpcProfileData);
        console.log('Profile Data:', rpcProfileData); // Log profile data

        const isOwnProfile = user && targetUserId === user.id;
        if (isOwnProfile) {
            const { data: pending } = await supabase.from('follows').select('*, profiles:follower_id(id, username, display_name, avatar_url)').eq('followed_id', user.id).eq('status', 'pending');
            setPendingFollowRequests(pending || []);
        }

        setAllActivitiesLoaded((rpcProfileData.activity_log || []).length >= (rpcProfileData.total_activities || 0));
        setLoading(false);
    }, [paramsUserId, navigate]);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    // NEW: Handlers for the followers/following modal
    const openFollowModal = async (type, initialCount) => {
        if (!profileData || initialCount === 0) return;

        setModalState({ isOpen: true, type, profileId: profileData.id, list: [], page: 0, hasMore: true, loadingMore: true });

        const rpcName = type === 'followers' ? 'get_profile_followers' : 'get_profile_following';
        const { data, error } = await supabase.rpc(rpcName, {
            profile_id_input: profileData.id,
            page_limit: 20,
            page_offset: 0
        });

        if (error) {
            console.error(`Error fetching ${type}:`, error);
            setModalState(s => ({ ...s, hasMore: false, loadingMore: false }));
        } else {
            setModalState(s => ({ ...s, list: data || [], hasMore: data.length === 20, loadingMore: false }));
        }
    };

    const handleLoadMoreInModal = async () => {
        if (modalState.loadingMore || !modalState.hasMore) return;

        setModalState(s => ({ ...s, loadingMore: true }));
        const nextPage = modalState.page + 1;

        const rpcName = modalState.type === 'followers' ? 'get_profile_followers' : 'get_profile_following';
        const { data, error } = await supabase.rpc(rpcName, {
            profile_id_input: modalState.profileId,
            page_limit: 20,
            page_offset: nextPage * 20
        });

        if (error) {
            console.error(`Error fetching more ${modalState.type}:`, error);
            setModalState(s => ({ ...s, hasMore: false }));
        } else {
            setModalState(s => ({
                ...s,
                list: [...s.list, ...(data || [])],
                page: nextPage,
                hasMore: data.length === 20,
            }));
        }
        setModalState(s => ({ ...s, loadingMore: false }));
    };

    const closeFollowModal = () => {
        setModalState({ isOpen: false, type: null, profileId: null, list: [], page: 0, hasMore: true, loadingMore: false });
    };


    const handleFollow = async () => {
        if (!currentUser || !profileData) return;
        const { error } = await supabase.rpc('request_follow', { user_to_follow_id: profileData.id });
        if (error) { console.error('Error requesting follow:', error); }
        fetchUserData(); // Refresh data to show updated counts and status
    };

    const handleUnfollow = async () => {
        if (!currentUser || !profileData) return;
        await supabase.from('follows').delete().match({ follower_id: currentUser.id, followed_id: profileData.id });
        fetchUserData(); // Refresh data
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
                activity_log: [...(prevData.activity_log || []), ...(moreActivities || [])],
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

    const formatTimestamp = (timestamp) => {
        console.log('Timestamp for formatting:', timestamp, typeof timestamp); // Log timestamp and type
        const now = new Date();
        const date = new Date(timestamp);
        const diffInSeconds = Math.floor((now - date) / 1000);
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);
        const diffInWeeks = Math.floor(diffInDays / 7);
        const diffInMonths = Math.floor(diffInDays / 30.44); // Average days in a month
        const diffInYears = Math.floor(diffInDays / 365.25); // Average days in a year

        if (diffInSeconds < 60) {
            return `${diffInSeconds} seconds ago`;
        } else if (diffInMinutes < 60) {
            return `${diffInMinutes} minutes ago`;
        } else if (diffInHours < 24) {
            return `${diffInHours} hours ago`;
        } else if (diffInDays < 7) {
            return `${diffInDays} days ago`;
        } else if (diffInWeeks < 4) { // Approximately less than a month
            return `${diffInWeeks} weeks ago`;
        } else if (diffInMonths < 12) {
            return `${diffInMonths} months ago`;
        } else {
            return `${diffInYears} years ago`;
        }
    };

    if (loading) return <div className="p-6 text-center text-gray-600">Loading profile...</div>;
    if (!profileData) return <div className="p-6 text-center text-red-500">Could not load profile data.</div>;

    const isOwnProfile = !paramsUserId || (currentUser && currentUser.id === profileData.id);
    const hasFullAccess = profileData.hasOwnProperty('active_goals');

    return (
        <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
            <div className="bg-white p-6 rounded-xl shadow-lg">

                {/* --- NEW: Main Header Container --- */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start sm:justify-between gap-4">

                    {/* Left Side: Avatar + User Info */}
                    <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-6 self-end">
                        <img
                            src={profileData.avatar_url || `https://placehold.co/128x128/E0E0E0/B0B0B0?text=${(profileData.display_name?.charAt(0) || 'U').toUpperCase()}`}
                            alt="Profile"
                            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-blue-500 flex-shrink-0"
                        />
                        <div className="flex-1">
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

                    {/* Right Side: Socials (Posts, Followers, Following) */}
                    <div className="grid grid-cols-3 gap-4 text-center pt-2 sm:pt-0 flex-shrink-0">
                        <div className="p-2">
                            <p className="text-xl font-bold text-gray-800">{profileData.total_activities || 0}</p>
                            <p className="text-xs text-gray-500">Posts</p>
                        </div>
                        <div onClick={() => openFollowModal('followers', profileData.follower_count)} className="p-2 rounded-md cursor-pointer hover:bg-gray-100 transition-colors">
                            <p className="text-xl font-bold text-gray-800">{profileData.follower_count || 0}</p>
                            <p className="text-xs text-gray-500">Followers</p>
                        </div>
                        <div onClick={() => openFollowModal('following', profileData.following_count)} className="p-2 rounded-md cursor-pointer hover:bg-gray-100 transition-colors">
                            <p className="text-xl font-bold text-gray-800">{profileData.following_count || 0}</p>
                            <p className="text-xs text-gray-500">Following</p>
                        </div>
                    </div>
                </div>

                {/* --- Detailed Stats (Now positioned below the header) --- */}
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center border-t border-gray-200 pt-4">
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
                </div>

                {!isOwnProfile && profileData.mutual_followers_count > 0 && (
                    <div className="mt-4 flex items-center justify-center sm:justify-start text-sm text-gray-500">
                        <Users size={16} className="mr-2 flex-shrink-0" />
                        <span>Followed by {profileData.mutual_followers_count} {profileData.mutual_followers_count > 1 ? 'users' : 'user'} you follow</span>
                    </div>
                )}

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


            {/* Conditional Content (Goals, Activities, or Private Message) */}
            {hasFullAccess ? (
                <>
                    {/* Goals Section */}
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Active Goals</h2>
                        <div className="grid grid-cols-3 gap-4"> {/* Use grid for 3 columns */}
                            {/* Map over slots (0, 1, 2) */}
                            {[0, 1, 2].map(slotIndex => {
                                const goal = profileData.active_goals?.[slotIndex]; // Get goal for this slot

                                return (
                                    <div key={slotIndex} className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col justify-between"> {/* Box for each slot */}
                                        {goal ? (
                                            /* Render Goal Info */
                                            <div className="flex justify-between"> {/* Use flex to separate left and right content */}
                                                <div className="flex flex-col items-center"> {/* Flex column for emoji and frequency */}
                                                    <span className="text-3xl">{getEmojiForActivityClass(goal.activity_class)}</span> {/* Large emoji */}

                                                    <p className="text-xs text-gray-600 mt-1">{goal.frequency}x {goal.period}</p> {/* Formatted frequency/period below emoji */}
                                                    {goal.created_at && ( /* Conditionally render date */
                                                        <p className="text-xs text-gray-400">{formatTimestamp(goal.created_at)}</p>
                                                    )}
                                                </div>
                                                <div className="flex-1 ml-4"> {/* Flex item for description and date, add margin */}
                                                    <p className="font-medium text-gray-800">{goal.activity_label}</p>
                                                    <p className="text-xs text-gray-800">{goal.goal_description}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Render Placeholder */
                                            <div className="flex flex-col items-center justify-center text-gray-400 h-full">
                                                <Lock size={24} /> {/* Use Lock icon */}
                                                <p className="text-sm mt-2">Empty Slot</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Activity Log */}
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Activity Log</h2>
                        <div className="space-y-3">
                            {profileData.activity_log?.length > 0 ? (
                                profileData.activity_log.map(activity => (
                                    <div key={activity.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex justify-between items-center">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-lg">{getEmojiForActivityClass(activity.activity_class)}</span>
                                            <p className="font-medium text-gray-800">{activity.activity_label}</p>
                                            {activity.details_value && (
                                                <p className="text-sm text-gray-600">{activity.details_value} {activity.details_units}</p>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400">{formatTimestamp(activity.timestamp)}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500">No activities logged yet.</p>
                            )}
                        </div>
                        {profileData.activity_log?.length > 0 && !allActivitiesLoaded && (
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

            {modalState.isOpen && (
                <FollowListModal
                    modalState={modalState}
                    onClose={closeFollowModal}
                    onLoadMore={handleLoadMoreInModal}
                />
            )}
        </div>
    );
};

export default ProfilePage;
