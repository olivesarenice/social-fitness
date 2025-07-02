import React from 'react';
import AuthForm from '../components/AuthForm';

const SignUpPage = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex flex-col items-center justify-center p-4">
            <div className="mb-8 text-center">
                <h1 className="text-5xl font-extrabold text-white">
                    Create Your Account
                </h1>
                <p className="mt-2 text-lg text-slate-300">Join Momentum and Gamify Your Fitness Journey.</p>
            </div>
            <AuthForm isSignUpPage={true} />
        </div>
    );
};

export default SignUpPage;
