import * as fs from 'node:fs';
import * as path from 'node:path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { getCwd } from '../utils/context.js';
import { printTitle, icons, colors } from '../utils/logger.js';

const GITHUB_ACTIONS_TEMPLATE = `name: Expo CI

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm install

      - name: Run Expo CI Doctor
        run: npx expo-ci-doctor ci

      - name: Run Expo checks
        run: npx expo-ci-doctor doctor
`;

const GITLAB_CI_TEMPLATE = `stages:
  - test

expo-ci:
  stage: test
  image: node:18
  script:
    - npm install
    - npx expo-ci-doctor ci
    - npx expo-ci-doctor doctor
`;

const CIRCLECI_TEMPLATE = `version: 2.1
jobs:
  build:
    docker:
      - image: cimg/node:18.17.0
    steps:
      - checkout
      - run:
          name: "Install dependencies"
          command: npm install
      - run:
          name: "Run Expo CI Doctor"
          command: npx expo-ci-doctor ci
      - run:
          name: "Run Expo checks"
          command: npx expo-ci-doctor doctor

workflows:
  build_test:
    jobs:
      - build
`;

const BITBUCKET_TEMPLATE = `image: node:18

pipelines:
  default:
    - step:
        name: Build and Test
        script:
          - npm install
          - npx expo-ci-doctor ci
          - npx expo-ci-doctor doctor
`;

export async function ciTemplateCommand(): Promise<void> {
  const cwd = getCwd();

  printTitle('CI Template Generator');

  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which CI provider do you use?',
      choices: [
        { name: '1) GitHub Actions', value: 'github' },
        { name: '2) GitLab CI', value: 'gitlab' },
        { name: '3) CircleCI', value: 'circleci' },
        { name: '4) Bitbucket', value: 'bitbucket' },
      ],
    },
  ]);

  let filePath = '';
  let content = '';

  switch (provider) {
    case 'github':
      filePath = '.github/workflows/expo-ci.yml';
      content = GITHUB_ACTIONS_TEMPLATE;
      break;
    case 'gitlab':
      filePath = '.gitlab-ci.yml';
      content = GITLAB_CI_TEMPLATE;
      break;
    case 'circleci':
      filePath = '.circleci/config.yml';
      content = CIRCLECI_TEMPLATE;
      break;
    case 'bitbucket':
      filePath = 'bitbucket-pipelines.yml';
      content = BITBUCKET_TEMPLATE;
      break;
  }

  const fullPath = path.join(cwd, filePath);
  const dirName = path.dirname(fullPath);

  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }

  if (fs.existsSync(fullPath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `${filePath} already exists. Overwrite?`,
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(`\n  ${icons.info} Skipped generating template.`);
      return;
    }
  }

  fs.writeFileSync(fullPath, content, 'utf8');

  console.log(`\n  ${icons.success} Generated ${chalk.bold(filePath)}`);
  console.log(`  ${colors.dim('You can now commit this file to trigger your CI workflow.')}\n`);
}
