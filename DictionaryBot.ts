import { Bot, InlineQueryResultBuilder, Context, CommandContext } from "grammy";

const { Client } = require("pg");

//Create a new bot
const bot = new Bot(process.env.dictionary_bot_key || "");
const authorizedUsers = process.env.authorized_users?.split(",") || [];

const client = new Client({
  connectionString: process.env.db_string,
});
client.connect();

const getDefinitionsReply = async (word: string) => {
  const definitions = await getDefinitions(word);
  const response = definitions
    ? `Here's the definition(s) of ${word}:\n${definitions}`
    : `Sorry, no definition for ${word} was found.`;
  return response;
};

async function queryCustomWord(word: string) {
  const lowerCaseWord = word.toLowerCase();

  const { rows: resultRows } = await client.query(
    "SELECT definitions from custom_definitions where word=$1",
    [lowerCaseWord]
  );
  if (resultRows.length) {
    return resultRows[0].definitions.join("\n");
  }
  return "";
}

async function getDefinitions(word: string) {
  const customDefinition = await queryCustomWord(word);
  if (customDefinition) {
    return customDefinition;
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

async function parseCommand(ctx: CommandContext<Context>) {
  if (!ctx.from) return;
  const { id: userId, first_name: name } = ctx.from;
  if (!authorizedUsers.includes(String(userId))) {
    await ctx.reply(
      `Sorry ${name}, you are not authorized to add a definition.`
    );
    return;
  }
  if (!ctx.match) {
    await ctx.reply("Please give a word and it's definition.");
    return;
  }
  const [word, ...definitions] = ctx.match.split("\n");
  const customDefinition = await queryCustomWord(word);
  return { word, definitions, customDefinition };
}

bot.command("addDefinition", async (ctx) => {
  const parsedCommands = await parseCommand(ctx);
  if (!parsedCommands) {
    return;
  }
  const { word, definitions, customDefinition } = parsedCommands;
  if (!customDefinition) {
    await client.query(
      "INSERT INTO custom_definitions(word, definitions) VALUES($1, $2)",
      [word, definitions]
    );
    await ctx.reply(`Definition for ${word} added.`);
  }
  await ctx.reply(`${word} already exists, try updating.`);
});

bot.command("updateDefinition", async (ctx) => {
  const parsedCommands = await parseCommand(ctx);
  if (!parsedCommands) {
    return;
  }
  const { word, definitions, customDefinition } = parsedCommands;
  if (!customDefinition) {
    await ctx.reply(`${word} doesn't exist, please add it first.`);
  }
  await client.query(
    "UPDATE custom_definitions SET definitions=$2 WHERE word=$1",
    [word, definitions]
  );
  await ctx.reply(`Definition for ${word} updated.`);
});

//This function would be added to the dispatcher as a handler for messages coming from the Bot API
bot.on("message:text", async (ctx) => {
  const word = ctx.msg.text;
  if (!word) return;
  const replyText = await getDefinitionsReply(word);
  await ctx.reply(replyText, {
    reply_to_message_id: ctx.msg.message_id,
  });
});

bot.on("inline_query", async (ctx) => {
  const word = ctx.inlineQuery.query; // query string
  if (!word) return;
  const replyText = await getDefinitionsReply(word);
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
