module.exports = {
    env: {
        es6: true,
        node: true,
    },
    extends: ['airbnb/base', 'prettier'],
    parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
    },
    rules: {
        'linebreak-style': ['error', 'unix'],
        camelcase: 0,
        'class-methods-use-this': 0,
        'consistent-return': 0,
        'no-restricted-syntax': 0,
        'guard-for-in': 0,
        'no-console': 'warn',
        'no-continue': 1,
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
            files: ['*-mock.js'],
            rules: {
                'no-unused-vars': 'off',
            },
        },
    ],
};
