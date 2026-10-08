import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { isBuiltin } from 'module';
// The TypeScript 7 API is experimental and may change between releases.
import { API } from 'typescript/unstable/sync';
import { createVirtualFileSystem } from 'typescript/unstable/fs';
import { SyntaxKind } from 'typescript/unstable/ast';
import { forEachLeadingCommentRange } from 'typescript/unstable/ast/scanner';

const dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * @param {string} folder
 * @param {import('child_process').ExecSyncOptions} options
 */
const execSyncAndLog = (command, options) => {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit', ...options });
};

/**
 * @param {string} folder 
 */
async function updateDependencies(folder) {
    const cwd = path.join(dirname, folder)
    execSyncAndLog('npx -y npm-check-updates -u', { cwd  });
    execSyncAndLog('npm install', { cwd });
}

/**
 * @param {string} packageName
 * @param {string} file
 * @returns {Promise<string>}
 */
async function getNpmFile(packageName, file) {
    const response = await fetch(`https://unpkg.com/${packageName}/${file}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        },
    });
    if (!response.ok) {
        throw new Error(`Could not download ${packageName}/${file}. Status: ${response.status}. Body: ${await response.text()}`);
    }
    return await response.text();
}

/**
 * Parses the given declaration files with the TypeScript compiler and passes the
 * resulting source files to `callback`. The files only live in a virtual file system.
 *
 * @template T
 * @param {Record<string, string>} files - Map of file name to file content
 * @param {(sourceFiles: Record<string, import('typescript/unstable/ast').SourceFile>) => T} callback
 * @returns {T}
 */
function withParsedFiles(files, callback) {
    const root = '/virtual';
    const toFileName = (/** @type {string} */ name) => `${root}/${name}`;
    const api = new API({
        cwd: root,
        fs: createVirtualFileSystem(Object.fromEntries(Object.entries(files).map(([name, content]) => [toFileName(name), content]))),
    });
    try {
        const snapshot = api.updateSnapshot({ openFiles: Object.keys(files).map(toFileName) });
        const sourceFiles = Object.fromEntries(Object.keys(files).map(name => {
            const fileName = toFileName(name);
            const sourceFile = snapshot.getDefaultProjectForFile(fileName)?.program.getSourceFile(fileName);
            if (!sourceFile)
                throw new Error(`Could not parse ${name}`);
            if (sourceFile.text !== files[name])
                throw new Error(`Parsed text of ${name} does not match its content`);
            return [name, sourceFile];
        }));
        return callback(sourceFiles);
    } finally {
        api.close();
    }
}

/**
 * @typedef {{ start: number, end: number, text: string }} TextEdit
 */

/**
 * @param {string} content
 * @param {TextEdit[]} edits - Non-overlapping edits
 * @returns {string}
 */
function applyEdits(content, edits) {
    let result = content;
    for (const { start, end, text } of [...edits].sort((a, b) => b.start - a.start))
        result = result.slice(0, start) + text + result.slice(end);
    return result;
}

/**
 * Guards against the experimental API reporting positions in another unit (e.g. UTF-8 bytes).
 *
 * @param {import('typescript/unstable/ast').SourceFile} sourceFile
 * @param {import('typescript/unstable/ast').Node} node
 * @param {string} expected
 */
function assertNodeStartsWith(sourceFile, node, expected) {
    const actual = sourceFile.text.slice(node.getStart(sourceFile), node.getStart(sourceFile) + expected.length);
    if (actual !== expected)
        throw new Error(`Unexpected node position in ${sourceFile.fileName}: expected "${expected}", got "${actual}"`);
}

/**
 * Whether the module can't be resolved from within the concatenated file: relative
 * paths point to files which got inlined and only the Node.js globals are available.
 *
 * @param {import('typescript/unstable/ast').Expression | undefined} moduleSpecifier
 * @returns {boolean}
 */
function isUnresolvableModule(moduleSpecifier) {
    if (moduleSpecifier?.kind !== SyntaxKind.StringLiteral)
        return false;
    return moduleSpecifier.text.startsWith('.') || isBuiltin(moduleSpecifier.text);
}

/**
 * Removes the module syntax from a type definition file so its declarations can be
 * concatenated into an ambient module declaration:
 * - imports/re-exports of relative paths and Node.js builtins (they don't exist in the concatenated file)
 * - the file header (copyright comments and triple-slash reference directives)
 *
 * Imports of other packages (e.g. the optional `zod` import, guarded by `@ts-ignore`) are kept.
 *
 * @param {import('typescript/unstable/ast').SourceFile} sourceFile
 * @returns {string}
 */
function stripModuleSyntax(sourceFile) {
    /** @type {TextEdit[]} */
    const edits = [];
    const isModuleSyntax = (/** @type {import('typescript/unstable/ast').Statement} */ statement) => {
        switch (statement.kind) {
            case SyntaxKind.ImportDeclaration:
            case SyntaxKind.ExportDeclaration:
                return isUnresolvableModule(statement.moduleSpecifier);
            case SyntaxKind.ImportEqualsDeclaration:
                return statement.moduleReference.kind === SyntaxKind.ExternalModuleReference && isUnresolvableModule(statement.moduleReference.expression);
            default:
                return false;
        }
    };

    for (const statement of sourceFile.statements) {
        if (!isModuleSyntax(statement))
            continue;
        assertNodeStartsWith(sourceFile, statement, statement.kind === SyntaxKind.ExportDeclaration ? 'export' : 'import');
        // The full range includes leading trivia, e.g. `// @ts-ignore` comments belonging to the statement.
        edits.push({ start: statement.pos, end: statement.end, text: '' });
    }

    // Drop the file header (copyright comments and triple-slash directives), but keep the
    // comments directly attached to the first remaining statement, e.g. its JSDoc.
    const firstStatement = sourceFile.statements.find(statement => !isModuleSyntax(statement));
    if (firstStatement) {
        const { text } = sourceFile;
        /** @type {{ pos: number, end: number }[]} */
        const comments = [];
        forEachLeadingCommentRange(text, firstStatement.pos, (pos, end) => {
            comments.push({ pos, end });
        });
        let headerEnd = firstStatement.getStart(sourceFile);
        for (const comment of comments.reverse()) {
            const isSeparatedByBlankLine = /\n[ \t\r]*\n/.test(text.slice(comment.end, headerEnd));
            if (isSeparatedByBlankLine || text.startsWith('///', comment.pos))
                break;
            headerEnd = comment.pos;
        }
        edits.push({ start: firstStatement.pos, end: headerEnd, text: '' });
    }

    return applyEdits(sourceFile.text, edits);
}

/**
 * Rewrites module specifiers of import/export declarations and import types.
 *
 * @param {import('typescript/unstable/ast').SourceFile} sourceFile
 * @param {Record<string, string>} replacements - Map of old to new module specifier
 * @returns {string}
 */
function rewriteModuleSpecifiers(sourceFile, replacements) {
    /** @type {TextEdit[]} */
    const edits = [];
    const moduleSpecifierParents = new Set([
        SyntaxKind.ImportDeclaration,
        SyntaxKind.ExportDeclaration,
        SyntaxKind.ExternalModuleReference,
        SyntaxKind.LiteralType, // import('...') types
    ]);
    const visit = (/** @type {import('typescript/unstable/ast').Node} */ node) => {
        if (node.kind === SyntaxKind.StringLiteral && moduleSpecifierParents.has(node.parent.kind) && Object.hasOwn(replacements, node.text)) {
            const start = node.getStart(sourceFile);
            const quote = sourceFile.text[start];
            assertNodeStartsWith(sourceFile, node, quote + node.text + quote);
            edits.push({ start, end: node.end, text: quote + replacements[node.text] + quote });
        }
        node.forEachChild(visit);
    };
    visit(sourceFile);
    return applyEdits(sourceFile.text, edits);
}

async function updateFrontendTypes() {
    const typesFile = 'frontend/src/components/Editor/types.txt';
    const files = {
        'globals.d.ts': await getNpmFile('@types/node@18', 'globals.d.ts'),
        'protocol.d.ts': await getNpmFile(`playwright-core`, 'types/protocol.d.ts'),
        'structs.d.ts': await getNpmFile(`playwright-core`, 'types/structs.d.ts'),
        'types.d.ts': await getNpmFile(`playwright-core`, 'types/types.d.ts'),
        'test.d.ts': await getNpmFile('playwright', 'types/test.d.ts'),
    };

    const typesBuffer = withParsedFiles(files, sourceFiles => {
        let typesBuffer = '';

        // Add Node.js global types
        typesBuffer += stripModuleSyntax(sourceFiles['globals.d.ts']);
        typesBuffer += '\n';

        // Add playwright-core module
        typesBuffer += 'declare module \'playwright-core\' {\n';
        typesBuffer += files['protocol.d.ts'];
        typesBuffer += stripModuleSyntax(sourceFiles['structs.d.ts']);
        typesBuffer += '\n';
        typesBuffer += stripModuleSyntax(sourceFiles['types.d.ts']);
        typesBuffer += '}\n';

        // Add playwright module (re-exports playwright-core)
        typesBuffer += 'declare module \'playwright\' {\n';
        typesBuffer += '  export * from \'playwright-core\';\n';
        typesBuffer += '}\n';

        // Add @playwright/test module
        typesBuffer += 'declare module \'@playwright/test\' {\n';
        // Fix internal reference paths that won't exist in the concatenated file
        typesBuffer += rewriteModuleSpecifiers(sourceFiles['test.d.ts'], {
            '@playwright/test/types/expect-types': '@playwright/test-expect',
        });
        typesBuffer += '}\n';
        return typesBuffer;
    });

    fs.writeFileSync(typesFile, typesBuffer);
}

/**
 * @param {string} lang
 * @returns {Promise<string>}
 */
async function getVersionForLanguageBinding(lang) {
    switch (lang) {
        case 'js':
            const npmResponse = await fetch('https://registry.npmjs.org/playwright');
            const npmData = await npmResponse.json();
            return npmData['dist-tags'].latest;

        case 'java':
            // central.sonatype.com is the authoritative source; search.maven.org's
            // solr index lags and reported a stale latestVersion (e.g. 1.52.0).
            const mavenResponse = await fetch('https://central.sonatype.com/api/internal/browse/component/versions?sortField=normalizedVersion&sortDirection=desc&page=0&size=1&filter=namespace%3Acom.microsoft.playwright%2Cname%3Aplaywright', {
                headers: { 'Accept': 'application/json' },
            });
            const mavenData = await mavenResponse.json();
            return mavenData.components[0].version;

        case 'python':
            const pypiResponse = await fetch('https://pypi.org/pypi/playwright/json');
            const pypiData = await pypiResponse.json();
            return pypiData.info.version;

        case 'csharp':
            const nugetResponse = await fetch('https://api.nuget.org/v3-flatcontainer/microsoft.playwright/index.json');
            const nugetData = await nugetResponse.json();
            return nugetData.versions.pop();

        default:
            throw new Error(`Unknown language binding ${lang}`);
    }
}

async function updateWorker(workerDir, version) {
    const dockerFile = `./worker-${workerDir}/Dockerfile`;
    const dockerFileContent = fs.readFileSync(dockerFile).toString();
    const newDockerFileContent = dockerFileContent.replace(/ARG PLAYWRIGHT_VERSION=.*/, `ARG PLAYWRIGHT_VERSION=${version}`);
    await fs.promises.writeFile(dockerFile, newDockerFileContent);
}


async function updateWorkers() {
    await updateWorker('csharp', await getVersionForLanguageBinding('csharp'));
    await updateWorker('java', await getVersionForLanguageBinding('java'));
    await updateWorker('javascript', await getVersionForLanguageBinding('js'));
    await updateWorker('python', await getVersionForLanguageBinding('python'));
}

async function updateMainReadMeBadge() {
    const readMeFile = path.join(dirname, 'README.md');
    const readMeContent = (await fs.promises.readFile(readMeFile)).toString();
    const newReadMeContent = readMeContent.replace(/Playwright-\d+\.\d+\.\d+-blue\.svg/, `Playwright-${await getVersionForLanguageBinding('js')}-blue.svg`);
    await fs.promises.writeFile(readMeFile, newReadMeContent);
}

await updateDependencies('frontend');
await updateDependencies('e2e');
await updateFrontendTypes();
await updateWorkers();
await updateMainReadMeBadge();
