import { Home, PlusSquare, Search, Settings, User } from 'lucide-react'; // Using Lucide icons
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/profile', label: 'Profile', icon: User },
    { path: '/log-activity', label: 'Log', icon: PlusSquare, isCentral: true }, // Central button
    { path: '/search', label: 'Search', icon: Search }, // Placeholder for User Search
    { path: '/settings', label: 'Settings', icon: Settings },
];

const Navigation = () => {
    const location = useLocation();

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 sm:h-14 z-50 bottom-nav">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path === '/profile' && location.pathname.startsWith('/profile'));
                const IconComponent = item.icon;

                if (item.isCentral) {
                    return (
                        <NavLink
                            key={item.label}
                            to={item.path}
                            className="flex flex-col items-center justify-center text-gray-600 hover:text-blue-600 -mt-6" // Negative margin to lift it
                            aria-label={item.label}
                        >
                            <div className={`flex items-center justify-center w-14 h-14 sm:w-12 sm:h-12 rounded-full shadow-lg transition-colors duration-200
                ${isActive ? 'bg-blue-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                                <IconComponent size={28} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            {/* Optional: text label for central button, usually omitted for icon-only central buttons */}
                            {/* <span className={`mt-1 text-xs ${isActive ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>{item.label}</span> */}
                        </NavLink>
                    );
                }

                return (
                    <NavLink
                        key={item.label}
                        to={item.path}
                        className={({ isActive: navIsActive }) => // Use NavLink's isActive prop
                            `flex flex-col items-center justify-center flex-1 pt-1 pb-1 text-xs sm:text-sm transition-colors duration-200 rounded-md mx-1
               ${(navIsActive || (item.path === '/profile' && location.pathname.startsWith('/profile'))) ? 'text-blue-600 font-semibold' : 'text-gray-500 hover:text-blue-500'}`
                        }
                        aria-label={item.label}
                    >
                        <IconComponent size={22} strokeWidth={(isActive || (item.path === '/profile' && location.pathname.startsWith('/profile'))) ? 2.5 : 2} className="mb-0.5" />
                        {item.label}
                    </NavLink>
                );
            })}
        </nav>
    );
};

export default Navigation;