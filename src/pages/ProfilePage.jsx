import { Award, LogOut, Settings as SettingsIcon, Users } from 'lucide-react'; // User for profile pic, Award for flairs
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ProfilePage = () => {
    const { userId: paramsUserId } = useParams(); // For viewing other users' profiles
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [profileData, setProfileData] = useState(null); // This would be fetched based on paramsUserId or current user
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!supabase) {
                setLoading(false);
                return;
            }
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);

            const targetUserId = paramsUserId || user?.id;

            if (targetUserId) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', targetUserId)
                    .single();

                if (error) {
                    console.error("Error fetching profile:", error);
                    setLoading(false);
                    return;
                }

                if (data) {
                    setProfileData({
                        id: data.id,
                        username: data.username,
                        display_name: data.display_name,
                        avatar_url: data.avatar_url,
                        current_energy: data.current_energy,
                        current_momentum: data.current_momentum,
                        lifetime_energy: data.lifetime_energy,
                        lifetime_momentum: data.lifetime_momentum,
                        common_followers: data.common_followers,
                        goals: data.goals,
                        activity_log: data.activity_log,
                        is_danger: data.is_in_danger_zone,
                        is_public: data.is_public,
                        goal_slots: data.goal_slots
                    });
                } else {
                    setProfileData({
                        id: targetUserId,
                        username: 'unknown',
                        displayName: 'Unknown User',
                        avatar_url: `https://placehold.co/128x128/E0E0E0/B0B0B0?text=U`,
                        current_energy: 0,
                        current_momentum: 1,
                        lifetime_energy: 0,
                        lifetime_momentum: 1,
                        common_followers: 0,
                        goals: [],
                        activity_log: [],
                        is_danger: false,
                        is_public: false,
                        goal_slots: 1
                    });
                }
            }
            setLoading(false);
        };

        fetchUserData();
    }, [paramsUserId]);

    const handleSignOut = async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error signing out:', error);
        // App.jsx onAuthStateChange will handle navigation to /login
    };

    if (loading) {
        return <div className="p-6 text-center text-gray-600">Loading profile...</div>;
    }

    if (!profileData) {
        return <div className="p-6 text-center text-red-500">Could not load profile data.</div>;
    }

    const isOwnProfile = !paramsUserId || (currentUser && currentUser.id === profileData.id);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            {/* Profile Header */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                    <img
                        src={profileData?.avatar_url || `https://placehold.co/128x128/E0E0E0/B0B0B0?text=${(profileData?.display_name?.charAt(0) || 'U').toUpperCase()}`}
                        alt="Profile"
                        class_name="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-blue-500"
                        onerror={(e) => e.target.src = `https://placehold.co/128x128/E0E0E0/B0B0B0?text=${(profileData?.display_name?.charAt(0) || 'U').toUpperCase()}`}
                    />
                    <div className="text-center sm:text-left">
                        <h1 className="text-3xl font-bold text-gray-800">{profileData?.display_name || 'Unknown User'}</h1>
                        <p className="text-md text-blue-600">@{profileData?.username || 'unknown'}</p>
                        <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                            {profileData?.flairs?.map(flair => (
                                <span key={flair} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium flex items-center">
                                    <Award size={14} className="mr-1" /> {flair}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-2xl font-bold text-blue-600">{profileData?.current_energy || 0}%</p>
                        <p className="text-sm text-gray-500">⚡ Energy</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-orange-500">🔥 {profileData?.current_momentum || 1}</p>
                        <p className="text-sm text-gray-500">Momentum</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-green-600">{profileData?.lifetimePoints || 0}</p>
                        <p className="text-sm text-gray-500">Lifetime Points</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-purple-600">🏆 {profileData?.max_momentum_achieved || 1}</p>
                        <p className="text-sm text-gray-500">Max Momentum</p>
                    </div>
                </div>
                {profileData?.common_followers !== null && (
                    <p className="mt-4 text-sm text-gray-600 text-center sm:text-left">
                        <Users size={16} className="inline mr-1" /> You have {profileData?.common_followers} followers in common.
                        <button className="text-blue-500 hover:underline ml-1">View list</button>
                    </p>
                )}
                {isOwnProfile && (
                    <button
                        onclick={() => navigate('/settings')}
                        class_name="mt-4 w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <SettingsIcon size={16} class_name="mr-2" /> Edit Profile / Settings
                    </button>
                )}
            </div>

            {/* Goals Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-700 mb-3">Active Goals</h2>
                <div className="space-y-3">
                    {profileData?.goals?.map((goal, index) => (
                        <div key={index} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                            <p className="font-medium text-gray-800">{goal.activity}</p>
                            <p className="text-sm text-gray-600">Target: {goal.frequency} times {goal.period}</p>
                            <p className="text-xs text-gray-400">Started: {goal.startDate}</p>
                            {/* TODO: Add progress bar for each goal */}
                        </div>
                    ))}
                </div>
            </div>

            {/* Activity Log */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-700 mb-3">Activity Log</h2>
                <div className="space-y-3">
                    {profileData?.activityLog?.map(activity => (
                        <div key={activity.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            <p className="text-xs text-gray-400">{activity.timestamp}</p>
                            <p className="text-sm font-medium text-gray-700">{activity.description}</p>
                            <p className="text-xs text-green-500">+1 towards "{activity.goal}"</p>
                        </div>
                    ))}
                    {profileData?.activityLog?.length === 0 && <p className="text-sm text-gray-500">No activities logged yet.</p>}
                </div>
            </div>

            {isOwnProfile && (
                <div className="mt-6 flex justify-center">
                    <button
                        onclick={handleSignOut}
                        class_name="flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                        <LogOut size={18} class_name="mr-2" /> Sign Out
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
