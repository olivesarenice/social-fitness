import { Lock } from 'lucide-react'; // Import the Lock icon
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const SearchPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    // CHANGED: The search logic now uses the RPC function
    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!searchQuery.trim()) {
            setSearchResults([]);
            setLoading(false);
            return;
        }

        // Call our new, efficient RPC function
        const { data, error } = await supabase.rpc('search_users', {
            search_term: searchQuery.trim()
        });

        if (error) {
            console.error("Error searching users via RPC:", error);
            setError("An error occurred during search.");
            setSearchResults([]);
        } else {
            setSearchResults(data || []);
        }

        setLoading(false);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Search Users</h1>
            <form onSubmit={handleSearch} className="flex gap-4">
                <input
                    type="text"
                    placeholder="Search by username or display name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={loading}
                >
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {error && <p className="text-red-500">{error}</p>}

            <div className="space-y-4">
                {searchResults.length > 0 ? (
                    searchResults.map(user => (
                        <div
                            key={user.id}
                            className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
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
                            {/* CHANGED: Conditionally render the lock icon */}
                            {!user.is_public && (
                                <Lock size={16} className="text-gray-400" />
                            )}
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500">
                        {loading ? 'Searching...' : 'Enter a name to begin your search.'}
                    </p>
                )}
            </div>
        </div>
    );
};

export default SearchPage;