#!/usr/bin/env node

import { execute } from '../function.js';
import fetch from 'node-fetch';

async function main() {
  try {
    const listPromise = await execute("npm list -json");
    const parsedList = JSON.parse(listPromise);
    const finalList = getDependecies(parsedList.dependencies);
    const metrics = await getMetricsForDependencyList(finalList);
    const referencePoint = await getReferencePointInfo();
    const scores = calculateAllScores(metrics, referencePoint);

    for (const entry of scores) {
      console.log(`${entry.name}: ${entry.score}`);
    }

  } catch (error) {
    console.error(error);
  }
}

async function getMetricsForSingleDependency(dependencyObject) {
    const endpoint = `https://api.npms.io/v2/package/${dependencyObject.name}`;

    const response = await fetch(endpoint);
    const body = await response.json();

    return {
      name: dependencyObject.name,
      weeklyDownloads: body.collected.npm.downloads[1].count,
      npmStarsCount: body.collected.npm.starsCount,
      githubStarsCount: body.collected.github.starsCount,
      gitHubForksCount: body.collected.github.forksCount,
      githubSubscribersCount: body.collected.github.subscribersCount,
      latestVersion: body.collected.metadata.version,
      currentVersion: dependencyObject.version,
    };
}

async function getMetricsForDependencyList(dependencies) {
  const metricList = [];

  for (const element of dependencies) {
    const entry = await getMetricsForSingleDependency(element);
    metricList.push(entry);
  }

  return metricList;
}

function calculateAllScores(packageMetrics, referencePoint) {
    const scores = [];

    for (const entry of packageMetrics) {
        let score = calculateSingleScore(entry, referencePoint);

        scores.push({
            name: entry.name,
            score: score,
        });
    }

    return scores;
}

function calculateSingleScore(pacakgeEntry, referencePoint) { 
    const weeklyDownloadsScore = pacakgeEntry.weeklyDownloads * 100 / (referencePoint.weeklyDownloads + 0.1);
    const npmStarsCountScore = pacakgeEntry.npmStarsCount * 100 / (referencePoint.npmStarsCount + 0.1);
    const gitHubForksCountScore = pacakgeEntry.gitHubForksCount * 100 / (referencePoint.gitHubForksCount + 0.1);
    const githubStarsCountScore = pacakgeEntry.githubStarsCount * 100 / (referencePoint.githubStarsCount + 0.1);
    const githubSubscribersCountScore = pacakgeEntry.githubSubscribersCount * 100 / (referencePoint.githubSubscribersCount + 0.1);

    let scorePercentage = average([weeklyDownloadsScore, npmStarsCountScore, gitHubForksCountScore, githubStarsCountScore, githubSubscribersCountScore]);

    if (pacakgeEntry.currentVersion != pacakgeEntry.latestVersion) {
      scorePercentage /= 1.1;
    }

    const readableScore = parseScorePercentage(scorePercentage);

    return readableScore;
}

function parseScorePercentage(percentage) {
  console.log(percentage);

  if (percentage > 100) {
    return "ERROR";
  }

  if (percentage > 91.0) {
    return "EXCEPTIONAL";
  } 

  if (percentage >= 66.6) {
    return "HIGH";
  }

  if (percentage >= 33.3) {
    return "MEDIUM";
  }

  if (percentage > 11.0) {
    return "LOW";
  } 

  if (percentage >= 0.0) {
    return "TERRIBLE";
  }

  console.log("ParseScorePercentage received bad arguments");
  return "ERROR";

}

function getDependecies(depList) {
  const names = Object.keys(depList);

    const list = []
    for (const key in depList) {
      list.push({
        name: key,
        version: depList[key].version,
      });
    }
    return list;
}


async function getReferencePointInfo() {
  const expressEndpoint = `https://api.npms.io/v2/package/express`;
  const AngularEndpoint = `https://api.npms.io/v2/package/angular`;

  const angularResponse = await fetch(AngularEndpoint);
  const angularBody = await angularResponse.json();
  
  const expressResponse = await fetch(expressEndpoint);
  const expressBody = await expressResponse.json();

  return {
    name: "Reference",
    weeklyDownloads: expressBody.collected.npm.downloads[1].count,
    npmStarsCount: expressBody.collected.npm.starsCount,
    githubStarsCount: angularBody.collected.github.starsCount,
    gitHubForksCount: angularBody.collected.github.forksCount,
    githubSubscribersCount: angularBody.collected.github.subscribersCount,
  };
}

const average = arr => arr.reduce((a,b) => a + b, 0) / arr.length;

main();