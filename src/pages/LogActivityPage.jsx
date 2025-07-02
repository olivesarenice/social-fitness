import { Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
// Assuming you have a similar helper for this page

const Modal = ({ title, children, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm text-center p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>
            <div className="text-gray-600 mb-6">{children}</div>
            <button onClick={onClose} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">
                OK
            </button>
        </div>
    </div>
);

// NEW: Helper function to get the current local time in the format required by datetime-local input
const getLocalISOString = () => {
    const date = new Date();
    // Adjust for the user's timezone offset to get the correct local time
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - timezoneOffset);
    // Format to "YYYY-MM-DDTHH:MM"
    return localDate.toISOString().slice(0, 16);
};

const LogActivityPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false); // For submit button state
    const [activityLabel, setActivityLabel] = useState('');
    // CHANGED: Use the helper function to correctly initialize to the user's local time
    const [timestamp, setTimestamp] = useState(getLocalISOString());
    const [locationTag, setLocationTag] = useState('');
    const [hideLocation, setHideLocation] = useState(false);
    const [detailsValue, setDetailsValue] = useState('');
    const [detailsUnits, setDetailsUnits] = useState('');
    const [proofFile, setProofFile] = useState(null);
    const [selectedGoal, setSelectedGoal] = useState('');
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });

    const [preConfiguredActivities, setPreConfiguredActivities] = useState([]);
    const [userGoals, setUserGoals] = useState([]);
    const [availableUnits, setAvailableUnits] = useState([]);

    // --- DATA FETCHING & UI LOGIC (No changes needed here) ---
    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/login');
            return;
        }

        // Fetch reference activities and user goals in parallel
        const [activitiesRes, goalsRes] = await Promise.all([
            supabase.from('activity_reference').select('id, activity_class, activity_label, allowed_units').order('activity_class').order('activity_label'),
            supabase.from('goals').select('id, goal_description, activity_id').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })
        ]);

        if (activitiesRes.error) console.error("Error fetching activities:", activitiesRes.error);
        else setPreConfiguredActivities(activitiesRes.data || []);

        if (goalsRes.error) console.error("Error fetching user goals:", goalsRes.error);
        else setUserGoals(goalsRes.data || []);

        setLoading(false);
    }, [navigate]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    useEffect(() => {
        if (selectedGoal) {
            const goal = userGoals.find(g => g.id === selectedGoal);
            if (goal) {
                const activity = preConfiguredActivities.find(act => act.id === goal.activity_id);
                if (activity) {
                    setActivityLabel(activity.id);
                } else {
                    setActivityLabel('');
                }
            }
        } else {
            setActivityLabel('');
        }
    }, [selectedGoal, userGoals, preConfiguredActivities]);

    useEffect(() => {
        const currentActivity = preConfiguredActivities.find(act => act.id === activityLabel);
        if (currentActivity?.allowed_units?.length > 0) {
            setAvailableUnits(currentActivity.allowed_units);
            if (!currentActivity.allowed_units.includes(detailsUnits)) {
                setDetailsUnits('');
            }
        } else {
            setAvailableUnits([]);
            setDetailsUnits('');
        }
    }, [activityLabel, preConfiguredActivities, detailsUnits]);


    // --- FORM SUBMISSION ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedGoal) {
            setModal({ isOpen: true, title: 'Goal Required', message: 'Please select a goal for this activity. Activities must contribute to a goal to earn Energy.' });
            return;
        }

        setIsSubmitting(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setModal({ isOpen: true, title: 'Authentication Error', message: 'You must be logged in to log an activity.' });
            setIsSubmitting(false);
            return;
        }

        let proofUrl = null;
        if (proofFile) {
            const fileExtension = proofFile.name.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExtension}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('activity-proofs')
                .upload(fileName, proofFile);

            if (uploadError) {
                setModal({ isOpen: true, title: 'Upload Error', message: `Error uploading proof: ${uploadError.message}` });
                setIsSubmitting(false);
                return;
            }
            proofUrl = uploadData.path;
        }

        // CHANGED: Convert local datetime string from state to a full UTC ISO string for the database
        const utcTimestamp = new Date(timestamp).toISOString();

        // Call the new RPC that handles all game logic on the server
        const { data: rpcData, error: rpcError } = await supabase.rpc('log_activity_and_update_stats', {
            goal_id_input: selectedGoal,
            activity_id_input: activityLabel,
            timestamp_input: utcTimestamp, // Use the converted UTC timestamp
            location_tag_input: locationTag,
            location_is_hidden_input: hideLocation,
            details_value_input: detailsValue || null,
            details_units_input: detailsUnits || null,
            proof_url_input: proofUrl
        });
        setIsSubmitting(false);
        if (rpcError) {
            console.error("Error logging activity via RPC:", rpcError);
            setModal({ isOpen: true, title: 'Error', children: `Error logging activity: ${rpcError.message}` });
        } else {
            setModal({
                isOpen: true,
                title: 'Activity Logged!',
                children: (
                    <div>
                        <p className="text-lg">You gained</p>
                        <p className="text-6xl font-bold my-2 flex items-center justify-center">
                            <Zap size={60} className="mr-2 text-yellow-500" />
                            {rpcData.energy_gained}
                        </p>
                    </div>
                ),
                onClose: () => navigate('/', { replace: true, state: { leveledUp: rpcData.leveled_up } })
            });
        }

    };


    // --- JSX RENDERING ---
    const groupedActivities = preConfiguredActivities.reduce((acc, activity) => {
        const { activity_class } = activity;
        if (!acc[activity_class]) acc[activity_class] = [];
        acc[activity_class].push(activity);
        return acc;
    }, {});

    if (loading) {
        return <div className="p-6 text-center text-gray-600">Loading form...</div>;
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50">
            {modal.isOpen && (
                <Modal
                    title={modal.title}
                    onClose={() => {
                        setModal({ isOpen: false, title: '', children: null });
                        if (modal.onClose) {
                            modal.onClose();
                        }
                    }}
                >
                    {modal.children}
                </Modal>
            )}
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-lg mx-auto">
                <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Log New Activity</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="selectedGoal" className="block text-sm font-medium text-gray-700">Which goal does this contribute to?</label>
                        <select
                            id="selectedGoal"
                            value={selectedGoal}
                            onChange={(e) => setSelectedGoal(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            required
                        >
                            <option value="">Select a Goal</option>
                            {userGoals.map(goal => {
                                const activity = preConfiguredActivities.find(act => act.id === goal.activity_id);
                                return (
                                    <option key={goal.id} value={goal.id}>
                                        {goal.goal_description} ({activity ? activity.activity_label : '...'})
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="activityLabel" className="block text-sm font-medium text-gray-700">Activity</label>
                        <input
                            id="activityLabel"
                            type="text"
                            value={preConfiguredActivities.find(act => act.id === activityLabel)?.activity_label || 'Select a goal first'}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-gray-100 rounded-md shadow-sm sm:text-sm"
                            disabled
                        />
                    </div>

                    <div>
                        <label htmlFor="timestamp" className="block text-sm font-medium text-gray-700">When did you do it?</label>
                        <input
                            type="datetime-local"
                            id="timestamp"
                            value={timestamp}
                            max={getLocalISOString()}
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
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            placeholder="e.g., The local gym"
                        />
                        <div className="mt-2 flex items-center">
                            <input id="hideLocation" type="checkbox" checked={hideLocation} onChange={(e) => setHideLocation(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                            <label htmlFor="hideLocation" className="ml-2 block text-sm text-gray-900">Hide location details</label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">How much/long? (Details)</label>
                        <div className="flex space-x-2 mt-1">
                            <input
                                type="number"
                                value={detailsValue}
                                onChange={(e) => setDetailsValue(e.target.value)}
                                className="block w-1/2 px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                placeholder="e.g., 5 or 30"
                                required
                            />
                            {availableUnits.length > 0 ? (
                                <select value={detailsUnits} onChange={(e) => setDetailsUnits(e.target.value)} className="block w-1/2 px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm" required>
                                    <option value="">Select Unit</option>
                                    {availableUnits.map(unit => (<option key={unit} value={unit}>{unit}</option>))}
                                </select>
                            ) : (
                                <input type="text" value={detailsUnits} onChange={(e) => setDetailsUnits(e.target.value)} className="block w-1/2 px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="e.g., km, reps" required />
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
                        disabled={isSubmitting || !selectedGoal}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Logging...' : 'Log Activity'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LogActivityPage;
