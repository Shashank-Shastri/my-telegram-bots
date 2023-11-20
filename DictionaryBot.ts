import { Bot, InlineQueryResultBuilder } from "grammy";

//Create a new bot
const bot = new Bot(process.env.dictionary_bot_key || "");

type customDefinitionsType = {
  [key: string]: string;
};

const customDefinitions: customDefinitionsType = {
  abby: "1. Also known as Abbyaa.\n2. Gunda of MSS.",
  aditi: "1. Propagator of Pani Puri Sorbet.\n2. Developer from Thane.",
  aditya: "1. Chee, worst Skribbl/Codenames/Wordbot player.",
  araina: "1. Pretends Thane is part of Mumbai.",
  arpit: "1. Me hota to nahi sehta.\n2. Developer from Lucknow.",
  asghar:
    "1. Gujju businessman famously know for his 'Tikuji-ni-wadi' jingle. His recent 'You can che ne call me Daddy little dragon' voice note was a chartbuster. People eagerly waiting for his next drop.",
  feature: "1. Tech gujju in Bengaluru.",
  keiko: "1. Shiro's mom.\n2. Wannabe CA.",
  luna: "1. Person also known as Monu and Chuna.\n2. A lactose intolerant cannibalistic vegan with ADHD and a brand new Pixel 7 that sometimes mayhaps fall prey to online scams.",
  madhura: "1. The one who reacts and replies to age old messages.",
  muskan: "1. World traveller of MSS.",
  orion:
    "1. Onion.\n2. A gender fluid human being who is scared of revealing their name.\n3. Unknown developer from Navi Mumbai.",
  sahil: "1. CA of MSS.",
  saxi: "1. Someone who searches for offers/discounts even if the value of the item is ₹1.\n2. Doctor from Wadala.",
  shashank: "1. Creator of this bot. 2. EV Road tripper.",
  timothee: "1. Master of Puns.",
};

const intermediary = async (word: string) => {
  const definitions = await getDefinitions(word);
  const response = definitions
    ? `Here's the definition(s) of ${word}:\n${definitions}`
    : `Sorry, no definition for ${word} was found.`;
  return response;
};

async function getDefinitions(word: string) {
  const lowerCaseWord = word.toLowerCase();
  if (customDefinitions[lowerCaseWord]) {
    return customDefinitions[lowerCaseWord];
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
  } catch (e) {
    console.log(e);
  }
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
