import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    'versions.json',
  ],
  rules: {
    'no-console': 'off', // allow console.log()
    'no-new': 'off', // allow new Notice()
  },
}, md())

/**
 * markdown config
 * @return {import('@antfu/eslint-config').TypedFlatConfigItem}
 */
function md() {
  return {
    files: ['**/*.md'],
    rules: {
      'style/no-trailing-spaces': 'off',
    },
  }
}
