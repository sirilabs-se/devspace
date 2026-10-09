// Import rules from the system doc's Architecture Checks table.
// Run with `npm run lint:deps`.

const MODULES = '^src/lib/server/modules/';

// Component libraries, icon sets and CSS frameworks. These may be imported
// only inside src/lib/ui/. Add a package here when it is approved.
const UI_PACKAGES = [
	'tailwindcss',
	'@tailwindcss/',
	'unocss',
	'@unocss/',
	'bootstrap',
	'bulma',
	'daisyui',
	'flowbite',
	'flowbite-svelte',
	'@skeletonlabs/',
	'bits-ui',
	'melt',
	'@melt-ui/',
	'shadcn-svelte',
	'@smui/',
	'carbon-components-svelte',
	'svelte-headlessui',
	'lucide-svelte',
	'@lucide/',
	'@iconify/',
	'phosphor-svelte',
	'svelte-hero-icons',
	'@steeze-ui/',
	'@tabler/',
	'@fortawesome/'
];

const uiPackagePattern = `(^|node_modules/)(${UI_PACKAGES.map((name) =>
	name.endsWith('/') ? name : `${name}(/|$)`
).join('|')})`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: 'module-public-interface-from-outside',
			comment: 'Code outside a module may import it only through its index.ts.',
			severity: 'error',
			from: { pathNot: MODULES },
			to: { path: `${MODULES}[^/]+/`, pathNot: `${MODULES}[^/]+/index\\.ts$` }
		},
		{
			name: 'module-public-interface-between-modules',
			comment: 'A module may import another module only through its index.ts.',
			severity: 'error',
			from: { path: `${MODULES}([^/]+)/` },
			to: {
				path: `${MODULES}[^/]+/`,
				pathNot: [`${MODULES}$1/`, `${MODULES}[^/]+/index\\.ts$`]
			}
		},
		{
			name: 'no-import-loops',
			comment: 'Files, and so modules, must not import each other in a loop.',
			severity: 'error',
			from: {},
			to: { circular: true }
		},
		{
			name: 'login-library-only-in-identity',
			comment: 'Only the Identity module may import the login library (ADR 0005).',
			severity: 'error',
			from: { pathNot: `${MODULES}identity/` },
			to: { path: '(^|node_modules/)(better-auth(/|$)|@better-auth/)' }
		},
		{
			name: 'ui-libraries-only-in-ui',
			comment:
				'Component libraries, icon sets and CSS frameworks may be imported only inside src/lib/ui/ (ADR 0002).',
			severity: 'error',
			from: { pathNot: '^src/lib/ui/' },
			to: { path: uiPackagePattern }
		},
		{
			name: 'logic-tests-without-ui',
			comment: 'Logic tests must not import .svelte files or $lib/ui (ADR 0002).',
			severity: 'error',
			from: { path: '^src/.+\\.test\\.ts$' },
			to: { path: ['\\.svelte$', '^src/lib/ui/'] }
		}
	],
	options: {
		doNotFollow: { path: 'node_modules' },
		tsPreCompilationDeps: true,
		tsConfig: { fileName: 'tsconfig.depcruise.json' },
		enhancedResolveOptions: {
			exportsFields: ['exports'],
			conditionNames: ['import', 'require', 'node', 'default', 'types', 'svelte']
		}
	}
};
