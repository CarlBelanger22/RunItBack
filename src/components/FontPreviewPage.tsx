import { useEffect } from 'react';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600&family=Big+Shoulders+Display:wght@700;800&family=Big+Shoulders+Text:wght@600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap';

const ROWS = [
  ['12', 'Jayden Cheng', '17:49', '3/4', '2/3', '1/1', '0/1', '3', '1', '2', '1', '+10', '7'],
  ['2', 'Shabbir Ahmad', '35:22', '8/22', '7/17', '1/5', '0/6', '3', '11', '4', '0', '+7', '17'],
  ['99', 'Gavin Tay', '34:24', '2/18', '2/15', '0/3', '4/4', '4', '9', '1', '6', '+3', '8'],
  ['11', 'Hoong Shen Tan', 'DNP', '—', '—', '—', '—', '—', '—', '—', '—', '—', '—'],
];

type Face = {
  id: string;
  title: string;
  note: string;
  words: string;
  tight: string;
  score: string;
  numbers: string;
  numeric: string;
};

const FACES: Face[] = [
  {
    id: 'now',
    title: 'Now',
    note: 'Live tracker today. Barlow for sentences, Barlow Condensed for the score and short labels, JetBrains Mono for the clock and the box numbers.',
    words: '"Barlow", sans-serif',
    tight: '"Barlow Condensed", sans-serif',
    score: '"Barlow Condensed", sans-serif',
    numbers: '"JetBrains Mono", monospace',
    numeric: 'normal',
  },
  {
    id: 'next',
    title: 'Proposed',
    note: 'Hanken Grotesk for names and the box, with equal-width digits. Big Shoulders for the score, the clock, and the short team names.',
    words: '"Hanken Grotesk", sans-serif',
    tight: '"Big Shoulders Text", sans-serif',
    score: '"Big Shoulders Display", sans-serif',
    numbers: '"Hanken Grotesk", sans-serif',
    numeric: 'tabular-nums lining-nums',
  },
];

function Board({ face }: { face: Face }) {
  const words = { fontFamily: face.words };
  const tight = { fontFamily: face.tight, fontVariantNumeric: face.numeric };
  const score = { fontFamily: face.score, fontVariantNumeric: face.numeric };
  const numbers = { fontFamily: face.numbers, fontVariantNumeric: face.numeric };
  return (
    <section className="font-preview-board" aria-labelledby={`face-${face.id}`}>
      <p id={`face-${face.id}`} className="font-preview-kicker" style={words}>
        {face.title}
      </p>
      <p className="font-preview-note" style={words}>
        {face.note}
      </p>

      <div className="font-preview-score">
        <div>
          <div className="font-preview-abbr" style={{ ...tight, color: '#00d2ff' }}>
            SIG
          </div>
          <div className="font-preview-team" style={numbers}>
            Siglap
          </div>
        </div>
        <div className="font-preview-mid">
          <div className="font-preview-num" style={score}>
            56–50
          </div>
          <div className="font-preview-clock" style={numbers}>
            Q4 02:14
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="font-preview-abbr" style={{ ...tight, color: '#ff9f00' }}>
            XH
          </div>
          <div className="font-preview-team" style={numbers}>
            Xin Hua
          </div>
        </div>
      </div>

      <p className="font-preview-sentence" style={words}>
        Siglap led by 8 with 2:14 left. Jayden Cheng scored 7 off the bench.
      </p>

      <div className="font-preview-table-wrap">
        <table className="font-preview-table">
          <thead>
            <tr style={tight}>
              {['#', 'Player', 'Min', 'FG', '2P', '3P', 'FT', 'OR', 'DR', 'AST', 'TO', '+/−', 'PTS'].map(
                (h) => (
                  <th key={h}>{h}</th>
                )
              )}
            </tr>
          </thead>
          <tbody style={numbers}>
            {ROWS.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td key={i} style={i === 1 ? words : undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FontPreviewPage() {
  useEffect(() => {
    const id = 'font-preview-faces';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);

  return (
    <main className="font-preview">
      <style>{`
        .font-preview {
          min-height: 100dvh;
          background: #12141c;
          color: #f8f9fa;
          padding: 28px 20px 64px;
        }
        .font-preview-inner { max-width: 1180px; margin: 0 auto; }
        .font-preview h1 {
          font-family: "Hanken Grotesk", sans-serif;
          font-size: 1.6rem;
          font-weight: 650;
          letter-spacing: -0.02em;
          margin: 0 0 8px;
        }
        .font-preview-lead {
          font-family: "Hanken Grotesk", sans-serif;
          color: color-mix(in srgb, #f8f9fa 72%, transparent);
          max-width: 46rem;
          margin: 0 0 28px;
          line-height: 1.45;
        }
        .font-preview-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 980px) {
          .font-preview-grid { grid-template-columns: 1fr 1fr; }
        }
        .font-preview-board {
          background: #1e2230;
          border: 1px solid #3a3f55;
          border-radius: 16px;
          padding: 18px 16px 16px;
        }
        .font-preview-kicker {
          margin: 0;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .font-preview-note {
          margin: 8px 0 16px;
          font-size: 0.92rem;
          line-height: 1.4;
          color: color-mix(in srgb, #f8f9fa 72%, transparent);
        }
        .font-preview-score {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          padding: 8px 4px 14px;
        }
        .font-preview-abbr {
          font-size: 2.4rem;
          font-weight: 800;
          line-height: 0.9;
          letter-spacing: 0.02em;
        }
        .font-preview-team { font-size: 0.85rem; opacity: 0.8; margin-top: 4px; }
        .font-preview-mid { text-align: center; }
        .font-preview-num {
          font-size: 4.4rem;
          font-weight: 800;
          line-height: 0.85;
          letter-spacing: 0.01em;
        }
        .font-preview-clock { margin-top: 8px; font-size: 1rem; letter-spacing: 0.04em; }
        .font-preview-sentence { margin: 0 0 14px; font-size: 1rem; line-height: 1.4; }
        .font-preview-table-wrap { overflow-x: auto; }
        .font-preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.78rem;
        }
        .font-preview-table th {
          text-align: right;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: color-mix(in srgb, #f8f9fa 62%, transparent);
          padding: 0 6px 8px;
          white-space: nowrap;
        }
        .font-preview-table th:nth-child(2),
        .font-preview-table td:nth-child(2) { text-align: left; }
        .font-preview-table td {
          text-align: right;
          padding: 7px 6px;
          border-top: 1px solid #3a3f55;
          white-space: nowrap;
          font-variant-numeric: inherit;
        }
      `}</style>
      <div className="font-preview-inner">
        <h1>Font sample</h1>
        <p className="font-preview-lead">
          Same game, two type systems. The app is still using the current fonts. This page is only
          here so you can look before deciding.
        </p>
        <div className="font-preview-grid">
          {FACES.map((face) => (
            <Board key={face.id} face={face} />
          ))}
        </div>
      </div>
    </main>
  );
}
