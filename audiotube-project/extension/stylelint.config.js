// Keeps the look in one place: every colour, font, size, corner radius and
// shadow in the side panel must come from a design token in
// src/sidepanel/ui/theme.css. The content script's CSS is exempt.

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
		'unit-disallowed-list': [
			['px', 'rem', 'em', 'pt', 'pc', 'cm', 'mm', 'in', 'ex', 'ch'],
			{ ignoreMediaFeatureNames: { px: ['/width/', '/height/'], em: ['/width/', '/height/'] } }
		],
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
	ignoreFiles: ['src/sidepanel/ui/theme.css']
};
