import plugin from 'tailwindcss/plugin'

const FiligranUIPlugin = (): any => {
  return plugin(
    ({addUtilities, addComponents}) => {
      addUtilities({
        '.popover-content-width-same-as-its-trigger': {
          width: 'var(--radix-popover-trigger-width)',
          'max-height': 'var(--radix-popover-content-available-height)',
        },
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
        '.txt-table': {
          'font-size': '0.8125rem',
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
              DEFAULT: 'hsl(var(--border) / <alpha-value>)',
              strong: 'hsl(var(--border-strong) / <alpha-value>)',
              'medium-strong': 'hsl(var(--border-medium-strong) / <alpha-value>)',
              medium: 'hsl(var(--border-medium) / <alpha-value>)',
              'medium-light': 'hsl(var(--border-medium-light) / <alpha-value>)',
              light: 'hsl(var(--border-light) / <alpha-value>)',
              focus: 'hsl(var(--border-focus) / <alpha-value>)',
            },
            text: {
              DEFAULT: 'hsl(var(--text-foreground) / <alpha-value>)',
              secondary: 'hsl(var(--secondary-text-foreground) / <alpha-value>)',
              inverted: 'hsl(var(--text-inverted-foreground) / <alpha-value>)',
              'inverted-focus': 'hsl(var(--text-inverted-foreground-focus) / <alpha-value>)',
            },
            page: {
              background: 'hsl(var(--page-background) / <alpha-value>)',
            },
            box: {
              background: 'hsl(var(--box-background) / <alpha-value>)',
            },
            menu: {
              active: 'hsl(var(--menu-active) / <alpha-value>)',
            },
            input: 'hsl(var(--input) / <alpha-value>)',
            ring: 'hsl(var(--ring))',
            background: 'hsl(var(--background) / <alpha-value>)',
            foreground: 'hsl(var(--foreground) / <alpha-value>)',
            primary: {
              DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
              foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
            },
            secondary: {
              DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
              foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
            },
            destructive: {
              DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
              foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
            },
            muted: {
              DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
              foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
            },
            popover: {
              DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
              foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
            },
            card: {
              DEFAULT: 'hsl(var(--card) / <alpha-value>)',
              foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
            },
            hover: {
              DEFAULT: 'var(--hover-background)',
            },
            gray: {
              DEFAULT: 'hsl(var(--gray-default) / <alpha-value>)',
              '50': 'hsl(var(--gray-50) / <alpha-value>)',
              '100': 'hsl(var(--gray-100) / <alpha-value>)',
              '150': 'hsl(var(--gray-150) / <alpha-value>)',
              '200': 'hsl(var(--gray-200) / <alpha-value>)',
              '300': 'hsl(var(--gray-300) / <alpha-value>)',
              '400': 'hsl(var(--gray-400) / <alpha-value>)',
              '500': 'hsl(var(--gray-500) / <alpha-value>)',
              '600': 'hsl(var(--gray-600) / <alpha-value>)',
              '700': 'hsl(var(--gray-700) / <alpha-value>)',
              '800': 'hsl(var(--gray-800) / <alpha-value>)',
              '900': 'hsl(var(--gray-900) / <alpha-value>)',
              '1000': 'hsl(var(--gray-1000) / <alpha-value>)',
            },
            darkblue: {
              DEFAULT: 'hsl(var(--darkblue-default) / <alpha-value>)',
              '100': 'hsl(var(--darkblue-100) / <alpha-value>)',
              '200': 'hsl(var(--darkblue-200) / <alpha-value>)',
              '300': 'hsl(var(--darkblue-300) / <alpha-value>)',
              '400': 'hsl(var(--darkblue-400) / <alpha-value>)',
              '500': 'hsl(var(--darkblue-500) / <alpha-value>)',
              '600': 'hsl(var(--darkblue-600) / <alpha-value>)',
              '700': 'hsl(var(--darkblue-700) / <alpha-value>)',
              '800': 'hsl(var(--darkblue-800) / <alpha-value>)',
              '900': 'hsl(var(--darkblue-900) / <alpha-value>)',
            },
            blue: {
              DEFAULT: 'hsl(var(--blue-default) / <alpha-value>)',
              '100': 'hsl(var(--blue-100) / <alpha-value>)',
              '200': 'hsl(var(--blue-200) / <alpha-value>)',
              '300': 'hsl(var(--blue-300) / <alpha-value>)',
              '400': 'hsl(var(--blue-400) / <alpha-value>)',
              '500': 'hsl(var(--blue-500) / <alpha-value>)',
              '600': 'hsl(var(--blue-600) / <alpha-value>)',
              '700': 'hsl(var(--blue-700) / <alpha-value>)',
              '800': 'hsl(var(--blue-800) / <alpha-value>)',
              '900': 'hsl(var(--blue-900) / <alpha-value>)',
            },
            turquoise: {
              DEFAULT: 'hsl(var(--turquoise-default) / <alpha-value>)',
              '100': 'hsl(var(--turquoise-100) / <alpha-value>)',
              '200': 'hsl(var(--turquoise-200) / <alpha-value>)',
              '300': 'hsl(var(--turquoise-300) / <alpha-value>)',
              '400': 'hsl(var(--turquoise-400) / <alpha-value>)',
              '500': 'hsl(var(--turquoise-500) / <alpha-value>)',
              '600': 'hsl(var(--turquoise-600) / <alpha-value>)',
              '700': 'hsl(var(--turquoise-700) / <alpha-value>)',
              '800': 'hsl(var(--turquoise-800) / <alpha-value>)',
              '900': 'hsl(var(--turquoise-900) / <alpha-value>)',
            },
            green: {
              DEFAULT: 'hsl(var(--green-default) / <alpha-value>)',
              '100': 'hsl(var(--green-100) / <alpha-value>)',
              '200': 'hsl(var(--green-200) / <alpha-value>)',
              '300': 'hsl(var(--green-300) / <alpha-value>)',
              '400': 'hsl(var(--green-400) / <alpha-value>)',
              '500': 'hsl(var(--green-500) / <alpha-value>)',
              '600': 'hsl(var(--green-600) / <alpha-value>)',
              '700': 'hsl(var(--green-700) / <alpha-value>)',
              '800': 'hsl(var(--green-800) / <alpha-value>)',
              '900': 'hsl(var(--green-900) / <alpha-value>)',
            },
            red: {
              DEFAULT: 'hsl(var(--red-default) / <alpha-value>)',
              '100': 'hsl(var(--red-100) / <alpha-value>)',
              '200': 'hsl(var(--red-200) / <alpha-value>)',
              '300': 'hsl(var(--red-300) / <alpha-value>)',
              '400': 'hsl(var(--red-400) / <alpha-value>)',
              '500': 'hsl(var(--red-500) / <alpha-value>)',
              '600': 'hsl(var(--red-600) / <alpha-value>)',
              '700': 'hsl(var(--red-700) / <alpha-value>)',
              '800': 'hsl(var(--red-800) / <alpha-value>)',
              '900': 'hsl(var(--red-900) / <alpha-value>)',
            },
            orange: {
              DEFAULT: 'hsl(var(--orange-default) / <alpha-value>)',
              '100': 'hsl(var(--orange-100) / <alpha-value>)',
              '200': 'hsl(var(--orange-200) / <alpha-value>)',
              '300': 'hsl(var(--orange-300) / <alpha-value>)',
              '400': 'hsl(var(--orange-400) / <alpha-value>)',
              '500': 'hsl(var(--orange-500) / <alpha-value>)',
              '600': 'hsl(var(--orange-600) / <alpha-value>)',
              '700': 'hsl(var(--orange-700) / <alpha-value>)',
              '800': 'hsl(var(--orange-800) / <alpha-value>)',
              '900': 'hsl(var(--orange-900) / <alpha-value>)',
            },
            yellow: {
              DEFAULT: 'hsl(var(--yellow-default) / <alpha-value>)',
              '100': 'hsl(var(--yellow-100) / <alpha-value>)',
              '200': 'hsl(var(--yellow-200) / <alpha-value>)',
              '300': 'hsl(var(--yellow-300) / <alpha-value>)',
              '400': 'hsl(var(--yellow-400) / <alpha-value>)',
              '500': 'hsl(var(--yellow-500) / <alpha-value>)',
              '600': 'hsl(var(--yellow-600) / <alpha-value>)',
              '700': 'hsl(var(--yellow-700) / <alpha-value>)',
              '800': 'hsl(var(--yellow-800) / <alpha-value>)',
              '900': 'hsl(var(--yellow-900) / <alpha-value>)',
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
