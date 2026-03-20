require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

async function getStockData(symbol) {
  const raw = String(symbol || "").trim().toUpperCase();

  const candidates = [
    raw,
    `${raw}.NS`,
    `${raw}.BO`,
  ];

  for (const finalSymbol of candidates) {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${finalSymbol}?interval=1d`;

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
        timeout: 15000,
      });

      const result = response.data?.chart?.result?.[0];
      const meta = result?.meta;

      if (meta?.regularMarketPrice) {
        return {
          symbol: finalSymbol,
          name: meta.longName || meta.shortName || finalSymbol,
          exchange: meta.exchangeName || meta.fullExchangeName || "N/A",
          price: meta.regularMarketPrice,
          open: meta.regularMarketOpen,
          high: meta.regularMarketDayHigh,
          low: meta.regularMarketDayLow,
          prevClose: meta.previousClose,
        };
      }
    } catch (err) {
      console.log(`API ERROR for ${finalSymbol}:`, err.message);
    }
  }

  return null;
}

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

app.get("/stock/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const data = await getStockData(symbol);

    if (!data || !data.price) {
      return res.status(404).json({ error: "Stock not found" });
    }

    const change = Number(data.price) - Number(data.prevClose || data.price);
    const changePercent = data.prevClose
      ? (change / Number(data.prevClose)) * 100
      : 0;

    res.json({
      symbol: data.symbol,
      name: data.name,
      exchange: data.exchange,
      price: Number(data.price).toFixed(2),
      change: Number(change).toFixed(2),
      changePercent: `${Number(changePercent).toFixed(2)}%`,
      open: data.open != null ? Number(data.open).toFixed(2) : "N/A",
      high: data.high != null ? Number(data.high).toFixed(2) : "N/A",
      low: data.low != null ? Number(data.low).toFixed(2) : "N/A",
      previousClose:
        data.prevClose != null ? Number(data.prevClose).toFixed(2) : "N/A",
    });
  } catch (err) {
    console.log("SERVER ERROR:", err.message);
    res.status(500).json({ error: "Error fetching stock data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});