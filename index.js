#!/usr/bin/env node

import { execute } from './function.js';
import fetch from 'node-fetch';

async function main() {
  try {
    const listPromise = await execute("npm list -json");
    const parsedList = JSON.parse(listPromise);
    const finalList = getDependecies(parsedList.dependencies);
    let results = await getPackageMetrics(finalList);

    console.log(results);

  } catch (error) {
    console.error(error.toString());
  }
}

async function getPackageMetrics(dependencies) {
  const metricList = []

  for (const element of dependencies) {
    const endpoint = `https://api.npms.io/v2/package/${element.name}`;

    const response = await fetch(endpoint);
    const body = await response.json();

    let entry = {
      name: element.name,
      weeklyDownloads: body.collected.npm.downloads[1].count,
      npmStarsCount: body.collected.npm.starsCount,
      githubStarsCount: body.collected.github.starsCount,
      gitHubForksCount: body.collected.github.forksCount,
      githubSubscribersCount: body.collected.github.subscribersCount,
      versionA: body.collected.metadata.version,
      versionB: element.version,
    };

    metricList.push(entry);
  }

  return metricList
}

function getDependecies(depList) {
  const names = Object.keys(depList)

    const list = []
    for (const key in depList) {
      list.push({
        name: key,
        version: depList[key].version
      });
    }
    return list;
}

main();