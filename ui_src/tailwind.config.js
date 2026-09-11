/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        xp: {
          // Light mode
          bg:           '#F5F5F4',
          surface:      '#FFFFFF',
          'surface-2':  '#FAFAF9',
          border:       'rgba(0,0,0,0.08)',
          'border-2':   'rgba(0,0,0,0.14)',
          text:         '#111111',
          'text-2':     '#555555',
          'text-3':     '#999999',
          accent:       '#16C784',
          'accent-d':   '#12B374',
          'accent-dim': 'rgba(22,199,132,0.09)',
          'accent-border': 'rgba(22,199,132,0.25)',
          profit:       '#16C784',
          'profit-bg':  'rgba(22,199,132,0.08)',
          loss:         '#EF5350',
          'loss-bg':    'rgba(239,83,80,0.08)',
          // Dark mode
          dbg:          '#0A0A0A',
          dsurf:        '#111111',
          'dsurf-2':    '#161616',
          dborder:      'rgba(255,255,255,0.07)',
          'dborder-2':  'rgba(255,255,255,0.12)',
          dtext:        '#EEEEEE',
          'dtext-2':    '#888888',
          'dtext-3':    '#555555',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs:    ['11px', '16px'],
        sm:    ['12px', '18px'],
        base:  ['13px', '20px'],
        md:    ['14px', '20px'],
        lg:    ['15px', '22px'],
        xl:    ['17px', '24px'],
        '2xl': ['20px', '28px'],
        '3xl': ['28px', '34px'],
        '4xl': ['36px', '42px'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.025em',
        tight: '-0.015em',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.07)',
        'card-dark': '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
      },
    },
  },
  plugins: [],
}
