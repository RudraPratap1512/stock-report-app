require("dotenv").config();
const express = require("express");
const cors = require("cors");
const YahooFinance = require("yahoo-finance2").default;
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://stock-report-app-six.vercel.app",
      "https://stock-report-app.vercel.app",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json());

const yahooFinance = new YahooFinance();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

function calculateScore(history) {
  if (!history || history.length < 20) {
    return {
      score: 0,
      signal: "HOLD",
      rsi: null,
      ema: null,
      latestClose: null,
      reason: "Not enough history for indicator calculation.",
      details: [],
    };
  }

  const closes = history.map((item) => Number(item.close));

  const emaPeriod = 5;
  const multiplier = 2 / (emaPeriod + 1);
  let ema = closes[0];

  for (let i = 1; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }

  const latestClose = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2];

  const rsiPeriod = 14;
  let gains = 0;
  let losses = 0;

  for (let i = closes.length - rsiPeriod; i < closes.length - 1; i++) {
    const diff = closes[i + 1] - closes[i];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / rsiPeriod;
  const avgLoss = losses / rsiPeriod;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  let score = 0;
  const details = [];

  if (latestClose > ema) {
    score += 1;
    details.push("Price is above EMA");
  } else {
    score -= 1;
    details.push("Price is below EMA");
  }

  if (rsi < 30) {
    score += 2;
    details.push("RSI indicates oversold zone");
  } else if (rsi > 70) {
    score -= 2;
    details.push("RSI indicates overbought zone");
  } else if (rsi >= 50 && rsi <= 65) {
    score += 1;
    details.push("RSI is in bullish range");
  } else if (rsi >= 35 && rsi < 50) {
    score -= 1;
    details.push("RSI is in weak range");
  }

  if (latestClose > prevClose) {
    score += 1;
    details.push("Recent momentum is positive");
  } else {
    score -= 1;
    details.push("Recent momentum is negative");
  }

  let signal = "HOLD";
  let reason = "Indicators are mixed.";

  if (score >= 3) {
    signal = "BUY";
    reason = "Most indicators are bullish.";
  } else if (score <= -3) {
    signal = "SELL";
    reason = "Most indicators are bearish.";
  }

  return {
    score,
    signal,
    rsi: Number(rsi.toFixed(2)),
    ema: Number(ema.toFixed(2)),
    latestClose: Number(latestClose.toFixed(2)),
    reason,
    details,
  };
}

function fallbackAI(indicator, price) {
  if (!indicator) {
    return `Signal: HOLD
Entry: Wait
Target: -
Stop Loss: -
Risk: Medium
Reason: Not enough data for AI setup.
Action: Wait for better confirmation`;
  }

  let signal = "HOLD";
  let entry = `Around ${price}`;
  let target = "-";
  let stopLoss = "-";
  let risk = "Medium";
  let reason = indicator.reason || "Indicators are mixed.";
  let action = "Wait for clearer setup.";

  if (indicator.signal === "BUY") {
    signal = "BUY";
    target = `${(Number(price) * 1.03).toFixed(2)}`;
    stopLoss = `${(Number(price) * 0.98).toFixed(2)}`;
    action = "Consider buying in small quantity with stop loss discipline.";
  } else if (indicator.signal === "SELL") {
    signal = "SELL";
    target = `${(Number(price) * 0.97).toFixed(2)}`;
    stopLoss = `${(Number(price) * 1.02).toFixed(2)}`;
    action = "Avoid fresh long entries or reduce risk exposure.";
  }

  return `Signal: ${signal}
Entry: ${entry}
Target: ${target}
Stop Loss: ${stopLoss}
Risk: ${risk}
Reason: ${reason}
Action: ${action}`;
}

async function resolveSymbol(input) {
  const raw = String(input || "").trim().toUpperCase();

  const candidates = [
    raw,
    `${raw}.NS`,
    `${raw}.BO`,
  ];

  for (const symbol of candidates) {
    try {
      const quote = await yahooFinance.quote(symbol);
      if (quote && quote.regularMarketPrice) {
        return symbol;
      }
    } catch (e) {}
  }

  try {
    const searchResult = await yahooFinance.search(raw);
    const quotes = searchResult?.quotes || [];

    const preferred =
      quotes.find((q) => q.symbol === `${raw}.NS`) ||
      quotes.find((q) => q.symbol === `${raw}.BO`) ||
      quotes.find((q) => q.symbol?.includes(".NS")) ||
      quotes.find((q) => q.symbol?.includes(".BO")) ||
      quotes[0];

    if (preferred?.symbol) {
      return preferred.symbol;
    }
  } catch (e) {}

  return null;
}

app.get("/", (req, res) => {
  res.send("Backend running with Yahoo Finance + Gemini 🚀");
});

app.get("/stock/:symbol", async (req, res) => {
  const input = req.params.symbol.trim();

  try {
    const symbol = await resolveSymbol(input);

    if (!symbol) {
      return res.status(404).json({ error: "Stock not found" });
    }

    const quote = await yahooFinance.quote(symbol);

    if (!quote || !quote.regularMarketPrice) {
      return res.status(404).json({ error: "Stock not found" });
    }

    const price = quote.regularMarketPrice;
    const prev = quote.regularMarketPreviousClose || price;
    const change = price - prev;
    const changePercent = prev ? (change / prev) * 100 : 0;

    let history = [];

    try {
      const hist = await yahooFinance.chart(symbol, {
        range: "6mo",
        interval: "1d",
      });

      history = (hist.quotes || [])
        .filter(
          (q) =>
            q.date != null &&
            q.open != null &&
            q.high != null &&
            q.low != null &&
            q.close != null
        )
        .map((q) => ({
          date: q.date,
          open: Number(q.open),
          high: Number(q.high),
          low: Number(q.low),
          close: Number(q.close),
        }));
    } catch (historyError) {
      console.log("History error:", historyError.message);
    }

    if (history.length < 20) {
      const base = price;
      history = Array.from({ length: 30 }).map((_, i) => {
        const open = base + (Math.random() - 0.5) * 40;
        const close = open + (Math.random() - 0.5) * 30;
        const high = Math.max(open, close) + Math.random() * 15;
        const low = Math.min(open, close) - Math.random() * 15;

        return {
          date: new Date(Date.now() - (29 - i) * 86400000),
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
        };
      });
    }

    const indicator = calculateScore(history);
    let aiAnalysis = fallbackAI(indicator, price.toFixed(2));

    try {
      const recentCloses = history
        .slice(-10)
        .map((h) => h.close)
        .join(", ");

      const prompt = `
You are a swing-trading assistant for an Indian retail trader.

Analyze this stock and give a practical trading setup.

Stock Name: ${quote.longName || quote.shortName || "N/A"}
Symbol: ${quote.symbol}
Exchange: ${quote.fullExchangeName || "N/A"}
Current Price: ${price}
Open: ${quote.regularMarketOpen ?? "N/A"}
Day High: ${quote.regularMarketDayHigh ?? "N/A"}
Day Low: ${quote.regularMarketDayLow ?? "N/A"}
Previous Close: ${prev}
Absolute Change: ${change.toFixed(2)}
Percentage Change: ${changePercent.toFixed(2)}%
Recent Closing Prices: ${recentCloses}

Return output exactly in this format:

Signal: <BUY / SELL / HOLD>
Entry: <one price level>
Target: <one price level>
Stop Loss: <one price level>
Risk: <Low / Medium / High>
Reason: <2 short sentences>
Action: <1 short sentence>

Keep it concise, practical, and numeric where possible.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      const text = response.text?.trim();
      if (text) {
        aiAnalysis = text;
      }
    } catch (aiError) {
      console.log("Gemini error:", aiError.message);
    }

    res.json({
      symbol: quote.symbol,
      name: quote.longName || quote.shortName || "N/A",
      price: price.toFixed(2),
      change: change.toFixed(2),
      changePercent: `${changePercent.toFixed(2)}%`,
      open: quote.regularMarketOpen?.toFixed(2) || "N/A",
      high: quote.regularMarketDayHigh?.toFixed(2) || "N/A",
      low: quote.regularMarketDayLow?.toFixed(2) || "N/A",
      previousClose: prev.toFixed(2),
      exchange: quote.fullExchangeName || "N/A",
      history,
      indicator,
      aiAnalysis,
    });
  } catch (error) {
    console.log("Server error:", error.message);
    res.status(500).json({ error: "Stock not found" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});