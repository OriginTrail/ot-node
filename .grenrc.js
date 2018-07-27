module.exports = {
    "dataSource": "commits",
    "prefix": "",
    "includeMessages": "merges",
    "changelogFilename": "CHANGELOG.md",
    "ignore-labels": "minor",
    "groupBy": {
        "Improvements:": ["enhancement", "internal"],
        "Bug Fixes:": ["bug"]
    }
}