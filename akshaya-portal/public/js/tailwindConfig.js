tailwind.config = {
    theme: {
      extend: {
        colors: {
          primary: '#6366F1',     // Indigo 500
          secondary: '#3B82F6',   // Sky 500
          accent: '#22D3EE',      // Cyan 400
          'bg-light': '#F9FAFB',  // Light gray
        }
      }
    },
    daisyui: {
      themes: [
        {
          calmblue: {
            primary: '#6366F1',
            secondary: '#3B82F6',
            accent: '#22D3EE',
            neutral: '#F9FAFB',
            'base-100': '#FFFFFF',
            'base-200': '#F3F4F6',
            'base-300': '#E5E7EB',
            info: '#3ABFF8',
            success: '#36D399',
            warning: '#FBBD23',
            error: '#F87272',
          },
        },
      ],
    }
  }