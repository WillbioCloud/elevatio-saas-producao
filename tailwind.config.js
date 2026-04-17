/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', 'class'],
  safelist: [
    'bg-brand-500',
    'text-brand-600',
    'hover:bg-brand-700',
    'border-brand-200',
  ],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'Lato',
  				'sans-serif'
  			],
  			serif: [
				'Playfair Display',
				'serif'
			],
			sans: ['Inter', 'sans-serif']
  		},
  		colors: {
  			brand: {
  				'50': '#faf5ff',
  				'100': '#f3e8ff',
  				'200': '#e9d5ff',
  				'300': '#d8b4fe',
  				'400': '#c084fc',
  				'500': '#8b5cf6',
  				'600': '#7c3aed',
  				'700': '#6d28d9',
  				'800': '#5b21b6',
  				'900': '#4c1d95',
  				'950': '#2e1065'
  			},
  			dark: {
  				bg: '#0f172a',
  				card: '#1e293b',
  				border: '#334155',
  				text: '#f8fafc',
  				muted: '#94a3b8',
  				hover: '#334155'
  			},
  			crm: {
  				bg: '#FFF5DE',
  				surface: '#FFFFFF',
  				border: '#E7ECF3',
  				text: '#0B1220',
  				body: '#334155',
  				muted: '#64748B',
  				navy: '#0F172A',
  				navy2: '#101030',
  				primary: '#50C070',
  				secondary: '#7030E0'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		boxShadow: {
  			soft: '0 10px 30px rgba(15, 23, 42, 0.08)',
  			soft2: '0 1px 2px rgba(15,23,42,0.06)'
  		},
  		borderRadius: {
  			xl2: '1rem',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		animation: {
  			'fade-in': 'fadeIn 0.5s ease-out',
  			'slide-up': 'slideUp 0.5s ease-out',
  			'slide-in-right': 'slideInRight 0.3s ease-out'
  		},
  		keyframes: {
  			fadeIn: {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			slideUp: {
  				'0%': {
  					transform: 'translateY(20px)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			},
  			slideInRight: {
  				'0%': {
  					transform: 'translateX(100%)'
  				},
  				'100%': {
  					transform: 'translateX(0)'
  				}
  			},
  			indeterminate: {
  				'0%': {
  					transform: 'translateX(-100%) scaleX(0.45)'
  				},
  				'50%': {
  					transform: 'translateX(0%) scaleX(0.75)'
  				},
  				'100%': {
  					transform: 'translateX(100%) scaleX(0.45)'
  				}
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
