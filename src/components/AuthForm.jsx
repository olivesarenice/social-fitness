import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthForm = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(true); // Toggle between Sign Up and Sign In
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [isPublic, setIsPublic] = useState(true); // State for the privacy toggle

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

    React.useEffect(() => {
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


    const handleAuth = async (event) => {
        event.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        if (!supabase) {
            setError("Supabase client not initialized. Check console.");
            setLoading(false);
            return;
        }

        try {
            let response;
            if (isSignUp) {
                if (!username.trim()) {
                    setError('Username cannot be empty.');
                    setLoading(false);
                    return;
                }
                if (!usernameAvailable || isCheckingUsername) {
                    setError('Username is not available or still being checked.');
                    setLoading(false);
                    return;
                }

                response = await supabase.auth.signUp({ email, password });
                if (response.error) throw response.error;

                const user = response.data.user;

                if (user) {
                    // Create a profile for the new user
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert([
                            { id: user.id, username: username.trim(), display_name: displayName.trim(), avatar_url: '', is_public: isPublic },
                        ]);

                    if (profileError) {
                        console.error("Error creating profile:", profileError);
                        setError("Sign up successful, but failed to create profile. Please try again.");
                    } else {
                        setMessage('Sign up successful! Redirecting...');
                    }
                } else if (response.data.session === null && response.data.user && response.data.user.identities && response.data.user.identities.length === 0) {
                    setMessage('Sign up successful! Please check your email to verify your account.');
                }
                else {
                    // This case might occur if email confirmation is disabled and signup is immediate
                    setMessage('Sign up successful! You can now log in.');
                    setIsSignUp(false); // Switch to login form
                }
            } else {
                response = await supabase.auth.signInWithPassword({ email, password });
                if (response.error) throw response.error;
                setMessage('Sign in successful! Redirecting...');
                // Navigation will be handled by App.jsx's onAuthStateChange
            }
        } catch (error) {
            console.error('Authentication error:', error);
            setError(error.error_description || error.message || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
            <h2 className="text-3xl font-bold text-center text-gray-800">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-center text-gray-600">
                {isSignUp ? 'Join to track your fitness journey!' : 'Log in to continue.'}
            </p>

            {message && <p className="text-sm text-center text-green-600 bg-green-100 p-3 rounded-md">{message}</p>}
            {error && <p className="text-sm text-center text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}

            <form className="space-y-6" onSubmit={handleAuth}>
                <h3 className="text-xl font-semibold text-gray-700 pt-4 border-t border-gray-200">Account</h3>
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email address
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        Password
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete={isSignUp ? "new-password" : "current-password"}
                        required
                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                    />
                </div>

                {isSignUp && (
                    <div className="space-y-6"> {/* New section for additional info */}
                        <h3 className="text-xl font-semibold text-gray-700 pt-4 border-t border-gray-200">Your Profile</h3>
                        <div>
                            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                                Display Name
                            </label>
                            <input
                                id="displayName"
                                name="displayName"
                                type="text"
                                autoComplete="name"
                                className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Your Name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                Username
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                autoComplete="username"
                                required
                                className={`mt-1 block w-full px-4 py-3 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none sm:text-sm ${usernameError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
                                placeholder="@yourusername"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={loading}
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

                        {/* Privacy Setting */}
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium text-gray-700">Make Profile Public</span>
                                <p className="text-xs text-gray-500">
                                    {isPublic
                                        ? "Anyone can see your profile."
                                        : "Your profile will be private."}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isPublic}
                                onClick={() => setIsPublic(!isPublic)}
                                disabled={loading}
                                className={`${isPublic ? 'bg-blue-600' : 'bg-gray-200'
                                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50`}
                            >
                                <span className="sr-only">Use setting</span>
                                <span
                                    aria-hidden="true"
                                    className={`${isPublic ? 'translate-x-5' : 'translate-x-0'
                                        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                                />
                            </button>
                        </div>
                    </div>
                )}

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        Password
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete={isSignUp ? "new-password" : "current-password"}
                        required
                        className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                    />
                </div>
                {isSignUp && (
                    <p className="text-xs text-gray-500">Password should be at least 6 characters.</p>
                )}

                <div>
                    <button
                        type="submit"
                        disabled={loading || (isSignUp && (!username.trim() || !usernameAvailable || isCheckingUsername))}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {loading ? (isSignUp ? 'Signing Up...' : 'Signing In...') : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </div>
            </form>

            <p className="text-sm text-center text-gray-600">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                    onClick={() => {
                        setIsSignUp(!isSignUp);
                        setMessage('');
                        setError('');
                    }}
                    className="font-medium text-blue-600 hover:text-blue-500"
                    disabled={loading}
                >
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
            </p>
        </div>
    );
};

export default AuthForm;
