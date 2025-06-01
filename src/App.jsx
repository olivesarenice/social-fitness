import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LogActivityPage from './pages/LogActivityPage'; // Placeholder for Log Activity
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
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
                    if (_event === 'SIGNED_IN' && window.location.pathname === '/login') {
                        // Check if profile exists, if not, redirect to settings
                        const checkProfile = async () => {
                            if (supabase?.auth?.currentUser) {
                                const { data, error } = await supabase
                                    .from('profiles')
                                    .select('*')
                                    .eq('id', supabase.auth.currentUser.id)
                                    .single();

                                if (error) {
                                    console.error("Error fetching profile:", error);
                                }

                                if (!data) {
                                    navigate('/settings');
                                } else {
                                    navigate('/');
                                }
                            }
                        };
                        checkProfile();
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
                                <Route path="settings" element={<SettingsPage />} />
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
