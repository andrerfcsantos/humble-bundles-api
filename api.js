import express from "express";
import humble from "./humble.js";
import cron from "node-cron";
import winston from "winston";
import dayjs from "dayjs";
import dayjsPluginUTC from "dayjs/plugin/utc.js";

const logger_formatter = winston.format.combine(
  winston.format.simple(),
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss ZZ",
  }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

const logger = winston.createLogger({
  level: "info",
  format: logger_formatter,
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "humble-bundles-api.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: logger_formatter,
    })
  );
}

let bundles;

async function updateBundle() {
  try {
    let new_bundles = await humble.fetch_bundles();
    bundles = new_bundles ? new_bundles : bundles;
    logger.info("Fetched bundles info sucessfully");
  } catch (e) {
    logger.error("Error fetching bundles info:", e);
  }
}

dayjs.extend(dayjsPluginUTC);
cron.schedule("0,15,30,45 * * * *", updateBundle);

const app = express();

app.get("/bundles", async (req, res) => {
  res.json(bundles);
});

logger.info("Getting bundles info for the first time");
await updateBundle();

logger.info("Ready to listen for requests");
app.listen(3200);
