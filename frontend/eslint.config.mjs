import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * Mechanical enforcement of FRONTEND_SPEC.md rules that would otherwise be promises:
 *  - the not-allowed libraries (section 14.3 and the build brief),
 *  - ground rule 8 / section 15.4: an `ip` field never reaches the DOM except through maskIp().
 */
const BANNED_LIBRARIES = [
  'gsap',
  'gsap/*',
  'framer-motion',
  'lenis',
  'lenis/*',
  '@studio-freight/lenis',
  'leaflet',
  'leaflet/*',
  'react-leaflet',
  'mapbox-gl',
  'mapbox-gl/*',
  '@react-three/*',
  'lottie-web',
  '@lottiefiles/*',
  'lottie-react',
  'recharts',
  'chart.js',
  'chart.js/*',
  'react-chartjs-2',
  'victory',
  'victory-*',
  '@nivo/*',
  'apexcharts',
  'react-apexcharts',
  'echarts',
  'highcharts',
  'plotly.js',
  'd3',
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'motion',
              message:
                'Not allowed by FRONTEND_SPEC.md section 14.3. Anime.js v4 is the only animation library.',
            },
          ],
          patterns: BANNED_LIBRARIES.map((group) => ({
            group: [group],
            message:
              'Not allowed by FRONTEND_SPEC.md section 14.3. Anime.js v4 is the only animation library; d3-scale, d3-shape and d3-array are the only d3 packages.',
          })),
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXExpressionContainer > MemberExpression[property.name=/^(ip|ip_str|ipAddress|ip_address)$/]',
          message:
            'Do not render an IP field directly. Pass it through maskIp() from @/lib/privacy/mask-ip (FRONTEND_SPEC.md section 15.4).',
        },
        {
          selector:
            'JSXExpressionContainer > TemplateLiteral > MemberExpression[property.name=/^(ip|ip_str|ipAddress|ip_address)$/]',
          message:
            'Do not render an IP field directly. Pass it through maskIp() from @/lib/privacy/mask-ip (FRONTEND_SPEC.md section 15.4).',
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'dist/**',
    'src/lib/api/schema.d.ts',
    'src/lib/content/facts.generated.ts',
    'src/lib/brand/hood-geometry.json',
  ]),
]);
