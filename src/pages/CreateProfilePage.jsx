import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const CreateProfilePage = () => {
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    // Username validation state
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [usernameAvailable, setUsernameAvailable] = useState(true);

    const debounceTimeoutRef = React.useRef(null);
    const DEBOUNCE_DELAY = 2000;

    const checkUsernameAvailability = React.useCallback(async (currentUsername) => {
        if (!currentUsername.trim()) {
            setUsernameError(''); setUsernameAvailable(true); return;
        }
        setIsCheckingUsername(true);
        setUsernameError('');

        const { data: isAvailable, error } = await supabase.rpc('check_username_availability', {
            username_to_check: currentUsername
        });

        if (error) {
            console.error('Error checking username:', error);
            setUsernameError('Error checking username.');
            setUsernameAvailable(false);
        } else {
            setUsernameAvailable(isAvailable);
            if (!isAvailable) {
                setUsernameError('Username is not available!');
            }
        }
        setIsCheckingUsername(false);
    }, []);

    useEffect(() => {
        if (!username.trim()) {
            setUsernameError(''); setUsernameAvailable(true);
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
            return;
        }
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        setIsCheckingUsername(true);
        setUsernameError('');
        debounceTimeoutRef.current = setTimeout(() => {
            checkUsernameAvailability(username);
        }, DEBOUNCE_DELAY);
        return () => clearTimeout(debounceTimeoutRef.current);
    }, [username, checkUsernameAvailability]);

    useEffect(() => {
        const fetchUser = async () => {
            const { data, error } = await supabase.auth.getUser();
            if (error || !data.user) {
                navigate('/login');
            } else {
                setUser(data.user);
                setDisplayName(data.user.user_metadata?.full_name || '');
            }
        };
        fetchUser();
    }, [navigate]);

    const handleProfileCreation = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        if (!username.trim()) {
            setError('Username is required.');
            setLoading(false);
            return;
        }

        if (!usernameAvailable || isCheckingUsername) {
            setError('Username is not available or still being checked.');
            setLoading(false);
            return;
        }

        try {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    id: user?.id,
                    username: username.trim(),
                    display_name: displayName.trim(),
                    avatar_url: user?.user_metadata?.avatar_url || '',
                    is_public: true
                }]);

            if (profileError) {
                throw profileError;
            }

            setMessage('Profile created successfully! Redirecting...');
            setTimeout(() => navigate('/'), 2000);

        } catch (error) {
            console.error('Error creating profile:', error);
            setError(error.message || 'An error occurred while creating your profile.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center text-gray-800">Complete Your Profile</h2>
                <p className="text-center text-gray-600">Just a few more details to get you started.</p>

                {message && <p className="text-sm text-center text-green-600 bg-green-100 p-3 rounded-md">{message}</p>}
                {error && <p className="text-sm text-center text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}

                <form onSubmit={handleProfileCreation} className="space-y-6">
                    <div>
                        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">Display Name</label>
                        <input
                            id="displayName"
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="Your Name"
                        />
                    </div>
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className={`mt-1 block w-full px-4 py-3 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none sm:text-sm ${usernameError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
                            placeholder="@yourusername"
                        />
                        {isCheckingUsername && username.trim() !== '' && (
                            <p className="mt-1 text-xs text-gray-500">Checking availability...</p>
                        )}
                        {usernameError && username.trim() !== '' && (
                            <p className="mt-1 text-xs text-red-500">{usernameError}</p>
                        )}
                        {!isCheckingUsername && !usernameError && username.trim() !== '' && usernameAvailable && (
                            <p className="mt-1 text-xs text-green-500">Username available!</p>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !username.trim() || !usernameAvailable || isCheckingUsername}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Complete Profile'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateProfilePage;
