/**
 * Type declarations for integration tests and sidecar YAML files.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

declare module '*.yaml' {
    const content: string;
    export default content;
}

declare module '*.yml' {
    const content: string;
    export default content;
}

declare module '*.yaml?raw' {
    const content: string;
    export default content;
}

declare module '*.beam' {
    const content: string;
    export default content;
}
declare module '*.beam?raw' {
    const content: string;
    export default content;
}
