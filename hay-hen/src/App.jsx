import { useEffect, useMemo, useRef, useState } from "react";

const MENU = [
  { key: "5-35", label: "Vietlott 5/35" },
  { key: "6-45", label: "Vietlott 6/46 (Mega 6/45)" },
  { key: "6-55", label: "Vietlott 6/55 (Power 6/55)" },
  { key: "jackpot", label: "Kỳ có người trúng jackpot" },
  { key: "custom-cage", label: "Quay số tự chọn" },
];

function formatNum(value) {
  return String(value).padStart(2, "0");
}

function randomInt(max) {
  const randomValues = new Uint32Array(1);
  crypto.getRandomValues(randomValues);
  return randomValues[0] % max;
}

function randomBallPosition() {
  while (true) {
    const x = 16 + randomInt(69);
    const y = 16 + randomInt(69);
    const dx = x - 50;
    const dy = y - 50;
    if (dx * dx + dy * dy <= 32 * 32) {
      return { x, y };
    }
  }
}

function createBallSet(maxNumber, ballCount = 12) {
  return Array.from({ length: ballCount }, (_, index) => {
    const position = randomBallPosition();
    return {
      id: `${index}-${randomInt(100000)}`,
      value: randomInt(maxNumber) + 1,
      x: position.x,
      y: position.y,
    };
  });
}

function NumberSet({ numbers }) {
  return (
    <div className="number-set">
      {numbers.map((num, index) => (
        <span key={`${num}-${index}`} className={index === 6 ? "num special" : "num"}>
          {formatNum(num)}
        </span>
      ))}
    </div>
  );
}

function LatestResult({ latest, title }) {
  if (!latest) return null;
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="sub">Kỳ gần nhất: #{latest.drawCode} - {latest.date}</p>
      <NumberSet numbers={latest.numbers} />
      <p className="sub">
        Jackpot trúng: {latest.jackpotWinners?.length ? latest.jackpotWinners.join(" / ") : "0"}
      </p>
    </section>
  );
}

function Suggestions({ suggestions, gameType }) {
  const [buyStatus, setBuyStatus] = useState("");
  const buyStatusTimeoutRef = useRef(null);
  const gameSmsCodeMap = {
    "6-55": "655",
    "5-35": "335",
    "6-45": "645",
  };
  const gameSmsCode = gameSmsCodeMap[gameType] ?? "645";

  useEffect(() => {
    return () => {
      if (buyStatusTimeoutRef.current) {
        clearTimeout(buyStatusTimeoutRef.current);
      }
    };
  }, []);

  async function copyToClipboard(text) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function showBuyStatus(message) {
    setBuyStatus(message);
    if (buyStatusTimeoutRef.current) {
      clearTimeout(buyStatusTimeoutRef.current);
    }
    buyStatusTimeoutRef.current = setTimeout(() => {
      setBuyStatus("");
      buyStatusTimeoutRef.current = null;
    }, 3200);
  }

  async function handleBuySuggestion(channel, numbers) {
    if (!numbers?.length) return;

    const normalizedNumbers = numbers.map(formatNum).join(" ");
    const isVietlott = channel === "vietlott";
    const syntax = isVietlott
      ? `${gameSmsCode} K1 ${normalizedNumbers}`
      : `VTM ${gameSmsCode} K1 ${normalizedNumbers}`;
    const copied = await copyToClipboard(syntax);
    const smsLink = `sms:9969?&body=${encodeURIComponent(syntax)}`;

    showBuyStatus(
      copied
        ? `Đang mở ứng dụng nhắn tin cho bộ số gợi ý (${isVietlott ? "Vietlot app" : "Viettel money"}).`
        : "Đang mở ứng dụng nhắn tin. Nếu chưa tự điền nội dung, dùng cú pháp hiển thị trong hộp gợi ý."
    );

    window.location.href = smsLink;
  }

  return (
    <section className="card">
      <h2>Bộ số gợi ý theo tần suất</h2>
      <div className="suggestion-grid">
        {["10", "20", "50"].map((key) => {
          const numbers = suggestions?.[key]?.numbers ?? [];
          const hasNumbers = numbers.length > 0;
          const normalizedNumbers = numbers.map(formatNum).join(" ");
          const vietlottSmsSyntax = `${gameSmsCode} K1 ${normalizedNumbers}`;
          const viettelMoneySmsSyntax = `VTM ${gameSmsCode} K1 ${normalizedNumbers}`;

          return (
          <div key={key} className="suggestion-box">
            <h3>{key} kỳ gần nhất</h3>
            <NumberSet numbers={numbers} />
            <div className="suggestion-buy-actions">
              <button
                type="button"
                onClick={() => handleBuySuggestion("vietlott", numbers)}
                disabled={!hasNumbers}
              >
                Mua ngay (Vietlot app)
              </button>
              <button
                type="button"
                onClick={() => handleBuySuggestion("viettel-money", numbers)}
                disabled={!hasNumbers}
              >
                Mua ngay (Viettel money)
              </button>
            </div>
            {hasNumbers && (
              <div className="suggestion-syntax">
                <p><b>Vietlott:</b> {vietlottSmsSyntax}</p>
                <p><b>Viettel Money:</b> {viettelMoneySmsSyntax}</p>
              </div>
            )}
          </div>
          );
        })}
      </div>
      {buyStatus && <p className="buy-now-status">{buyStatus}</p>}
    </section>
  );
}

function DrawTable({ draws }) {
  return (
    <section className="card">
      <h2>Lịch sử kỳ quay</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Kỳ</th>
              <th>Bộ số</th>
              <th>Jackpot</th>
            </tr>
          </thead>
          <tbody>
            {draws.slice(0, 50).map((draw) => (
              <tr key={draw.drawCode}>
                <td>{draw.date}</td>
                <td>#{draw.drawCode}</td>
                <td><NumberSet numbers={draw.numbers} /></td>
                <td>{draw.jackpotWinners?.length ? draw.jackpotWinners.join(" / ") : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomCageDraw() {
  const GAME_OPTIONS = [
    { key: "5-35", value: "5/35", label: "Tự chọn 5/35 (01-35)", drawCount: 5, maxNumber: 35 },
    { key: "6-45", value: "6/45", label: "Tự chọn 6/45 (01-45)", drawCount: 6, maxNumber: 45 },
    { key: "6-55", value: "6/55", label: "Power 6/55 (01-55)", drawCount: 6, maxNumber: 55 },
  ];
  const [gameType, setGameType] = useState("6-45");
  const currentGame = GAME_OPTIONS.find((game) => game.key === gameType) ?? GAME_OPTIONS[1];
  const { drawCount, maxNumber } = currentGame;
  const [results, setResults] = useState(Array(currentGame.drawCount).fill(null));
  const [spinning, setSpinning] = useState(Array(currentGame.drawCount).fill(false));
  const [activeBallIndex, setActiveBallIndex] = useState(Array(currentGame.drawCount).fill(0));
  const [cageBalls, setCageBalls] = useState(() =>
    Array.from({ length: currentGame.drawCount }, () => createBallSet(currentGame.maxNumber))
  );
  const [buyStatus, setBuyStatus] = useState("");
  const intervalRefs = useRef(Array(6).fill(null));
  const timeoutRefs = useRef(Array(6).fill(null));
  const buyStatusTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (buyStatusTimeoutRef.current) {
        clearTimeout(buyStatusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const intervalIds = intervalRefs.current;
    const timeoutIds = timeoutRefs.current;

    return () => {
      intervalIds.forEach((id) => {
        if (id) clearInterval(id);
      });
      timeoutIds.forEach((id) => {
        if (id) clearTimeout(id);
      });
    };
  }, []);

  function pickNumber(excludedSet) {
    const availableNumbers = [];
    for (let num = 1; num <= maxNumber; num += 1) {
      if (!excludedSet.has(num)) {
        availableNumbers.push(num);
      }
    }

    if (!availableNumbers.length) return null;
    return availableNumbers[randomInt(availableNumbers.length)];
  }

  function resetBoard(nextGame) {
    intervalRefs.current.forEach((id, index) => {
      if (id) {
        clearInterval(id);
        intervalRefs.current[index] = null;
      }
    });
    timeoutRefs.current.forEach((id, index) => {
      if (id) {
        clearTimeout(id);
        timeoutRefs.current[index] = null;
      }
    });

    setResults(Array(nextGame.drawCount).fill(null));
    setSpinning(Array(nextGame.drawCount).fill(false));
    setActiveBallIndex(Array(nextGame.drawCount).fill(0));
    setCageBalls(Array.from({ length: nextGame.drawCount }, () => createBallSet(nextGame.maxNumber)));
    setBuyStatus("");
  }

  function handleGameChange(event) {
    const nextType = event.target.value;
    const nextGame = GAME_OPTIONS.find((game) => game.key === nextType) ?? GAME_OPTIONS[1];
    setGameType(nextType);
    resetBoard(nextGame);
  }

  function spinCage(index) {
    if (spinning[index]) return;

    const duration = 2200 + randomInt(1200);
    const excludedNumbers = new Set(results.filter((value, i) => i !== index && value !== null));
    const finalNumber = pickNumber(excludedNumbers);
    if (finalNumber === null) return;

    setSpinning((prev) => prev.map((value, i) => (i === index ? true : value)));
    setResults((prev) => prev.map((value, i) => (i === index ? null : value)));
    setBuyStatus("");

    intervalRefs.current[index] = setInterval(() => {
      const rollingNumber = randomInt(maxNumber) + 1;
      const rollingBallIndex = randomInt(12);
      setActiveBallIndex((prev) => prev.map((value, i) => (i === index ? rollingBallIndex : value)));
      setCageBalls((prev) =>
        prev.map((balls, i) =>
          i !== index
            ? balls
            : balls.map((ball, ballIndex) => {
                const position = randomBallPosition();
                return {
                  ...ball,
                  value: ballIndex === rollingBallIndex ? rollingNumber : randomInt(maxNumber) + 1,
                  x: position.x,
                  y: position.y,
                };
              })
        )
      );
    }, 90);

    timeoutRefs.current[index] = setTimeout(() => {
      clearInterval(intervalRefs.current[index]);
      intervalRefs.current[index] = null;

      setResults((prev) => prev.map((value, i) => (i === index ? finalNumber : value)));
      setActiveBallIndex((prev) => prev.map((value, i) => (i === index ? 0 : value)));
      setCageBalls((prev) =>
        prev.map((balls, i) =>
          i !== index
            ? balls
            : balls.map((ball, ballIndex) => {
                const position = ballIndex === 0 ? { x: 50, y: 50 } : randomBallPosition();
                return {
                  ...ball,
                  value: ballIndex === 0 ? finalNumber : ball.value,
                  x: position.x,
                  y: position.y,
                };
              })
        )
      );
      setSpinning((prev) => prev.map((value, i) => (i === index ? false : value)));
      timeoutRefs.current[index] = null;
    }, duration);
  }

  const completedNumbers = useMemo(
    () => results.filter((value) => value !== null),
    [results]
  );
  const canBuyNow = completedNumbers.length === drawCount;
  const formattedNumbers = completedNumbers.map(formatNum);
  const gameSmsCodeMap = {
    "6-55": "655",
    "5-35": "335",
    "6-45": "645",
  };
  const gameSmsCode = gameSmsCodeMap[gameType] ?? "645";
  const selectedNumbers = formattedNumbers.join(" ");
  const vietlottSmsSyntax = `${gameSmsCode} K1 ${selectedNumbers}`;
  const viettelMoneySmsSyntax = `VTM ${gameSmsCode} K1 ${selectedNumbers}`;

  async function copyToClipboard(text) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function showBuyStatus(message) {
    setBuyStatus(message);
    if (buyStatusTimeoutRef.current) {
      clearTimeout(buyStatusTimeoutRef.current);
    }
    buyStatusTimeoutRef.current = setTimeout(() => {
      setBuyStatus("");
      buyStatusTimeoutRef.current = null;
    }, 3200);
  }

  async function handleBuyNow(channel) {
    if (!canBuyNow) return;

    const isVietlott = channel === "vietlott";
    const syntax = isVietlott ? vietlottSmsSyntax : viettelMoneySmsSyntax;
    const copied = await copyToClipboard(syntax);
    const smsLink = `sms:9969?&body=${encodeURIComponent(syntax)}`;

    showBuyStatus(
      copied
        ? `Đang mở ứng dụng nhắn tin với cú pháp ${isVietlott ? "Vietlott app" : "Viettel Money"}.`
        : `Đang mở ứng dụng nhắn tin. Nếu chưa tự điền nội dung, dùng cú pháp hiển thị bên dưới.`
    );

    window.location.href = smsLink;
  }

  return (
    <section className="card">
      <h2>Quay số tự chọn</h2>
      <p className="sub">
        Loại hình quay: <b>{currentGame.value}</b>
      </p>  

      <div className="custom-controls">
        <label htmlFor="game-type">Chọn</label>
        <select
          id="game-type"
          value={gameType}
          onChange={handleGameChange}
        >
          {GAME_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="draw-result-header">
        {results.map((value, index) => (
          <span
            key={`result-${index}`}
            className={`draw-result-ball ${value !== null ? "filled" : ""}`}
            title={`Vị trí ${index + 1}`}
          >
            {value === null ? "" : formatNum(value)}
          </span>
        ))}
      </div>

      <div className="cage-grid">
        {Array.from({ length: drawCount }).map((_, index) => (
          <article key={`cage-${index}`} className="cage-card">
            <h3>Lồng {index + 1}</h3>
            <div className={`cage ${spinning[index] ? "is-spinning" : ""}`}>
              {cageBalls[index].map((ballValue, ballIndex) => (
                <span
                  key={`cage-${index}-${ballValue.id}`}
                  className={`ball ${ballIndex === activeBallIndex[index] ? "active" : ""}`}
                  style={{ "--x": `${ballValue.x}%`, "--y": `${ballValue.y}%` }}
                >
                  {formatNum(ballValue.value)}
                </span>
              ))}
            </div>
            <button type="button" onClick={() => spinCage(index)} disabled={spinning[index]}>
              {spinning[index] ? "Đang quay..." : "Quay lồng"}
            </button>
          </article>
        ))}
      </div>

      <div className="buy-now-panel">
        <h3>Mua ngay bộ số vừa quay</h3>
        <p className="sub">
          {canBuyNow
            ? "Bấm nút để chuyển sang màn hình gửi SMS của điện thoại với nội dung có sẵn."
            : `Hãy quay đủ ${drawCount} lồng để bật mua nhanh.`}
        </p>
        <div className="buy-now-actions">
          <button type="button" onClick={() => handleBuyNow("vietlott")} disabled={!canBuyNow}>
            Mua ngay (Vietlot app)
          </button>
          <button type="button" onClick={() => handleBuyNow("viettel-money")} disabled={!canBuyNow}>
            Mua ngay (Viettel money)
          </button>
        </div>
        {canBuyNow && (
          <div className="buy-now-syntax">
            <p><b>Cú pháp SMS Vietlott:</b> {vietlottSmsSyntax}</p>
            <p><b>Cú pháp SMS Viettel Money:</b> {viettelMoneySmsSyntax}</p>
            <p><b>S (dãy số hiện tại):</b> {selectedNumbers}</p>
          </div>
        )}
        {buyStatus && <p className="buy-now-status">{buyStatus}</p>}
      </div>
    </section>
  );
}

function App() {
  const [activeMenu, setActiveMenu] = useState("6-45");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [data535, setData535] = useState(null);
  const [data645, setData645] = useState(null);
  const [data655, setData655] = useState(null);
  const [jackpotData, setJackpotData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [res535, res645, res655, resJackpot] = await Promise.all([
          fetch("/api/vietlott/5-35"),
          fetch("/api/vietlott/6-45"),
          fetch("/api/vietlott/6-55"),
          fetch("/api/vietlott/jackpot-winners"),
        ]);

        if (!res535.ok || !res645.ok || !res655.ok || !resJackpot.ok) {
          throw new Error("Không thể tải dữ liệu từ API.");
        }

        const [json535, json645, json655, jsonJackpot] = await Promise.all([
          res535.json(),
          res645.json(),
          res655.json(),
          resJackpot.json(),
        ]);

        setData535(json535);
        setData645(json645);
        setData655(json655);
        setJackpotData(jsonJackpot);
      } catch (err) {
        setError(err.message || "Đã có lỗi xảy ra.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const currentData = useMemo(() => {
    if (activeMenu === "5-35") return data535;
    if (activeMenu === "6-45") return data645;
    if (activeMenu === "6-55") return data655;
    return null;
  }, [activeMenu, data535, data645, data655]);

  return (
    <div className="layout">
      <button
        type="button"
        className={`menu-toggle ${isMenuOpen ? "open" : ""}`}
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-label="Mở menu"
        aria-expanded={isMenuOpen}
        aria-controls="app-sidebar"
      >
        {isMenuOpen ? "✕" : "☰"}
      </button>

      {isMenuOpen && <div className="menu-backdrop" onClick={() => setIsMenuOpen(false)} />}

      <aside id="app-sidebar" className={`sidebar ${isMenuOpen ? "open" : ""}`}>
        <h1>Hay Hên</h1>
        <nav>
          {MENU.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setActiveMenu(item.key);
                setIsMenuOpen(false);
              }}
              className={activeMenu === item.key ? "active" : ""}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <p className="sidebar-footer">Copyright by thuongdq</p>
      </aside>

      <main className="content">
        {loading && <p>Đang tải dữ liệu thật từ Vietlott...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && activeMenu !== "jackpot" && currentData && (
          <>
            <LatestResult
              latest={currentData.latest}
              title={
                activeMenu === "5-35"
                  ? "Kết quả 5/35 mới nhất"
                  : activeMenu === "6-45"
                    ? "Kết quả Mega 6/45 mới nhất"
                    : "Kết quả Power 6/55 mới nhất"
              }
            />
            <Suggestions suggestions={currentData.suggestions} gameType={activeMenu} />
            <DrawTable draws={currentData.draws} />
          </>
        )}

        {!loading && !error && activeMenu === "jackpot" && jackpotData && (
          <section className="card">
            <h2>Thống kê các kỳ có người trúng jackpot (5/35 + Mega + Power)</h2>
            <p className="sub">Tổng kỳ có người trúng: {jackpotData.total}</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Loại hình</th>
                    <th>Ngày</th>
                    <th>Kỳ</th>
                    <th>Bộ số</th>
                    <th>Số vé trúng jackpot</th>
                  </tr>
                </thead>
                <tbody>
                  {jackpotData.draws.map((draw) => (
                    <tr key={`${draw.game}-${draw.drawCode}`}>
                      <td>{draw.game}</td>
                      <td>{draw.date}</td>
                      <td>#{draw.drawCode}</td>
                      <td><NumberSet numbers={draw.numbers} /></td>
                      <td>{draw.jackpotWinners.join(" / ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!loading && !error && activeMenu === "custom-cage" && <CustomCageDraw />}

        <footer className="page-footer">Copyright by thuongdq</footer>
      </main>
    </div>
  );
}

export default App;
