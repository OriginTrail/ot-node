module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "extends": "airbnb",
    "parser": "babel-eslint",
    "parserOptions": {
      "sourceType": "module",
      "ecmaVersion": 2017
    },
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "camelcase": 0,
        "no-unused-expressions": 0,
        "no-unused-vars": 0,
        "no-undef": 0,
        "no-var": 0,
        "no-use-before-define": 0,
        "vars-on-top": 0,
        "block-scoped-var": 0,
        "no-restricted-syntax": 0,
        "guard-for-in": 0,
        "no-param-reassign": 0,
        "semi": [
            "error",
            "always"
        ],
        "no-console": [
          "error",
          { "allow": ["warn", "error", "log"] }
        ],
    }
};