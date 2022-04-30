import { execute } from './function.js';
import fetch from 'node-fetch';

async function main() {
  try {
    let listPromise = await execute("npm list -json");
    let parsedList = JSON.parse(listPromise);
    let names = Object.keys(parsedList.dependencies)

    let results = await getPackageMetrics(names);

    console.log(results);

  } catch (error) {
    console.error(error.toString());
  }
}

async function getPackageMetrics(dependecyNames) {
  let metricList = []

  for (const element of dependecyNames) {
    let endpoint = `https://api.npms.io/v2/package/${element}`;

    let response = await fetch(endpoint);
    let body = await response.json();

    let entry = {
      name: element,
      weeklyDownloads: body.collected.npm.downloads[1].count,
      npmStarsCount: body.collected.npm.starsCount,
      githubStarsCount: body.collected.github.starsCount,
      gitHubForksCount: body.collected.github.forksCount,
      githubSubscribersCount: body.collected.github.subscribersCount,
    };

    metricList.push(entry);
  }

  return metricList
}

main();