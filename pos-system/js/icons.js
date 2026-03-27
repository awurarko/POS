// Shared SVG icon library for POS and products pages
// Each icon returns a self-contained inline SVG string (48x48)

const ICONS = {
    bread: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="18" width="36" height="22" rx="8" fill="#f5c97a" stroke="#d4a038" stroke-width="1.2"/>
        <ellipse cx="24" cy="18" rx="18" ry="7" fill="#f7d996" stroke="#d4a038" stroke-width="1.2"/>
        <path d="M12 26 Q24 22 36 26" stroke="#d4a038" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.5"/>
    </svg>`,

    milk: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="16" width="20" height="26" rx="3" fill="#e8f4fd" stroke="#7fb8e0" stroke-width="1.2"/>
        <path d="M14 20 L19 14 L29 14 L34 20" fill="#cce8f8" stroke="#7fb8e0" stroke-width="1.2"/>
        <rect x="17" y="22" width="14" height="8" rx="2" fill="#7fb8e0" opacity="0.25"/>
        <text x="24" y="29" text-anchor="middle" font-size="6" font-weight="600" fill="#4a90c4" font-family="sans-serif">MILK</text>
    </svg>`,

    eggs: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="19" cy="26" rx="7" ry="9" fill="#f8edd5" stroke="#c8a96e" stroke-width="1.2"/>
        <ellipse cx="30" cy="25" rx="6" ry="8" fill="#f8edd5" stroke="#c8a96e" stroke-width="1.2"/>
        <ellipse cx="19" cy="27" rx="3" ry="3.5" fill="#f5c542" opacity="0.5"/>
        <ellipse cx="30" cy="26" rx="2.5" ry="3" fill="#f5c542" opacity="0.5"/>
    </svg>`,

    sugar: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="13" y="16" width="22" height="26" rx="5" fill="#fff9f0" stroke="#d4b896" stroke-width="1.2"/>
        <path d="M18 16 L18 13 Q24 10 30 13 L30 16" fill="#ead9c2" stroke="#d4b896" stroke-width="1.2"/>
        <line x1="13" y1="23" x2="35" y2="23" stroke="#d4b896" stroke-width="0.8" opacity="0.6"/>
        <text x="24" y="33" text-anchor="middle" font-size="6" font-weight="700" fill="#b08040" font-family="sans-serif">SUGAR</text>
    </svg>`,

    rice: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="15" width="24" height="28" rx="5" fill="#faf8f0" stroke="#c8c090" stroke-width="1.2"/>
        <path d="M16 15 Q24 10 32 15" stroke="#c8c090" stroke-width="1.2" fill="none"/>
        <ellipse cx="21" cy="27" rx="1.5" ry="2.5" fill="#a8a070" transform="rotate(-20 21 27)"/>
        <ellipse cx="27" cy="25" rx="1.5" ry="2.5" fill="#a8a070" transform="rotate(15 27 25)"/>
        <ellipse cx="24" cy="31" rx="1.5" ry="2.5" fill="#a8a070" transform="rotate(5 24 31)"/>
        <ellipse cx="19" cy="33" rx="1.5" ry="2.5" fill="#a8a070" transform="rotate(-10 19 33)"/>
        <ellipse cx="29" cy="32" rx="1.5" ry="2.5" fill="#a8a070" transform="rotate(20 29 32)"/>
    </svg>`,

    "cooking oil": `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="18" y="8" width="12" height="6" rx="2" fill="#d4c060" stroke="#b0a040" stroke-width="1"/>
        <path d="M16 14 L16 38 Q16 42 24 42 Q32 42 32 38 L32 14 Q32 10 24 10 Q16 10 16 14Z" fill="#f5e87a" stroke="#c8b840" stroke-width="1.2"/>
        <ellipse cx="24" cy="28" rx="5" ry="7" fill="#e8d850" opacity="0.5"/>
        <rect x="18" y="10" width="12" height="3" rx="1" fill="#c8b840" opacity="0.4"/>
    </svg>`,

    water: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="7" width="8" height="5" rx="2" fill="#90c8e8" stroke="#5a9ec8" stroke-width="1"/>
        <path d="M16 13 L16 40 Q16 44 24 44 Q32 44 32 40 L32 13 Q32 10 24 10 Q16 10 16 13Z" fill="#cce8f8" stroke="#7fb8e0" stroke-width="1.2"/>
        <path d="M16 28 Q20 25 24 28 Q28 31 32 28" stroke="#7fb8e0" stroke-width="0.8" fill="none" opacity="0.6"/>
        <path d="M16 34 Q20 31 24 34 Q28 37 32 34" stroke="#7fb8e0" stroke-width="0.8" fill="none" opacity="0.6"/>
    </svg>`,

    juice: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="13" y="16" width="22" height="26" rx="3" fill="#fff0c0" stroke="#e0a830" stroke-width="1.2"/>
        <path d="M13 20 L17 13 L31 13 L35 20" fill="#ffe080" stroke="#e0a830" stroke-width="1.2"/>
        <circle cx="24" cy="30" r="6" fill="#f5c830" opacity="0.45"/>
        <circle cx="24" cy="30" r="3" fill="#f5c830" opacity="0.6"/>
    </svg>`,

    soda: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="13" width="18" height="28" rx="6" fill="#e84040" stroke="#c02020" stroke-width="1.2"/>
        <ellipse cx="24" cy="13" rx="9" ry="4" fill="#f06060" stroke="#c02020" stroke-width="1"/>
        <ellipse cx="24" cy="41" rx="9" ry="4" fill="#c02020" stroke="#a01010" stroke-width="1"/>
        <path d="M20 10 Q24 8 26 10" stroke="#c02020" stroke-width="1" fill="none"/>
        <line x1="15" y1="20" x2="33" y2="20" stroke="white" stroke-width="0.6" opacity="0.3"/>
        <line x1="15" y1="24" x2="33" y2="24" stroke="white" stroke-width="0.6" opacity="0.3"/>
    </svg>`,

    coffee: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 20 L14 38 Q14 40 24 40 Q34 40 34 38 L36 20Z" fill="#6b3a2a" stroke="#4a2018" stroke-width="1.2"/>
        <ellipse cx="24" cy="20" rx="12" ry="4" fill="#7a4535" stroke="#4a2018" stroke-width="1"/>
        <path d="M34 25 Q40 25 40 30 Q40 35 34 35" fill="none" stroke="#4a2018" stroke-width="1.5"/>
        <path d="M18 14 Q18 10 21 12 Q21 8 24 10" stroke="#9c6a50" stroke-width="1" fill="none" stroke-linecap="round"/>
    </svg>`,

    butter: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="22" width="28" height="16" rx="3" fill="#f5e070" stroke="#c8a820" stroke-width="1.2"/>
        <path d="M10 22 L16 16 L44 16 L38 22Z" fill="#f8ec90" stroke="#c8a820" stroke-width="1.2"/>
        <path d="M38 22 L44 16 L44 32 L38 38Z" fill="#e8d050" stroke="#c8a820" stroke-width="1.2"/>
    </svg>`,

    cheese: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 34 L24 10 L42 34 Z" fill="#f5d040" stroke="#c8a010" stroke-width="1.2"/>
        <line x1="6" y1="34" x2="42" y2="34" stroke="#c8a010" stroke-width="1.2"/>
        <circle cx="18" cy="28" r="2.5" fill="#c8a010" opacity="0.4"/>
        <circle cx="30" cy="26" r="2" fill="#c8a010" opacity="0.4"/>
        <circle cx="24" cy="32" r="1.5" fill="#c8a010" opacity="0.4"/>
    </svg>`,

    apple: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 14 C14 14 10 22 10 30 C10 38 16 42 24 42 C32 42 38 38 38 30 C38 22 34 14 24 14Z" fill="#e84040" stroke="#c02020" stroke-width="1.2"/>
        <path d="M24 14 C24 14 22 8 18 7" stroke="#5a8a20" stroke-width="1.5" stroke-linecap="round" fill="none"/>
        <path d="M24 14 C24 10 28 8 30 10" fill="#50a820" stroke="#3a8010" stroke-width="1"/>
        <path d="M14 26 Q20 22 26 26" stroke="#c04040" stroke-width="0.8" fill="none" opacity="0.5"/>
    </svg>`,

    banana: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 32 Q12 20 24 16 Q36 12 38 18 Q36 14 24 20 Q14 26 14 36Z" fill="#f8e040" stroke="#c8a810" stroke-width="1.2"/>
        <path d="M10 32 Q10 36 13 36 Q14 36 14 36Z" fill="#c8a810"/>
        <path d="M38 18 Q42 16 40 12" stroke="#c8a810" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    </svg>`,

    carrot: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 10 C16 16 14 28 18 36 C22 44 26 44 30 36 C34 28 32 16 24 10Z" fill="#f28c28" stroke="#cf6e16" stroke-width="1.2"/>
        <path d="M24 10 L20 6" stroke="#4a9a3a" stroke-width="2" stroke-linecap="round"/>
        <path d="M24 10 L28 6" stroke="#4a9a3a" stroke-width="2" stroke-linecap="round"/>
        <path d="M22 26 L26 26" stroke="#cf6e16" stroke-width="1" opacity="0.4"/>
        <path d="M21 30 L27 30" stroke="#cf6e16" stroke-width="1" opacity="0.4"/>
        <path d="M22 34 L26 34" stroke="#cf6e16" stroke-width="1" opacity="0.4"/>
    </svg>`,

    tomato: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="28" r="14" fill="#e83030" stroke="#b81818" stroke-width="1.2"/>
        <path d="M20 16 C18 10 22 8 24 14" fill="#50a020" stroke="#3a8010" stroke-width="1"/>
        <path d="M24 14 C26 8 30 10 28 16" fill="#50a020" stroke="#3a8010" stroke-width="1"/>
        <path d="M24 14 L24 18" stroke="#3a8010" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M16 28 Q20 24 24 28" stroke="#b81818" stroke-width="0.8" fill="none" opacity="0.5"/>
    </svg>`,

    chicken: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="22" cy="28" rx="13" ry="11" fill="#e8a060" stroke="#c07030" stroke-width="1.2"/>
        <path d="M28 20 Q36 14 38 20 Q36 18 34 22" fill="#e8a060" stroke="#c07030" stroke-width="1.2"/>
        <line x1="32" y1="38" x2="32" y2="44" stroke="#c07030" stroke-width="2" stroke-linecap="round"/>
        <line x1="28" y1="38" x2="28" y2="44" stroke="#c07030" stroke-width="2" stroke-linecap="round"/>
        <path d="M14 26 Q18 22 22 26" stroke="#c07030" stroke-width="0.8" fill="none" opacity="0.5"/>
    </svg>`,

    fish: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M36 24 L42 18 L42 30 Z" fill="#6090e0" stroke="#4070c0" stroke-width="1"/>
        <ellipse cx="24" cy="24" rx="16" ry="9" fill="#70a0f0" stroke="#4070c0" stroke-width="1.2"/>
        <circle cx="32" cy="21" r="2" fill="#4070c0" opacity="0.6"/>
        <path d="M14 22 Q18 20 22 22 Q18 24 14 26Z" fill="#4070c0" opacity="0.3"/>
    </svg>`,

    soap: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="20" width="24" height="20" rx="5" fill="#d0e8f8" stroke="#80b8e0" stroke-width="1.2"/>
        <rect x="18" y="14" width="12" height="8" rx="3" fill="#b8d8f0" stroke="#80b8e0" stroke-width="1"/>
        <circle cx="32" cy="16" r="3" fill="white" stroke="#80b8e0" stroke-width="0.8"/>
        <text x="24" y="34" text-anchor="middle" font-size="6" font-weight="600" fill="#3a88c0" font-family="sans-serif">SOAP</text>
    </svg>`,

    detergent: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="14" width="20" height="30" rx="4" fill="#e0f0e8" stroke="#60b870" stroke-width="1.2"/>
        <rect x="18" y="10" width="12" height="6" rx="2" fill="#c0e0c8" stroke="#60b870" stroke-width="1"/>
        <rect x="16" y="20" width="16" height="10" rx="2" fill="#60b870" opacity="0.3"/>
        <text x="24" y="28" text-anchor="middle" font-size="5" font-weight="700" fill="#3a9040" font-family="sans-serif">CLEAN</text>
    </svg>`,

    matches: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="22" width="16" height="20" rx="3" fill="#f0d8a0" stroke="#c0a050" stroke-width="1.2"/>
        <line x1="20" y1="22" x2="20" y2="42" stroke="#c0a050" stroke-width="0.6" opacity="0.4"/>
        <line x1="24" y1="22" x2="24" y2="42" stroke="#c0a050" stroke-width="0.6" opacity="0.4"/>
        <line x1="28" y1="22" x2="28" y2="42" stroke="#c0a050" stroke-width="0.6" opacity="0.4"/>
        <rect x="14" y="28" width="20" height="4" rx="1" fill="#c05020" opacity="0.7"/>
        <circle cx="20" cy="18" r="3" fill="#f08020"/>
        <circle cx="24" cy="16" r="3" fill="#e06020"/>
        <circle cx="28" cy="18" r="3" fill="#f08020"/>
    </svg>`,

    candle: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="18" y="24" width="12" height="18" rx="3" fill="#f5f0e0" stroke="#d8c880" stroke-width="1.2"/>
        <rect x="18" y="24" width="12" height="4" rx="1" fill="#e8d870" opacity="0.5"/>
        <line x1="24" y1="24" x2="24" y2="18" stroke="#8a7040" stroke-width="1.2"/>
        <path d="M22 17 Q24 12 26 17 Q24 16 22 17Z" fill="#f08020"/>
        <path d="M23 17 Q24 14 25 17" fill="#f8c030"/>
    </svg>`,

    flour: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="13" y="16" width="22" height="26" rx="5" fill="#faf8f4" stroke="#d8d0b8" stroke-width="1.2"/>
        <path d="M18 16 Q24 11 30 16" stroke="#d8d0b8" stroke-width="1.2" fill="none"/>
        <text x="24" y="34" text-anchor="middle" font-size="6" font-weight="700" fill="#a09070" font-family="sans-serif">FLOUR</text>
        <line x1="13" y1="24" x2="35" y2="24" stroke="#d8d0b8" stroke-width="0.7" opacity="0.6"/>
    </svg>`,

    salt: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="16" width="16" height="26" rx="8" fill="#f8f8f8" stroke="#c0c0c0" stroke-width="1.2"/>
        <ellipse cx="24" cy="13" rx="5" ry="3" fill="#c0c0c0" stroke="#a0a0a0" stroke-width="1"/>
        <circle cx="21" cy="27" r="1.2" fill="#a0a0a0" opacity="0.7"/>
        <circle cx="27" cy="27" r="1.2" fill="#a0a0a0" opacity="0.7"/>
        <circle cx="24" cy="31" r="1.2" fill="#a0a0a0" opacity="0.7"/>
    </svg>`,

    pepper: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="16" width="16" height="26" rx="8" fill="#2c2c2c" stroke="#1a1a1a" stroke-width="1.2"/>
        <ellipse cx="24" cy="13" rx="5" ry="3" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="1"/>
        <circle cx="21" cy="27" r="1.2" fill="#6c6c6c" opacity="0.7"/>
        <circle cx="27" cy="27" r="1.2" fill="#6c6c6c" opacity="0.7"/>
        <circle cx="24" cy="31" r="1.2" fill="#6c6c6c" opacity="0.7"/>
    </svg>`,

    toothpaste: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="20" width="28" height="14" rx="7" fill="#d0f0e8" stroke="#50b890" stroke-width="1.2"/>
        <ellipse cx="36" cy="27" rx="5" ry="7" fill="#c0e8d8" stroke="#50b890" stroke-width="1"/>
        <path d="M36 22 Q40 22 40 27 Q40 32 36 32" fill="#50b890" stroke="#30a070" stroke-width="0.8"/>
        <rect x="10" y="23" width="24" height="8" rx="4" fill="#50b890" opacity="0.2"/>
    </svg>`,

    chocolate: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="16" width="32" height="22" rx="5" fill="#7a3a18" stroke="#5a2808" stroke-width="1.2"/>
        <line x1="8" y1="24" x2="40" y2="24" stroke="#5a2808" stroke-width="1" opacity="0.6"/>
        <line x1="8" y1="30" x2="40" y2="30" stroke="#5a2808" stroke-width="1" opacity="0.6"/>
        <line x1="18" y1="16" x2="18" y2="38" stroke="#5a2808" stroke-width="1" opacity="0.6"/>
        <line x1="28" y1="16" x2="28" y2="38" stroke="#5a2808" stroke-width="1" opacity="0.6"/>
    </svg>`,

    biscuits: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="28" r="10" fill="#e8c878" stroke="#c0a040" stroke-width="1.2"/>
        <circle cx="32" cy="26" r="8" fill="#e8c878" stroke="#c0a040" stroke-width="1.2"/>
        <circle cx="20" cy="27" r="4" fill="#c0a040" opacity="0.25"/>
        <circle cx="32" cy="25" r="3.5" fill="#c0a040" opacity="0.25"/>
        <circle cx="18" cy="25" r="1" fill="#c0a040" opacity="0.6"/>
        <circle cx="22" cy="30" r="1" fill="#c0a040" opacity="0.6"/>
        <circle cx="30" cy="23" r="1" fill="#c0a040" opacity="0.6"/>
        <circle cx="34" cy="27" r="1" fill="#c0a040" opacity="0.6"/>
    </svg>`,

    tea: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 20 L16 38 Q16 40 24 40 Q32 40 32 38 L34 20Z" fill="#a05030" stroke="#804020" stroke-width="1.2" opacity="0.9"/>
        <ellipse cx="24" cy="20" rx="10" ry="4" fill="#b06040" stroke="#804020" stroke-width="1"/>
        <path d="M32 26 Q38 26 38 30 Q38 34 32 34" fill="none" stroke="#804020" stroke-width="1.5"/>
        <rect x="20" y="14" width="8" height="7" rx="1" fill="#e0c080" stroke="#b09040" stroke-width="0.8"/>
        <line x1="24" y1="14" x2="22" y2="10" stroke="#80a040" stroke-width="1" stroke-linecap="round"/>
    </svg>`,

    yogurt: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 18 L16 40 Q16 42 24 42 Q32 42 32 40 L33 18Z" fill="#f8f4f0" stroke="#d0c0b0" stroke-width="1.2"/>
        <ellipse cx="24" cy="18" rx="9" ry="4" fill="#ede8e0" stroke="#d0c0b0" stroke-width="1.2"/>
        <rect x="20" y="13" width="8" height="6" rx="2" fill="#e8e0d8" stroke="#c0b0a0" stroke-width="0.8"/>
        <path d="M17 28 Q20 25 24 27 Q28 29 31 26" stroke="#e08080" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    </svg>`,

    noodles: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 28 Q14 22 18 28 Q22 34 26 28 Q30 22 34 28 Q38 34 38 30" stroke="#e8c060" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M10 34 Q14 28 18 34 Q22 40 26 34 Q30 28 34 34" stroke="#e8c060" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>
        <path d="M12 22 Q16 16 20 22 Q24 28 28 22 Q32 16 36 22" stroke="#d4a840" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>
    </svg>`,

    canned: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="16" width="20" height="24" rx="2" fill="#d0e8d0" stroke="#80b880" stroke-width="1.2"/>
        <ellipse cx="24" cy="16" rx="10" ry="4" fill="#b8d8b8" stroke="#80b880" stroke-width="1.2"/>
        <ellipse cx="24" cy="40" rx="10" ry="4" fill="#90c890" stroke="#80b880" stroke-width="1.2"/>
        <line x1="14" y1="22" x2="34" y2="22" stroke="#80b880" stroke-width="0.7" opacity="0.5"/>
        <line x1="14" y1="34" x2="34" y2="34" stroke="#80b880" stroke-width="0.7" opacity="0.5"/>
    </svg>`,

    default: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="18" width="28" height="22" rx="4" fill="#e8e0f0" stroke="#9a7ab0" stroke-width="1.2"/>
        <path d="M10 24 L24 18 L38 24" fill="#d8c8ec" stroke="#9a7ab0" stroke-width="1.2"/>
        <line x1="24" y1="18" x2="24" y2="40" stroke="#9a7ab0" stroke-width="0.8" opacity="0.5"/>
        <line x1="10" y1="24" x2="38" y2="24" stroke="#9a7ab0" stroke-width="0.8" opacity="0.5"/>
    </svg>`,
};

const CATEGORY_ICONS = {
    Beverages: "juice",
    Food: "default",
    Household: "soap",
    Electronics: "default",
    Produce: "carrot",
    Vegetables: "carrot",
    Other: "default",
};

function getIcon(productName, category) {
    const key = productName.toLowerCase().trim();
    for (const iconKey of Object.keys(ICONS)) {
        if (key === iconKey || key.includes(iconKey) || iconKey.includes(key)) {
            return ICONS[iconKey];
        }
    }
    const catIcon = CATEGORY_ICONS[category];
    return catIcon ? ICONS[catIcon] : ICONS.default;
}
