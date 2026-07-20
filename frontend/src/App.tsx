import { useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import ChessBoard from './ChessBoard';
import { analyzeGame, analyzePosition, fetchChessComGames } from './api';
import type { AnalysisResponse, ChessComGame, MovePayload } from './types';
import appIcon from '../assets/checkboki-icon.png';

type PromotionPiece = 'q' | 'r' | 'b' | 'n';
interface PendingPromotion { from: Square; to: Square; color: 'w' | 'b' }

/**
 * 백엔드가 반환하는 영문 분류 코드를 사용자에게 보여 줄 아이콘/한글/색상으로 변환한다.
 * `tone`은 styles.css의 동명 클래스로 연결되므로 새 분류를 추가할 때 양쪽을 함께 수정해야 한다.
 */
const classificationMeta: Record<string, { icon: string; label: string; tone: string }> = {
  ONLY_MOVE: { icon: '◆', label: '유일수', tone: 'only' },
  BEST: { icon: '★', label: '최선수', tone: 'best' },
  RECOMMENDED: { icon: '✓', label: '추천수', tone: 'recommended' },
  GOOD: { icon: '●', label: '좋은 수', tone: 'good' },
  INACCURACY: { icon: '?!', label: '부정확', tone: 'inaccuracy' },
  MISTAKE: { icon: '?', label: '실수', tone: 'mistake' },
  BLUNDER: { icon: '??', label: '블런더', tone: 'blunder' },
};

const samplePgn = `[White "White"]
[Black "Black"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3 Ncb4 9. a3 Nxc2+ 10. Kd1 Nxa1 11. Nxd5 Kd6 12. d4 h5 13. dxe5+ Kc5 14. Be3+ Kxc4 15. Qe4+ Kb5 16. Nc3+ Ka6 17. Qa4# 1-0`;

/**
 * 직접 붙여 넣은 PGN도 Chess.com에서 받은 PGN과 같은 모양으로 정리한다.
 * 선수 이름/레이팅/결과만 헤더에 남기며, 시계 주석·일반 주석·후보 변화·NAG를 제거한다.
 * 괄호와 중괄호는 중첩될 수 있어 단순 정규식 대신 글자를 순서대로 읽는다.
 */
function sanitizePgn(pgn: string): string {
  const keptHeaderNames = ['White', 'WhiteElo', 'Black', 'BlackElo', 'Result'];
  const headerPattern = /^\s*\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\]\s*$/gm;
  const headers = new Map<string, string>();
  let lastHeaderEnd = 0;
  for (const match of pgn.matchAll(headerPattern)) {
    if (!headers.has(match[1])) headers.set(match[1], match[2]);
    lastHeaderEnd = (match.index ?? 0) + match[0].length;
  }

  const moveText = pgn.slice(lastHeaderEnd);
  let braceDepth = 0;
  let variationDepth = 0;
  let lineComment = false;
  let cleanedMoves = '';
  for (const character of moveText) {
    if (lineComment) {
      if (character === '\n' || character === '\r') lineComment = false;
      else continue;
    }
    if (character === ';' && braceDepth === 0 && variationDepth === 0) { lineComment = true; continue; }
    if (character === '{') { braceDepth++; continue; }
    if (character === '}' && braceDepth > 0) { braceDepth--; continue; }
    if (braceDepth > 0) continue;
    if (character === '(') { variationDepth++; continue; }
    if (character === ')' && variationDepth > 0) { variationDepth--; continue; }
    if (variationDepth === 0) cleanedMoves += character;
  }
  // 한 줄에 백과 흑이 각각 한 수씩 오도록 다음 백 수의 번호 앞에서 줄을 바꾼다.
  // 예: "1. e4 e5\n2. Nf3 Nc6"
  cleanedMoves = cleanedMoves
    .replace(/\$\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(?=\d+\.(?!\.))/g, '\n');

  const cleanedHeaders = keptHeaderNames
    .filter((name) => headers.get(name)?.trim())
    .map((name) => `[${name} "${headers.get(name)}"]`)
    .join('\n');
  return [cleanedHeaders, cleanedMoves].filter(Boolean).join('\n\n');
}

function parsePgn(pgn: string): { moves: MovePayload[]; error?: string } {
  try {
    // chess.js가 PGN 문법과 각 수의 합법성을 함께 검증한다.
    const chess = new Chess(); chess.loadPgn(pgn);
    const replay = new Chess();
    const moves = chess.history({ verbose: true }).map((move, index) => {
      // Stockfish는 "수를 두기 전"과 "수를 둔 후" 평가의 차이로 수의 품질을 판단한다.
      // 그래서 각 수마다 두 FEN을 모두 보관한다.
      const beforeFen = replay.fen(); replay.move(move.san);
      return { ply: index + 1, san: move.san, beforeFen, fen: replay.fen(), color: move.color } as MovePayload;
    });
    return moves.length ? { moves } : { moves, error: '수순이 포함된 PGN을 입력해 주세요.' };
  } catch { return { moves: [], error: 'PGN 형식을 확인해 주세요.' }; }
}

export default function App() {
  // pgn은 텍스트 편집기의 원본, moves는 화면/분석에 사용하기 좋게 변환된 수순 배열이다.
  const [pgn, setPgn] = useState(samplePgn);
  const [moves, setMoves] = useState<MovePayload[]>(() => parsePgn(samplePgn).moves);
  const [cursor, setCursor] = useState(0);
  const [message, setMessage] = useState('Chess.com 아이디를 검색하거나 PGN을 불러오세요.');
  const [analysis, setAnalysis] = useState<AnalysisResponse>();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [games, setGames] = useState<ChessComGame[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion>();
  const [liveRecommendation, setLiveRecommendation] = useState<string>();
  const [liveScore, setLiveScore] = useState<number>();
  const [liveAnalyzing, setLiveAnalyzing] = useState(false);
  const fen = cursor === 0 ? new Chess().fen() : moves[cursor - 1].fen;
  // cursor는 반수(half-move) 기준이다. 0은 시작 포지션, 1은 백의 첫 수 이후를 뜻한다.
  const review = analysis?.reviews.find((item) => item.ply === cursor);
  const reviewMeta = review ? classificationMeta[review.classification] : undefined;
  const boardEvaluationBadge = (() => {
    if (!reviewMeta || cursor === 0) return undefined;
    try {
      const currentMove = moves[cursor - 1];
      const position = new Chess(currentMove.beforeFen);
      // SAN(예: Nf3)을 chess.js에 적용해 실제 도착 칸(예: f3)을 얻는다.
      // 이 칸 위에 현재 수의 평가 아이콘을 표시한다.
      const played = position.move(currentMove.san);
      return { square: played.to, icon: reviewMeta.icon, label: reviewMeta.label, tone: reviewMeta.tone };
    } catch { return undefined; }
  })();
  const movePairs = useMemo(() => Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => moves.slice(i * 2, i * 2 + 2)), [moves]);

  /**
   * 현재 FEN이 바뀌면 자동으로 Stockfish 추천을 갱신한다.
   * 250ms 안에 또 수가 바뀌면 타이머와 fetch를 취소해 오래된 화살표가 표시되지 않게 한다.
   */
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLiveAnalyzing(true);
      try {
        const result = await analyzePosition(fen, controller.signal);
        setLiveRecommendation(result.bestMove); setLiveScore(result.score);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setLiveRecommendation(undefined); setLiveScore(undefined);
        }
      } finally { if (!controller.signal.aborted) setLiveAnalyzing(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [fen]);

  /** PGN 문자열을 검증하고 현재 보드/수순/분석 상태를 한 번에 교체한다. */
  const usePgn = (nextPgn: string, success: string) => {
    // 정리된 결과를 검증하므로 입력창에 보이는 PGN과 실제 복기 데이터가 항상 일치한다.
    const cleanedPgn = sanitizePgn(nextPgn);
    const parsed = parsePgn(cleanedPgn); if (parsed.error) return setMessage(parsed.error);
    setPgn(cleanedPgn); setMoves(parsed.moves); setCursor(0); setAnalysis(undefined); setMessage(success);
  };
  /** Chess.com 사용자명으로 백엔드 프록시를 호출한다. 브라우저가 Chess.com API를 직접 호출하지 않는다. */
  const searchGames = async () => {
    if (!username.trim()) return setMessage('Chess.com 아이디를 입력해 주세요.');
    setSearching(true); setMessage('Chess.com 공개 대국을 조회하고 있습니다…');
    try {
      const result = await fetchChessComGames(username.trim()); setGames(result.games);
      setMessage(`최근 ${result.archiveCount}개월에서 ${result.games.length}개 대국을 찾았습니다.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : '대국 조회에 실패했습니다.'); }
    finally { setSearching(false); }
  };
  /** 선택한 Chess.com 대국의 PGN을 로컬 수순 데이터로 변환한다. */
  const selectGame = (game: ChessComGame) => usePgn(game.pgn, `${game.white.username} vs ${game.black.username} 기보를 선택했습니다.`);

  /** 현재 수순 전체를 백엔드로 보내 Stockfish 분석 결과를 받는다. */
  const runAnalysis = async () => {
    setLoading(true); setMessage('Stockfish가 기보를 분석하고 있습니다…');
    try { const result = await analyzeGame(moves); setAnalysis(result); setMessage(result.summary); }
    catch (error) { setMessage(error instanceof Error ? error.message : '분석에 실패했습니다.'); }
    finally { setLoading(false); }
  };

  /**
   * 드래그 또는 클릭으로 입력한 합법 수를 현재 수순에 확정한다.
   * 복기 중간(cursor < moves.length)에서 수를 두면 기존 미래 수순을 버리고 새 변형을 만든다.
   */
  const commitBoardMove = (from: Square, to: Square, promotion?: PromotionPiece) => {
    try {
      const game = new Chess(fen);
      const beforeFen = game.fen();
      const played = game.move({ from, to, promotion });
      if (!played) return false;
      const branch = moves.slice(0, cursor);
      const nextMove: MovePayload = {
        ply: branch.length + 1, san: played.san, beforeFen, fen: game.fen(), color: played.color,
      };
      const nextMoves = [...branch, nextMove];
      // 화면의 PGN 편집기와 내부 moves 배열이 서로 달라지지 않도록 PGN도 다시 생성한다.
      const exported = new Chess();
      nextMoves.forEach((move) => exported.move(move.san));
      setMoves(nextMoves); setCursor(nextMoves.length); setAnalysis(undefined);
      setPgn(exported.pgn());
      setMessage(`${played.san} 수를 두었습니다. 새 변형 수순으로 복기할 수 있습니다.`);
      return true;
    } catch {
      setMessage('둘 수 없는 수입니다. 체크 상태와 기물 이동 규칙을 확인해 주세요.');
      return false;
    }
  };

  /**
   * 일반 수는 즉시 확정하고, 폰이 마지막 랭크에 도착하는 경우에는
   * 사용자가 기물을 선택할 때까지 pendingPromotion에 임시 보관한다.
   */
  const playBoardMove = (from: Square, to: Square) => {
    const game = new Chess(fen);
    const piece = game.get(from);
    const promotionRank = piece?.color === 'w' ? '8' : '1';
    if (piece?.type === 'p' && to.endsWith(promotionRank)) {
      const isLegalPromotion = game.moves({ square: from, verbose: true }).some((move) => move.to === to && Boolean(move.promotion));
      if (!isLegalPromotion) return false;
      setPendingPromotion({ from, to, color: piece.color });
      setMessage('승격할 기물을 선택해 주세요.');
      return true;
    }
    return commitBoardMove(from, to);
  };

  /** 프로모션 선택창에서 고른 기물을 포함해 보류 중이던 수를 확정한다. */
  const choosePromotion = (piece: PromotionPiece) => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(undefined);
    commitBoardMove(from, to, piece);
  };

  return <main className="app-shell">
    <header><div className="brand"><img src={appIcon} alt="" /><div><span className="eyebrow">CHESS × TTEOKBOKKI</span><h1>쳌볶이</h1></div></div><div className="status-dot">Stockfish 복기</div></header>
    <section className="workspace">
      <div className="board-panel">
        <ChessBoard fen={fen} onMove={playBoardMove} evaluationBadge={boardEvaluationBadge} recommendation={review?.bestMove ?? liveRecommendation} />
        <div className="live-analysis"><span className={liveAnalyzing ? 'thinking' : ''}>●</span>{liveAnalyzing ? 'Stockfish 계산 중…' : liveRecommendation ? `실시간 추천 ${liveRecommendation} · 평가 ${liveScore! > 0 ? '+' : ''}${((liveScore ?? 0) / 100).toFixed(2)}` : 'Stockfish 연결 대기'}</div>
        <div className="controls">
          <button onClick={() => setCursor(0)}>≪</button><button onClick={() => setCursor(Math.max(0, cursor - 1))}>‹</button>
          <span>{cursor === 0 ? '시작 포지션' : `${Math.ceil(cursor / 2)}.${cursor % 2 ? '' : '..'} ${moves[cursor - 1].san}`}</span>
          <button onClick={() => setCursor(Math.min(moves.length, cursor + 1))}>›</button><button onClick={() => setCursor(moves.length)}>≫</button>
        </div>
        <div className="comment-card">
          {reviewMeta && <div className={`evaluation-badge ${reviewMeta.tone}`}><b>{reviewMeta.icon}</b><span>{reviewMeta.label}</span></div>}
          <span>{review ? `손실 ${review.centipawnLoss}cp · Stockfish 추천 ${review.bestMove}` : 'POSITION'}</span>
          <p>{review?.comment ?? '분석 후 수순을 선택하면 Stockfish 평가를 확인할 수 있습니다.'}</p>
        </div>
      </div>
      <aside>
        <div className="tabs"><strong>Chess.com</strong><span>기보 · 분석</span></div>
        <label htmlFor="username">Chess.com 아이디</label>
        <div className="search-row"><input id="username" value={username} placeholder="예: hikaru" onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void searchGames()} /><button onClick={searchGames} disabled={searching}>{searching ? '조회 중' : '전적 조회'}</button></div>
        {games.length > 0 && <div className="game-list">{games.map((game) => <button key={game.id} onClick={() => selectGame(game)}><span><b>{game.white.username}</b> {game.white.rating} vs <b>{game.black.username}</b> {game.black.rating}</span><small>{new Date(game.endTime * 1000).toLocaleDateString('ko-KR')} · {game.timeClass} · {game.white.result}</small></button>)}</div>}
        <label htmlFor="pgn">PGN</label><textarea id="pgn" value={pgn} onChange={(e) => setPgn(e.target.value)} />
        <div className="actions"><button className="secondary" onClick={() => usePgn(pgn, 'PGN을 불러왔습니다.')}>기보 불러오기</button><button className="primary" disabled={loading || moves.length === 0} onClick={runAnalysis}>{loading ? '분석 중…' : 'Stockfish 복기'}</button></div>
        <p className="message">{message}</p>
        <div className="move-list">{movePairs.map((pair, index) => <div className="move-row" key={index}><b>{index + 1}.</b>{pair.map((move) => {
          const moveReview = analysis?.reviews.find((item) => item.ply === move.ply);
          const meta = moveReview ? classificationMeta[moveReview.classification] : undefined;
          return <button key={move.ply} className={cursor === move.ply ? 'active' : ''} onClick={() => setCursor(move.ply)}><span>{move.san}</span>{meta && <i className={`move-icon ${meta.tone}`} title={meta.label}>{meta.icon}</i>}</button>;
        })}</div>)}</div>
      </aside>
    </section>
    {pendingPromotion && <div className="modal-backdrop" role="presentation" onMouseDown={() => setPendingPromotion(undefined)}>
      <div className="promotion-dialog" role="dialog" aria-modal="true" aria-labelledby="promotion-title" onMouseDown={(event) => event.stopPropagation()}>
        <span className="eyebrow">PAWN PROMOTION</span>
        <h2 id="promotion-title">승격할 기물을 선택하세요</h2>
        <div className="promotion-options">
          {([['q', '퀸', '\u265b'], ['r', '룩', '\u265c'], ['b', '비숍', '\u265d'], ['n', '나이트', '\u265e']] as const).map(([piece, label, blackSymbol]) => {
            const symbol = pendingPromotion.color === 'w' ? String.fromCharCode(blackSymbol.charCodeAt(0) - 6) : blackSymbol;
            return <button key={piece} onClick={() => choosePromotion(piece)}><span>{symbol}</span><small>{label}</small></button>;
          })}
        </div>
        <button className="promotion-cancel" onClick={() => setPendingPromotion(undefined)}>취소</button>
      </div>
    </div>}
  </main>;
}
