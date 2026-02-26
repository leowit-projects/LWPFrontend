// utils/sectorEmojis.ts  (or paste at top of your component)
export const SECTOR_EMOJI_MAP: Record<string, string> = {
    // Technology
    'aerospace & defense': '🚀',
    'auto ancillary': '🚘',
    'finance': '🤑',
    'fmcg': '🛒',
    'chemicals & petrochemicals': '🧪',
    'retail': '🛍️',
    'consumer durables': '🏠',
    'electrical equipment': '⚡',
    'ferrous metals': '🔩',
    'software services': '💻',
    'leisure services': '🎭',
    'minerals & mining': '⛏️',
    'non - ferrous metals': '🥈',
    'personal products': '🧴',
    'energy': '⚡',
    'healthcare': '💊',
    'telecom - services': '📡',
    'transport services': '🚚',
    'entertainment': '🎬',
    'etf': '📊',
    'realty': '🏗️',
    'consumable fuels': '⛽',
    'media': '📰',
    'diversified metals': '🪨',
    'gas': '🛢️',
    'industrial manufacturing': '🏭',
    'metals & minerals trading': '⚖️',

    // Default
    default: '📈',
};

export const getSectorEmoji = (sectorIndustry?: string): string => {
    if (!sectorIndustry) return '📈';

    const lower = sectorIndustry.toLowerCase();

    // Check for exact or partial matches
    for (const [key, emoji] of Object.entries(SECTOR_EMOJI_MAP)) {
        if (key === 'default') continue;
        if (lower.includes(key)) return emoji;
    }

    return SECTOR_EMOJI_MAP.default;
};