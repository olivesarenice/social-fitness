import { Lock, Search as SearchIcon, UserPlus } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const SearchPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isInitialView, setIsInitialView] = useState(true);
    const navigate = useNavigate();
    const debounceTimeoutRef = useRef(null);

    // Function to get the initial list of latest users
    const fetchLatestUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        setIsInitialView(true);

        // CHANGED: Call the RPC with the new limit_count parameter
        const { data, error } = await supabase.rpc('get_latest_users', {
            limit_count: 10
        });

        if (error) {
            console.error("Error fetching latest users:", error);
            setError("Could not load new users.");
        } else {
            setResults(data || []);
        }
        setLoading(false);
    }, []);

    // Fetch initial data when the component mounts
    useEffect(() => {
        fetchLatestUsers();
    }, [fetchLatestUsers]);

    // This useEffect handles debounced searching as the user types
    useEffect(() => {
        // Clear any existing timeout
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        // If the query is empty, show the latest users again
        if (!searchQuery.trim()) {
            fetchLatestUsers();
            return;
        }

        // Set a new timeout to perform the search
        debounceTimeoutRef.current = setTimeout(async () => {
            setLoading(true);
            setError(null);
            setIsInitialView(false);

            const { data, error } = await supabase.rpc('search_users', {
                search_term: searchQuery.trim()
            });

            if (error) {
                console.error("Error searching users:", error);
                setError("An error occurred during search.");
                setResults([]);
            } else {
                setResults(data || []);
            }
            setLoading(false);
        }, 300); // 300ms debounce delay

        // Cleanup function to clear timeout if component unmounts
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [searchQuery, fetchLatestUsers]);


    return (
        <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-800">Discover Users</h1>
            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Search by username or display name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            {error && <p className="text-center text-red-500">{error}</p>}

            <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-700">
                    {isInitialView ? 'Newest Members' : `Search Results for "${searchQuery}"`}
                </h2>

                {loading ? (
                    <p className="text-center text-gray-500 py-8">Loading...</p>
                ) : results.length > 0 ? (
                    results.map(user => (
                        <div
                            key={user.id}
                            className="flex items-center p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => navigate(`/profile/${user.id}`)}
                        >
                            <img
                                src={user.avatar_url || `https://placehold.co/40x40/E0E0E0/B0B0B0?text=${(user.display_name?.charAt(0) || user.username?.charAt(0) || 'U').toUpperCase()}`}
                                alt="Avatar"
                                className="w-10 h-10 rounded-full object-cover mr-4"
                            />
                            <div className="flex-grow">
                                <p className="font-medium text-gray-800">{user.display_name || user.username}</p>
                                <p className="text-sm text-gray-600">@{user.username}</p>
                            </div>
                            {!user.is_public && (
                                <Lock size={16} className="text-gray-400 mx-2" title="Private Account" />
                            )}
                            {/* A placeholder for a follow button */}
                            <button className="ml-4 px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full hover:bg-blue-200">
                                <UserPlus size={16} />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 px-4 bg-white rounded-lg border">
                        <p className="text-gray-600 font-semibold">No users found.</p>
                        <p className="text-sm text-gray-500 mt-1">Try a different search term.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;
