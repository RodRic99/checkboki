import { useState, type DragEvent } from 'react';
import { Chess, type Square } from 'chess.js';

const pieces: Record<string, string> = {
  wp: '\u2659', wn: '\u2658', wb: '\u2657', wr: '\u2656', wq: '\u2655', wk: '\u2654',
  bp: '\u265f', bn: '\u265e', bb: '\u265d', br: '\u265c', bq: '\u265b', bk: '\u265a',
};

interface ChessBoardProps {
  /** 현재 화면에 그릴 표준 FEN 문자열 */
  fen: string;
  /** 합법 수 입력을 부모에게 전달한다. true면 부모가 수를 수락했다는 의미다. */
  onMove: (from: Square, to: Square) => boolean;
  /** 실제로 둔 수의 품질 아이콘. 해당 수의 도착 칸 오른쪽 위에 표시한다. */
  evaluationBadge?: { square: Square; icon: string; label: string; tone: string };
  /** Stockfish 추천 수의 UCI 표기. 예: e2e4, e7e8q */
  recommendation?: string;
}

export default function ChessBoard({ fen, onMove, evaluationBadge, recommendation }: ChessBoardProps) {
  const chess = new Chess(fen);
  const [draggedFrom, setDraggedFrom] = useState<Square>();
  const [selectedSquare, setSelectedSquare] = useState<Square>();
  const [dragOver, setDragOver] = useState<Square>();
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  // UCI 추천 수에서 앞의 두 칸과 뒤의 두 칸만 추출한다. 프로모션 접미사(q 등)는 화살표에 불필요하다.
  const arrow = recommendation?.match(/^([a-h][1-8])([a-h][1-8])/);
  // SVG viewBox가 8×8이므로 보드 좌표를 각 칸의 중심 좌표로 변환한다.
  // 화면은 8랭크부터 시작하므로 y축은 반대로 계산한다.
  const squareCenter = (square: string) => ({
    x: square.charCodeAt(0) - 97 + .5,
    y: 8 - Number(square[1]) + .5,
  });
  const arrowStart = arrow ? squareCenter(arrow[1]) : undefined;
  const arrowEnd = arrow ? squareCenter(arrow[2]) : undefined;

  const activeSquare = draggedFrom ?? selectedSquare;
  // chess.js에서 선택 기물의 합법적인 도착지만 받아 강조 표시와 입력 검증에 함께 사용한다.
  const legalTargets = activeSquare
    ? new Set(chess.moves({ square: activeSquare, verbose: true }).map((move) => move.to))
    : new Set<string>();

  /** HTML Drag and Drop API에 출발 칸을 기록한다. 상대 기물은 드래그할 수 없다. */
  const startDrag = (event: DragEvent, square: Square) => {
    const piece = chess.get(square);
    if (!piece || piece.color !== chess.turn()) { event.preventDefault(); return; }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', square);
    setSelectedSquare(undefined);
    setDraggedFrom(square);
  };
  /** 드롭된 칸과 출발 칸을 부모에게 전달한 후 임시 드래그 상태를 정리한다. */
  const drop = (event: DragEvent, target: Square) => {
    event.preventDefault();
    const from = (event.dataTransfer.getData('text/plain') || draggedFrom) as Square | undefined;
    if (from) onMove(from, target);
    setDraggedFrom(undefined); setDragOver(undefined);
  };

  /**
   * 클릭 이동 상태 머신:
   * 1) 자기 기물 클릭 → 선택, 2) 합법 목적지 클릭 → 이동,
   * 같은 기물 재클릭 → 해제, 다른 자기 기물 클릭 → 선택 교체.
   */
  const clickSquare = (square: Square) => {
    const piece = chess.get(square);
    if (!selectedSquare) {
      if (piece?.color === chess.turn()) setSelectedSquare(square);
      return;
    }
    if (square === selectedSquare) { setSelectedSquare(undefined); return; }
    if (piece?.color === chess.turn()) { setSelectedSquare(square); return; }
    if (legalTargets.has(square)) onMove(selectedSquare, square);
    setSelectedSquare(undefined);
  };

  return <div className="board" aria-label="현재 체스 포지션">
    {/* 추천 화살표는 pointer-events:none이므로 아래 칸의 클릭/드래그를 막지 않는다. */}
    {arrowStart && arrowEnd && <svg className="recommendation-arrow" viewBox="0 0 8 8" aria-label={`Stockfish 추천 수 ${recommendation}`}>
      <defs><marker id="stockfish-arrow-head" markerWidth="3.2" markerHeight="3.2" refX="2.35" refY="1.6" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L3.2,1.6 L0,3.2 z" /></marker></defs>
      <line x1={arrowStart.x} y1={arrowStart.y} x2={arrowEnd.x} y2={arrowEnd.y} markerEnd="url(#stockfish-arrow-head)" />
    </svg>}
    {ranks.flatMap((rank) => files.map((file, fileIndex) => {
      const square = `${file}${rank}` as Square;
      const piece = chess.get(square);
      const dark = (rank + fileIndex) % 2 === 1;
      const canDrop = legalTargets.has(square);
      return <div
        className={`square ${dark ? 'dark' : 'light'} ${canDrop ? 'legal-target' : ''} ${selectedSquare === square ? 'selected-square' : ''} ${dragOver === square && canDrop ? 'drag-over' : ''}`}
        key={square}
        onClick={() => clickSquare(square)}
        onDragOver={(event) => { if (canDrop) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOver(square); } }}
        onDragLeave={() => setDragOver(undefined)}
        onDrop={(event) => drop(event, square)}
      >
        <span
          draggable={Boolean(piece && piece.color === chess.turn())}
          onDragStart={(event) => startDrag(event, square)}
          onDragEnd={() => { setDraggedFrom(undefined); setDragOver(undefined); }}
          className={`${piece?.color === 'w' ? 'white-piece' : 'black-piece'} chess-piece`}
        >{piece ? pieces[`${piece.color}${piece.type}`] : ''}</span>
        {evaluationBadge?.square === square && <span className={`board-evaluation-icon ${evaluationBadge.tone}`} title={evaluationBadge.label}>{evaluationBadge.icon}</span>}
        {fileIndex === 0 && <small className="rank-label">{rank}</small>}
        {rank === 1 && <small className="file-label">{file}</small>}
      </div>;
    }))}
  </div>;
}
