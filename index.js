import axios from "axios";
import fs from "fs";
import chalk from "chalk";
import { DateTime } from "luxon";
import TelegramBot from 'node-telegram-bot-api';

const accounts = JSON.parse(fs.readFileSync("token.json", "utf-8"));
const userAgents = JSON.parse(fs.readFileSync("useragents.json", "utf-8"));
const convertedTokensPath = "token-converted.json";

// Telegram Bot setup
const telegramBotToken = '7507240778:AAFGaA_ygypAo5sbq-v8d9Sghv_QURusO40';
const chatId = '5637543234';
const bot = new TelegramBot(telegramBotToken);

if (!fs.existsSync(convertedTokensPath)) {
  fs.writeFileSync(convertedTokensPath, JSON.stringify([]));
}

const convertedTokens = JSON.parse(
  fs.readFileSync(convertedTokensPath, "utf-8")
);

const getRandomUserAgent = () => {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

const getTimestamp = () => {
  return `[ ${new Date().toLocaleTimeString()} ]`;
};

const getHeaders = (token) => ({
  accept: "/",
  "accept-language": "en-GB,en;q=0.8",
  authorization: token,
  "content-type": "application/json",
  origin: "https://tg-tap-miniapp.laborx.io",
  priority: "u=1, i",
  referer: "https://tg-tap-miniapp.laborx.io/",
  "sec-ch-ua": '"Brave";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "sec-gpc": "1",
  "user-agent": getRandomUserAgent(),
});

const getFarmingInfo = async (account) => {
  try {
    const response = await axios.get(
      "https://tg-bot-tap.laborx.io/api/v1/farming/info",
      {
        headers: getHeaders(account.token),
      }
    );
    const { balance, activeFarmingStartedAt, farmingDurationInSec } =
      response.data;
    const activeFarmingStartedWIB = activeFarmingStartedAt
      ? DateTime.fromISO(activeFarmingStartedAt)
          .setZone("Asia/Jakarta")
          .toLocaleString(DateTime.DATETIME_MED)
      : null;
    const nextClaimTime = activeFarmingStartedAt
      ? DateTime.fromISO(activeFarmingStartedAt)
          .plus({ seconds: farmingDurationInSec + 10 })
          .setZone("Asia/Jakarta")
          .toLocaleString(DateTime.DATETIME_MED)
      : null;
    console.log(chalk.green(`${getTimestamp()} Balance: ${balance}`));
    if (activeFarmingStartedWIB) {
      console.log(
        chalk.green(
          `${getTimestamp()} Active Farming Started At (WIB): ${activeFarmingStartedWIB}`
        )
      );
      console.log(
        chalk.green(`${getTimestamp()} Next Claim Time (WIB): ${nextClaimTime}`)
      );
    } else {
      console.log(chalk.green(`${getTimestamp()} Farming has not started yet`));
    }
    return { activeFarmingStartedAt, farmingDurationInSec };
  } catch (error) {
    console.log(
      chalk.red(`${getTimestamp()} Error getting farming info:`, error.message)
    );
    return null;
  }
};

const startFarming = async (account, index) => {
  const config = {
    method: "post",
    url: "https://tg-bot-tap.laborx.io/api/v1/farming/start",
    headers: getHeaders(account.token),
    data: {},
  };

  try {
    const response = await axios(config);
    if (response.status === 200) {
      console.log(
        chalk.green(
          `${getTimestamp()} ${account.telegramName} successfully started farming`
        )
      );
      // Send message to Telegram
      try {
        await bot.sendMessage(chatId, `${account.telegramName} successfully started farming.`);
      } catch (telegramError) {
        console.log(chalk.red(`${getTimestamp()} Error sending Telegram message:`, telegramError.message));
      }
    }
  } catch (error) {
    console.log(
      chalk.red(
        `${getTimestamp()} ${account.telegramName} Error starting farming:`,
        error.message
      )
    );
  }
  console.log(chalk.cyan("------------------------------"));
};

const finishFarming = async (account, index) => {
  const config = {
    method: "post",
    url: "https://tg-bot-tap.laborx.io/api/v1/farming/finish",
    headers: getHeaders(account.token),
    data: {},
  };

  try {
    const response = await axios(config);
    if (response.status === 200) {
      console.log(
        chalk.green(
          `${getTimestamp()} ${account.telegramName} successfully finished farming`
        )
      );
      // Send message to Telegram
      try {
        await bot.sendMessage(chatId, `${account.telegramName} successfully finished farming and claimed rewards.`);
      } catch (telegramError) {
        console.log(chalk.red(`${getTimestamp()} Error sending Telegram message:`, telegramError.message));
      }
      setTimeout(() => startFarming(account, index), 3000); // Start farming again after 3 seconds
    }
  } catch (error) {
    console.log(
      chalk.red(
        `${getTimestamp()} ${account.telegramName} Error finishing farming:`,
        error.message
      )
    );
  }
  console.log(chalk.cyan("------------------------------"));
};

const processTasks = async (account, index) => {
  try {
    const response = await axios.get(
      "https://tg-bot-tap.laborx.io/api/v1/tasks",
      {
        headers: getHeaders(account.token),
      }
    );
    const tasks = response.data;
    let allClaimed = true;

    for (const task of tasks) {
      if (!task.submission || task.submission.status === "REJECTED") {
        await axios.post(
          `https://tg-bot-tap.laborx.io/api/v1/tasks/${task.id}/submissions`,
          {},
          {
            headers: getHeaders(account.token),
          }
        );
        console.log(
          chalk.green(
            `${getTimestamp()} Successfully submitted task ${task.title}`
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else if (task.submission.status === "SUBMITTED") {
        console.log(
          chalk.yellow(
            `${getTimestamp()} Task ${task.title} cannot be claimed yet`
          )
        );
      } else if (task.submission.status === "COMPLETED") {
        await axios.post(
          `https://tg-bot-tap.laborx.io/api/v1/tasks/${task.id}/claims`,
          {},
          {
            headers: getHeaders(account.token),
          }
        );
        console.log(
          chalk.green(
            `${getTimestamp()} Successfully claimed task ${task.title}`
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else if (task.submission.status === "CLAIMED") {
        console.log(
          chalk.cyan(`${getTimestamp()} Task ${task.title} already claimed`)
        );
      }

      if (task.submission && task.submission.status !== "CLAIMED") {
        allClaimed = false;
      }
    }

    if (allClaimed) {
      console.log(
        chalk.green(`${getTimestamp()} All tasks have been completed`)
      );
    }
  } catch (error) {
    console.log(
      chalk.red(`${getTimestamp()} Error processing tasks:`, error.message)
    );
  }
};

const updateConvertedTokens = (account, farmingInfo) => {
  const existingToken = convertedTokens.find((t) => t.token === account.token);
  if (!existingToken) {
    convertedTokens.push({ token: account.token, telegramName: account.telegramName, ...farmingInfo });
    fs.writeFileSync(
      convertedTokensPath,
      JSON.stringify(convertedTokens, null, 2)
    );
  } else {
    existingToken.activeFarmingStartedAt = farmingInfo.activeFarmingStartedAt;
    existingToken.farmingDurationInSec = farmingInfo.farmingDurationInSec;
    fs.writeFileSync(
      convertedTokensPath,
      JSON.stringify(convertedTokens, null, 2)
    );
  }
};

const runAccount = async (account, index) => {
  console.log(`-----------------------------`);
  console.log(
    chalk.cyan(`${getTimestamp()} Processing ${account.telegramName}...`)
  );
  const farmingInfo = await getFarmingInfo(account);

  if (farmingInfo) {
    if (farmingInfo.activeFarmingStartedAt) {
      updateConvertedTokens(account, farmingInfo);

      await processTasks(account, index);

      const { activeFarmingStartedAt, farmingDurationInSec } = farmingInfo;
      const nextClaimTime = DateTime.fromISO(activeFarmingStartedAt)
        .plus({ seconds: farmingDurationInSec + 10 })
        .setZone("Asia/Jakarta");
      const waitTime = nextClaimTime.diffNow().as("milliseconds");
      const hours = Math.floor(waitTime / 1000 / 60 / 60);
      const minutes = Math.floor((waitTime / 1000 / 60) % 60);
      console.log(
        chalk.bgBlackBright(
          `${getTimestamp()} ${account.telegramName} waiting ${hours} hours and ${minutes} minutes before claiming...`
        )
      );
      console.log(`-----------------------------`);
      setTimeout(() => finishFarming(account, index), Math.max(0, waitTime));
    } else {
      console.log(
        chalk.cyan(
          `${getTimestamp()} Starting farming for ${account.telegramName}...`
        )
      );
      startFarming(account, index);
    }
  } else {
    
    // Send error message to Telegram
    try {
      await bot.sendMessage(chatId, `${account.telegramName} WARNING!! ACCOUNT ERROR: UPDATE THE AUTH TOKEN PLEASE!!.`);
    } catch (telegramError) {
      console.log(chalk.red(`${getTimestamp()} Error sending Telegram message:`, telegramError.message));
    }
  }
};

const startClaiming = async () => {
  while (true) {
    for (let i = 0; i < accounts.length; i++) {
      runAccount(accounts[i], i);
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Delay 5 seconds between each account
    }
    console.log(
      chalk.cyan(`${getTimestamp()} Waiting 5 minutes before starting again...`)
    );
    await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000)); // Wait 5 minutes before starting again
  }
};

startClaiming();
