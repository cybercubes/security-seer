#!/usr/bin/env node

import { execute } from '../function.js';
import fetch from 'node-fetch';
import getLatestVersion from 'get-latest-version';
import fs from 'fs';

const dependencyWarning = "Unsatisfactory dependency count!";
const dependentWarning = "Unsatisfactory dependants count!";
const publishingFrequencyWarning = "Unsatisfactory publishing frequency!";
const suspicousVersionWarning = "Suspicious package version detected!";
const depricationWarning = "Package is deprecated!";
const firstPublishedWarning = "The package was published to recently!";

async function main() {
  try {
    console.log("reading config...");
    const configObject = readConfig();

    console.log("generating lock file...");
    await execute("npm i --package-lock-only");

    console.log("lock file generated!");
    const listPromise = await execute("npm list --json");
    const parsedList = JSON.parse(listPromise);

    console.log("processing dependencies...");
    let finalList = await getDependecies(parsedList);
    excludeDependencies(finalList, configObject);
    
    const warningList = await assessDependencyList(finalList, configObject);
    printTotalWarningsCount(warningList);

    process.argv.slice(2).forEach((val, index) => {
      if (val == "--verbose" || val == "-v") {
        console.log(warningList);
      }
    });

  } catch (error) {
    console.error(error);
  }
}

function printTotalWarningsCount(warningList) {
  let totalWarningsCounter = {
    dependency: 0,
    dependents: 0,
    publishing_frequency: 0,
    suspicous_version: 0,
    deprication: 0,
    first_published: 0
  }

  for (const pacakge of warningList) {
    for (const warn of pacakge.warning) {
      switch (warn) {
        case dependencyWarning:
          totalWarningsCounter.dependency++;
          break;
        case dependentWarning:
          totalWarningsCounter.dependents++;
          break;
        case publishingFrequencyWarning:
          totalWarningsCounter.publishing_frequency++;
          break;
        case suspicousVersionWarning:
          totalWarningsCounter.suspicous_version++;
          break;
        case depricationWarning:
          totalWarningsCounter.deprication++;
          break;
        case firstPublishedWarning:
          totalWarningsCounter.first_published++;
          break;
      }
    }
  }

  let counterMessage = "warnings detected: \n";

  if (totalWarningsCounter.dependency) {
    counterMessage += ` {dependencies warnings: ${totalWarningsCounter.dependency}} \n`;
  }
  if (totalWarningsCounter.dependents) {
    counterMessage += ` {dependents warnings: ${totalWarningsCounter.dependents}} \n`;
  }
  if (totalWarningsCounter.publishing_frequency) {
    counterMessage += ` {publishing frequency warnings: ${totalWarningsCounter.publishing_frequency}} \n`;
  }
  if (totalWarningsCounter.suspicous_version) {
    counterMessage += ` {suspicous version warnings: ${totalWarningsCounter.suspicous_version}} \n`;
  }
  if (totalWarningsCounter.deprication) {
    counterMessage += ` {deprication warnings: ${totalWarningsCounter.deprication}} \n`;
  }
  if (totalWarningsCounter.first_published) {
    counterMessage += ` {first published warnings: ${totalWarningsCounter.first_published}} \n`;
  }

  console.log(counterMessage);
}

async function assessDependencyList(dependencies, config) {
  const warningsFinal = [];

  for (const dependency of dependencies) {
    await assessSingleDependency(dependency, config, warningsFinal);
  }

  return warningsFinal;
}

async function assessSingleDependency(dependency, config, warningsFinal) {
  let appliedConfig;
  const custom = config.custom.find(element => element.name == dependency.name)
  if (custom) {
    appliedConfig = custom;
  } else {
    appliedConfig = config.default;
  }

  const warnings = [];
  const publishingTimeInformation = await getPublishingTimeInformation(dependency);
  const dependenciesCount = await getDependenciesCount(dependency);
  const dependentsCount = await getDependentsCount(dependency);
  const depricationMessage = await getDepricationMessage(dependency);

  assessVersion(dependency.version, appliedConfig, warnings);
  assessPublishingFrequency(publishingTimeInformation.frequency, appliedConfig, warnings);
  assessDependenciesCount(dependenciesCount, appliedConfig, warnings);
  assessDependentsCount(dependentsCount, appliedConfig, warnings);
  assessCreatedDate(publishingTimeInformation.created, appliedConfig, warnings);
  assessDeprication(depricationMessage, appliedConfig, warnings);

  if (warnings.length > 0) {
    warningsFinal.push({
      name: dependency.name,
      warning: warnings
    });
  }
}

function excludeDependencies(dependencies, config) {
  for (const index in dependencies) {
    if (config.excluded.find(name => name == dependencies[index].name)) {
      dependencies.splice(index, 1);
    } 
  }
}

function readConfig() {
  if (!fs.existsSync("./seersec-config.json")) {
    const defaultConfigObject = {
      "default": {
        "dependencyThreshold": "10",
        "dependentsThreshold": "5",
        "publishFrequencyThreshold": "14",
        "versionTrustThresholds": {
            "majorVersionThreshold": 9,
            "minorVersionThreshold": 99,
            "patchVersionThreshold": 999
        },
        "firstPublishedThreshold": "3",
        "assessDeprication": "true"
      },
      "excluded": [],
      "custom": []
    };

    const data = JSON.stringify(defaultConfigObject);
    fs.writeFileSync("seersec-config.json", data);
  }

  const rawData = fs.readFileSync("./seersec-config.json");
  const configObject = JSON.parse(rawData);

  return configObject;
}

function assessVersion(value, config, warnings) {
  const versions = value.split(".");

  if (config.versionTrustThresholds.majorVersionThreshold != null && 
    versions[0] >= config.versionTrustThresholds.majorVersionThreshold) {
      warnings.push(suspicousVersionWarning);
      return;  
  }

  if (config.versionTrustThresholds.minorVersionThreshold != null && 
    versions[1] >= config.versionTrustThresholds.minorVersionThreshold) {
      warnings.push(suspicousVersionWarning);
      return;  
  }

  if (config.versionTrustThresholds.patchVersionThreshold != null && 
    versions[2] >= config.versionTrustThresholds.patchVersionThreshold) {
      warnings.push(suspicousVersionWarning);
      return;  
  }
}

function assessPublishingFrequency(value, config, warnings) {
  if (!config.publishFrequencyThreshold) {return;}
  
  if (value > config.publishFrequencyThreshold) {
    warnings.push(publishingFrequencyWarning);
  }
}

function assessDependenciesCount(value, config, warnings) {
  if (!config.dependencyThreshold) {return;}

  if (value > config.dependencyThreshold) {
    warnings.push(dependencyWarning);
  }
}

function assessDependentsCount(value, config, warnings) {
  if (!config.dependentsThreshold) {return;}
  
  if (value < config.dependentsThreshold) {
    warnings.push(dependentWarning);
  }
}

function assessCreatedDate(value, config, warnings) {
  if (!config.firstPublishedThreshold) {return;}

  const lifespanInDays = (Date.now() - Date.parse(value.created)) / 86400000;
  if (lifespanInDays < config.firstPublishedThreshold) {
    warnings.push(firstPublishedWarning);
  }
}

function assessDeprication(value, config, warnings) {
  if (config.assessDeprication && value) {
    warnings.push(depricationWarning);
  }
}

async function getPublishingTimeInformation(dependency) {
  const commandString = `npm view ${dependency.name}@${dependency.version} time --json`;
  const result = await execute(commandString);
  const resultObject = JSON.parse(result);

  const lifespan = Date.now() - Date.parse(resultObject.created);
  const totalUpdates = Object.keys(resultObject).length - 2;
  const frequency = lifespan / totalUpdates;

  //from milliseconds to days
  const frequencyInDays = frequency / 86400000;
  const lastModifiedInDays = (Date.now() - Date.parse(resultObject.modified)) / 86400000

  return {
    created: Date.parse(resultObject.created),
    lastModified: lastModifiedInDays,
    frequency: frequencyInDays,
  }
}

async function getDependenciesCount(dependency) {
  const commandString = `npm view ${dependency.name}@${dependency.version} dependencies --json`;
  const result = await execute(commandString);
  if (!result) {
    return 0;
  }
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

// Happens if the list of dependencies is only present through a package-lock.json file with no node modules present
async function handleProblems(problems) {
  const list = [];
  
  for (const problem of problems) {
    const regex = /:\s?(.[^@]+)@(.+),/;
    const matcher = problem.match(regex);
    const packageName = matcher[1];
    const packageVersionRange = matcher[2];
    if (matcher[2].includes("file")) {
      const packageVersion = await getLatestVersion(packageName).then((version) => version).catch((err) => {});

      list.push({
        name: packageName,
        version: packageVersion,
      });
      
      continue;
    }
    const packageVersion = await getLatestVersion(packageName, {range: packageVersionRange})
      .then((version) => version)
      .catch((err) => console.log("ouch!"));

    list.push({
      name: packageName,
      version: packageVersion,
    });
  }

  return list;
}
main();