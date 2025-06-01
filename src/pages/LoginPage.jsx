import React from 'react';
import AuthForm from '../components/AuthForm';
// You can import your app logo here if you have one
// import AppLogo from '../assets/logo.svg'; 

const LoginPage = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex flex-col items-center justify-center p-4">
            <div className="mb-8 text-center">
                {/* <img src={AppLogo} alt="App Logo" className="w-24 h-24 mx-auto mb-4" /> */}
                <h1 className="text-5xl font-extrabold text-white">
                    &lt;UNTITLED&gt;
                </h1>
                <p className="mt-2 text-lg text-slate-300">Gamify Your Fitness Journey.</p>
            </div>
            <AuthForm />
        </div>
    );
};

export default LoginPage;