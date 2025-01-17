#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import extractTests from './src/extract-tests/index.js';
import reset from './src/git-reset.js';
import run from './src/index.js';
import { info } from './src/log.js';
import { convertToMonorepo } from './src/monorepo.js';
import { isSolorepo } from './src/workspaces.js';

let yarg = yargs(hideBin(process.argv));

yarg.wrap(yarg.terminalWidth());

yarg
  .command(
    'reset',
    'resets the git workspace -- useful in case of error and you need to re-run' +
      ' the migrator. Each step is not idempotent, so resetting continuing after' +
      ' an error is not always possible. This runs `git clean -f -d; git checkout .',
    () => {},
    async () => {
      info(`Resetting git repo to clean state...`);

      await reset();

      info('Done! ✨');
    }
  )
  .command(
    'make-monorepo',
    'Converts a traditional v1 addon at the root of a git repository to a monorepo where that v1 addon exists as the sole workspace',
    (yargs) => {
      return yargs.option('directory', {
        describe:
          'the directory to run the migration in. defaults to the current directory',
        type: 'string',
        default: process.cwd(),
      });
    },
    async (args) => {
      info(`Converting to monorepo...`);

      await convertToMonorepo(args);

      info('Done! ✨');
    }
  )
  .command(
    'extract-tests',
    `in low-maintenance projects, or projects with many people needing context, ` +
      `it is greatly beneficial to do a v2 addon conversion in two parts: ` +
      `split the tests from the addon, and then later in a separate PR, ` +
      `do the actual v1 -> v2 conversion of the addon itself. ` +
      `extract-tests is meant to be a partial migration -- as such, it does not generate C.I.-passable code after running, as it cannot know exactly how your repo and C.I. are configured. ` +
      `Please check lints and C.I. config after running.`,
    (yargs) => {
      yargs.option('test-app-location', {
        describe:
          'The folder to place the extracted test app. ' +
          'Defaults to a sibling folder to the addon-location named "test-app"',
        type: 'string',
      });
      yargs.option('directory', {
        describe:
          'the directory to run the migration in. defaults to the current directory',
        type: 'string',
        default: process.cwd(),
      });
      yargs.option('in-place', {
        describe:
          'move the v1 addon out to a sub-folder of the current directory, and the test-app will be a sibling to that new directory.',
        type: 'boolean',
        default: true,
      });
      yargs.option('addon-location', {
        describe: `This flag is only relevant when in-place is present. This is the location that the addon will be moved to. To match the addon-blueprint, set this to the addon's name.`,
        type: 'string',
        default: 'package',
      });
      yargs.option('test-app-name', {
        describe: 'the name of the test-app package.',
        type: 'string',
        default: 'test-app',
      });
      yargs.option('analysis-only', {
        describe: 'inspect the analysis object, skipping migration entirely',
        type: 'boolean',
        default: false,
      });
      yargs.option('reuse-existing-versions', {
        describe:
          'When the test-app is generated, instead of using the (latest) dependency versions of the app blueprint it will try to use the same versions previously used in the addon.',
        type: 'boolean',
        default: false,
      });
      yargs.option('ignore-new-dependencies', {
        describe:
          'When the test-app is generated, any dependencies that are part of the default app blueprint which were not used before will be ignored. WARNING: there is a considerable risk that this leaves your dependencies in a broken state, use it only with great caution!',
        type: 'boolean',
        default: false,
      });
    },
    async (args) => {
      // "Light logic" to keep the test app to be a sibling to the addon directory (if not specified)
      let testAppLocation =
        args.testAppLocation || (args.inPlace ? 'test-app' : '../test-app');

      let isSolo = await isSolorepo(args.directory);

      if (!args.inPlace && isSolo) {
        args.inPlace = true;
        testAppLocation = args.testAppLocation || 'test-app';
      }

      return extractTests({ ...args, testAppLocation });
    }
  )
  .command(
    ['run', '$0 [addon-location]'],
    'the default command -- runs the addon migrator.',
    (yargs) => {
      yargs.option('addon-location', {
        describe:
          'the folder to place the addon package. defaults to the package name.',
        type: 'string',
      });
      yargs.option('test-app-location', {
        describe: 'the folder to place the test-app package.',
        type: 'string',
        default: 'test-app',
      });
      yargs.option('test-app-name', {
        describe: 'the name of the test-app package.',
        type: 'string',
        default: 'test-app',
      });
      yargs.option('directory', {
        describe:
          'the directory to run the migration in. defaults to the current directory',
        type: 'string',
        default: process.cwd(),
      });
      yargs.option('analysis-only', {
        describe: 'inspect the analysis object, skipping migration entirely',
        type: 'boolean',
        default: false,
      });
      yargs.option('reuse-existing-versions', {
        describe:
          'When the test-app is generated, instead of using the (latest) dependency versions of the app blueprint it will try to use the same versions previously used in the addon.',
        type: 'boolean',
        default: false,
      });
      yargs.option('ignore-new-dependencies', {
        describe:
          'When the test-app is generated, any dependencies that are part of the default app blueprint which were not used before will be ignored. WARNING: there is a considerable risk that this leaves your dependencies in a broken state, use it only with great caution!',
        type: 'boolean',
        default: false,
      });
    },
    (args) => {
      return run(args);
    }
  )
  .help().argv;
