import { CheckCircle, Edit, PlusCircle, Trash2, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ManageGoalsPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [goals, setGoals] = useState([]);
    const [profile, setProfile] = useState(null);
    const [activities, setActivities] = useState([]); // New state for activity_reference
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null); // null or goal object being edited

    const [newGoal, setNewGoal] = useState({
        activity_id: '', // Changed from activity_label
        goal_description: '',
        frequency: '',
        period: 'weekly',
        start_date: new Date().toISOString().split('T')[0],
    });

    // Emoji mapping for activity classes
    const classEmojis = {
        Strength: '🛡️',
        Balance: '❤️',
        Speed: '🪽',
        Skill: '🎯',
        Extreme: '☠️'
    };

    const getEmojiForClassLabel = (activityClass) => {
        const emoji = classEmojis[activityClass] || '';
        return emoji ? `${emoji} ${activityClass}` : activityClass;
    };

    // Dynamic color mapping for activity classes
    const activityClassColors = [
        'bg-blue-100 text-blue-800',
        'bg-green-100 text-green-800',
        'bg-purple-100 text-purple-800',
        'bg-yellow-100 text-yellow-800',
        'bg-red-100 text-red-800',
        'bg-indigo-100 text-indigo-800',
        'bg-pink-100 text-pink-800',
        'bg-gray-100 text-gray-800',
    ];
    const [colorMap, setColorMap] = useState(new Map());

    const getColorForClass = (activityClass) => {
        if (!colorMap.has(activityClass)) {
            const newColorMap = new Map(colorMap);
            newColorMap.set(activityClass, activityClassColors[colorMap.size % activityClassColors.length]);
            setColorMap(newColorMap);
        }
        return colorMap.get(activityClass);
    };

    useEffect(() => {
        fetchGoalsAndProfile();
        fetchActivities(); // Fetch activities on component mount
    }, []);

    const fetchActivities = async () => {
        const { data, error } = await supabase
            .from('activity_reference')
            .select('id, activity_class, activity_label')
            .order('activity_class', { ascending: true })
            .order('activity_label', { ascending: true });

        if (error) {
            console.error("Error fetching activities:", error);
        } else {
            setActivities(data);
        }
    };

    const fetchGoalsAndProfile = async () => {
        setLoading(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error("User not logged in or error fetching user:", userError);
            navigate('/login'); // Redirect to login if not authenticated
            return;
        }
        console.log("fetchGoalsAndProfile: Current user:", user); // Log user in fetch

        // Fetch profile to get goal_slots
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('goal_slots')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error("Error fetching profile:", profileError);
            setLoading(false);
            return;
        }
        setProfile(profileData);

        // Fetch goals for the current user, selecting activity_id
        const { data: goalsData, error: goalsError } = await supabase
            .from('goals')
            .select('*, goal_description, activity_id') // Include activity_id
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (goalsError) {
            console.error("Error fetching goals:", goalsError);
        } else {
            setGoals(goalsData);
        }
        setLoading(false);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (editingGoal) {
            setEditingGoal({ ...editingGoal, [name]: value });
        } else {
            setNewGoal({ ...newGoal, [name]: value });
        }
    };

    const handleCreateGoal = async (e) => {
        e.preventDefault();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error("handleCreateGoal: User not found, cannot create goal.");
            alert("You must be logged in to create a goal.");
            return;
        }
        console.log("handleCreateGoal: User ID for insert:", user.id);

        if (goals.filter(g => g.is_active).length >= (profile?.goal_slots || 1)) {
            alert('You have reached your maximum active goal slots. Deactivate an existing goal to create a new one.');
            return;
        }

        const goalToInsert = {
            user_id: user.id,
            activity_id: newGoal.activity_id, // Changed from activity_label
            goal_description: newGoal.goal_description,
            frequency: parseInt(newGoal.frequency),
            period: 'weekly',
            start_date: newGoal.start_date,
            is_active: true,
            completions_for_period: 0,
        };

        const { data, error } = await supabase
            .from('goals')
            .insert([goalToInsert])
            .select();

        if (error) {
            console.error("Error creating goal:", error);
            alert('Error creating goal: ' + error.message);
        } else {
            setGoals([data[0], ...goals]);
            setNewGoal({
                activity_id: '', // Reset new field
                goal_description: '',
                frequency: '',
                period: 'weekly',
                start_date: new Date().toISOString().split('T')[0],
            });
            setShowCreateForm(false);
        }
    };

    const handleUpdateGoal = async (e) => {
        e.preventDefault();
        if (!editingGoal) return;

        const { id, activity_id, goal_description, frequency, start_date, is_active } = editingGoal; // Changed from activity_label

        const { data, error } = await supabase
            .from('goals')
            .update({
                activity_id, // Changed from activity_label
                goal_description,
                frequency: parseInt(frequency),
                period: 'weekly',
                start_date,
                is_active
            })
            .eq('id', id)
            .select();

        if (error) {
            console.error("Error updating goal:", error);
            alert('Error updating goal: ' + error.message);
        } else {
            setGoals(goals.map(g => (g.id === id ? data[0] : g)));
            setEditingGoal(null);
        }
    };

    const handleDeleteGoal = async (goalId) => {
        if (!window.confirm('Are you sure you want to delete this goal? This action cannot be undone.')) {
            return;
        }
        const { error } = await supabase
            .from('goals')
            .delete()
            .eq('id', goalId);

        if (error) {
            console.error("Error deleting goal:", error);
            alert('Error deleting goal: ' + error.message);
        } else {
            setGoals(goals.filter(g => g.id !== goalId));
        }
    };

    const handleToggleGoalActive = async (goal) => {
        const newIsActive = !goal.is_active;

        if (newIsActive && goals.filter(g => g.is_active).length >= (profile?.goal_slots || 1)) {
            alert('You have reached your maximum active goal slots. Deactivate an existing goal to activate this one.');
            return;
        }

        const { data, error } = await supabase
            .from('goals')
            .update({ is_active: newIsActive })
            .eq('id', goal.id)
            .select();

        if (error) {
            console.error("Error toggling goal status:", error);
            alert('Error toggling goal status: ' + error.message);
        } else {
            setGoals(goals.map(g => (g.id === goal.id ? data[0] : g)));
        }
    };

    if (loading) {
        return <div className="p-6 text-center text-gray-600">Loading goals and activities...</div>;
    }

    // Group activities by activity_class
    const groupedActivities = activities.reduce((acc, activity) => {
        const { activity_class } = activity;
        if (!acc[activity_class]) {
            acc[activity_class] = [];
        }
        acc[activity_class].push(activity);
        return acc;
    }, {});

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Manage Your Goals</h1>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Create New Goal</h2>
                <p className="text-sm text-gray-600 mb-4">You have {goals.filter(g => g.is_active).length} / {profile?.goal_slots || 1} active goal slots used.</p>
                {!showCreateForm && (
                    <div className="flex flex-col items-center">
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className={`w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${goals.filter(g => g.is_active).length >= (profile?.goal_slots || 1)
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700'
                                }`}
                            disabled={goals.filter(g => g.is_active).length >= (profile?.goal_slots || 1)}
                        >
                            <PlusCircle size={16} className="mr-2" /> Add New Goal
                        </button>
                        {goals.filter(g => g.is_active).length >= (profile?.goal_slots || 1) && (
                            <p className="mt-2 text-sm text-red-500">(All Goal Slots used)</p>
                        )}
                    </div>
                )}
                {showCreateForm && (
                    <form onSubmit={handleCreateGoal} className="space-y-4">
                        <div>
                            <label htmlFor="activity_id" className="block text-sm font-medium text-gray-700">Activity</label>
                            <select
                                id="activity_id"
                                name="activity_id"
                                value={newGoal.activity_id}
                                onChange={handleInputChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                required
                            >
                                <option value="">Select an activity</option>
                                {Object.keys(groupedActivities).map(activityClass => (
                                    <optgroup
                                        key={activityClass}
                                        label={getEmojiForClassLabel(activityClass)}
                                        className={`font-semibold ${getColorForClass(activityClass)}`}
                                    >
                                        {groupedActivities[activityClass].map(activity => (
                                            <option key={activity.id} value={activity.id}>
                                                {activity.activity_label}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="goal_description" className="block text-sm font-medium text-gray-700">Goal Description</label>
                            <textarea
                                id="goal_description"
                                name="goal_description"
                                value={newGoal.goal_description}
                                onChange={handleInputChange}
                                rows="3"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                placeholder="e.g., Run 3 times a week to prepare for a marathon."
                                required
                            ></textarea>
                        </div>
                        <div>
                            <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">How many times per week?</label>
                            <input
                                type="number"
                                id="frequency"
                                name="frequency"
                                value={newGoal.frequency}
                                onChange={handleInputChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                placeholder="e.g., 3"
                                required
                            />
                        </div>
                        {/* Period selection removed as it's fixed to weekly */}
                        <div>
                            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">Start Date</label>
                            <input
                                type="date"
                                id="start_date"
                                name="start_date"
                                value={newGoal.start_date}
                                onChange={handleInputChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                required
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                            >
                                Create Goal
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCreateForm(false)}
                                className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Your Active Goals</h2>
                <div className="space-y-4">
                    {goals.filter(g => g.is_active).length === 0 && <p className="text-gray-500">No active goals. Create one above!</p>}
                    {goals.filter(g => g.is_active).map(goal => (
                        <div key={goal.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            {editingGoal?.id === goal.id ? (
                                <form onSubmit={handleUpdateGoal} className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                    <div>
                                        <label htmlFor="edit_activity_id" className="block text-sm font-medium text-gray-700">Activity</label>
                                        <select
                                            id="edit_activity_id"
                                            name="activity_id"
                                            value={editingGoal.activity_id}
                                            onChange={handleInputChange}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                            required
                                        >
                                            <option value="">Select an activity</option>
                                            {Object.keys(groupedActivities).map(activityClass => (
                                                <optgroup
                                                    key={activityClass}
                                                    label={getEmojiForClassLabel(activityClass)}
                                                    className={`font-semibold ${getColorForClass(activityClass)}`}
                                                >
                                                    {groupedActivities[activityClass].map(activity => (
                                                        <option key={activity.id} value={activity.id}>
                                                            {activity.activity_label}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="edit_goal_description" className="block text-sm font-medium text-gray-700">Goal Description</label>
                                        <textarea
                                            id="edit_goal_description"
                                            name="goal_description"
                                            value={editingGoal.goal_description || ''}
                                            onChange={handleInputChange}
                                            rows="2"
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm sm:col-span-2"
                                            placeholder="Goal Description"
                                            required
                                        ></textarea>
                                    </div>
                                    <div>
                                        <label htmlFor="edit_frequency" className="block text-sm font-medium text-gray-700">How many times per week?</label>
                                        <input
                                            type="number"
                                            id="edit_frequency"
                                            name="frequency"
                                            value={editingGoal.frequency}
                                            onChange={handleInputChange}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                            required
                                        />
                                    </div>
                                    {/* Period selection removed as it's fixed to weekly */}
                                    <div>
                                        <label htmlFor="edit_start_date" className="block text-sm font-medium text-gray-700">Start Date</label>
                                        <input
                                            type="date"
                                            id="edit_start_date"
                                            name="start_date"
                                            value={editingGoal.start_date.split('T')[0]} // Ensure date format for input
                                            onChange={handleInputChange}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-2 sm:col-span-2">
                                        <button type="submit" className="flex-1 flex items-center justify-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                                            <CheckCircle size={16} className="mr-1" /> Save
                                        </button>
                                        <button type="button" onClick={() => setEditingGoal(null)} className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                                            <XCircle size={16} className="mr-1" /> Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <div className="flex-1">
                                        {/* Find the activity label and class from activities state */}
                                        {(() => {
                                            const activity = activities.find(act => act.id === goal.activity_id);
                                            const activityLabel = activity ? activity.activity_label : 'Unknown Activity';
                                            const activityClass = activity ? activity.activity_class : '';
                                            const colorClass = activityClass ? getColorForClass(activityClass) : '';
                                            return (
                                                <p className={`font-medium text-gray-800 ${colorClass} px-2 py-1 rounded-md inline-block`}>
                                                    {activityLabel}
                                                    {activityClass && <span className="ml-2 text-xs font-normal opacity-75">({getEmojiForClassLabel(activityClass)})</span>}
                                                </p>
                                            );
                                        })()}
                                        {goal.goal_description && <p className="text-sm text-gray-600 italic">{goal.goal_description}</p>}
                                        <p className="text-sm text-gray-600">Target: {goal.frequency} times {goal.period}</p>
                                        <p className="text-xs text-gray-400">Started: {new Date(goal.start_date).toLocaleDateString()}</p>
                                        <p className="text-xs text-gray-500">Completions this period: {goal.completions_for_period}</p>
                                    </div>
                                    <div className="flex gap-2 mt-2 sm:mt-0">
                                        <button
                                            onClick={() => setEditingGoal(goal)}
                                            className="p-2 rounded-md text-blue-600 hover:bg-blue-100"
                                            title="Edit Goal"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleToggleGoalActive(goal)}
                                            className="p-2 rounded-md text-red-600 hover:bg-red-100"
                                            title="Deactivate Goal"
                                        >
                                            <XCircle size={18} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Your Inactive Goals</h2>
                <div className="space-y-4">
                    {goals.filter(g => !g.is_active).length === 0 && <p className="text-gray-500">No inactive goals.</p>}
                    {goals.filter(g => !g.is_active).map(goal => (
                        <div key={goal.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 opacity-70">
                            <div className="flex-1">
                                {/* Find the activity label and class from activities state */}
                                {(() => {
                                    const activity = activities.find(act => act.id === goal.activity_id);
                                    const activityLabel = activity ? activity.activity_label : 'Unknown Activity';
                                    const activityClass = activity ? activity.activity_class : '';
                                    const colorClass = activityClass ? getColorForClass(activityClass) : '';
                                    return (
                                        <p className={`font-medium text-gray-800 ${colorClass} px-2 py-1 rounded-md inline-block`}>
                                            {activityLabel} (Inactive)
                                            {activityClass && <span className="ml-2 text-xs font-normal opacity-75">({getEmojiForClassLabel(activityClass)})</span>}
                                        </p>
                                    );
                                })()}
                                {goal.goal_description && <p className="text-sm text-gray-600 italic">{goal.goal_description}</p>}
                                <p className="text-sm text-gray-600">Target: {goal.frequency} times {goal.period}</p>
                                <p className="text-xs text-gray-400">Started: {new Date(goal.start_date).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-2 mt-2 sm:mt-0">
                                <button
                                    onClick={() => handleToggleGoalActive(goal)}
                                    className="p-2 rounded-md text-green-600 hover:bg-green-100"
                                    title="Activate Goal"
                                >
                                    <CheckCircle size={18} />
                                </button>
                                <button
                                    onClick={() => handleDeleteGoal(goal.id)}
                                    className="p-2 rounded-md text-red-600 hover:bg-red-100"
                                    title="Delete Goal"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ManageGoalsPage;
