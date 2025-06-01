import React from 'react';
import Navigation from './Navigation';

// The Layout component wraps pages that need the bottom navigation
// It ensures content is displayed above the fixed navigation bar
const Layout = ({ children, session }) => {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Main content area */}
            {/* pb-16 (padding-bottom: 4rem) or similar to avoid overlap with fixed bottom nav */}
            <main className="flex-grow pb-20 sm:pb-16 bg-gray-50">
                {/* The children prop will render the current page's content 
          (e.g., HomePage, ProfilePage)
        */}
                {children}
            </main>

            {/* Bottom Navigation Bar */}
            <Navigation />
        </div>
    );
};

export default Layout;