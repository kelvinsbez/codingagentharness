
/** @type {import('dependency-cruiser').IConfiguration} */

module.exports = {
    forbidden: [
        {
            name: "no-handler-to-handler",
            comment: "Handlers must communicate through the event bus.",
            severity: "error",
            from: {
                path: "^src/handlers/"
            },
            to: {
                path: "^src/handlers/"
            }
        },
        {
            name: "no-domain-to-infra-handlers",
            comment: "Domain must not depend on infrastructure or handlers.",
            severity: "error",
            from: {
                path: "^src/domain/"
            },
            to: {
                path: "^src/(infra|handlers)/"
            }
        },
        {
            name: "no-infra-to-handlers",
            comment: "Infrastructure must not depend on handlers.",
            severity: "error",
            from: {
                path: "^src/infra/"
            },
            to: {
                path: "^src/handlers/"
            }
        },
        {
            name: "no-circular",
            comment: "Circular dependencies are forbidden.",
            severity: "error",
            from: {},
            to: {
                circular: true
            }
        }
    ]
};
