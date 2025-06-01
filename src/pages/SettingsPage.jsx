import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const SettingsPage = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [initialUsername, setInitialUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [usernameAvailable, setUsernameAvailable] = useState(true);

    const debounceTimeoutRef = useRef(null);
    const DEBOUNCE_DELAY = 500;

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                console.error("Error getting user or no user:", userError);
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('profiles') // Still fetch the full profile from the 'profiles' table
                .select('*')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Error fetching profile:", error);
            }

            if (data) {
                setUsername(data.username || '');
                setInitialUsername(data.username || '');
                setDisplayName(data.display_name || '');
                setAvatarUrl(data.avatar_url || '');
            } else {
                console.warn("No profile found for user ID:", user.id, "A new profile will be created on save.");
            }
            setLoading(false);
        };

        fetchProfile();
    }, []);

    // Memoized function to check username availability against the VIEW
    const checkUsernameAvailability = useCallback(async (currentUsername) => {
        if (!currentUsername.trim()) {
            setUsernameError('');
            setUsernameAvailable(true);
            setIsCheckingUsername(false);
            return;
        }

        setIsCheckingUsername(true);
        setUsernameError('');
        try {
            const { data, error } = await supabase
                .from('all_profile_usernames') // MODIFIED: Changed from 'profiles' to your view name
                .select('username')             // The view must expose a 'username' column
                .eq('username', currentUsername)
                .limit(1);

            if (error) {
                // Check if the error is because the view doesn't exist (code PGRST200 for "Relation not found")
                if (error.code === '42P01' || (error.message && error.message.includes('relation "all_profile_usernames" does not exist'))) { // Error code for "undefined_table"
                    console.error('Error checking username: The view "all_profile_usernames" does not seem to exist or you might lack permissions.', error);
                    setUsernameError('System error: Could not verify username.');
                } else {
                    throw error; // Re-throw other errors
                }
            }


            if (data && data.length > 0) {
                setUsernameAvailable(false);
                setUsernameError('Username is not available!');
            } else if (!error) { // Only set to available if there wasn't an error (like view not found)
                setUsernameAvailable(true);
                setUsernameError('');
            }
        } catch (error) { // Catch errors re-thrown or not specifically handled above
            console.error('Error checking username:', error);
            setUsernameError('Error checking username.');
            setUsernameAvailable(false); // Assume not available on unexpected error
        } finally {
            setIsCheckingUsername(false);
        }
    }, []); // Empty dependency array is fine if 'supabase' is stable


    // useEffect for debouncing username check
    useEffect(() => {
        if (!username.trim() || username === initialUsername) {
            setUsernameError('');
            setUsernameAvailable(true);
            setIsCheckingUsername(false);
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
            return;
        }

        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        setIsCheckingUsername(true);
        setUsernameError('');

        debounceTimeoutRef.current = setTimeout(() => {
            checkUsernameAvailability(username);
        }, DEBOUNCE_DELAY);

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [username, initialUsername, checkUsernameAvailability]);


    const handleSignOut = async () => {
        // ... (sign out logic remains the same)
        setIsSaving(true);
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error signing out:', error);
        }
        setIsSaving(false);
    };

    const handleSaveProfile = async () => {
        // ... (save profile logic remains largely the same)
        // It will still upsert to the main 'profiles' table.
        // The real-time check is just using the view for username availability.
        if (username !== initialUsername && (!usernameAvailable || isCheckingUsername)) {
            alert('Username is not available or still being checked. Please choose another.');
            return;
        }
        if (!username.trim()) {
            alert('Username cannot be empty.');
            return;
        }

        setIsSaving(true);
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                console.error("Error getting user or no user:", userError);
                alert("No user signed in. Please try again.");
                setIsSaving(false);
                return;
            }

            let newAvatarPublicUrl = avatarUrl;

            if (avatarFile) {
                const filePath = `${user.id}/${Date.now()}_${avatarFile.name}`;
                const { data: storageData, error: storageError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, avatarFile, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (storageError) {
                    console.error("Storage Error:", storageError);
                    throw storageError;
                }

                const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(storageData.path);
                if (publicUrlData) {
                    newAvatarPublicUrl = publicUrlData.publicUrl;
                } else {
                    console.warn("Could not get public URL for uploaded avatar.");
                }
            }

            const updates = {
                id: user.id,
                username: username,
                display_name: displayName,
                avatar_url: newAvatarPublicUrl,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase.from('profiles').upsert(updates, { // Still upserts to 'profiles'
                onConflict: 'id',
                returning: 'minimal',
            });

            if (error) {
                console.error("Profile Upsert Error:", error);
                if (error.message.includes('duplicate key value violates unique constraint "profiles_username_key"')) {
                    setUsernameError('Username is not available!');
                    setUsernameAvailable(false);
                    alert('This username is already taken. Please choose another (verified by server).');
                } else if (error.message.includes('new row violates row-level security policy')) {
                    alert('Failed to save profile due to a security policy. Please check your inputs or contact support.');
                }
                else {
                    throw error; // Re-throw for generic error handling
                }
            } else {
                alert('Profile updated successfully!');
                setInitialUsername(username);
                setAvatarUrl(newAvatarPublicUrl);
                setAvatarFile(null);
                setUsernameError('');
                setUsernameAvailable(true);
            }

        } catch (error) {
            console.error("Error updating profile:", error);
            alert('Failed to update profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarChange = (event) => {
        // ... (avatar change logic remains the same)
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarUrl(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // ... (loading JSX and rest of the return statement remains the same)
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-xl text-gray-700">Loading...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-800 mb-6">Settings</h1>
                <div className="space-y-8">
                    {/* Profile Settings */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Profile</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">Display Name</label>
                                <input
                                    type="text"
                                    name="displayName"
                                    id="displayName"
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="Your Name"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    disabled={isSaving}
                                />
                            </div>
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    id="username"
                                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${usernameError && username !== initialUsername ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    placeholder="@yourusername"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={isSaving}
                                />
                                {isCheckingUsername && username !== initialUsername && <p className="mt-1 text-xs text-gray-500">Checking availability...</p>}
                                {usernameError && username !== initialUsername && <p className="mt-1 text-xs text-red-500">{usernameError}</p>}
                                {!isCheckingUsername && !usernameError && username !== initialUsername && username.trim() !== '' && <p className="mt-1 text-xs text-green-500">Username available!</p>}
                            </div>
                            <div>
                                <label htmlFor="avatar" className="block text-sm font-medium text-gray-700">Profile Picture</label>
                                {avatarUrl && <img src={avatarUrl} alt="Avatar Preview" className="mt-2 w-20 h-20 rounded-full object-cover" />}
                                <input
                                    type="file"
                                    name="avatar"
                                    id="avatar"
                                    accept="image/png, image/jpeg, image/gif"
                                    className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    onChange={handleAvatarChange}
                                    disabled={isSaving}
                                />
                            </div>
                            <button
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                onClick={handleSaveProfile}
                                disabled={isSaving || (username !== initialUsername && (!usernameAvailable || isCheckingUsername))}
                            >
                                {isSaving ? 'Saving...' : 'Save Profile Changes'}
                            </button>
                        </div>
                    </section>

                    {/* Other sections (Goal Management, Privacy, Account Actions) remain the same */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Manage Goals</h2>
                        <p className="text-sm text-gray-500">Goal management features will be here. (e.g., add, edit, remove goals)</p>
                        <button disabled={isSaving} className="mt-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            Manage My Goals
                        </button>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Privacy</h2>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Make profile private</span>
                            <button disabled={isSaving} className="relative inline-flex items-center h-6 rounded-full w-11 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                <span className="sr-only">Make profile private</span>
                                <span className="inline-block w-11 h-6 bg-gray-200 rounded-full"></span>
                                <span className="inline-block w-4 h-4 transform translate-x-1 bg-white rounded-full transition-transform"></span>
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">More privacy options will be available here.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Account</h2>
                        <button
                            onClick={handleSignOut}
                            disabled={isSaving}
                            className="w-full px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                        >
                            {isSaving ? 'Processing...' : 'Sign Out'}
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;