import { execute } from './function.js';

async function main() {
  try {
    let listPromise = await execute("npm list -json");
    let parsedList = JSON.parse(listPromise);

    console.log(parsedList.dependencies);
  } catch (error) {
    console.error(error.toString());
  }
}

main();