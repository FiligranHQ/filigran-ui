import plugin from 'tailwindcss/plugin'

const FiligranUIPlugin = () => {
  return plugin(
    ({addUtilities, addComponents}) => {
      addUtilities({
        '.txt-jumbo': {
          'font-size': '2.5rem',
          'letter-spacing': '0.01875rem',
          'font-family': 'var(--font-geologica)',
        },
        '.txt-title': {
          'font-size': '1.5rem',
          'letter-spacing': '0.01125rem',
          'font-family': 'var(--font-geologica)',
        },
        '.txt-subtitle': {
          'font-size': '1.125rem',
          'letter-spacing': '0.00844rem',
          'font-family': 'var(--font-geologica)',
        },
        '.txt-category': {
          'font-size': '0.875rem',
          'font-weight': 'bold',
          'letter-spacing': '0.00656rem',
          'font-family': 'var(--font-geologica)',
        },
        '.txt-tab': {
          'font-size': '0.875rem',
          'letter-spacing': '0.00656rem',
          'text-transform': 'uppercase',
          'font-family': 'var(--font-geologica)',
        },
        '.txt-container-title': {
          'font-size': '0.75rem',
          'letter-spacing': '0.00563rem',
          'text-transform': 'uppercase',
          'font-family': 'var(--font-geologica)',
        },
        '.txt-default': {
          'font-size': '0.875rem',
          'line-height': '1.52',
          'letter-spacing': '0.0035rem',
        },
        '.txt-sub-content': {
          'font-size': '0.75rem',
          'line-height': '1.52',
          'letter-spacing': '0.003rem',
        },
        '.txt-mini': {
          'font-size': '0.5625rem',
          'line-height': '1.52',
          'letter-spacing': '0.00225rem',
        },
      })
    },
    {
      theme: {
        container: {
          center: true,
          padding: '2rem',
          screens: {
            '2xl': '1400px',
          },
        },
        extend: {
          colors: {
            border: {
              DEFAULT: 'hsl(var(--border))',
              strong: 'hsl(var(--border-strong))',
              'medium-strong': 'hsl(var(--border-medium-strong))',
              neutral: 'hsl(var(--border-neutral))',
              'medium-light': 'hsl(var(--border-medium-light))',
              light: 'hsl(var(--border-light))',
              focus: 'hsl(var(--border-focus))',
            },
            text: {
              DEFAULT: 'hsl(var(--text-foreground))',
              secondary: 'hsl(var(--secondary-text-foreground))',
              inverted: 'hsl(var(--text-inverted-foreground))',
              'inverted-focus': 'hsl(var(--text-inverted-foreground-focus))',
            },
            page: {
              background: 'hsl(var(--page-background))',
            },
            box: {
              background: 'hsl(var(--box-background))',
            },
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            primary: {
              DEFAULT: 'hsl(var(--primary))',
              foreground: 'hsl(var(--primary-foreground))',
            },
            secondary: {
              DEFAULT: 'hsl(var(--secondary))',
              foreground: 'hsl(var(--secondary-foreground))',
            },
            destructive: {
              DEFAULT: 'hsl(var(--destructive))',
              foreground: 'hsl(var(--destructive-foreground))',
            },
            muted: {
              DEFAULT: 'hsl(var(--muted))',
              foreground: 'hsl(var(--muted-foreground))',
            },
            popover: {
              DEFAULT: 'hsl(var(--popover))',
              foreground: 'hsl(var(--popover-foreground))',
            },
            card: {
              DEFAULT: 'hsl(var(--card))',
              foreground: 'hsl(var(--card-foreground))',
            },
            hover: {
              DEFAULT: 'hsl(var(--hover-background))',
            },
            gray: {
              DEFAULT: 'hsl(var(--gray-default))',
              '50': 'hsl(var(--gray-50))',
              '100': 'hsl(var(--gray-100))',
              '150': 'hsl(var(--gray-150))',
              '200': 'hsl(var(--gray-200))',
              '300': 'hsl(var(--gray-300))',
              '400': 'hsl(var(--gray-400))',
              '500': 'hsl(var(--gray-500))',
              '600': 'hsl(var(--gray-600))',
              '700': 'hsl(var(--gray-700))',
              '800': 'hsl(var(--gray-800))',
              '900': 'hsl(var(--gray-900))',
              '1000': 'hsl(var(--gray-1000))',
            },
            darkblue: {
              DEFAULT: 'hsl(var(--darkblue-default))',
              '100': 'hsl(var(--darkblue-100))',
              '200': 'hsl(var(--darkblue-200))',
              '300': 'hsl(var(--darkblue-300))',
              '400': 'hsl(var(--darkblue-400))',
              '500': 'hsl(var(--darkblue-500))',
              '600': 'hsl(var(--darkblue-600))',
              '700': 'hsl(var(--darkblue-700))',
              '800': 'hsl(var(--darkblue-800))',
              '900': 'hsl(var(--darkblue-900))',
            },
            blue: {
              DEFAULT: 'hsl(var(--blue-default))',
              '100': 'hsl(var(--blue-100))',
              '200': 'hsl(var(--blue-200))',
              '300': 'hsl(var(--blue-300))',
              '400': 'hsl(var(--blue-400))',
              '500': 'hsl(var(--blue-500))',
              '600': 'hsl(var(--blue-600))',
              '700': 'hsl(var(--blue-700))',
              '800': 'hsl(var(--blue-800))',
              '900': 'hsl(var(--blue-900))',
            },
            turquoise: {
              DEFAULT: 'hsl(var(--turquoise-default))',
              '100': 'hsl(var(--turquoise-100))',
              '200': 'hsl(var(--turquoise-200))',
              '300': 'hsl(var(--turquoise-300))',
              '400': 'hsl(var(--turquoise-400))',
              '500': 'hsl(var(--turquoise-500))',
              '600': 'hsl(var(--turquoise-600))',
              '700': 'hsl(var(--turquoise-700))',
              '800': 'hsl(var(--turquoise-800))',
              '900': 'hsl(var(--turquoise-900))',
            },
            green: {
              DEFAULT: 'hsl(var(--green-default))',
              '100': 'hsl(var(--green-100))',
              '200': 'hsl(var(--green-200))',
              '300': 'hsl(var(--green-300))',
              '400': 'hsl(var(--green-400))',
              '500': 'hsl(var(--green-500))',
              '600': 'hsl(var(--green-600))',
              '700': 'hsl(var(--green-700))',
              '800': 'hsl(var(--green-800))',
              '900': 'hsl(var(--green-900))',
            },
            red: {
              DEFAULT: 'hsl(var(--red-default))',
              '100': 'hsl(var(--red-100))',
              '200': 'hsl(var(--red-200))',
              '300': 'hsl(var(--red-300))',
              '400': 'hsl(var(--red-400))',
              '500': 'hsl(var(--red-500))',
              '600': 'hsl(var(--red-600))',
              '700': 'hsl(var(--red-700))',
              '800': 'hsl(var(--red-800))',
              '900': 'hsl(var(--red-900))',
            },
            orange: {
              DEFAULT: 'hsl(var(--orange-default))',
              '100': 'hsl(var(--orange-100))',
              '200': 'hsl(var(--orange-200))',
              '300': 'hsl(var(--orange-300))',
              '400': 'hsl(var(--orange-400))',
              '500': 'hsl(var(--orange-500))',
              '600': 'hsl(var(--orange-600))',
              '700': 'hsl(var(--orange-700))',
              '800': 'hsl(var(--orange-800))',
              '900': 'hsl(var(--orange-900))',
            },
            yellow: {
              DEFAULT: 'hsl(var(--yellow-default))',
              '100': 'hsl(var(--yellow-100))',
              '200': 'hsl(var(--yellow-200))',
              '300': 'hsl(var(--yellow-300))',
              '400': 'hsl(var(--yellow-400))',
              '500': 'hsl(var(--yellow-500))',
              '600': 'hsl(var(--yellow-600))',
              '700': 'hsl(var(--yellow-700))',
              '800': 'hsl(var(--yellow-800))',
              '900': 'hsl(var(--yellow-900))',
            },
          },
          borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)',
          },
          keyframes: {
            'accordion-down': {
              from: {height: '0'},
              to: {height: 'var(--radix-accordion-content-height)'},
            },
            'accordion-up': {
              from: {height: 'var(--radix-accordion-content-height)'},
              to: {height: '0'},
            },
          },
          animation: {
            'accordion-down': 'accordion-down 0.2s ease-out',
            'accordion-up': 'accordion-up 0.2s ease-out',
          },
          spacing: {
            xxs: '0.125rem',
            xs: '0.25rem',
            s: '0.5rem',
            m: '0.75rem',
            l: '1rem',
            xl: '1.5rem',
            xxl: '2rem',
          },
          fontFamily: {
            title: ['var(--font-geologica)', 'system-ui', 'sans-serif'],
            body: ['var(--font-ibm-plex-sans)', 'system-ui', 'sans-serif'],
          },
        },
      },
    }
  )
}
export default FiligranUIPlugin
