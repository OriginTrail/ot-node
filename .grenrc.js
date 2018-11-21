module.exports = {
    "dataSource": "prs",
    "prefix": "",
    "includeMessages": "merges",
    "changelogFilename": "CHANGELOG.md",
    "ignore-labels": ["minor", "internal process"],
    "groupBy": {
        "Features": ["enhancement", "breaking change"],
        "Chore:": ["chore", "internal"],
        "Bug Fixes:": ["bug"]
    }
}