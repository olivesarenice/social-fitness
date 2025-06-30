import { X } from 'lucide-react';
import React from 'react';

const ProfileUpdatedPopup = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="font-semibold text-lg">Profile Updated</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200"><X size={20} /></button>
                </div>
                <div className="p-6 text-gray-700 text-sm space-y-2 flex-1">
                    <p>Your profile has been successfully updated.</p>
                </div>
            </div>
        </div>
    );
};

export default ProfileUpdatedPopup;
