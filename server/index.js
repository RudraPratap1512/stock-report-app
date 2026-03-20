require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function getStockData(symbol) {
  const raw = String(symbol || "").trim().toUpperCase();
  const candidates = [raw, `${raw}.NS`, `${raw}.BO`];

  for (const finalSymbol of candidates) {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${finalSymbol}?range=1mo&interval=1d`;

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
        timeout: 15000,
      });

      const result = response.data?.chart?.result?.[0];
      const meta = result?.meta;
      const timestamps = result?.timestamp || [];
      const quote = result?.indicators?.quote?.[0] || {};

      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];
      const closes = quote.close || [];

      if (!meta?.regularMarketPrice) {
        continue;
      }

      const rows = timestamps.map((ts, i) => ({
        date: new Date(ts * 1000).toISOString(),
        open: opens[i] ?? null,
        high: highs[i] ?? null,
        low: lows[i] ?? null,
        close: closes[i] ?? null,
      }));

      const validRows = rows.filter((r) => r.close != null);

      const lastRow =
        validRows.length > 0 ? validRows[validRows.length - 1] : null;
      const prevRow =
        validRows.length > 1 ? validRows[validRows.length - 2] : null;

      const previousClose =
        meta.previousClose ??
        meta.chartPreviousClose ??
        (prevRow ? Number(prevRow.close) : null);

      return {
        symbol: finalSymbol,
        name: meta.longName || meta.shortName || finalSymbol,
        exchange: meta.exchangeName || meta.fullExchangeName || "N/A",
        price: Number(meta.regularMarketPrice),
        open:
          meta.regularMarketOpen != null
            ? Number(meta.regularMarketOpen)
            : lastRow?.open != null
            ? Number(lastRow.open)
            : null,
        high:
          meta.regularMarketDayHigh != null
            ? Number(meta.regularMarketDayHigh)
            : lastRow?.high != null
            ? Number(lastRow.high)
            : null,
        low:
          meta.regularMarketDayLow != null
            ? Number(meta.regularMarketDayLow)
            : lastRow?.low != null
            ? Number(lastRow.low)
            : null,
        previousClose:
          previousClose != null ? Number(previousClose) : null,
      };
    } catch (err) {
      console.log(`API ERROR for ${finalSymbol}:`, err.message);
    }
  }

  return null;
}

function fallbackAI(stockData, changePercent) {
  let signal = "HOLD";
  let risk = "Medium";
  let reason = "Price is moving in a neutral range.";
  let action = "Wait for better confirmation.";
  let target = (Number(stockData.price) * 1.03).toFixed(2);
  let stopLoss = (Number(stockData.price) * 0.98).toFixed(2);

  if (changePercent > 1.5) {
    signal = "BUY";
    risk = "Medium";
    reason = "Price momentum is positive and stock is showing strength.";
    action = "Consider buying in small quantity with stop loss discipline.";
  } else if (changePercent < -1.5) {
    signal = "SELL";
    risk = "Medium";
    reason = "Price momentum is weak and downside pressure is visible.";
    action = "Avoid fresh long entries or wait for stability.";
  }

  return {
    signal,
    entry: Number(stockData.price).toFixed(2),
    target,
    stopLoss,
    risk,
    reason,
    action,
  };
}

async function generateAIAnalysis(stockData, changePercent) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return fallbackAI(stockData, changePercent);
    }

    const prompt = `
You are a practical stock analysis assistant for educational use only.

Analyze this stock data and return only valid JSON.

Stock Name: ${stockData.name}
Symbol: ${stockData.symbol}
Exchange: ${stockData.exchange}
Current Price: ${stockData.price}
Open: ${stockData.open ?? "N/A"}
High: ${stockData.high ?? "N/A"}
Low: ${stockData.low ?? "N/A"}
Previous Close: ${stockData.previousClose ?? "N/A"}
Change Percent: ${changePercent.toFixed(2)}%

Return JSON in exactly this format:
{
  "signal": "BUY or SELL or HOLD",
  "entry": "numeric value or short range",
  "target": "numeric value",
  "stopLoss": "numeric value",
  "risk": "Low or Medium or High",
  "reason": "1-2 short sentences",
  "action": "1 short practical sentence"
}

Do not return markdown. Do not return anything except JSON.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const text = response.text?.trim();

    if (!text) {
      return fallbackAI(stockData, changePercent);
    }

    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.log("Gemini error:", error.message);
    return fallbackAI(stockData, changePercent);
  }
}

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

app.get("/stock/:symbol", async (req, res) => {
  try {
    const stockData = await getStockData(req.params.symbol);

    if (!stockData || !stockData.price) {
      return res.status(404).json({ error: "Stock not found" });
    }

    const currentPrice = Number(stockData.price);
    const prevClose =
      stockData.previousClose != null
        ? Number(stockData.previousClose)
        : currentPrice;

    const change = currentPrice - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    const aiAnalysis = await generateAIAnalysis(stockData, changePercent);

    res.json({
      symbol: stockData.symbol,
      name: stockData.name,
      exchange: stockData.exchange,
      price: currentPrice.toFixed(2),
      change: change.toFixed(2),
      changePercent: `${changePercent.toFixed(2)}%`,
      open: stockData.open != null ? Number(stockData.open).toFixed(2) : "N/A",
      high: stockData.high != null ? Number(stockData.high).toFixed(2) : "N/A",
      low: stockData.low != null ? Number(stockData.low).toFixed(2) : "N/A",
      previousClose:
        stockData.previousClose != null
          ? Number(stockData.previousClose).toFixed(2)
          : "N/A",
      aiAnalysis,
    });
  } catch (err) {
    console.log("SERVER ERROR:", err.message);
    res.status(500).json({ error: "Error fetching stock data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});