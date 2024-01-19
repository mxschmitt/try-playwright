import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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
    const response = await fetch(`https://unpkg.com/${packageName}/${file}`);
    if (!response.ok) {
        throw new Error(`Could not download ${packageName}/${file}`);
    }
    return await response.text();
}

async function updateFrontendTypes() {
    const typesFile = 'frontend/src/components/Editor/types.txt';
    let typesBuffer = '';
    typesBuffer += await getNpmFile('@types/node@18', 'globals.d.ts');
    typesBuffer += 'declare module \'playwright-core\' {\n';
    typesBuffer += await getNpmFile(`playwright-core`, 'types/protocol.d.ts');
    typesBuffer += (await getNpmFile(`playwright-core`, 'types/structs.d.ts')).split('\n').slice(19).join('\n');
    typesBuffer += (await getNpmFile(`playwright-core`, 'types/types.d.ts')).split('\n').slice(23).join('\n');
    typesBuffer += '}\n';
    typesBuffer += 'declare module \'playwright\' {\n';
    typesBuffer += '  export * from \'playwright-core\';\n';
    typesBuffer += '}\n';
    typesBuffer += 'declare module \'@playwright/test\' {\n';
    typesBuffer += (await getNpmFile('playwright', 'types/test.d.ts')).split('\n').map(line => line.replace('@playwright/test/types/expect-types', '@playwright/test-expect')).join('\n');
    typesBuffer += '}\n';
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
            const mavenResponse = await fetch('https://search.maven.org/solrsearch/select?q=g:com.microsoft.playwright+AND+a:playwright&rows=1&wt=json');
            const mavenData = await mavenResponse.json();
            return mavenData.response.docs[0].latestVersion;

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
