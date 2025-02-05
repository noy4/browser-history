import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'no-console': 'off', // allow console.log()
    'no-new': 'off', // allow new Notice()
  },
})
