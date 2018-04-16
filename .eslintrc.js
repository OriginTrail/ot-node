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
        "class-methods-use-this": 0,
        "no-unused-vars": 0,
        "no-return-assign": 0,
        "consistent-return": 0,
        "no-var": 0,
        "vars-on-top": 0,
        "block-scoped-var": 0,
        "no-restricted-syntax": 0,
        "guard-for-in": 0,
        "no-param-reassign": 0,
        "no-underscore-dangle": 0,
        "no-shadow": 0,
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