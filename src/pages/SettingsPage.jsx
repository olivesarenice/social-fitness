import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
// Assuming you have lucide-react for icons
import { LogOut } from 'lucide-react';
import ProfileUpdatedPopup from '../components/ProfileUpdatedPopup';

const SettingsPage = () => {
    // --- STATE MANAGEMENT ---
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form state for profile details
    const [username, setUsername] = useState('');
    const [showUpdatedPopup, setShowUpdatedPopup] = useState(false);
    const [initialUsername, setInitialUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [isPublic, setIsPublic] = useState(true); // State for the privacy toggle

    // Username validation state
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [usernameAvailable, setUsernameAvailable] = useState(true);

    const debounceTimeoutRef = useRef(null);
    const DEBOUNCE_DELAY = 500;

    // --- DATA FETCHING & SIDE EFFECTS ---
    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_settings_data');

            if (error) {
                console.error("Error fetching profile:", error);
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) navigate('/login');
            }

            if (data && data.length > 0) {
                const profile = data[0];
                setUsername(profile.username || '');
                setInitialUsername(profile.username || '');
                setDisplayName(profile.display_name || '');
                setAvatarUrl(profile.avatar_url || '');
                setIsPublic(profile.is_public);
            }
            setLoading(false);
        };
        fetchProfile();
    }, [navigate]);

    const checkUsernameAvailability = useCallback(async (currentUsername) => {
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
        if (!username.trim() || username === initialUsername) {
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
    }, [username, initialUsername, checkUsernameAvailability]);

    // --- RPC-BASED HANDLER FUNCTIONS ---
    const handleSaveProfile = async () => {
        if (username !== initialUsername && (!usernameAvailable || isCheckingUsername)) {
            alert('Username is not available or still being checked.'); return;
        }
        if (!username.trim()) {
            alert('Username cannot be empty.'); return;
        }

        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated.");

            let avatarUrlToSave = avatarUrl;
            if (avatarFile) {
                const filePath = `${user.id}/${Date.now()}_${avatarFile.name}`;
                const { error: storageError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
                if (storageError) throw storageError;
                const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                avatarUrlToSave = publicUrlData.publicUrl;
            }

            const { data: updatedProfile, error: rpcError } = await supabase.rpc('update_profile_settings', {
                new_username: username, new_display_name: displayName, new_avatar_url: avatarUrlToSave
            });

            if (rpcError) {
                if (rpcError.message.includes('UsernameNotAvailable')) {
                    setUsernameError('This username is already taken.');
                    setUsernameAvailable(false);
                    alert('This username was taken while you were making changes.');
                } else { throw rpcError; }
            } else {
                setShowUpdatedPopup(true);
                setInitialUsername(updatedProfile.username);
                setAvatarUrl(updatedProfile.avatar_url);
                setDisplayName(updatedProfile.display_name);
                setUsername(updatedProfile.username);
                setAvatarFile(null);
                setUsernameError('');
                setUsernameAvailable(true);
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            alert(`Failed to update profile: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrivacyToggle = async () => {
        const originalStatus = isPublic;
        setIsPublic(!originalStatus); // Optimistic UI Update

        const { error } = await supabase.rpc('update_privacy_setting', {
            new_is_public_status: !originalStatus
        });

        if (error) {
            console.error("Error updating privacy setting:", error);
            alert("Failed to update privacy setting. Please try again.");
            setIsPublic(originalStatus); // Revert UI on error
        }
    };

    const handleAvatarChange = (event) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => { setAvatarUrl(reader.result); };
            reader.readAsDataURL(file);
        }
    };

    const handleSignOut = async () => {
        setIsSaving(true);
        await supabase.auth.signOut();
        setIsSaving(false);
        navigate('/login');
    };

    // --- JSX RENDERING ---
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-xl text-gray-700">Loading Settings...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
            {showUpdatedPopup && <ProfileUpdatedPopup onClose={() => setShowUpdatedPopup(false)} />}
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-800 mb-6">Settings</h1>
                <div className="space-y-8">

                    {/* Profile Settings Section */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Profile</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">Display Name</label>
                                <input
                                    type="text"
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
                                    id="username"
                                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none sm:text-sm ${usernameError && username !== initialUsername ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
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
                                    id="avatar"
                                    accept="image/png, image/jpeg, image/gif"
                                    className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    onChange={handleAvatarChange}
                                    disabled={isSaving}
                                />
                            </div>
                            <button
                                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                onClick={handleSaveProfile}
                                disabled={isSaving || (username !== initialUsername && (!usernameAvailable || isCheckingUsername))}
                            >
                                {isSaving ? 'Saving...' : 'Save Profile Changes'}
                            </button>
                        </div>
                    </section>

                    {/* Manage Goals Section */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Manage Goals</h2>
                        <p className="text-sm text-gray-500 mb-2">Set, track, and manage your personal activity goals.</p>
                        <button
                            disabled={isSaving}
                            onClick={() => navigate('/manage-goals')}
                            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Go to My Goals
                        </button>
                    </section>

                    {/* Privacy Section */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Privacy</h2>
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium text-gray-700">Make Profile Public</span>
                                <p className="text-xs text-gray-500">
                                    {isPublic
                                        ? "Anyone can see your profile and follow you."
                                        : "Only approved followers can see your private details."}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isPublic}
                                onClick={handlePrivacyToggle}
                                disabled={isSaving}
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
                    </section>

                    {/* Account Section */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Account</h2>
                        <button
                            onClick={handleSignOut}
                            disabled={isSaving}
                            className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                        >
                            <LogOut size={16} className="mr-2" />
                            {isSaving ? 'Processing...' : 'Sign Out'}
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
