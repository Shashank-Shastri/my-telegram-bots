import { Bot, InlineQueryResultBuilder } from "grammy";

const { Client } = require("pg");

//Create a new bot
const bot = new Bot(process.env.dictionary_bot_key || "");

const client = new Client({
  connectionString: process.env.db_string,
});
client.connect();

const intermediary = async (word: string) => {
  const definitions = await getDefinitions(word);
  const response = definitions
    ? `Here's the definition(s) of ${word}:\n${definitions}`
    : `Sorry, no definition for ${word} was found.`;
  return response;
};

async function getDefinitions(word: string) {
  const lowerCaseWord = word.toLowerCase();

  const { rows: resultRows } = await client.query(
    "SELECT definitions from custom_definitions where word=$1",
    [lowerCaseWord]
  );
  if (resultRows.length) {
    return resultRows[0].definitions.join("\n");
  }

  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
  );
  const data = await response.json();
  let definition = "";
  try {
    const meanings = (data as any)[0].meanings;
    let definitions: any[] = meanings[0].definitions;
    definitions = definitions.map((o, i) => `${i + 1}. ${o.definition}`);
    definition = definitions.join("\n");
  } catch {}
  return definition;
}

//This function would be added to the dispatcher as a handler for messages coming from the Bot API
bot.on("message:text", async (ctx) => {
  const word = ctx.msg.text;
  if (!word) return;
  const replyText = await intermediary(word);
  await ctx.reply(replyText, {
    reply_to_message_id: ctx.msg.message_id,
  });
});

bot.on("inline_query", async (ctx) => {
  const word = ctx.inlineQuery.query; // query string
  if (!word) return;
  const replyText = await intermediary(word);
  const reply = InlineQueryResultBuilder.article(
    "id-2",
    `${word} meaning`
  ).text(replyText);
  await ctx.answerInlineQuery([reply]);
});

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  console.error("Unknown error:", e);
});

//Start the Bot
bot.start();
