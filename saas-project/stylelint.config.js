// Keeps the look in one place: every colour, font, size, corner radius and
// shadow must come from a design token in src/lib/ui/theme.css.

const tokenOrKeyword = [
	'/^var\\(--[a-z0-9-]+\\)$/',
	'inherit',
	'initial',
	'unset',
	'none',
	'normal',
	'0'
];

/** @type {import('stylelint').Config} */
export default {
	overrides: [{ files: ['**/*.svelte'], customSyntax: 'postcss-html' }],
	rules: {
		// Colours
		'color-no-hex': true,
		'color-named': 'never',
		'function-disallowed-list': [
			'rgb',
			'rgba',
			'hsl',
			'hsla',
			'hwb',
			'lab',
			'lch',
			'oklab',
			'oklch',
			'color',
			'color-mix'
		],
		// Sizes and spacing: no fixed lengths, so they have to be tokens.
		'unit-disallowed-list': [
			['px', 'rem', 'em', 'pt', 'pc', 'cm', 'mm', 'in', 'ex', 'ch'],
			{ ignoreMediaFeatureNames: { px: ['/width/', '/height/'], em: ['/width/', '/height/'] } }
		],
		// Fonts, corner radii and shadows
		'declaration-property-value-allowed-list': {
			'font-family': tokenOrKeyword,
			'font-size': tokenOrKeyword,
			'font-weight': tokenOrKeyword,
			'line-height': tokenOrKeyword,
			'border-radius': tokenOrKeyword,
			'box-shadow': tokenOrKeyword,
			font: tokenOrKeyword
		}
	},
	ignoreFiles: ['src/lib/ui/theme.css']
};
