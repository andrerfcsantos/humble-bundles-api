import express from "express";
import humble from "./humble.js";
import cron from "node-cron";

let bundles;

async function updateBundle() {
  bundles = await humble.fetch_bundles();
}

cron.schedule("0,15,30,45 * * * *", updateBundle);

const app = express();

app.get("/bundles", async (req, res) => {
  res.json(bundles);
});

await updateBundle();

app.listen(3200);
