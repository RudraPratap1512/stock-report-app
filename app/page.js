"use client";

import { useEffect, useState } from "react";

const API_BASE_URL = "https://stock-report-app.onrender.com";

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
      if (!disclaimerAccepted) setShowDisclaimer(true);

      const savedPortfolio = localStorage.getItem("savedPortfolio");
      if (savedPortfolio) setPortfolio(JSON.parse(savedPortfolio));
    } catch (err) {
      console.log("Local load error:", err);
    }
  }, []);

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
        setData(null);
        return;
      }

      setData(result);
    } catch (err) {
      console.log("Error fetching stock data:", err);
      setError("Unable to fetch stock data. Please try again.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const clearSavedPortfolio = () => {
    setStock("");
    setData(null);
    setBuyPrice("");
    setQuantity("");
    setPortfolio([]);
    setError("");
    localStorage.removeItem("savedPortfolio");
    localStorage.removeItem("savedStock");
    localStorage.removeItem("savedData");
    localStorage.removeItem("savedBuyPrice");
    localStorage.removeItem("savedQuantity");
  };

  const addToPortfolio = () => {
    if (!data || !buyPrice || !quantity) return;

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

  const totalInvested = portfolioWithPL.reduce(
    (sum, item) => sum + item.invested,
    0
  );

  const totalCurrent = portfolioWithPL.reduce(
    (sum, item) => sum + item.current,
    0
  );

  const totalProfit = totalCurrent - totalInvested;
  const totalReturn = totalInvested
    ? ((totalProfit / totalInvested) * 100).toFixed(2)
    : "0.00";

  const bestStock =
    portfolioWithPL.length > 0
      ? [...portfolioWithPL].sort((a, b) => b.pl - a.pl)[0]
      : null;

  const worstStock =
    portfolioWithPL.length > 0
      ? [...portfolioWithPL].sort((a, b) => a.pl - b.pl)[0]
      : null;

  const changeNum = data ? Number(data.change) : 0;
  const isPositive = changeNum >= 0;

  const signalColor =
    data?.aiAnalysis?.signal === "BUY"
      ? "#22c55e"
      : data?.aiAnalysis?.signal === "SELL"
      ? "#ef4444"
      : "#facc15";

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
                Stock data and AI suggestions shown here are for research and learning only.
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
              background: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: "22px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.28)",
              marginBottom: "22px",
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
                  Advanced AI-powered stock analysis platform with real-time data
                  and portfolio tracking.
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
              <StatCard title="Total Invested" value={`₹${totalInvested.toFixed(2)}`} />
              <StatCard title="Current Value" value={`₹${totalCurrent.toFixed(2)}`} />
              <StatCard
                title="Total P&L"
                value={`₹${totalProfit.toFixed(2)}`}
                subValue={`${totalReturn}%`}
                valueColor={totalProfit >= 0 ? "#22c55e" : "#ef4444"}
              />
              <StatCard
                title="Best Performer"
                value={bestStock ? bestStock.symbol : "N/A"}
                subValue={bestStock ? `₹${bestStock.pl.toFixed(2)}` : "-"}
                valueColor="#22c55e"
              />
              <StatCard
                title="Worst Performer"
                value={worstStock ? worstStock.symbol : "N/A"}
                subValue={worstStock ? `₹${worstStock.pl.toFixed(2)}` : "-"}
                valueColor="#ef4444"
              />
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
                <div style={panelStyle}>
                  <div style={labelStyle}>LIVE QUOTE</div>
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
                    <p><strong>Symbol:</strong> {data.symbol}</p>
                    <p><strong>Exchange:</strong> {data.exchange}</p>
                    <p><strong>Open:</strong> ₹{data.open}</p>
                    <p><strong>High:</strong> ₹{data.high}</p>
                    <p><strong>Low:</strong> ₹{data.low}</p>
                    <p><strong>Prev Close:</strong> ₹{data.previousClose}</p>
                  </div>
                </div>

                <div style={panelStyle}>
                  <div style={labelStyle}>AI SIGNAL</div>
                  <h2
                    style={{
                      margin: "8px 0 14px 0",
                      color: signalColor,
                      fontSize: "30px",
                    }}
                  >
                    {data.aiAnalysis?.signal || "N/A"}
                  </h2>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <MiniBox title="Entry" value={`₹${data.aiAnalysis?.entry || "N/A"}`} />
                    <MiniBox title="Target" value={`₹${data.aiAnalysis?.target || "N/A"}`} />
                    <MiniBox title="Stop Loss" value={`₹${data.aiAnalysis?.stopLoss || "N/A"}`} />
                    <MiniBox title="Risk" value={data.aiAnalysis?.risk || "N/A"} />
                  </div>

                  <div style={{ marginTop: "18px", color: "#cbd5e1", lineHeight: 1.7 }}>
                    <p><strong>Reason:</strong> {data.aiAnalysis?.reason || "N/A"}</p>
                    <p><strong>Action:</strong> {data.aiAnalysis?.action || "N/A"}</p>
                  </div>
                </div>

                <div style={panelStyle}>
                  <div style={labelStyle}>PORTFOLIO ENTRY</div>
                  <h2 style={{ margin: "8px 0 14px 0", color: "#fff" }}>
                    Add This Stock
                  </h2>

                  <div style={{ display: "grid", gap: "12px" }}>
                    <input
                      type="number"
                      placeholder="Buy Price"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      style={inputStyle}
                    />
                    <button
                      onClick={addToPortfolio}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "10px",
                        border: "none",
                        background:
                          "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      Add to Portfolio
                    </button>
                  </div>
                </div>
              </div>

              {portfolio.length > 0 && (
                <div style={{ ...panelStyle, marginBottom: "22px" }}>
                  <div style={labelStyle}>PORTFOLIO MANAGER</div>
                  <h2 style={{ marginTop: 0 }}>Your Holdings</h2>

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
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function StatCard({ title, value, subValue, valueColor = "#ffffff" }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #111827 0%, #0b1220 100%)",
        border: "1px solid rgba(148,163,184,0.14)",
        borderRadius: "18px",
        padding: "18px",
        boxShadow: "0 16px 30px rgba(0,0,0,0.22)",
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "8px" }}>
        {title}
      </div>
      <div style={{ fontSize: "28px", fontWeight: "bold", color: valueColor }}>
        {value}
      </div>
      {subValue && (
        <div style={{ marginTop: "6px", color: valueColor }}>{subValue}</div>
      )}
    </div>
  );
}

function MiniBox({ title, value }) {
  return (
    <div
      style={{
        backgroundColor: "rgba(15,23,42,0.7)",
        border: "1px solid rgba(148,163,184,0.12)",
        borderRadius: "14px",
        padding: "12px",
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "6px" }}>
        {title}
      </div>
      <div style={{ fontWeight: "bold", color: "#fff" }}>{value}</div>
    </div>
  );
}

const panelStyle = {
  background: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: "22px",
  padding: "20px",
  boxShadow: "0 20px 40px rgba(0,0,0,0.28)",
};

const labelStyle = {
  color: "#94a3b8",
  fontSize: "13px",
  marginBottom: "8px",
};

const inputStyle = {
  padding: "11px 12px",
  borderRadius: "10px",
  border: "1px solid #334155",
  backgroundColor: "#0f172a",
  color: "#fff",
  outline: "none",
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