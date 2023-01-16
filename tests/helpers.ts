/* eslint-disable @typescript-eslint/no-explicit-any */
import { execa } from 'execa';
import fs from 'fs';
import fse from 'fs-extra';
import { dirname, join } from 'path';
import { Project } from 'scenario-tester';
import { fileURLToPath } from 'url';
import { expect } from 'vitest';

/**
  * NOTE: these tests *only* use pnpm, becausue npm and yarn are frail 
  *       and slow.
  */

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function addonFrom(fixture: string): Promise<Project> {
  let packagePath = join(__dirname, 'fixtures', fixture, 'package.json');
  let sampleAddon: null | { path: string; destroy: () => Promise<void> } = null;

  if (!fs.existsSync(packagePath)) {
    let sample = join(__dirname, 'samples', fixture, 'input.json');

    if (!fs.existsSync(sample)) {
      throw new Error(`Unable to resolve fixture ${fixture}`);
    }

    let addonObject = fse.readJSONSync(sample);

    sampleAddon = await restoreAddon(addonObject);

    if (!sampleAddon) {
      throw new Error(`Unable to restore sample addon: ${fixture}`);
    }

    packagePath = join(sampleAddon.path, 'package.json');
  }

  let originalPackageJsonPath = require.resolve(packagePath);
  const nodeModulesPath = join(dirname(originalPackageJsonPath), 'node_modules');

  // This TS is compiled to CJS, so require is fine
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let originalPackageJson = require(originalPackageJsonPath);
  let fixturePath = dirname(originalPackageJsonPath);

  let project = Project.fromDir(fixturePath);

  project.name = originalPackageJson.name;

  await project.write();

    try {
      // we need this to not resolve ember-cli from addon itself (all deps is mocked)
      fse.rmSync(join(project.baseDir, 'node_modules', 'ember-cli'), { recursive: true });
    } catch (e) {
      // FINE
    }

  return project;
}

export const binPath = join(__dirname, '..', 'bin.js');

export async function migrate(project: Pick<Project, 'baseDir'>) {
  let { stdout } = await execa('node', [binPath], { cwd: project.baseDir });

  expect(stdout).toMatch(`🎉 Congratulations! Your addon is now formatted as a V2 addon!`);
}

export async function install(project: Pick<Project, 'baseDir'>) {
  await execa('pnpm', ['install'], {
    cwd: project.baseDir,
    preferLocal: true,
  });
}

export async function build(project: Pick<Project, 'baseDir' | 'name'>) {
  let addonPath = join(project.baseDir, project.name);
  let { stdout, exitCode } = await execa('pnpm', ['run', 'build'], { cwd: addonPath });

  // subset of full stdout
  // can't use snapshot testing due to time taken printed
  // to stdout
  console.debug(stdout);
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch(`$ concurrently 'npm:build:*'`);
  expect(stdout).toMatch('[build:*js] > rollup -c ./rollup.config.js');
  expect(stdout).toMatch('[build:*docs] > cp ../README.md ./README.md');
  // Message from concurrently
  expect(stdout).toMatch('npm run build:js exited with code 0');

  let result = await execa('ls', { cwd: join(project.baseDir, project.name) });

  expect(result.stdout).toMatch('dist');
}

export async function emberTest(project: Pick<Project, 'baseDir'>) {
  let { stdout, exitCode } = await execa('pnpm', ['run', 'ember', 'test'], {
    cwd: join(project.baseDir, 'test-app'),
  });

  // subset of full stdout
  // can't use snapshot testing due to time taken printed
  // to stdout
  console.debug(stdout);
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Built project successfully');
  expect(stdout).toMatch('# skip  0');
  expect(stdout).toMatch('# todo  0');
  expect(stdout).toMatch('# fail  0');
}

export async function verify(fixtureName: string) {
  let project = await addonFrom(fixtureName);

  await migrate(project);
  await install(project);
  await build(project);
  await emberTest(project);
}
