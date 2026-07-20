import type { AnalysisResponse, ChessComGamesResponse, MovePayload } from './types';

const API_ROOT = 'http://localhost:8080/api';

/**
 * 수순별 beforeFen/afterFen을 Spring Boot에 전달한다.
 * 오류 응답의 message를 보존해 Stockfish 미설치 같은 원인을 UI에 그대로 보여 준다.
 */
export async function analyzeGame(moves: MovePayload[]): Promise<AnalysisResponse> {
  const response = await fetch(`${API_ROOT}/analysis`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ moves }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `분석 서버 오류 (${response.status})`);
  }
  return response.json() as Promise<AnalysisResponse>;
}

/** Chess.com PubAPI 호출은 Spring Boot가 담당하며 프런트는 정리된 게임 DTO만 받는다. */
export async function fetchChessComGames(username: string, months = 3): Promise<ChessComGamesResponse> {
  const response = await fetch(`${API_ROOT}/chesscom/players/${encodeURIComponent(username)}/games?months=${months}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Chess.com 조회 오류 (${response.status})`);
  }
  return response.json() as Promise<ChessComGamesResponse>;
}
