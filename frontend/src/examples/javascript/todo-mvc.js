// @ts-check
const playwright = require('playwright');

/**
 * Helper function which will compare val1 with val2.
 * If they dont equal itself it will throw an error.
 */
const expect = (val1, val2) => {
  if (val1 !== val2) {
    throw new Error(`${val1} does not match ${val2}`)
  }
}

const TODO_NAME = 'Bake a cake';

(async () => {
  const browser = await playwright.chromium.launch({
    slowMo: 100
  });
  const context = await browser.newContext({
    recordVideo: {
      dir: 'videos/'
    }
  });
  const page = await context.newPage();

  await page.goto('https://demo.playwright.dev/todomvc');

  // Helper function to get the amount of todos on the page
  const getCountOfTodos = () => page.$$eval('ul.todo-list > li', el => el.length)

  // Initially there should be 0 entries
  expect(await getCountOfTodos(), 0)

  // Adding a todo entry (click in the input, enter the todo title and press the Enter key)
  await page.click('input.new-todo');
  await page.fill('input.new-todo', TODO_NAME);
  await page.press('input.new-todo', 'Enter');

  // After adding 1 there should be 1 entry in the list
  expect(await getCountOfTodos(), 1)

  // Here we get the text in the first todo item to see if it's the same which the user has entered
  const textContentOfFirstTodoEntry = await page.$eval('ul.todo-list > li:nth-child(1) label', el => el.textContent)
  expect(textContentOfFirstTodoEntry, TODO_NAME)

  // The todo list should be persistent. Here we reload the page and see if the entry is still there
  await page.reload({
    waitUntil: 'networkidle'
  });
  expect(await getCountOfTodos(), 1)

  // Set the entry to completed
  await page.click('input.toggle');

  // Filter for active entries. There should be 0, because we have completed the entry already
  await page.click('"Active"');
  expect(await getCountOfTodos(), 0)

  // If we filter now for completed entries, there should be 1
  await page.click('"Completed"');
  expect(await getCountOfTodos(), 1)

  // Clear the list of completed entries, then it should be again 0
  await page.click('"Clear completed"');
  expect(await getCountOfTodos(), 0)

  await browser.close();
})();
