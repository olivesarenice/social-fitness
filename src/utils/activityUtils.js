// src/utils/activityUtils.js

export const getEmojiForActivityClass = (activityClass) => {
    switch (activityClass) {
        case 'Speed':
            return '🪽';
        case 'Strength':
            return '🛡️';
        case 'Flexibility':
            return '🤸';
        case 'Balance':
            return '❤️';
        case 'Skill':
            return '🎯';
        case 'Extreme':
            return '☠️'
        default:
            return '✨'; // Default emoji
    }
};