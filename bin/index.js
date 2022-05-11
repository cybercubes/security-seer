#!/usr/bin/env node

import { execute } from '../function.js';
import fetch from 'node-fetch';
import getLatestVersion from 'get-latest-version';

async function main() {
  try {
    console.log("generating lock file...");
    await execute("npm i --package-lock-only");
    console.log("lock file generated!");

    const listPromise = await execute("npm list --json");
    const parsedList = JSON.parse(listPromise);

    console.log("processing dependencies...");
    const finalList = await getDependecies(parsedList);
    const testPackage = {name: 'angular', version: 'latest'};

    const testFrequency = await getPublishingFrequency(testPackage);

    console.log(testFrequency);

    // const dependentsCount = await getDependentsCount(testPackage);
    // console.log(dependentsCount)

    console.log(finalList);

  } catch (error) {
    console.error(error);
    
  }
}

async function handleProblems(problems) {
  const list = [];
  
  for (const problem of problems) {
    //console.log(problem);
    const regex = /:\s?(.[^@]+)@(.+),/;
    const matcher = problem.match(regex);
    const packageName = matcher[1];
    const packageVersionRange = matcher[2];
    if (matcher[2].includes("file")) {
      continue;
    }
    const packageVersion = await getLatestVersion(packageName, {range: packageVersionRange})
      .then((version) => version)
      .catch((err) => console.error(err));

    //console.log(`${packageName}@${packageVersion}`);
    list.push({
      name: packageName,
      version: packageVersion,
    });
  }

  return list;
}

async function getPublishingFrequency(dependency) {
  const commandString = `npm view ${dependency.name}@${dependency.version} time --json`;
  const result = await execute(commandString);
  const resultObject = JSON.parse(result);

  const lifespan = Date.now() - Date.parse(resultObject.created);
  const totalUpdates = Object.keys(resultObject).length - 2;
  const frequency = lifespan / totalUpdates;

  //from milliseconds to days
  return frequency / 86400000;
}

async function getDependenciesCount(dependency) {
  const commandString = `npm view ${dependency.name}@${dependency.version} dependencies --json`;
  const result = await execute(commandString);
  const length = Object.keys(JSON.parse(result)).length;

  return length;
}

async function getDepricationMessage(dependency) {
  const commandString = `npm view ${dependency.name}@${dependency.version} deprecated`;
  const result = await execute(commandString);

  return result;
}

async function getDependentsCount(dependency) {
  const url = `https://www.npmjs.com/package/${dependency.name}/v/${dependency.version}`;
  console.log(url);
  const res = await fetch(url);
  const html = await res.text();
  const regexForDepCount = /"dependentsCount"\s*:\s*(\d+)/;
  const num = html.match(regexForDepCount)[1];

  return num;
}

async function getDependecies(depList) {
  if (depList.problems) {
    const res = await handleProblems(depList.problems);
    return res;
  }
  const names = Object.keys(depList.dependencies);
  const list = [];

  for (const key in depList.dependencies) {
    list.push({
      name: key,
      version: depList.dependencies[key].version,
    });
  }
  return list;
}
main();