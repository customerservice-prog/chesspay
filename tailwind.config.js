/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}','./components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg:'#080B12',surface:'#0D1117',elevated:'#161B27',overlay:'#1C2333',
        border:'#21293D','border-bright':'#2D3A52',
        gold:'#D4A843','gold-dim':'#9A7A31','gold-glow':'#F5C842',
        green:'#00D26A','green-dim':'#007A3D',
        red:'#FF3B3B','red-dim':'#8B1A1A',
        blue:'#3D7EFF',cyan:'#00C9E0',
        primary:'#EDF0F7',secondary:'#8892A4',tertiary:'#4A5568',
      },
      fontFamily: {
        display:['"Bebas Neue"','Impact','sans-serif'],
        sans:['"DM Sans"','system-ui','sans-serif'],
        mono:['"JetBrains Mono"','monospace'],
        num:['"Oswald"','sans-serif'],
      },
      backgroundImage: {
        'gold-gradient':'linear-gradient(135deg,#D4A843 0%,#F5C842 50%,#D4A843 100%)',
        'surface-gradient':'linear-gradient(180deg,#0D1117 0%,#080B12 100%)',
        'arena-gradient':'radial-gradient(ellipse at top,#161B27 0%,#080B12 70%)',
        'gold-radial':'radial-gradient(ellipse at center,rgba(212,168,67,0.15) 0%,transparent 70%)',
        'green-radial':'radial-gradient(ellipse at center,rgba(0,210,106,0.12) 0%,transparent 70%)',
        'red-radial':'radial-gradient(ellipse at center,rgba(255,59,59,0.12) 0%,transparent 70%)',
      },
      boxShadow: {
        'gold':'0 0 20px rgba(212,168,67,0.3),0 0 40px rgba(212,168,67,0.1)',
        'gold-sm':'0 0 10px rgba(212,168,67,0.2)',
        'green':'0 0 20px rgba(0,210,106,0.3)',
        'green-sm':'0 0 8px rgba(0,210,106,0.25)',
        'red':'0 0 20px rgba(255,59,59,0.3)',
        'card':'0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-gold':'pulseGold 2s ease-in-out infinite',
        'pulse-green':'pulseGreen 2s ease-in-out infinite',
        'slide-up':'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':'fadeIn 0.3s ease-out',
        'live-dot':'liveDot 1.5s ease-in-out infinite',
        'shimmer':'shimmer 2s linear infinite',
      },
      keyframes: {
        pulseGold:{'0%,100%':{boxShadow:'0 0 8px rgba(212,168,67,0.3)'},'50%':{boxShadow:'0 0 24px rgba(212,168,67,0.6)'}},
        pulseGreen:{'0%,100%':{boxShadow:'0 0 8px rgba(0,210,106,0.3)'},'50%':{boxShadow:'0 0 24px rgba(0,210,106,0.6)'}},
        slideUp:{'0%':{opacity:'0',transform:'translateY(16px)'},'100%':{opacity:'1',transform:'translateY(0)'}},
        fadeIn:{'0%':{opacity:'0'},'100%':{opacity:'1'}},
        liveDot:{'0%,100%':{opacity:'1'},'50%':{opacity:'0.3'}},
        shimmer:{'0%':{backgroundPosition:'-200% 0'},'100%':{backgroundPosition:'200% 0'}},
      },
    },
  },
  plugins:[],
}
