import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import CreateProfilePage from './pages/CreateProfilePage';
import HomePage from './pages/HomePage';
import LogActivityPage from './pages/LogActivityPage'; // Placeholder for Log Activity
import LoginPage from './pages/LoginPage';
import ManageGoalsPage from './pages/ManageGoalsPage'; // Import the new page
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage'; // Import the new page
import SettingsPage from './pages/SettingsPage';
import SignUpPage from './pages/SignUpPage';
import { supabase } from './supabaseClient';

function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Check for an active session
        const getSession = async () => {
            if (!supabase) {
                console.error("Supabase client not available in App.jsx");
                setLoading(false);
                return;
            }
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setLoading(false);
        };

        getSession();

        // Listen for auth state changes
        if (supabase) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                (_event, session) => {
                    setSession(session);
                    if (_event === 'SIGNED_OUT') {
                        navigate('/login');
                    }
                    if (_event === 'SIGNED_IN') {
                        // Check if profile exists, if not, redirect to settings
                        const checkProfile = async () => {
                            if (session?.user) {
                                const { data, error } = await supabase
                                    .from('profiles')
                                    .select('*')
                                    .eq('id', session.user.id)
                                    .single();

                                if (error && error.code !== 'PGRST116') { // Ignore no rows found error
                                    console.error("Error fetching profile:", error);
                                }

                                // If no profile data, redirect to create profile page
                                if (!data) {
                                    if (session.user.app_metadata?.provider === 'google') {
                                        navigate('/create-profile');
                                    } else {
                                        // This case is for email sign up, which should have created a profile.
                                        // If not, something went wrong, but we can send them to manage-goals as a fallback.
                                        navigate('/manage-goals');
                                    }
                                } else {
                                    // If profile exists, navigate to home.
                                    navigate('/');
                                }
                            }
                        };
                        // A short delay to ensure the session is fully processed before checking profile
                        setTimeout(checkProfile, 100);
                    }
                }
            );
            return () => subscription.unsubscribe();
        }
    }, [navigate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-xl text-gray-700">Loading...</p>
            </div>
        );
    }

    // ProtectedRoute component
    const ProtectedRoute = ({ children }) => {
        if (!session) {
            return <Navigate to="/login" replace />;
        }
        return children;
    };

    return (
        <Routes>
            <Route path="/login" element={!session ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/signup" element={!session ? <SignUpPage /> : <Navigate to="/" />} />
            <Route path="/create-profile" element={session ? <CreateProfilePage /> : <Navigate to="/login" />} />
            <Route
                path="/*"
                element={
                    <ProtectedRoute>
                        <Layout session={session}> {/* Pass session to Layout if needed for user info */}
                            <Routes>
                                <Route index element={<HomePage />} />
                                <Route path="profile" element={<ProfilePage />} />
                                <Route path="profile/:userId" element={<ProfilePage />} /> {/* For viewing other profiles */}
                                <Route path="log-activity" element={<LogActivityPage />} />
                                <Route path="manage-goals" element={<ManageGoalsPage />} /> {/* New route for managing goals */}
                                <Route path="settings" element={<SettingsPage />} />
                                <Route path="search" element={<SearchPage />} /> {/* New route for searching users */}
                                {/* Add other protected routes here */}
                                <Route path="*" element={<Navigate to="/" replace />} /> {/* Fallback for unknown protected routes */}
                            </Routes>
                        </Layout>
                    </ProtectedRoute>
                }
            />
        </Routes>
    );
}

export default App;
