import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const HomePage = () => {
    // Example: Fetch current user's email to display
    const [userEmail, setUserEmail] = useState('');

    useEffect(() => {
        const fetchUser = async () => {
            if (!supabase) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email);
            }
        };
        fetchUser();
    }, []);


    return (
        <div className="p-4 sm:p-6">
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Home Feed</h1>
                <p className="text-gray-600 mb-4">Welcome to your activity feed, {userEmail || 'User'}!</p>
                {/* This is where you'll map over activity posts from followed users.
          Each post will be a component (e.g., <ActivityCard />).
        */}
                <div className="space-y-4">
                    {/* Placeholder for Activity Cards */}
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <p className="text-sm text-gray-500">11:50AM 20 Dec 2024</p>
                        <p className="font-semibold text-gray-700">@olivesarenice Oliver. Q just did a 5km run at Anytime Fitness (Buona Vista)</p>
                        <p className="text-xs text-green-600">+1 towards "Run 3 times a week"</p>
                        <div className="mt-2 text-xs text-gray-400">Energy: 60% | Momentum: 🔥 5</div>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <p className="text-sm text-gray-500">10:30AM 20 Dec 2024</p>
                        <p className="font-semibold text-gray-700">@anotheruser Jane D. just completed a Yoga Session</p>
                        <p className="text-xs text-green-600">+1 towards "Yoga Daily"</p>
                        <div className="mt-2 text-xs text-gray-400">Energy: 100% | Momentum: 🔥 12</div>
                    </div>
                    {/* Add more placeholder cards or logic to fetch and display actual data */}
                </div>
            </div>
        </div>
    );
};

export default HomePage;