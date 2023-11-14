module.exports = {
    env: {
        es2020: true,
        node: true,
    },
    extends: ['airbnb/base', 'prettier'],
    parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
    },
    rules: {
        'linebreak-style': ['error', 'unix'],
        'class-methods-use-this': 0,
        'consistent-return': 0,
        'no-restricted-syntax': 0,
        'guard-for-in': 0,
        'no-console': 'warn',
        'no-continue': 0,
        'no-underscore-dangle': 0,
        'import/extensions': 0,
    },
    overrides: [
        {
            files: ['*.test.js', '*.spec.js'],
            rules: {
                'no-unused-expressions': 'off',
            },
        },
        {
            files: ['*-mock.js', '*.test.js'],
            rules: {
                'no-empty-function': 'off',
                'no-unused-vars': 'off',
            },
        },
    ],
};
