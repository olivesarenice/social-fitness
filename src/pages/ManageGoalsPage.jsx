import { CheckCircle, Edit, MinusCircle, PlusCircle, Trash2, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ManageGoalsPage = () => {
    // --- STATE MANAGEMENT ---
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [goals, setGoals] = useState([]);
    const [profile, setProfile] = useState(null);
    const [activities, setActivities] = useState([]); // For dropdowns
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null); // null or goal object being edited
    const [newGoal, setNewGoal] = useState({
        activity_id: '',
        goal_description: '',
        frequency: '',
        period: 'weekly',
        start_date: new Date().toISOString().split('T')[0],
    });

    // --- UI HELPER FUNCTIONS ---
    const classEmojis = {
        Strength: '🛡️', Balance: '❤️', Speed: '🪽', Skill: '🎯', Extreme: '☠️'
    };
    const getEmojiForClassLabel = (activityClass) => {
        const emoji = classEmojis[activityClass] || '';
        return emoji ? `${emoji} ${activityClass}` : activityClass;
    };
    const activityClassColors = [
        'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800',
        'bg-purple-100 text-purple-800', 'bg-yellow-100 text-yellow-800',
        'bg-red-100 text-red-800', 'bg-indigo-100 text-indigo-800',
    ];
    const [colorMap, setColorMap] = useState(new Map());
    const getColorForClass = (activityClass) => {
        if (!colorMap.has(activityClass)) {
            const newColorMap = new Map(colorMap);
            newColorMap.set(activityClass, activityClassColors[newColorMap.size % activityClassColors.length]);
            setColorMap(newColorMap);
        }
        return colorMap.get(activityClass);
    };

    // --- DATA FETCHING & SIDE EFFECTS ---
    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/login');
            return;
        }

        // Fetch reference activities for UI dropdowns (this is fine on the client)
        const { data: activityRefData } = await supabase.from('activity_reference').select('id, activity_class, activity_label').order('activity_class').order('activity_label');
        setActivities(activityRefData || []);

        // Fetch main page data (profile + goals) with a single RPC call
        const { data: pageData, error: pageError } = await supabase.rpc('get_manage_goals_data');

        if (pageError) {
            console.error("Error fetching page data:", pageError);
            alert("Error fetching your goals: " + pageError.message);
        } else {
            setProfile(pageData.profile);
            // The RPC returns {goal: {...}, activity: {...}}, let's flatten it for easier use in the UI
            const formattedGoals = pageData.goals.map(item => ({
                ...item.goal,
                activity_label: item.activity.activity_label,
                activity_class: item.activity.activity_class,
            }));
            setGoals(formattedGoals);
        }
        setLoading(false);
    }, [navigate]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (editingGoal) {
            setEditingGoal({ ...editingGoal, [name]: value });
        } else {
            setNewGoal({ ...newGoal, [name]: value });
        }
    };

    // --- RPC-BASED HANDLER FUNCTIONS ---
    const handleCreateGoal = async (e) => {
        e.preventDefault();
        const { data, error } = await supabase.rpc('create_goal', {
            activity_id_input: newGoal.activity_id,
            goal_description_input: newGoal.goal_description,
            frequency_input: parseInt(newGoal.frequency),
            start_date_input: newGoal.start_date
        });

        if (error) {
            console.error("Error creating goal:", error);
            alert('Error creating goal: ' + error.message);
        } else {
            // --- THE FIX IS HERE ---
            const activityInfo = activities.find(a => a.id === data.activity_id);
            const newGoalData = {
                ...data, // The full goal object from the RPC with the correct UUID 'id'
                // Explicitly add the properties you need from the activity reference
                activity_label: activityInfo?.activity_label,
                activity_class: activityInfo?.activity_class,
            };
            // --- END FIX ---

            setGoals([newGoalData, ...goals]);
            setShowCreateForm(false);
            setNewGoal({ activity_id: '', goal_description: '', frequency: '', period: 'weekly', start_date: new Date().toISOString().split('T')[0] });
        }
    };

    const handleUpdateGoal = async (e) => {
        e.preventDefault();
        if (!editingGoal) return;
        const { id, activity_id, goal_description, frequency, start_date } = editingGoal;

        const { data, error } = await supabase.rpc('update_goal', {
            goal_id_input: id,
            activity_id_input: activity_id,
            goal_description_input: goal_description,
            frequency_input: parseInt(frequency),
            start_date_input: start_date
        });

        if (error) {
            console.error("Error updating goal:", error);
            alert('Error updating goal: ' + error.message);
        } else {
            // --- THE FIX IS HERE ---
            const activityInfo = activities.find(a => a.id === data.activity_id);
            const updatedGoalData = {
                ...data,
                activity_label: activityInfo?.activity_label,
                activity_class: activityInfo?.activity_class,
            };
            // --- END FIX ---

            setGoals(goals.map(g => (g.id === id ? updatedGoalData : g)));
            setEditingGoal(null);
        }
    };

    const handleToggleGoalActive = async (goal) => {
        const { data, error } = await supabase.rpc('toggle_goal_active', {
            goal_id_input: goal.id,
            new_is_active_input: !goal.is_active
        });

        if (error) {
            console.error("Error toggling goal status:", error);
            alert('Error toggling goal status: ' + error.message);
        } else {
            // --- THE FIX IS HERE ---
            const activityInfo = activities.find(a => a.id === data.activity_id);
            const updatedGoalData = {
                ...data,
                activity_label: activityInfo?.activity_label,
                activity_class: activityInfo?.activity_class,
            };
            // --- END FIX ---

            setGoals(goals.map(g => (g.id === goal.id ? updatedGoalData : g)));
        }
    };

    const handleDeleteGoal = async (goalId) => {
        if (!window.confirm('Are you sure you want to delete this goal? This action cannot be undone.')) return;

        const { data, error } = await supabase.rpc('delete_goal', { goal_id_input: goalId });

        if (error) {
            console.error("Error deleting goal:", error);
            alert('Error deleting goal: ' + error.message);
        } else {
            setGoals(goals.filter(g => g.id !== data.deleted_id));
        }
    };

    // --- JSX RENDERING ---
    if (loading) {
        return <div className="p-6 text-center text-gray-600">Loading your goals...</div>;
    }

    const groupedActivities = activities.reduce((acc, activity) => {
        const { activity_class } = activity;
        if (!acc[activity_class]) acc[activity_class] = [];
        acc[activity_class].push(activity);
        return acc;
    }, {});

    return (
        <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-800">Manage Your Goals</h1>

            {/* Create New Goal Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Create New Goal</h2>
                <p className="text-sm text-gray-600 mb-4">You have {goals.filter(g => g.is_active).length} / {profile?.goal_slots || 1} active goal slots used.</p>
                {!showCreateForm && (
                    <div className="flex flex-col items-center">
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className={`w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${goals.filter(g => g.is_active).length >= (profile?.goal_slots || 1) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
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
                        {/* Form fields for creating a goal (activity_id, description, frequency, start_date) */}
                        <div>
                            <label htmlFor="activity_id" className="block text-sm font-medium text-gray-700">Activity</label>
                            <select id="activity_id" name="activity_id" value={newGoal.activity_id} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required>
                                <option value="">Select an activity</option>
                                {Object.keys(groupedActivities).map(activityClass => (
                                    <optgroup key={activityClass} label={getEmojiForClassLabel(activityClass)} className={`font-semibold ${getColorForClass(activityClass)}`}>
                                        {groupedActivities[activityClass].map(activity => (
                                            <option key={activity.id} value={activity.id}>{activity.activity_label}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="goal_description" className="block text-sm font-medium text-gray-700">Goal Description</label>
                            <textarea id="goal_description" name="goal_description" value={newGoal.goal_description} onChange={handleInputChange} rows="3" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="e.g., Run 3 times a week to prepare for a marathon." required></textarea>
                        </div>
                        <div>
                            <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">How many times per week?</label>
                            <input type="number" id="frequency" name="frequency" value={newGoal.frequency} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="e.g., 3" required />
                        </div>
                        <div>
                            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">Start Date</label>
                            <input type="date" id="start_date" name="start_date" value={newGoal.start_date} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
                        </div>
                        <div className="flex gap-3">
                            <button type="submit" className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Create Goal</button>
                            <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                        </div>
                    </form>
                )}
            </div>

            {/* Active Goals List */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Your Active Goals</h2>
                <div className="space-y-4">
                    {goals.filter(g => g.is_active).length === 0 && <p className="text-gray-500">No active goals. Create one above!</p>}
                    {goals.filter(g => g.is_active).map(goal => (
                        <div key={goal.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            {editingGoal?.id === goal.id ? (
                                <form onSubmit={handleUpdateGoal} className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                    {/* Edit form fields */}
                                    <div>
                                        <label htmlFor={`edit_activity_id_${goal.id}`} className="block text-sm font-medium text-gray-700">Activity</label>
                                        <select id={`edit_activity_id_${goal.id}`} name="activity_id" value={editingGoal.activity_id} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required>
                                            <option value="">Select an activity</option>
                                            {Object.keys(groupedActivities).map(activityClass => (
                                                <optgroup key={activityClass} label={getEmojiForClassLabel(activityClass)} className={`font-semibold ${getColorForClass(activityClass)}`}>
                                                    {groupedActivities[activityClass].map(activity => (
                                                        <option key={activity.id} value={activity.id}>{activity.activity_label}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor={`edit_goal_description_${goal.id}`} className="block text-sm font-medium text-gray-700">Goal Description</label>
                                        <textarea id={`edit_goal_description_${goal.id}`} name="goal_description" value={editingGoal.goal_description} onChange={handleInputChange} rows="3" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="e.g., Run 3 times a week to prepare for a marathon." required></textarea>
                                    </div>
                                    <div>
                                        <label htmlFor={`edit_frequency_${goal.id}`} className="block text-sm font-medium text-gray-700">How many times per week?</label>
                                        <input type="number" id={`edit_frequency_${goal.id}`} name="frequency" value={editingGoal.frequency} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="e.g., 3" required />
                                    </div>
                                    <div>
                                        <label htmlFor={`edit_start_date_${goal.id}`} className="block text-sm font-medium text-gray-700">Start Date</label>
                                        <input type="date" id={`edit_start_date_${goal.id}`} name="start_date" value={editingGoal.start_date} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
                                    </div>
                                    <div className="flex gap-2 sm:col-span-2">
                                        <button type="submit" className="flex-1 flex items-center justify-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"><CheckCircle size={16} className="mr-1" /> Save</button>
                                        <button type="button" onClick={() => setEditingGoal(null)} className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"><XCircle size={16} className="mr-1" /> Cancel</button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <div className="flex-1">
                                        <p className={`font-medium text-gray-800 ${getColorForClass(goal.activity_class)} px-2 py-1 rounded-md inline-block`}>
                                            {goal.activity_label}
                                            {goal.activity_class && <span className="ml-2 text-xs font-normal opacity-75">({getEmojiForClassLabel(goal.activity_class)})</span>}
                                        </p>
                                        <p className="text-sm text-gray-600 italic mt-1">{goal.goal_description}</p>
                                        <p className="text-sm text-gray-600">Target: {goal.frequency} times {goal.period}</p>
                                        <p className="text-xs text-gray-400">Started: {new Date(goal.start_date).toLocaleDateString()}</p>
                                        <p className="text-xs text-gray-500">Completions this period: {goal.completions_for_period}</p>
                                    </div>
                                    <div className="flex gap-2 mt-2 sm:mt-0 self-start">
                                        <button onClick={() => setEditingGoal(goal)} className="p-2 rounded-md text-blue-600 hover:bg-blue-100" title="Edit Goal"><Edit size={18} /></button>
                                        <button onClick={() => handleToggleGoalActive(goal)} className="p-2 rounded-md text-red-600 hover:bg-red-100" title="Deactivate Goal"><MinusCircle size={18} /></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Inactive Goals List */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Your Inactive Goals</h2>
                <div className="space-y-4">
                    {goals.filter(g => !g.is_active).length === 0 && <p className="text-gray-500">No inactive goals.</p>}
                    {goals.filter(g => !g.is_active).map(goal => (
                        <div key={goal.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 opacity-70">
                            <div className="flex-1">
                                <p className={`font-medium text-gray-800 ${getColorForClass(goal.activity_class)} px-2 py-1 rounded-md inline-block`}>
                                    {goal.activity_label} (Inactive)
                                    {goal.activity_class && <span className="ml-2 text-xs font-normal opacity-75">({getEmojiForClassLabel(goal.activity_class)})</span>}
                                </p>
                                <p className="text-sm text-gray-600 italic mt-1">{goal.goal_description}</p>
                            </div>
                            <div className="flex gap-2 mt-2 sm:mt-0 self-start">
                                <button onClick={() => handleToggleGoalActive(goal)} className="p-2 rounded-md text-green-600 hover:bg-green-100" title="Activate Goal"><CheckCircle size={18} /></button>
                                <button onClick={() => handleDeleteGoal(goal.id)} className="p-2 rounded-md text-red-600 hover:bg-red-100" title="Delete Goal"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ManageGoalsPage;
