import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const LogActivityPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activityLabel, setActivityLabel] = useState('');
    const [customLabel, setCustomLabel] = useState(''); // Keep for now, but it won't be used if activity is always derived from goal
    const [timestamp, setTimestamp] = useState(new Date().toISOString().slice(0, 16)); // For datetime-local input
    const [locationTag, setLocationTag] = useState('');
    const [hideLocation, setHideLocation] = useState(false);
    const [detailsValue, setDetailsValue] = useState('');
    const [detailsUnits, setDetailsUnits] = useState('');
    const [proofFile, setProofFile] = useState(null);
    const [selectedGoal, setSelectedGoal] = useState(''); // ID of the goal this activity contributes to

    const [preConfiguredActivities, setPreConfiguredActivities] = useState([]);
    const [userGoals, setUserGoals] = useState([]);
    const [availableUnits, setAvailableUnits] = useState([]); // New state for available units

    useEffect(() => {
        fetchActivities();
        fetchUserGoals();
    }, []);

    useEffect(() => {
        if (selectedGoal) {
            const goal = userGoals.find(g => g.id === selectedGoal);
            if (goal) {
                const activity = preConfiguredActivities.find(act => act.id === goal.activity_id);
                if (activity) {
                    setActivityLabel(activity.id); // Set activityLabel to the ID of the activity
                } else {
                    setActivityLabel(''); // Reset if activity not found
                }
            }
        } else {
            setActivityLabel(''); // Reset activityLabel if no goal is selected
        }
    }, [selectedGoal, userGoals, preConfiguredActivities]);

    useEffect(() => {
        const currentActivity = preConfiguredActivities.find(act => act.id === activityLabel);
        if (currentActivity && currentActivity.allowed_units && currentActivity.allowed_units.length > 0) {
            setAvailableUnits(currentActivity.allowed_units);
            if (!currentActivity.allowed_units.includes(detailsUnits)) {
                setDetailsUnits(''); // Reset detailsUnits if current unit is not allowed
            }
        } else {
            setAvailableUnits([]);
            setDetailsUnits(''); // Clear units if no activity or no allowed units
        }
    }, [activityLabel, preConfiguredActivities, detailsUnits]); // Added detailsUnits to dependency array


    const fetchActivities = async () => {
        const { data, error } = await supabase
            .from('activity_reference')
            .select('id, activity_class, activity_label, allowed_units') // Include allowed_units
            .order('activity_class', { ascending: true })
            .order('activity_label', { ascending: true });

        if (error) {
            console.error("Error fetching activities:", error);
        } else {
            setPreConfiguredActivities(data);
        }
    };

    const fetchUserGoals = async () => {
        setLoading(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error("User not logged in or error fetching user:", userError);
            navigate('/login'); // Redirect to login if not authenticated
            return;
        }

        const { data: goalsData, error: goalsError } = await supabase
            .from('goals')
            .select('id, goal_description, activity_id')
            .eq('user_id', user.id)
            .eq('is_active', true) // Only fetch active goals
            .order('created_at', { ascending: false });

        if (goalsError) {
            console.error("Error fetching user goals:", goalsError);
        } else {
            setUserGoals(goalsData);
        }
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            console.error("User not logged in:", userError);
            alert("You must be logged in to log an activity.");
            setLoading(false);
            return;
        }

        let proofUrl = null;
        if (proofFile) {
            const fileExtension = proofFile.name.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExtension}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('activity-proofs')
                .upload(fileName, proofFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error("Error uploading proof:", uploadError);
                alert("Error uploading proof: " + uploadError.message);
                setLoading(false);
                return;
            }
            proofUrl = uploadData.path; // This is the path within the bucket
        }

        const activityToInsert = {
            user_id: user.id,
            goal_id: selectedGoal || null,
            activity_id: activityLabel || null, // Use activityLabel which holds the activity ID
            timestamp: timestamp,
            location_tag: hideLocation ? (locationTag ? 'Location Hidden' : '') : locationTag,
            location_is_hidden: hideLocation,
            details_value: detailsValue ? (isNaN(detailsValue) ? detailsValue : parseFloat(detailsValue)) : null,
            details_units: detailsUnits || null,
            proof_url: proofUrl,
            energy_gained: null, // Removed as per user's manual edit
        };

        // Step 2: Call the RPC function with the form data.
        const { data: rpcData, error: rpcError } = await supabase.rpc('log_activity', {
            goal_id_input: selectedGoal || null,
            activity_id_input: activityLabel || null,
            timestamp_input: timestamp,
            location_tag_input: locationTag,
            location_is_hidden_input: hideLocation,
            details_value_input: detailsValue || null,
            details_units_input: detailsUnits || null,
            proof_url_input: proofUrl
        });

        // Step 3: Handle the response from the RPC function.
        if (rpcError) {
            console.error("Error logging activity via RPC:", rpcError);
            alert("Error logging activity: " + rpcError.message);
        } else {
            console.log('Activity logged successfully:', rpcData);
            alert('Activity logged successfully!');
            // Reset the form (this logic stays the same)
            setActivityLabel('');
            setCustomLabel('');
            setTimestamp(new Date().toISOString().slice(0, 16));
            setLocationTag('');
            setHideLocation(false);
            setDetailsValue('');
            setDetailsUnits('');
            setProofFile(null);
            setSelectedGoal('');
        }
        setLoading(false);
    };

    // Group activities by activity_class for optgroup display (still useful for understanding preConfiguredActivities)
    const groupedActivities = preConfiguredActivities.reduce((acc, activity) => {
        const { activity_class } = activity;
        if (!acc[activity_class]) {
            acc[activity_class] = [];
        }
        acc[activity_class].push(activity);
        return acc;
    }, {});

    if (loading) {
        return <div className="p-6 text-center text-gray-600">Loading form...</div>;
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-lg mx-auto">
                <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Log New Activity</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="selectedGoal" className="block text-sm font-medium text-gray-700">Contributes to Goal</label>
                        <select
                            id="selectedGoal"
                            value={selectedGoal ? `${selectedGoal}|${preConfiguredActivities.find(act => act.id === userGoals.find(g => g.id === selectedGoal)?.activity_id)?.activity_class || ''}` : ''}
                            onChange={(e) => {
                                const [goalId, activityClass] = e.target.value.split('|');
                                setSelectedGoal(goalId);
                                // activityClass is now available here if needed, but the useEffect already handles finding the activity
                            }}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                            <option value="">Select Goal (Optional)</option>
                            {userGoals.map(goal => {
                                const activity = preConfiguredActivities.find(act => act.id === goal.activity_id);
                                return (
                                    <option key={goal.id} value={`${goal.id}|${activity ? activity.activity_class : ''}`}>
                                        {goal.goal_description} ({activity ? activity.activity_label : 'Unknown Activity'})
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="activityLabel" className="block text-sm font-medium text-gray-700">Activity</label>
                        <select
                            id="activityLabel"
                            value={activityLabel}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            disabled // Always disabled
                        >
                            <option value="">
                                {selectedGoal ?
                                    (preConfiguredActivities.find(act => act.id === activityLabel)?.activity_label || 'Loading Activity...')
                                    : 'Select a Goal to choose Activity'}
                            </option>
                            {/* Options are dynamically set by selectedGoal useEffect, no direct selection here */}
                        </select>
                    </div>

                    {/* Custom label input is removed as activity is now strictly derived from goal */}
                    {/* {activityLabel === 'Custom' && (
                        <div>
                            <label htmlFor="customLabel" className="block text-sm font-medium text-gray-700">Custom Activity Name</label>
                            <input
                                type="text"
                                id="customLabel"
                                value={customLabel}
                                onChange={(e) => setCustomLabel(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="e.g., Morning Walk"
                            />
                        </div>
                    )} */}

                    <div>
                        <label htmlFor="timestamp" className="block text-sm font-medium text-gray-700">When</label>
                        <input
                            type="datetime-local"
                            id="timestamp"
                            value={timestamp}
                            onChange={(e) => setTimestamp(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="locationTag" className="block text-sm font-medium text-gray-700">Where (Optional)</label>
                        <input
                            type="text"
                            id="locationTag"
                            value={locationTag}
                            onChange={(e) => setLocationTag(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="e.g., Anytime Fitness (Buona Vista)"
                        />
                        <div className="mt-1 flex items-center">
                            <input
                                id="hideLocation"
                                type="checkbox"
                                checked={hideLocation}
                                onChange={(e) => setHideLocation(e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="hideLocation" className="ml-2 block text-sm text-gray-900">Hide actual location details</label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">How (Details)</label>
                        <div className="flex space-x-2 mt-1">
                            <input
                                type="text"
                                value={detailsValue}
                                onChange={(e) => setDetailsValue(e.target.value)}
                                className="block w-1/2 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="e.g., 5 or 30"
                            />
                            {availableUnits.length > 0 ? (
                                <select
                                    value={detailsUnits}
                                    onChange={(e) => setDetailsUnits(e.target.value)}
                                    className="block w-1/2 px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                >
                                    <option value="">Select Unit</option>
                                    {availableUnits.map(unit => (
                                        <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={detailsUnits}
                                    onChange={(e) => setDetailsUnits(e.target.value)}
                                    className="block w-1/2 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="e.g., km or mins or rounds"
                                />
                            )}
                        </div>
                    </div>


                    <div>
                        <label htmlFor="proofFile" className="block text-sm font-medium text-gray-700">Proof (Optional)</label>
                        <input
                            type="file"
                            id="proofFile"
                            onChange={(e) => setProofFile(e.target.files[0])}
                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Log Activity
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LogActivityPage;
