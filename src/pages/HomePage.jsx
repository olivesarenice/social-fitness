import { formatDistanceToNow } from 'date-fns'; // For friendly date formatting
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const HomePage = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [feedActivities, setFeedActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const PAGE_SIZE = 10; // Number of activities to fetch per page

    const fetchFeed = useCallback(async (pageNum) => {
        if (pageNum === 0) {
            setLoading(true); // Full page loader only on initial fetch
        } else {
            setLoadingMore(true); // Spinner for "load more" button
        }

        const { data, error } = await supabase.rpc('get_home_feed', {
            page_limit: PAGE_SIZE,
            page_offset: pageNum * PAGE_SIZE
        });

        if (error) {
            console.error("Error fetching home feed:", error);
        } else {
            if (pageNum === 0) {
                setFeedActivities(data || []);
            } else {
                setFeedActivities(prev => [...prev, ...(data || [])]);
            }

            // If we received fewer items than we asked for, there are no more pages
            if (!data || data.length < PAGE_SIZE) {
                setHasMore(false);
            }
        }
        setLoading(false);
        setLoadingMore(false);
    }, []);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
            } else {
                navigate('/login');
            }
        };
        checkUser();
    }, [navigate]);

    useEffect(() => {
        // Only fetch the feed if the user is known
        if (user) {
            fetchFeed(0); // Fetch the first page
        }
    }, [user, fetchFeed]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchFeed(nextPage);
    };

    if (loading) {
        return <div className="p-6 text-center text-gray-600">Loading your feed...</div>;
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Home Feed</h1>
                <p className="text-gray-600 mb-6">Welcome back, {user?.email || 'User'}!</p>

                <div className="space-y-4">
                    {feedActivities.length > 0 ? (
                        feedActivities.map(activity => (
                            <ActivityCard key={activity.activity_id} activity={activity} />
                        ))
                    ) : (
                        <p className="text-center text-gray-500 py-8">Your feed is empty. Follow some users or log an activity to get started!</p>
                    )}

                    {loadingMore && <p className="text-center text-gray-500">Loading more...</p>}

                    {hasMore && !loadingMore && feedActivities.length > 0 && (
                        <div className="text-center pt-4">
                            <button
                                onClick={handleLoadMore}
                                className="px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50"
                            >
                                Load More
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// A dedicated component for each item in the feed
const ActivityCard = ({ activity }) => {
    const navigate = useNavigate();

    return (
        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex items-start space-x-3">
                <img
                    src={activity.avatar_url || `https://placehold.co/40x40/E0E0E0/B0B0B0?text=${(activity.display_name?.charAt(0) || 'U').toUpperCase()}`}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full object-cover cursor-pointer"
                    onClick={() => navigate(`/profile/${activity.user_id}`)}
                />
                <div className="flex-1">
                    <p className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(activity.activity_timestamp), { addSuffix: true })}
                    </p>
                    <p className="font-medium text-gray-800">
                        <span className="font-semibold cursor-pointer hover:underline" onClick={() => navigate(`/profile/${activity.user_id}`)}>
                            {activity.display_name || activity.username}
                        </span>
                        {' just completed '}
                        <span className="font-semibold">{activity.activity_label || 'an activity'}</span>
                        {activity.location_tag && ` at ${activity.location_tag}`}
                    </p>
                    {activity.goal_description && (
                        <p className="text-xs text-green-600 mt-1">+1 towards "{activity.goal_description}"</p>
                    )}
                    <div className="mt-2 text-xs text-gray-500">
                        <span>Energy: {activity.current_energy}%</span>
                        <span className="mx-2">|</span>
                        <span>Momentum: 🔥 {activity.current_momentum}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;