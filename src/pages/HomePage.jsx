import { formatDistanceToNow } from 'date-fns'; // For friendly date formatting
import { AlertTriangle, Flame, Heart, HelpCircle, Hourglass, Info, Shield, Target, UserPlus, X, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import Confetti from 'react-confetti'; // Import the confetti library
import { Link, useLocation, useNavigate } from 'react-router-dom'; // Import useLocation
import GameMechanicsPopup from '../components/GameMechanicsPopup';
import { supabase } from '../supabaseClient';
import { getEmojiForActivityClass } from '../utils/activityUtils';

const parseIntervalToSeconds = (intervalString) => {
    if (!intervalString) return 0;

    let totalSeconds = 0;
    const parts = intervalString.split(' ');

    for (let i = 0; i < parts.length; i += 2) {
        const value = parseInt(parts[i], 10);
        const unit = parts[i + 1];

        if (isNaN(value)) continue;

        if (unit.startsWith('day')) {
            totalSeconds += value * 86400;
        } else if (unit.startsWith('hour')) {
            totalSeconds += value * 3600;
        } else if (unit.startsWith('min')) {
            totalSeconds += value * 60;
        } else if (unit.startsWith('sec')) {
            totalSeconds += value;
        }
    }
    return totalSeconds;
};

// --- NEW: Reusable Info Popup Component ---
const InfoPopup = ({ title, content, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center">
                <h2 className="font-semibold text-lg flex items-center"><Info size={18} className="mr-2" /> {title}</h2>
                <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200"><X size={20} /></button>
            </div>
            <div className="p-6 text-gray-700 text-sm space-y-2">
                {content}
            </div>
        </div>
    </div>
);

// --- NEW: Follow Request Modal Component ---
const FollowRequestModal = ({ initialRequests, onClose, onUpdateRequest }) => {
    const [requests, setRequests] = useState(initialRequests);

    const handleAccept = async (requestorId) => {
        await supabase.rpc('manage_follow_request', { requestor_id: requestorId, action: 'accept' });
        const updatedRequests = requests.filter(req => req.profiles.id !== requestorId);
        setRequests(updatedRequests);
        onUpdateRequest(updatedRequests);
    };

    const handleDeny = async (requestorId) => {
        await supabase.rpc('manage_follow_request', { requestor_id: requestorId, action: 'deny' });
        const updatedRequests = requests.filter(req => req.profiles.id !== requestorId);
        setRequests(updatedRequests);
        onUpdateRequest(updatedRequests);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm h-3/4 max-h-[500px] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="font-semibold text-lg">Follow Requests</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {requests.length > 0 ? requests.map(req => (
                        <div key={req.follower_id} className="flex items-center p-2 rounded-lg">
                            <img src={req.profiles.avatar_url || `https://placehold.co/40x40/E0E0E0/B0B0B0?text=U`} alt="Avatar" className="w-10 h-10 rounded-full object-cover mr-3" />
                            <div className="flex-grow">
                                <p className="font-medium text-gray-800">{req.profiles.display_name || req.profiles.username}</p>
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => handleAccept(req.profiles.id)} className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full hover:bg-blue-700">Accept</button>
                                <button onClick={() => handleDeny(req.profiles.id)} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-300">Deny</button>
                            </div>
                        </div>
                    )) : <p className="text-center text-gray-500 p-4">No pending requests.</p>}
                </div>
            </div>
        </div>
    );
};

// --- NEW: Level Up Popup Component ---
const LevelUpPopup = ({ level, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm text-center p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-3xl font-bold text-blue-600 mb-2">Keep it up!</h2>
            <p className="text-lg text-gray-700 mb-4">You've reached Momentum Level</p>
            <p className="text-6xl font-bold text-gray-800 mb-6 flex items-center justify-center"><Flame size={60} className="mr-2 text-red-500" />{level}</p>
            <button onClick={onClose} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">
                Continue
            </button>
        </div>
    </div>
);

// --- StatusHeader Component ---
const StatusHeader = ({ onInfoClick, statusData }) => {
    const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0 });
    const [timerPercentage, setTimerPercentage] = useState(100);

    useEffect(() => {
        if (!statusData || !statusData.expires_at) return;

        const calculateRemaining = () => {
            const now = new Date();
            const expiry = new Date(statusData.expires_at);
            const totalSecondsLeft = Math.max(0, (expiry.getTime() - now.getTime()) / 1000);

            // FIX: Use the new helper function to parse the interval string
            const totalDurationInSeconds = parseIntervalToSeconds(statusData.timer_duration);

            if (totalDurationInSeconds > 0) {
                const percentage = (totalSecondsLeft / totalDurationInSeconds) * 100;
                setTimerPercentage(Math.max(0, percentage));
            } else {
                // Handle case where duration is 0 or timer has expired
                setTimerPercentage(totalSecondsLeft > 0 ? 100 : 0);
            }

            setTimeRemaining({
                days: Math.floor(totalSecondsLeft / 86400),
                hours: Math.floor((totalSecondsLeft % 86400) / 3600),
                minutes: Math.floor((totalSecondsLeft % 3600) / 60)
            });
        };

        calculateRemaining();
        const interval = setInterval(calculateRemaining, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [statusData]);


    if (!statusData) {
        return <div className="p-3 border border-gray-200 bg-gray-50 rounded-lg animate-pulse h-32 mb-6"></div>;
    }

    const { is_in_danger, current_energy, energy_for_next_level, weekly_goals_progress } = statusData;
    const energyPercentage = energy_for_next_level > 0 ? Math.min(100, (current_energy / energy_for_next_level) * 100) : 0;
    const timerBarColor = is_in_danger ? 'bg-red-500' : timerPercentage < 50 ? 'bg-yellow-500' : 'bg-green-500';
    const containerClass = is_in_danger ? 'p-3 border-2 border-red-300 bg-red-50 rounded-lg' : 'p-3 border border-gray-200 bg-gray-50 rounded-lg';

    return (
        <div className={containerClass}>
            {/* Momentum Shield Bar */}
            <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <p className={`text-sm font-semibold flex items-center ${is_in_danger ? 'text-red-800' : 'text-gray-700'}`}>
                        <Shield size={16} className="mr-2" /> Momentum Shield
                        <button onClick={() => onInfoClick('momentum')} className="ml-1 text-gray-400 hover:text-blue-600"><Info size={14} /></button>
                    </p>
                    {is_in_danger || timeRemaining.days === 0 && timeRemaining.hours === 0 && timeRemaining.minutes === 0 ? (
                        <div className="flex items-center text-sm font-bold text-red-800"><AlertTriangle size={16} className="mr-1" /><span>IN DANGER</span></div>
                    ) : (
                        <p className="text-sm font-medium text-gray-800 flex items-center">
                            <Hourglass size={14} className="mr-1.5" />
                            {timeRemaining.days > 0 && `${timeRemaining.days}d `}{timeRemaining.hours > 0 && `${timeRemaining.hours}h `}{timeRemaining.minutes}m left
                        </p>
                    )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className={`${timerBarColor} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${timerPercentage}%` }}></div>
                </div>
            </div>

            {/* Energy Bar */}
            <div className="mt-3 space-y-1">
                <div className="flex justify-between items-center">
                    <p className="text-sm font-semibold flex items-center text-gray-700">
                        <Zap size={16} className="mr-2 text-yellow-500" /> Energy
                        <button onClick={() => onInfoClick('energy')} className="ml-1 text-gray-400 hover:text-blue-600"><Info size={14} /></button>
                    </p>
                    <p className="text-sm font-medium text-gray-800">
                        {Math.max(0, energy_for_next_level - current_energy)} pts to <Flame size={16} className="inline-block mr-0 text-red-500" />{statusData.current_momentum + 1}
                    </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${energyPercentage}%` }}></div>
                </div>
            </div>

            {/* Weekly Goal Progress Section */}
            {weekly_goals_progress && weekly_goals_progress.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                    <p className="text-sm font-semibold flex items-center text-gray-700 mb-1">
                        <Target size={16} className="mr-2" /> Weekly Progress
                        <button onClick={() => onInfoClick('goals')} className="ml-1 text-gray-400 hover:text-blue-600"><Info size={14} /></button>
                    </p>
                    {weekly_goals_progress.map(goal => {
                        const goalPercentage = goal.target_frequency > 0 ? Math.min(100, (goal.completions_this_week / goal.target_frequency) * 100) : 0;
                        return (
                            <div key={goal.goal_id}>
                                <div className="flex justify-between items-center text-xs font-medium">
                                    <span className="text-gray-600 truncate pr-2">{goal.activity_label}</span>
                                    <span className="text-gray-800 flex-shrink-0">{goal.completions_this_week} / {goal.target_frequency}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                    <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${goalPercentage}%` }}></div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

const HomePage = () => {
    const navigate = useNavigate();
    const location = useLocation(); // Hook to get location object
    const [user, setUser] = useState(null);
    const [feedActivities, setFeedActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [statusData, setStatusData] = useState(null);
    const [showHelpMessage, setShowHelpMessage] = useState(false);
    // NEW: State to control the confetti effect
    const [showConfetti, setShowConfetti] = useState(false);
    const [showLevelUpPopup, setShowLevelUpPopup] = useState(false);
    const PAGE_SIZE = 10;

    // NEW: State for modals and popups
    const [showFollowRequests, setShowFollowRequests] = useState(false);
    const [infoPopup, setInfoPopup] = useState({ isOpen: false, type: null });
    const [showGameMechanics, setShowGameMechanics] = useState(false);

    useEffect(() => {
        if (location.state?.leveledUp) {
            setShowConfetti(true);
            setShowLevelUpPopup(true);
            const timer = setTimeout(() => {
                setShowConfetti(false);
            }, 8000); // Let the confetti run for 8 seconds

            // Clear the state to prevent re-triggering on refresh
            window.history.replaceState({}, document.title)

            return () => clearTimeout(timer);
        }
    }, [location.state]);

    // MODIFIED: This function now uses RPC for pending requests and the PAGE_SIZE variable.
    const fetchPageData = useCallback(async (pageNum = 0) => {
        if (pageNum === 0) setLoading(true);
        else setLoadingMore(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate('/login'); return; }
        setUser(user);

        // Fetch feed, pending requests, status, and goals in parallel
        const [feedRes, requestsRes, statusRes, goalsRes] = await Promise.all([
            supabase.rpc('get_home_feed', {
                page_limit: PAGE_SIZE,
                page_offset: pageNum * PAGE_SIZE
            }),
            supabase.rpc('get_pending_follow_requests'), // Use new RPC
            supabase.rpc('get_user_status_header'),
            supabase.from('goals').select('id').eq('user_id', user.id)
        ]);

        if (feedRes.error) {
            console.error("Error fetching feed:", feedRes.error);
        } else {
            if (pageNum === 0) {
                setFeedActivities(feedRes.data || []);
            } else {
                setFeedActivities(prev => [...prev, ...(feedRes.data || [])]);
            }
            if (!feedRes.data || feedRes.data.length < PAGE_SIZE) {
                setHasMore(false);
            }
        }

        if (requestsRes.error) {
            console.error("Error fetching requests:", requestsRes.error);
        } else {
            // The RPC returns the data directly
            setPendingRequests(requestsRes.data || []);
        }

        if (statusRes.error) {
            console.error("Error fetching status header data:", statusRes.error);
        } else {
            setStatusData(statusRes.data);
        }

        if (goalsRes.error) {
            console.error("Error fetching goals:", goalsRes.error);
        } else {
            if (goalsRes.data.length === 0) {
                setShowHelpMessage(true);
                setShowGameMechanics(true);
            }
        }

        if (pageNum === 0) setLoading(false);
        else setLoadingMore(false);
    }, [navigate]);

    useEffect(() => {
        fetchPageData(0);
    }, [fetchPageData]);

    const handleInfoClick = (type) => {
        if (type === 'game_mechanics') {
            setShowGameMechanics(true);
        } else {
            setInfoPopup({ isOpen: true, type });
        }
    };

    const infoContent = {
        momentum: (
            <>
                <p>The timer resets every time you log an activity. Once timer reaches 0 and the day passes, your Momentum will reduce by 1.</p>
                <p>Timer is dependent on the most frequent goal you set. More frequent goals give you shorter timers.</p>
            </>
        ),
        energy: (
            <p>Each activity grants 20 base energy.</p>
        ),
        goals: (
            <>
                <p>Repeated activities for the same goal gives you energy multipliers, doubling the amount of energy gained per activity up to 16x.</p>
                <p>Multipliers reset each week.</p>
            </>
        )
    };

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchPageData(nextPage);
    };

    if (loading) {
        return <div className="p-6 text-center text-gray-600">Loading your feed...</div>;
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
            {showConfetti && <Confetti recycle={false} numberOfPieces={500} gravity={0.2} />}

            <div className="bg-white p-6 rounded-xl shadow-lg max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold text-gray-800">Home Feed</h1>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => setShowFollowRequests(true)} className="relative text-gray-500 hover:text-blue-600 flex flex-col items-center p-2 rounded-lg hover:bg-gray-100">
                            <UserPlus size={24} />
                            <span className="text-xs mt-1">Requests</span>
                            {pendingRequests.length > 0 && (
                                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                                    {pendingRequests.length}
                                </span>
                            )}
                        </button>
                        <button onClick={() => handleInfoClick('game_mechanics')} className="text-gray-500 hover:text-blue-600 flex flex-col items-center p-2 rounded-lg hover:bg-gray-100">
                            <HelpCircle size={24} />
                            <span className="text-xs mt-1">Help</span>
                        </button>
                    </div>
                </div>

                <StatusHeader onInfoClick={handleInfoClick} statusData={statusData} />

                {showHelpMessage && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                        <h3 className="text-lg font-semibold text-blue-800">Welcome to Momentum!</h3>
                        <p className="text-blue-700 mt-1">It looks like you haven't set any goals yet. Head over to the <Link to="/profile" className="font-bold underline">Profile</Link> page to get started!</p>
                    </div>
                )}

                <div className="border-t border-gray-200 my-6"></div>

                <div className="space-y-4">
                    {feedActivities.length > 0 ? (
                        feedActivities.map(activity => (
                            <ActivityCard key={activity.activity_id} activity={activity} />
                        ))
                    ) : (
                        <p className="text-center text-gray-500 py-8">Your feed is empty!</p>
                    )}
                    {loadingMore && <p className="text-center text-gray-500">Loading...</p>}
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

            {showFollowRequests && (
                <FollowRequestModal
                    initialRequests={pendingRequests}
                    onClose={() => setShowFollowRequests(false)}
                    onUpdateRequest={setPendingRequests}
                />
            )}
            {infoPopup.isOpen && (
                <InfoPopup
                    title={infoPopup.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    content={infoContent[infoPopup.type] || <p>No information available.</p>}
                    onClose={() => setInfoPopup({ isOpen: false, type: null })}
                />
            )}
            {showLevelUpPopup && statusData && (
                <LevelUpPopup level={statusData.current_momentum} onClose={() => setShowLevelUpPopup(false)} />
            )}
            {showGameMechanics && <GameMechanicsPopup onClose={() => setShowGameMechanics(false)} />}
        </div>
    );
};


// A dedicated component for each item in the feed
const ActivityCard = ({ activity }) => {
    const navigate = useNavigate();
    const [bumpState, setBumpState] = useState({
        count: activity.bump_count,
        viewerHasBumped: activity.viewer_has_bumped,
    });

    const handleBumpToggle = async () => {
        const hasBumped = bumpState.viewerHasBumped;

        // Optimistic UI update for a snappy feel
        setBumpState({
            count: hasBumped ? bumpState.count - 1 : bumpState.count + 1,
            viewerHasBumped: !hasBumped,
        });

        // Call the appropriate RPC in the background
        const rpcName = hasBumped ? 'remove_bump' : 'add_bump';
        const { error } = await supabase.rpc(rpcName, {
            activity_id_input: activity.activity_id
        });

        if (error) {
            console.error("Error toggling bump:", error);
            // On error, revert the optimistic update
            setBumpState({
                count: activity.bump_count,
                viewerHasBumped: activity.viewer_has_bumped,
            });
            alert("Couldn't give bump. Please try again.");
        }
    };
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
        <div className="pr-4 pl-4 pb-4 border-b border-gray-200 bg-white hover:bg-gray-100 transition-colors relative"> {/* Added relative for absolute positioning of timestamp */}

            <div className="flex items-start space-x-4 sm:space-x-6">

                <div className="flex-shrink-0 w-20 sm:w-24"> {/* New container for avatar and username */}
                    <div className="flex flex-col items-center mt-6"> {/* Container for avatar and username */}
                        <img
                            src={activity.avatar_url || `https://placehold.co/40x40/E0E0E0/B0B0B0?text=${(activity.display_name?.charAt(0) || 'U').toUpperCase()}`}
                            alt="Avatar"
                            className="w-12 h-12 rounded-full object-cover cursor-pointer"
                            onClick={() => navigate(`/profile/${activity.user_id}`)}
                        />
                        <span className="text-xs font-medium text-gray-800 mt-1 cursor-pointer hover:underline" onClick={() => navigate(`/profile/${activity.user_id}`)}> {/* Username below avatar */}
                            {activity.username}
                        </span>
                        <div className="flex items-center mt-0">
                            <div className="flex items-center text-sm font-medium text-gray-800 mr-1"><Flame size={16} className="inline-block mr-0 text-red-500" />{activity.current_momentum}</div> {/* ignore {activity.current_momentum} first */}
                            <div className="w-14 bg-gray-300 rounded-full h-2 flex-grow mr-2">
                                <div
                                    className={`${energyColor} h-2 rounded-full`}
                                    style={{ width: `${activity.current_energy}%` }}
                                ></div>

                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1"> {/* Adjusted margin top to account for timestamp */}
                    <div className="flex justify-between items-center mb-2"> {/* Container for location and timestamp */}
                        {/* Timestamp div (without absolute positioning) */}
                        <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(activity.activity_timestamp), { addSuffix: true })}
                        </p>

                        {/* Location div (without absolute positioning) */}
                        {activity.location_tag && activity.location_tag !== 'Location Hidden' && ( // Conditional rendering for location
                            <p className="text-xs text-gray-500 truncate max-w-32">
                                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    📍{activity.location_tag}
                                </a>
                            </p>
                        )}

                    </div>
                    <div className={`border ${activityClassColor(activity.activity_class)} p-2 rounded flex justify-between items-center`}>
                        <div>
                            <div>
                                <p className="font-medium text-gray-800 text-sm">
                                    <span className="font-medium">{activity.details_value} {activity.details_units} </span>
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800 text-sm">
                                    <span className="font-semibold">{activity.activity_label || 'an activity'}</span>{' '}
                                    {getEmojiForActivityClass(activity.activity_class)}
                                </p>
                            </div>
                        </div>
                        <div>
                            <p className="text-gray-800 italic font-semibold text-lg">{activity.energy_gained}<Zap size={16} className="inline-block ml-1 text-yellow-500" /></p>
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <button onClick={handleBumpToggle} className="flex items-center space-x-1 text-gray-500 hover:text-red-500 transition-colors">
                            <Heart
                                size={18}
                                className={bumpState.viewerHasBumped ? 'text-red-500 fill-current' : 'text-gray-400'}
                            />
                            <span className="font-medium text-xs">{bumpState.count}</span>
                        </button>
                        {activity.goal_description && (
                            <p className="text-sm text-green-600 truncate max-w-32">"{activity.goal_description}"</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
