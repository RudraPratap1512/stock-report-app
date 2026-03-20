require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

async function getStockData(symbol) {
  const finalSymbol = symbol.toUpperCase() + ".NS";

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${finalSymbol}`;

  try {
    const response = await axios.get(url);
    const result = response.data?.chart?.result?.[0];

    if (!result) return null;

    const meta = result.meta;

    return {
      symbol: finalSymbol,
      price: meta.regularMarketPrice,
      open: meta.regularMarketOpen,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      prevClose: meta.previousClose,
    };
  } catch (err) {
    console.log("API ERROR:", err.message);
    return null;
  }
}

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

app.get("/stock/:symbol", async (req, res) => {
  const symbol = req.params.symbol;

  const data = await getStockData(symbol);

  if (!data || !data.price) {
    return res.status(404).json({ error: "Stock not found" });
  }

  const change = data.price - data.prevClose;
  const changePercent = (change / data.prevClose) * 100;

  res.json({
    symbol: data.symbol,
    price: data.price.toFixed(2),
    change: change.toFixed(2),
    changePercent: changePercent.toFixed(2) + "%",
    open: data.open?.toFixed(2),
    high: data.high?.toFixed(2),
    low: data.low?.toFixed(2),
    previousClose: data.prevClose?.toFixed(2),
  });
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});