import React, { useState } from 'react';
// import { supabase } from '../supabaseClient'; // If you need to fetch goals or save activity

const LogActivityPage = () => {
    const [activityLabel, setActivityLabel] = useState('');
    const [customLabel, setCustomLabel] = useState('');
    const [locationTag, setLocationTag] = useState('');
    const [hideLocation, setHideLocation] = useState(false);
    const [detailsValue, setDetailsValue] = useState('');
    const [detailsUnits, setDetailsUnits] = useState('');
    const [proofFile, setProofFile] = useState(null);
    const [selectedGoal, setSelectedGoal] = useState(''); // ID of the goal this activity contributes to

    // Placeholder for pre-configured activities and user's goals
    const preConfiguredActivities = ['Run', 'Gym', 'Cycling', 'Swimming', 'Yoga', 'Custom'];
    const userGoals = [
        { id: 'goal1', name: 'Run 3 times a week' },
        { id: 'goal2', name: 'Gym 2 times a week' },
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        const activityData = {
            activity: activityLabel === 'Custom' ? customLabel : activityLabel,
            timestamp: new Date().toISOString(),
            location: hideLocation ? (locationTag ? 'Location Hidden' : '') : locationTag, // Simplified
            goalContribution: selectedGoal,
            details: `${detailsValue} ${detailsUnits}`.trim(),
            proof: proofFile ? proofFile.name : null, // In reality, you'd upload the file
            // who: current user (from Supabase session)
        };
        console.log('Activity to log:', activityData);
        // TODO: Send data to Supabase
        alert('Activity logged (see console)! Implement Supabase saving.');
    };

    return (
        <div className="p-4 sm:p-6">
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-lg mx-auto">
                <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Log New Activity</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="activityLabel" className="block text-sm font-medium text-gray-700">Activity</label>
                        <select
                            id="activityLabel"
                            value={activityLabel}
                            onChange={(e) => setActivityLabel(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                            <option value="">Select Activity</option>
                            {preConfiguredActivities.map(act => <option key={act} value={act}>{act}</option>)}
                        </select>
                    </div>

                    {activityLabel === 'Custom' && (
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
                    )}

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
                        <label htmlFor="selectedGoal" className="block text-sm font-medium text-gray-700">Contributes to Goal</label>
                        <select
                            id="selectedGoal"
                            value={selectedGoal}
                            onChange={(e) => setSelectedGoal(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                            <option value="">Select Goal</option>
                            {userGoals.map(goal => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
                        </select>
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
                            <input
                                type="text"
                                value={detailsUnits}
                                onChange={(e) => setDetailsUnits(e.target.value)}
                                className="block w-1/2 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="e.g., km or mins or rounds"
                            />
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