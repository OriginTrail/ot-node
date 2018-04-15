Contributing
============

Want to contribute? Check out our [issue board](http://waffle.io/kadtools/kad)!

This document outlines general patterns and conventions for contributing
to the project. **For in-depth documentation on Kad,
[read the documentation](http://kadtools.github.io).**

Coding Style
------------

Kad adheres to
[Felix's Node.js Style Guide](https://github.com/felixge/node-style-guide).

Test Coverage
-------------

At the time of writing, Kad has complete code coverage (100%) through
it's test suite. It is important to never decrease coverage, so be sure to
include tests for any new code.

You can run the coverage report with:

```
npm run coverage
```

Linting
-------

To help maintain consistent expectations for code quality and enforcing these
conventions, there is an included `.eslintrc` file. Most editors support using
this to alert you of offending code in real time but, if your editor does not,
you can run the linter with:

```
npm run linter
```

Alternatively, the linter will run as part of the test suite as well, which can
be executed with:

```
npm test
```

---

Have fun and be excellent!
