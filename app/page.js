"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Title,
  TimeScale,
  LineElement,
  PointElement,
} from "chart.js";
import { Chart, Line } from "react-chartjs-2";
import {
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement,
} from "chartjs-chart-financial";
import "chartjs-adapter-date-fns";

ChartJS.register(
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Title,
  TimeScale,
  LineElement,
  PointElement,
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement
);

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://stock-report-app.onrender.com";

export default function Home() {
  const [stock, setStock] = useState("");
  const [data, setData] = useState(null);
  const [buyPrice, setBuyPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const disclaimerAccepted = localStorage.getItem("disclaimerAccepted");
      if (!disclaimerAccepted) {
        setShowDisclaimer(true);
      }

      const savedStock = localStorage.getItem("savedStock");
      const savedData = localStorage.getItem("savedData");
      const savedBuyPrice = localStorage.getItem("savedBuyPrice");
      const savedQuantity = localStorage.getItem("savedQuantity");
      const savedPortfolio = localStorage.getItem("savedPortfolio");

      if (savedStock) setStock(savedStock);
      if (savedData) setData(JSON.parse(savedData));
      if (savedBuyPrice) setBuyPrice(savedBuyPrice);
      if (savedQuantity) setQuantity(savedQuantity);
      if (savedPortfolio) setPortfolio(JSON.parse(savedPortfolio));
    } catch (err) {
      console.log("LocalStorage load error:", err);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("savedStock", stock);
  }, [stock]);

  useEffect(() => {
    localStorage.setItem("savedBuyPrice", buyPrice);
  }, [buyPrice]);

  useEffect(() => {
    localStorage.setItem("savedQuantity", quantity);
  }, [quantity]);

  useEffect(() => {
    if (data) {
      localStorage.setItem("savedData", JSON.stringify(data));
    }
  }, [data]);

  useEffect(() => {
    localStorage.setItem("savedPortfolio", JSON.stringify(portfolio));
  }, [portfolio]);

  const acceptDisclaimer = () => {
    localStorage.setItem("disclaimerAccepted", "true");
    setShowDisclaimer(false);
  };

  const handleSearch = async () => {
    if (!stock || loading) return;

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE_URL}/stock/${stock.trim()}`);
      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Stock fetch failed");
        return;
      }

      setData(result);
    } catch (err) {
      console.log("Error fetching data:", err);
      setError("Unable to fetch stock data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addToPortfolio = () => {
    if (!data || data.error || !buyPrice || !quantity) return;

    const newItem = {
      id: Date.now(),
      name: data.name,
      symbol: data.symbol,
      buyPrice: Number(buyPrice),
      quantity: Number(quantity),
      currentPrice: Number(data.price),
    };

    setPortfolio((prev) => [...prev, newItem]);
    setBuyPrice("");
    setQuantity("");
  };

  const removeFromPortfolio = (id) => {
    setPortfolio((prev) => prev.filter((item) => item.id !== id));
  };

  const clearSavedPortfolio = () => {
    localStorage.removeItem("savedStock");
    localStorage.removeItem("savedData");
    localStorage.removeItem("savedBuyPrice");
    localStorage.removeItem("savedQuantity");
    localStorage.removeItem("savedPortfolio");

    setStock("");
    setData(null);
    setBuyPrice("");
    setQuantity("");
    setPortfolio([]);
    setError("");
  };

  const totalInvested = portfolio.reduce(
    (sum, item) => sum + item.buyPrice * item.quantity,
    0
  );

  const totalCurrent = portfolio.reduce(
    (sum, item) => sum + item.currentPrice * item.quantity,
    0
  );

  const totalProfit = totalCurrent - totalInvested;
  const totalReturn = totalInvested
    ? ((totalProfit / totalInvested) * 100).toFixed(2)
    : 0;

  const portfolioWithPL = portfolio.map((item) => {
    const invested = item.buyPrice * item.quantity;
    const current = item.currentPrice * item.quantity;
    const pl = current - invested;
    const returnPercent = invested ? (pl / invested) * 100 : 0;

    return {
      ...item,
      invested,
      current,
      pl,
      returnPercent,
    };
  });

  const bestStock =
    portfolioWithPL.length > 0
      ? [...portfolioWithPL].sort((a, b) => b.pl - a.pl)[0]
      : null;

  const worstStock =
    portfolioWithPL.length > 0
      ? [...portfolioWithPL].sort((a, b) => a.pl - b.pl)[0]
      : null;

  const emaPeriod = 5;
  const rsiPeriod = 14;

  const emaValues = useMemo(() => {
    if (!data?.history || data.history.length === 0) return [];

    const closes = data.history.map((item) => Number(item.close));
    const multiplier = 2 / (emaPeriod + 1);

    const result = [];
    let emaPrev = closes[0];

    for (let i = 0; i < closes.length; i++) {
      const close = closes[i];
      if (i === 0) {
        emaPrev = close;
      } else {
        emaPrev = (close - emaPrev) * multiplier + emaPrev;
      }

      result.push({
        x: new Date(data.history[i].date).getTime(),
        y: Number(emaPrev.toFixed(2)),
      });
    }

    return result;
  }, [data]);

  const rsiValues = useMemo(() => {
    if (!data?.history || data.history.length <= rsiPeriod) return [];

    const closes = data.history.map((item) => Number(item.close));
    const result = [];

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= rsiPeriod; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / rsiPeriod;
    let avgLoss = losses / rsiPeriod;

    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = 100 - 100 / (1 + rs);

    result.push({
      x: new Date(data.history[rsiPeriod].date).toLocaleDateString(),
      y: Number(rsi.toFixed(2)),
    });

    for (let i = rsiPeriod + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = (avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;

      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi = 100 - 100 / (1 + rs);

      result.push({
        x: new Date(data.history[i].date).toLocaleDateString(),
        y: Number(rsi.toFixed(2)),
      });
    }

    return result;
  }, [data]);

  const parseAI = (text) => {
    if (!text) {
      return {
        signal: "N/A",
        entry: "N/A",
        target: "N/A",
        stopLoss: "N/A",
        risk: "N/A",
        reason: "N/A",
        action: "N/A",
      };
    }

    const getValue = (label) => {
      const regex = new RegExp(`${label}:\\s*(.*)`, "i");
      const match = text.match(regex);
      return match ? match[1].trim() : "N/A";
    };

    return {
      signal: getValue("Signal").toUpperCase(),
      entry: getValue("Entry"),
      target: getValue("Target"),
      stopLoss: getValue("Stop Loss"),
      risk: getValue("Risk"),
      reason: getValue("Reason"),
      action: getValue("Action"),
    };
  };

  const ai = parseAI(data?.aiAnalysis);

  const indicatorRecommendation = data?.indicator || {
    signal: "N/A",
    score: 0,
    rsi: null,
    ema: null,
    latestClose: null,
    reason: "No indicator data available.",
    details: [],
  };

  const finalRecommendation = useMemo(() => {
    const aiSignal = ai.signal || "N/A";
    const indSignal = indicatorRecommendation.signal || "N/A";

    let verdict = "WAIT";
    let color = "#f59e0b";
    let summary = "Not enough confirmation yet.";

    if (aiSignal.includes("BUY") && indSignal === "BUY") {
      verdict = "STRONG BUY";
      color = "#22c55e";
      summary = "AI and indicators are both bullish.";
    } else if (aiSignal.includes("SELL") && indSignal === "SELL") {
      verdict = "STRONG SELL";
      color = "#ef4444";
      summary = "AI and indicators are both bearish.";
    } else if (aiSignal.includes("BUY") && indSignal === "HOLD") {
      verdict = "BUY WITH CAUTION";
      color = "#84cc16";
      summary = "AI is bullish but indicators are not fully aligned.";
    } else if (aiSignal.includes("SELL") && indSignal === "HOLD") {
      verdict = "SELL WITH CAUTION";
      color = "#f97316";
      summary = "AI is bearish but indicators are not fully aligned.";
    } else if (aiSignal.includes("HOLD") && indSignal === "BUY") {
      verdict = "WATCH FOR BUY";
      color = "#a3e635";
      summary = "Indicators are improving but AI is still cautious.";
    } else if (aiSignal.includes("HOLD") && indSignal === "SELL") {
      verdict = "WATCH FOR SELL";
      color = "#fb7185";
      summary = "Indicators are weakening but AI is still cautious.";
    } else if (
      (aiSignal.includes("BUY") && indSignal === "SELL") ||
      (aiSignal.includes("SELL") && indSignal === "BUY")
    ) {
      verdict = "CONFLICT / AVOID";
      color = "#eab308";
      summary = "AI and indicators disagree, so avoid fresh trade.";
    } else if (aiSignal.includes("HOLD") && indSignal === "HOLD") {
      verdict = "HOLD / WAIT";
      color = "#f59e0b";
      summary = "Both AI and indicators suggest patience.";
    }

    return { verdict, color, summary };
  }, [ai.signal, indicatorRecommendation.signal]);

  const signalColor =
    ai.signal.includes("BUY")
      ? "#22c55e"
      : ai.signal.includes("SELL")
      ? "#ef4444"
      : "#f59e0b";

  const candleData = {
    datasets: [
      {
        type: "candlestick",
        label: "Candlestick",
        data:
          data?.history?.map((item) => ({
            x: new Date(item.date).getTime(),
            o: Number(item.open),
            h: Number(item.high),
            l: Number(item.low),
            c: Number(item.close),
          })) || [],
        borderColor: {
          up: "#26a69a",
          down: "#ef5350",
          unchanged: "#999",
        },
        backgroundColor: {
          up: "#26a69a",
          down: "#ef5350",
          unchanged: "#999",
        },
      },
      {
        type: "line",
        label: `EMA ${emaPeriod}`,
        data: emaValues,
        borderColor: "#f59e0b",
        backgroundColor: "#f59e0b",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
      },
    ],
  };

  const candleOptions = {
    parsing: false,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: "#cbd5e1",
          boxWidth: 14,
        },
      },
      title: {
        display: true,
        text: "Candlestick Chart + EMA",
        color: "#ffffff",
        font: {
          size: 18,
        },
      },
      tooltip: {
        backgroundColor: "#111827",
        titleColor: "#fff",
        bodyColor: "#fff",
      },
    },
    scales: {
      x: {
        type: "time",
        time: {
          unit: "day",
        },
        ticks: {
          color: "#94a3b8",
          maxRotation: 0,
        },
        grid: {
          color: "rgba(148,163,184,0.12)",
        },
      },
      y: {
        beginAtZero: false,
        ticks: {
          color: "#94a3b8",
        },
        grid: {
          color: "rgba(148,163,184,0.12)",
        },
      },
    },
  };

  const rsiChartData = {
    labels: rsiValues.map((item) => item.x),
    datasets: [
      {
        label: `RSI ${rsiPeriod}`,
        data: rsiValues.map((item) => item.y),
        borderColor: "#60a5fa",
        backgroundColor: "#60a5fa",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
      },
      {
        label: "Overbought (70)",
        data: rsiValues.map(() => 70),
        borderColor: "#ef4444",
        borderDash: [6, 6],
        pointRadius: 0,
        borderWidth: 1.5,
      },
      {
        label: "Oversold (30)",
        data: rsiValues.map(() => 30),
        borderColor: "#22c55e",
        borderDash: [6, 6],
        pointRadius: 0,
        borderWidth: 1.5,
      },
    ],
  };

  const rsiOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#cbd5e1",
        },
      },
      title: {
        display: true,
        text: "RSI Indicator",
        color: "#ffffff",
        font: {
          size: 18,
        },
      },
    },
    scales: {
      x: {
        type: "category",
        ticks: {
          color: "#94a3b8",
          maxRotation: 0,
        },
        grid: {
          color: "rgba(148,163,184,0.12)",
        },
      },
      y: {
        min: 0,
        max: 100,
        ticks: {
          color: "#94a3b8",
        },
        grid: {
          color: "rgba(148,163,184,0.12)",
        },
      },
    },
  };

  const isPositive = data && parseFloat(data.change) >= 0;

  const panel = {
    background: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
    border: "1px solid rgba(148,163,184,0.16)",
    borderRadius: "22px",
    padding: "20px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.28)",
  };

  const statCard = {
    background: "linear-gradient(180deg, #111827 0%, #0b1220 100%)",
    border: "1px solid rgba(148,163,184,0.14)",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 16px 30px rgba(0,0,0,0.22)",
  };

  const labelStyle = {
    color: "#94a3b8",
    fontSize: "13px",
    marginBottom: "8px",
  };

  const badgeStyle = (bg, color) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 12px",
    borderRadius: "999px",
    background: bg,
    color,
    fontSize: "12px",
    fontWeight: "bold",
    border: `1px solid ${color}33`,
  });

  return (
    <>
      {showDisclaimer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(2,6,23,0.82)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "640px",
              background: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
              border: "1px solid rgba(148,163,184,0.18)",
              borderRadius: "24px",
              padding: "28px",
              boxShadow: "0 30px 60px rgba(0,0,0,0.40)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                padding: "8px 12px",
                borderRadius: "999px",
                background: "rgba(245,158,11,0.12)",
                color: "#f59e0b",
                border: "1px solid rgba(245,158,11,0.25)",
                fontSize: "12px",
                fontWeight: "bold",
                marginBottom: "16px",
              }}
            >
              IMPORTANT DISCLAIMER
            </div>

            <h2
              style={{
                margin: "0 0 12px 0",
                fontSize: "28px",
                color: "#fff",
              }}
            >
              Please read before using this platform
            </h2>

            <div
              style={{
                color: "#cbd5e1",
                lineHeight: 1.8,
                fontSize: "15px",
              }}
            >
              <p>
                This platform is for <strong>educational and informational purposes only</strong>.
              </p>
              <p>
                It does <strong>not</strong> provide investment advice, portfolio management,
                or guaranteed buy/sell recommendations.
              </p>
              <p>
                Stock data, AI signals, indicators, and final verdicts should be treated as
                research tools only. Always do your own analysis before investing.
              </p>
              <p>
                By continuing, you acknowledge that any trading or investing decision taken
                by you is entirely at your own risk.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "22px",
              }}
            >
              <button
                onClick={acceptDisclaimer}
                style={{
                  padding: "13px 18px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      <main
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top left, rgba(37,99,235,0.18), transparent 28%), radial-gradient(circle at top right, rgba(16,185,129,0.10), transparent 24%), #020617",
          color: "#f8fafc",
          padding: "20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: "1320px", margin: "0 auto" }}>
          <div
            style={{
              ...panel,
              marginBottom: "22px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ flex: "1 1 380px" }}>
                <p
                  style={{
                    margin: 0,
                    color: "#60a5fa",
                    fontSize: "13px",
                    letterSpacing: "1px",
                  }}
                >
                  DASHBOARD
                </p>
                <h1
                  style={{
                    fontSize: "clamp(28px, 5vw, 34px)",
                    margin: "8px 0 6px 0",
                    color: "#ffffff",
                  }}
                >
                  AI Stock Analyzer
                </h1>
                <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.6 }}>
                  Advanced AI-powered stock analysis platform with real-time data,
                  technical indicators, and portfolio tracking.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  alignItems: "center",
                  flex: "1 1 340px",
                  justifyContent: "flex-end",
                }}
              >
                <input
                  type="text"
                  placeholder="Search stock (e.g. TCS)"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  style={{
                    padding: "13px 16px",
                    borderRadius: "12px",
                    border: "1px solid #334155",
                    backgroundColor: "#0f172a",
                    color: "#fff",
                    minWidth: "220px",
                    flex: "1 1 220px",
                    outline: "none",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                />

                <button
                  onClick={handleSearch}
                  disabled={loading}
                  style={{
                    padding: "13px 18px",
                    borderRadius: "12px",
                    border: "none",
                    background:
                      "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#fff",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    opacity: loading ? 0.8 : 1,
                  }}
                >
                  {loading && (
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        border: "2px solid rgba(255,255,255,0.35)",
                        borderTop: "2px solid #ffffff",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                  )}
                  {loading ? "Searching..." : "Search"}
                </button>

                <button
                  onClick={clearSavedPortfolio}
                  style={{
                    padding: "13px 18px",
                    borderRadius: "12px",
                    border: "1px solid rgba(239,68,68,0.35)",
                    background: "rgba(239,68,68,0.10)",
                    color: "#fecaca",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Clear Data
                </button>
              </div>
            </div>

            {error && (
              <p style={{ color: "#f87171", marginTop: "12px" }}>{error}</p>
            )}
          </div>

          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>

          {portfolio.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
                marginBottom: "22px",
              }}
            >
              <div style={statCard}>
                <div style={labelStyle}>Total Invested</div>
                <div style={{ fontSize: "28px", fontWeight: "bold" }}>
                  ₹{totalInvested.toFixed(2)}
                </div>
              </div>

              <div style={statCard}>
                <div style={labelStyle}>Current Value</div>
                <div style={{ fontSize: "28px", fontWeight: "bold" }}>
                  ₹{totalCurrent.toFixed(2)}
                </div>
              </div>

              <div style={statCard}>
                <div style={labelStyle}>Total P&L</div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    color: totalProfit >= 0 ? "#22c55e" : "#ef4444",
                  }}
                >
                  ₹{totalProfit.toFixed(2)}
                </div>
                <div
                  style={{
                    marginTop: "6px",
                    color: totalProfit >= 0 ? "#22c55e" : "#ef4444",
                  }}
                >
                  {totalReturn}%
                </div>
              </div>

              <div style={statCard}>
                <div style={labelStyle}>Best Performer</div>
                <div style={{ fontSize: "22px", fontWeight: "bold" }}>
                  {bestStock ? bestStock.symbol : "N/A"}
                </div>
                <div style={{ marginTop: "6px", color: "#22c55e" }}>
                  {bestStock ? `₹${bestStock.pl.toFixed(2)}` : "-"}
                </div>
              </div>

              <div style={statCard}>
                <div style={labelStyle}>Worst Performer</div>
                <div style={{ fontSize: "22px", fontWeight: "bold" }}>
                  {worstStock ? worstStock.symbol : "N/A"}
                </div>
                <div style={{ marginTop: "6px", color: "#ef4444" }}>
                  {worstStock ? `₹${worstStock.pl.toFixed(2)}` : "-"}
                </div>
              </div>
            </div>
          )}

          {data && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "18px",
                  marginBottom: "22px",
                }}
              >
                <div style={panel}>
                  <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                    LIVE QUOTE
                  </div>
                  <h2 style={{ margin: "8px 0 14px 0", color: "#fff" }}>
                    {data.name}
                  </h2>

                  <div style={{ ...labelStyle, marginBottom: "4px" }}>
                    Current Price
                  </div>
                  <div
                    style={{
                      fontSize: "28px",
                      fontWeight: "bold",
                      marginBottom: "12px",
                    }}
                  >
                    ₹{data.price}
                  </div>

                  <div
                    style={
                      isPositive
                        ? badgeStyle("rgba(34,197,94,0.12)", "#22c55e")
                        : badgeStyle("rgba(239,68,68,0.12)", "#ef4444")
                    }
                  >
                    {data.change} ({data.changePercent})
                  </div>

                  <div style={{ marginTop: "16px", lineHeight: 1.8 }}>
                    <p><strong>Open:</strong> ₹{data.open}</p>
                    <p><strong>High:</strong> ₹{data.high}</p>
                    <p><strong>Low:</strong> ₹{data.low}</p>
                    <p><strong>Prev Close:</strong> ₹{data.previousClose}</p>
                  </div>
                </div>

                <div style={panel}>
                  <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                    SMART AI SIGNAL
                  </div>
                  <div
                    style={{
                      marginTop: "10px",
                      marginBottom: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: signalColor,
                      }}
                    >
                      {ai.signal}
                    </div>
                    <div
                      style={
                        ai.signal.includes("BUY")
                          ? badgeStyle("rgba(34,197,94,0.12)", "#22c55e")
                          : ai.signal.includes("SELL")
                          ? badgeStyle("rgba(239,68,68,0.12)", "#ef4444")
                          : badgeStyle("rgba(245,158,11,0.12)", "#f59e0b")
                      }
                    >
                      AI View
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "12px",
                      marginBottom: "14px",
                    }}
                  >
                    <div>
                      <div style={labelStyle}>Entry</div>
                      <div>{ai.entry}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Target</div>
                      <div>{ai.target}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Stop Loss</div>
                      <div>{ai.stopLoss}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Risk</div>
                      <div>{ai.risk}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: "10px" }}>
                    <div style={labelStyle}>Reason</div>
                    <div style={{ color: "#e5e7eb", lineHeight: 1.55 }}>
                      {ai.reason}
                    </div>
                  </div>

                  <div>
                    <div style={labelStyle}>Action</div>
                    <div style={{ color: "#e5e7eb", lineHeight: 1.55 }}>
                      {ai.action}
                    </div>
                  </div>
                </div>

                <div style={panel}>
                  <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                    INDICATOR RECOMMENDATION
                  </div>
                  <div
                    style={{
                      marginTop: "10px",
                      marginBottom: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color:
                          indicatorRecommendation.signal === "BUY"
                            ? "#22c55e"
                            : indicatorRecommendation.signal === "SELL"
                            ? "#ef4444"
                            : "#f59e0b",
                      }}
                    >
                      {indicatorRecommendation.signal}
                    </div>
                    <div
                      style={
                        indicatorRecommendation.signal === "BUY"
                          ? badgeStyle("rgba(34,197,94,0.12)", "#22c55e")
                          : indicatorRecommendation.signal === "SELL"
                          ? badgeStyle("rgba(239,68,68,0.12)", "#ef4444")
                          : badgeStyle("rgba(245,158,11,0.12)", "#f59e0b")
                      }
                    >
                      Indicator View
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "12px",
                      marginBottom: "14px",
                    }}
                  >
                    <div>
                      <div style={labelStyle}>Score</div>
                      <div>{indicatorRecommendation.score}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>RSI</div>
                      <div>{indicatorRecommendation.rsi ?? "N/A"}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>EMA</div>
                      <div>{indicatorRecommendation.ema ?? "N/A"}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Latest Close</div>
                      <div>{indicatorRecommendation.latestClose ?? "N/A"}</div>
                    </div>
                  </div>

                  <div>
                    <div style={labelStyle}>Reason</div>
                    <div style={{ color: "#e5e7eb", lineHeight: 1.55 }}>
                      {indicatorRecommendation.reason}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    ...panel,
                    border: `1px solid ${finalRecommendation.color}55`,
                    boxShadow: `0 20px 40px ${finalRecommendation.color}22`,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: `linear-gradient(135deg, ${finalRecommendation.color}12, transparent 45%)`,
                      pointerEvents: "none",
                    }}
                  />
                  <div style={{ position: "relative" }}>
                    <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                      FINAL VERDICT
                    </div>

                    <div
                      style={{
                        marginTop: "10px",
                        marginBottom: "14px",
                        fontSize: "28px",
                        fontWeight: "bold",
                        color: finalRecommendation.color,
                      }}
                    >
                      {finalRecommendation.verdict}
                    </div>

                    <div
                      style={{
                        ...badgeStyle(
                          `${finalRecommendation.color}22`,
                          finalRecommendation.color
                        ),
                        marginBottom: "14px",
                      }}
                    >
                      Combined Engine
                    </div>

                    <div style={{ marginBottom: "10px" }}>
                      <div style={labelStyle}>Summary</div>
                      <div style={{ color: "#e5e7eb", lineHeight: 1.6 }}>
                        {finalRecommendation.summary}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "12px",
                        marginTop: "14px",
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: "rgba(15,23,42,0.7)",
                          border: "1px solid rgba(148,163,184,0.12)",
                          borderRadius: "14px",
                          padding: "12px",
                        }}
                      >
                        <div style={labelStyle}>AI Signal</div>
                        <div style={{ fontWeight: "bold" }}>{ai.signal}</div>
                      </div>

                      <div
                        style={{
                          backgroundColor: "rgba(15,23,42,0.7)",
                          border: "1px solid rgba(148,163,184,0.12)",
                          borderRadius: "14px",
                          padding: "12px",
                        }}
                      >
                        <div style={labelStyle}>Indicator Signal</div>
                        <div style={{ fontWeight: "bold" }}>
                          {indicatorRecommendation.signal}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ ...panel, marginBottom: "22px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <div style={labelStyle}>PORTFOLIO MANAGER</div>
                    <h2 style={{ margin: 0 }}>Multi Stock Portfolio</h2>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    marginBottom: "16px",
                  }}
                >
                  <input
                    type="number"
                    placeholder="Buy Price"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    style={{
                      padding: "11px 12px",
                      borderRadius: "10px",
                      border: "1px solid #334155",
                      backgroundColor: "#0f172a",
                      color: "#fff",
                      flex: "1 1 180px",
                    }}
                  />

                  <input
                    type="number"
                    placeholder="Quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    style={{
                      padding: "11px 12px",
                      borderRadius: "10px",
                      border: "1px solid #334155",
                      backgroundColor: "#0f172a",
                      color: "#fff",
                      flex: "1 1 180px",
                    }}
                  />

                  <button
                    onClick={addToPortfolio}
                    style={{
                      padding: "11px 16px",
                      borderRadius: "10px",
                      border: "none",
                      background:
                        "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Add Stock
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                    marginBottom: "18px",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#0b1220",
                      border: "1px solid rgba(148,163,184,0.12)",
                      borderRadius: "14px",
                      padding: "14px",
                    }}
                  >
                    <div style={labelStyle}>Total Invested</div>
                    <div style={{ fontWeight: "bold" }}>
                      ₹{totalInvested.toFixed(2)}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#0b1220",
                      border: "1px solid rgba(148,163,184,0.12)",
                      borderRadius: "14px",
                      padding: "14px",
                    }}
                  >
                    <div style={labelStyle}>Current Value</div>
                    <div style={{ fontWeight: "bold" }}>
                      ₹{totalCurrent.toFixed(2)}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#0b1220",
                      border: "1px solid rgba(148,163,184,0.12)",
                      borderRadius: "14px",
                      padding: "14px",
                    }}
                  >
                    <div style={labelStyle}>Portfolio Return</div>
                    <div
                      style={{
                        fontWeight: "bold",
                        color: totalProfit >= 0 ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {totalReturn}%
                    </div>
                  </div>
                </div>

                {portfolio.length > 0 && (
                  <div
                    style={{
                      overflowX: "auto",
                      border: "1px solid rgba(148,163,184,0.12)",
                      borderRadius: "16px",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        minWidth: "760px",
                      }}
                    >
                      <thead>
                        <tr style={{ backgroundColor: "#0b1220" }}>
                          <th style={thStyle}>Stock</th>
                          <th style={thStyle}>Buy Price</th>
                          <th style={thStyle}>Qty</th>
                          <th style={thStyle}>Current</th>
                          <th style={thStyle}>Invested</th>
                          <th style={thStyle}>P&L</th>
                          <th style={thStyle}>Return</th>
                          <th style={thStyle}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioWithPL.map((item) => (
                          <tr
                            key={item.id}
                            style={{
                              borderTop: "1px solid rgba(148,163,184,0.10)",
                            }}
                          >
                            <td style={tdStyle}>
                              <div style={{ fontWeight: "bold" }}>{item.symbol}</div>
                              <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                                {item.name}
                              </div>
                            </td>
                            <td style={tdStyle}>₹{item.buyPrice}</td>
                            <td style={tdStyle}>{item.quantity}</td>
                            <td style={tdStyle}>₹{item.currentPrice}</td>
                            <td style={tdStyle}>₹{item.invested.toFixed(2)}</td>
                            <td
                              style={{
                                ...tdStyle,
                                color: item.pl >= 0 ? "#22c55e" : "#ef4444",
                                fontWeight: "bold",
                              }}
                            >
                              ₹{item.pl.toFixed(2)}
                            </td>
                            <td
                              style={{
                                ...tdStyle,
                                color:
                                  item.returnPercent >= 0 ? "#22c55e" : "#ef4444",
                              }}
                            >
                              {item.returnPercent.toFixed(2)}%
                            </td>
                            <td style={tdStyle}>
                              <button
                                onClick={() => removeFromPortfolio(item.id)}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: "8px",
                                  border: "none",
                                  backgroundColor: "#dc2626",
                                  color: "#fff",
                                  cursor: "pointer",
                                }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {data?.history && data.history.length > 0 && (
                <>
                  <div
                    style={{
                      ...panel,
                      marginBottom: "22px",
                      height: "min(520px, 70vh)",
                    }}
                  >
                    <Chart
                      type="candlestick"
                      data={candleData}
                      options={candleOptions}
                    />
                  </div>

                  {rsiValues.length > 0 && (
                    <div
                      style={{
                        ...panel,
                        height: "min(360px, 50vh)",
                      }}
                    >
                      <Line data={rsiChartData} options={rsiOptions} />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

const thStyle = {
  padding: "14px 12px",
  textAlign: "left",
  color: "#cbd5e1",
  fontSize: "13px",
};

const tdStyle = {
  padding: "14px 12px",
  color: "#e5e7eb",
};