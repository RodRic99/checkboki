/** Stockfish가 한 수의 손실을 계산하는 데 필요한 최소 정보 */
export interface MovePayload { ply: number; san: string; beforeFen: string; fen: string; color: 'w' | 'b' }
/** 백엔드가 수 하나에 대해 계산한 엔진 평가 결과 */
export interface MoveReview { ply: number; score: number; centipawnLoss: number; bestMove: string; classification: string; comment: string }
/** 한 대국 전체 분석 응답 */
export interface AnalysisResponse { engine: string; summary: string; reviews: MoveReview[] }
export interface PositionAnalysis { score: number; bestMove: string }
export interface ChessComPlayer { username: string; rating: number; result: string }
export interface ChessComGame {
  id: string; url: string; pgn: string; endTime: number; timeClass: string; timeControl: string; rated: string;
  white: ChessComPlayer; black: ChessComPlayer;
}
export interface ChessComGamesResponse { username: string; archiveCount: number; games: ChessComGame[] }
