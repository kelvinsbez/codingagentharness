
/** @type {import('jest').Config} */

module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    cacheDirectory: "<rootDir>/node_modules/.cache/jest",

    testMatch: [
        "<rootDir>/test/**/*.test.ts"
    ],

    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "tsconfig.test.json"
            }
        ]
    }
};
