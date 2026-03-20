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
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${finalSymbol}?range=5d&interval=1d`;

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
      const closes = quote.close || [];
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];

      if (meta?.regularMarketPrice) {
        const validCloses = closes.filter((x) => x != null);
        const validOpens = opens.filter((x) => x != null);
        const validHighs = highs.filter((x) => x != null);
        const validLows = lows.filter((x) => x != null);

        let prevClose = meta.previousClose ?? null;

        if (prevClose == null && validCloses.length >= 2) {
          prevClose = validCloses[validCloses.length - 2];
        }

        if (prevClose == null && meta.chartPreviousClose != null) {
          prevClose = meta.chartPreviousClose;
        }

        return {
          symbol: finalSymbol,
          name: meta.longName || meta.shortName || finalSymbol,
          exchange: meta.exchangeName || meta.fullExchangeName || "N/A",
          price: meta.regularMarketPrice,
          open: meta.regularMarketOpen ?? validOpens[validOpens.length - 1] ?? null,
          high: meta.regularMarketDayHigh ?? validHighs[validHighs.length - 1] ?? null,
          low: meta.regularMarketDayLow ?? validLows[validLows.length - 1] ?? null,
          prevClose,
          history: timestamps.map((ts, i) => ({
            date: new Date(ts * 1000).toISOString(),
            open: opens[i] ?? null,
            high: highs[i] ?? null,
            low: lows[i] ?? null,
            close: closes[i] ?? null,
          })),
        };
      }
    } catch (err) {
      console.log(`API ERROR for ${finalSymbol}:`, err.message);
    }
  }

  return null;
}

function fallbackAI(data) {
  return {
    signal: "HOLD",
    entry: `${data.price}`,
    target: (Number(data.price) * 1.03).toFixed(2),
    stopLoss: (Number(data.price) * 0.98).toFixed(2),
    risk: "Medium",
    reason: "AI service unavailable, using fallback logic based on current live price.",
    action: "Wait for confirmation before taking a fresh position.",
  };
}

async function generateAIAnalysis(stockData) {
  try {
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
Previous Close: ${stockData.prevClose ?? "N/A"}

Return JSON in exactly this format:
{
  "signal": "BUY or SELL or HOLD",
  "entry": "short numeric guidance",
  "target": "short numeric guidance",
  "stopLoss": "short numeric guidance",
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

    if (!text) return fallbackAI(stockData);

    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.log("Gemini error:", error.message);
    return fallbackAI(stockData);
  }
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

    const currentPrice = Number(data.price);
    const prevClose =
      data.prevClose != null ? Number(data.prevClose) : currentPrice;

    const change = currentPrice - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    const aiAnalysis = await generateAIAnalysis(data);

    res.json({
      symbol: data.symbol,
      name: data.name,
      exchange: data.exchange,
      price: currentPrice.toFixed(2),
      change: change.toFixed(2),
      changePercent: `${changePercent.toFixed(2)}%`,
      open: data.open != null ? Number(data.open).toFixed(2) : "N/A",
      high: data.high != null ? Number(data.high).toFixed(2) : "N/A",
      low: data.low != null ? Number(data.low).toFixed(2) : "N/A",
      previousClose: data.prevClose != null ? Number(data.prevClose).toFixed(2) : "N/A",
      aiAnalysis,
      history: data.history || [],
    });
  } catch (err) {
    console.log("SERVER ERROR:", err.message);
    res.status(500).json({ error: "Error fetching stock data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});