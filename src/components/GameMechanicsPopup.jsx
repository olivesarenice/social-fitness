import { ArrowLeft, ArrowRight, Flame, Search, Settings, SquarePlus, User, X, Zap } from 'lucide-react';
import React, { useState } from 'react';

const pages = [
    {
        title: 'Getting Started',
        content: (
            <>
                <p>Build your <strong>Momentum</strong> <Flame size={16} className="inline-block text-red-500" /> level by consistently completing your goals.</p>
                <ul className="list-disc list-inside mt-2 space-y-2">
                    <br></br>
                    <li><strong>Set Your Goals:</strong> Go to your Profile <User size={16} className="inline-block" /> to set up to a weekly fitness goal (e.g., "Run 3 times a week").</li>
                    <br></br>
                    <li><strong>Follow Friends:</strong> This app is meant to be social - find your friends in the Search <Search size={16} className="inline-block" /> bar!</li>
                    <br></br>
                    <li><strong>Log Activities:</strong> Log Activities <SquarePlus size={16} className="inline-block" /> to earn points and progress. An activity <strong>must be linked to one of your active goals</strong>.</li>
                </ul>
            </>
        )
    },
    {
        title: 'Level Up: Energy & Momentum',
        content: (
            <>
                <p>Completing activities earns you <strong>Energy</strong> <Zap size={16} className="inline-block text-yellow-500" />, which automatically increases your <strong>Momentum</strong> <Flame size={16} className="inline-block text-red-500" /> level.</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                    <br></br>
                    <li><strong>Gaining Energy:</strong> You gain a base amount of Energy <Zap size={16} className="inline-block text-yellow-500" /> for every activity.</li>
                    <br></br>
                    <li><strong>Leveling Up:</strong> When your Energy <Zap size={16} className="inline-block text-yellow-500" /> bar is full, you level up! However, it's not so simple - Momentum <Flame size={16} className="inline-block text-red-500" /> can also fall if you aren't consistent...</li>
                </ul>
            </>
        )
    },
    {
        title: 'Stay Consistent: Shield & Streaks',
        content: (
            <>
                <p>The system rewards you for regular activity.</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                    <br></br>
                    <li><strong>Momentum Shield:</strong> A timer that protects your Momentum <Flame size={16} className="inline-block text-red-500" /> from decaying. It resets every time you log an activity.</li>
                    <br></br>
                    <li><strong>Danger Zone:</strong> If the timer runs out, your shield breaks. If you don't log another activity by the end of the day, your <strong>Momentum <Flame size={16} className="inline-block text-red-500" /> will drop</strong>.</li>
                    <br></br>
                    <li><strong>Weekly Streaks:</strong> Completing the same goal multiple times in one week activates <strong>Energy Multipliers</strong>, helping you level up much faster.</li>
                </ul>
            </>
        )
    },
    {
        title: 'Social & Privacy',
        content: (
            <>
                <p>You have full control over who sees your progress. See the Profile <User size={16} className="inline-block" /> and Settings <Settings size={16} className="inline-block" /> page for more info.</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                    <br></br>
                    <li><strong>Public Profiles:</strong> Anyone can see your activity and follow you instantly.</li>
                    <br></br>
                    <li><strong>Private Profiles:</strong> Only approved followers can see your activity log and goals.</li>
                </ul>
            </>
        )
    }
];

const GameMechanicsPopup = ({ onClose }) => {
    const [currentPage, setCurrentPage] = useState(0);

    const handleNext = () => {
        setCurrentPage(prev => Math.min(prev + 1, pages.length - 1));
    };

    const handlePrev = () => {
        setCurrentPage(prev => Math.max(prev - 1, 0));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="font-semibold text-lg">{pages[currentPage].title}</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200"><X size={20} /></button>
                </div>
                <div className="p-6 text-gray-700 text-sm space-y-2 flex-1">
                    {pages[currentPage].content}
                </div>
                <div className="p-4 border-t flex justify-between items-center">
                    <button onClick={handlePrev} disabled={currentPage === 0} className="p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex space-x-2">
                        {pages.map((_, index) => (
                            <div key={index} className={`w-2 h-2 rounded-full ${currentPage === index ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                        ))}
                    </div>
                    <button onClick={handleNext} disabled={currentPage === pages.length - 1} className="p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100">
                        <ArrowRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameMechanicsPopup;
