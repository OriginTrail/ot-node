module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "extends": "airbnb",
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