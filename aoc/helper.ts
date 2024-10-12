export async function getInput(year: number, day: number): Promise<string> {
  try {
    return await Deno.readTextFile("input.txt");
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      const url = `https://adventofcode.com/${year}/day/${day}/input`;
      const data = fetch(url, {
        headers: {
          Cookie:
            "session=53616c7465645f5fe5d3724ad9f6901ba24e074a5dbad9735ea6149210b004fc1fc1222528adae30f4ee31aacd9e1861f905ce7be4ce0abf37fb62935f4cadcd",
        },
      });
      const response = await data;
      const text = await response.text();
      Deno.writeTextFile("input.txt", text);
      return text;
    } else {
      throw err;
    }
  }
}
