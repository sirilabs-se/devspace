// Import rules from CLAUDE.md. Run with `npm run lint:deps`.

const MODULE_DIRS = 'src/(?:background|content|inject|shared|sidepanel/(?:core|ui))';
const MODULES = `^${MODULE_DIRS}/`;

// Component libraries, icon sets and CSS frameworks. These may be imported
// only inside src/sidepanel/ui/. Add a package here when it is approved.
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
			to: { path: MODULES, pathNot: `${MODULES}index\\.ts$` }
		},
		{
			name: 'module-public-interface-between-modules',
			comment: 'A module may import another module only through its index.ts.',
			severity: 'error',
			from: { path: `^(${MODULE_DIRS})/` },
			to: { path: MODULES, pathNot: ['^$1/', `${MODULES}index\\.ts$`] }
		},
		{
			name: 'no-import-loops',
			comment: 'Files, and so modules, must not import each other in a loop.',
			severity: 'error',
			from: {},
			to: { circular: true }
		},
		{
			name: 'contexts-never-import-each-other',
			comment:
				'background, content and inject run in different contexts and talk only through messages and storage.',
			severity: 'error',
			from: { path: '^src/(background|content|inject)/' },
			to: { path: '^src/(?!$1/)(background|content|inject)/' }
		},
		{
			name: 'core-never-imports-ui',
			comment: 'sidepanel/core must not import sidepanel/ui or any .svelte file.',
			severity: 'error',
			from: { path: '^src/sidepanel/core/' },
			to: { path: ['^src/sidepanel/ui/', '\\.svelte$'] }
		},
		{
			name: 'ui-libraries-only-in-ui',
			comment:
				'Component libraries, icon sets and CSS frameworks may be imported only inside src/sidepanel/ui/.',
			severity: 'error',
			from: { pathNot: '^src/sidepanel/ui/' },
			to: { path: uiPackagePattern }
		},
		{
			name: 'logic-tests-without-ui',
			comment: 'Logic tests must not import .svelte files or anything from sidepanel/ui.',
			severity: 'error',
			from: { path: '\\.test\\.ts$' },
			to: { path: ['\\.svelte$', '^src/sidepanel/ui/'] }
		}
	],
	options: {
		doNotFollow: { path: 'node_modules' },
		tsPreCompilationDeps: true,
		tsConfig: { fileName: 'tsconfig.json' },
		enhancedResolveOptions: {
			exportsFields: ['exports'],
			conditionNames: ['import', 'require', 'node', 'default', 'types', 'svelte']
		}
	}
};
