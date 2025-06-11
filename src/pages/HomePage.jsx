import { formatDistanceToNow } from 'date-fns'; // For friendly date formatting
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getEmojiForActivityClass } from '../utils/activityUtils';

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

    // Determine energy bar color
    const energyColor = activity.current_energy < 25 ? 'bg-red-500' :
        activity.current_energy < 50 ? 'bg-orange-500' :
            activity.current_energy < 100 ? 'bg-green-500' :
                activity.current_energy === 100 ? 'bg-gradient-to-r from-green-500 via-cyan-500 to-purple-500' :
                    'bg-grey-500'; // Default color for other cases

    // Construct Google Maps URL
    const googleMapsUrl = activity.location_tag ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location_tag)}` : null;

    // Determine border color based on activity_class
    const activityClassColor = (activityClass) => {
        switch (activityClass) {
            case 'running':
                return 'border-red-500';
            case 'cycling':
                return 'border-blue-500';
            case 'swimming':
                return 'border-green-500';
            default:
                return 'border-gray-500';
        }
    };
    console.log(activity)
    return (
        <div className="p-4 border-b border-gray-200 bg-white hover:bg-gray-100 transition-colors relative"> {/* Added relative for absolute positioning of timestamp */}

            <div className="flex items-start space-x-6">
                <div className="w-24 flex-shrink-0"> {/* New container for avatar and username */}
                    <div className="flex flex-col items-center"> {/* Container for avatar and username */}
                        <img
                            src={activity.avatar_url || `https://placehold.co/40x40/E0E0E0/B0B0B0?text=${(activity.display_name?.charAt(0) || 'U').toUpperCase()}`}
                            alt="Avatar"
                            className="w-12 h-12 rounded-full object-cover cursor-pointer"
                            onClick={() => navigate(`/profile/${activity.user_id}`)}
                        />
                        <span className="text-xs font-medium text-gray-800 mt-1 cursor-pointer hover:underline" onClick={() => navigate(`/profile/${activity.user_id}`)}> {/* Username below avatar */}
                            {activity.username}
                        </span>
                        <div className="w-16 bg-gray-300 rounded-full h-2 mt-2">
                            <div
                                className={`${energyColor} h-2 rounded-full`}
                                style={{ width: `${activity.current_energy}%` }}
                            ></div>
                        </div>

                        <span className="text-xs font-medium text-gray-800 mt-1">🔥{activity.current_momentum}</span> {/* Only emoji and number */}
                    </div>
                </div>

                <div className="flex-1 mt-4"> {/* Adjusted margin top to account for timestamp */}
                    <div className="flex justify-between items-center mb-2"> {/* Container for location and timestamp */}
                        {/* Timestamp div (without absolute positioning) */}
                        <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(activity.activity_timestamp), { addSuffix: true })}
                        </p>

                        {/* Location div (without absolute positioning) */}
                        {activity.location_tag && activity.location_tag !== 'Location Hidden' && ( // Conditional rendering for location
                            <p className="text-xs text-gray-500">
                                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    📍{activity.location_tag}
                                </a>
                            </p>
                        )}

                    </div>
                    <div className={`border ${activityClassColor(activity.activity_class)} p-2 rounded flex justify-between items-center`}>
                        <p className="font-medium text-gray-800">
                            <span className="font-medium">{activity.details_value} {activity.details_units} </span>
                            <span className="font-semibold">{activity.activity_label || 'an activity'}</span>{' '}
                            {getEmojiForActivityClass(activity.activity_class)}
                        </p>
                        <p className="text-gray-800 italic font-semibold">{activity.energy_gained}⚡</p>
                    </div>
                    {activity.goal_description && (
                        <p className="text-xs text-green-600 mt-1">⬆️ towards "{activity.goal_description}"</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomePage;
