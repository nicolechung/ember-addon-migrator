import { packageJson } from 'ember-apply';
import { execa } from 'execa';
import fse from 'fs-extra';
import path from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

import { assertEmberTest, extractTests } from '../assertions.js';
import {
  type Project,
  addonFrom,
  disableNoEmitOnError,
  findFixtures,
  install,
  lintTestApp,
} from '../helpers.js';

let fixtures = await findFixtures();

for (let fixtureName of fixtures) {
  describe(`extract-tests on fixture: ${fixtureName}`, () => {
    let project: Project;

    beforeAll(async () => {
      project = await addonFrom(fixtureName);
      await extractTests(project, ['--in-place']);
      // For tests, since we aren't in a monorepo,
      // make the rootDir a monorepo
      // "extra-tests" does not create monorepos
      //
      // TODO: either add a flag or determine when we should make a project a monorepo
      await fse.writeFile(
        path.join(project.rootPath, 'package.json'),
        JSON.stringify(
          {
            name: 'root',
            private: true,
            version: '0.0.0',
            // Some transient deps bring in eslint7, which messes up tsc somehow
            pnpm: { overrides: { '@types/eslint': '^8.0.0' } },
          },
          null,
          2
        )
      );
      await fse.writeFile(
        path.join(project.rootPath, 'pnpm-workspace.yaml'),
        `packages:\n` + `- package\n` + `- test-app\n`
      );
      await fse.writeFile(
        path.join(project.rootPath, '.gitignore'),
        `node_modules/`
      );
      await packageJson.modify((json) => {
        if (json.dependencies?.[fixtureName]) {
          json.dependencies[fixtureName] = `workspace:*`;
        }

        if (json.devDependencies?.[fixtureName]) {
          json.devDependencies[fixtureName] = `workspace:*`;
        }
      });

      await install(project);

      // !!! Attempt to handle v1 TS projects
      // These, like v2 addons, need their types built separately
      // However, this can fail for a ton of reasons, we'll to flip noEmitOnError in the app
      // but as the TS blueprint is iterated on, these tests may begin failing (again) in the future
      await disableNoEmitOnError(project.testAppPath);

      // This package causes typechecking to fail, and will for packages out in the wild as well.
      // This is due to a non-breaking floating update of both
      // @types/ember__test-helpers (removing types) and @ember/test-helpers (adding types)
      // which is a conflicting migration.
      if (
        await fse.pathExists(path.join(project.packagePath, 'tsconfig.json'))
      ) {
        await packageJson.removeDevDependencies(
          ['@types/ember__test-helpers'],
          project.packagePath
        );
        await install(project);
        // ember-cli-typescript set up this prepack command,
        // but due to instability of transient deps, we have to skip lib check (skipping @types/eslint)
        // to even get types to build at all
        await execa(
          'pnpm',
          [
            'tsc',
            '--allowJs',
            'false',
            '--noEmit',
            'false',
            '--rootDir',
            project.packagePath,
            '--isolatedModules',
            'false',
            '--declaration',
            '--emitDeclarationOnly',
            '--pretty',
            'true',
            '--skipLibCheck',
          ],
          { cwd: project.packagePath, env: { JOBS: '1' } }
        );
      }
    });

    test('verify tmp project', async () => {
      console.debug(`verify tmp project 'ls -la' @ ${project.rootPath}`);

      await execa('ls', ['-la'], { cwd: project.rootPath, stdio: 'inherit' });

      expect(
        await fse.pathExists(project.rootPath),
        `rootPath: ${project.rootPath}`
      ).toBe(true);
      expect(
        await fse.pathExists(project.addonPath),
        `addonPath: ${project.addonPath}`
      ).toBe(false);
      expect(
        await fse.pathExists(project.packagePath),
        `packagePath: ${project.packagePath}`
      ).toBe(true);
      expect(
        await fse.pathExists(project.testAppPath),
        `testAppPath: ${project.testAppPath}`
      ).toBe(true);
    });

    test('lint test-app', async () => {
      let result = await lintTestApp(project);

      expect(result).toMatchObject({ exitCode: 0 });
    });

    test('tests pass', async () => {
      await assertEmberTest(project);
    });
  });
}
