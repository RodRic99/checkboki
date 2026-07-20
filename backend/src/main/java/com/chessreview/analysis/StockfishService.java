package com.chessreview.analysis;

import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class StockfishService {
    private final String configuredPath;
    private final int depth;
    private Process process;
    private BufferedWriter input;
    private BufferedReader output;
    /**
     * 연속한 수의 afterFen은 다음 수의 beforeFen과 같다.
     * 최대 256개 포지션을 LRU 캐시해 같은 포지션을 두 번 엔진에 보내지 않는다.
     */
    private final Map<String, Evaluation> cache = new LinkedHashMap<>(192, .75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<String, Evaluation> eldest) { return size() > 256; }
    };

    public StockfishService(@Value("${chess-review.stockfish.path:}") String configuredPath,
                            @Value("${chess-review.stockfish.depth:12}") int depth) {
        this.configuredPath = configuredPath;
        this.depth = Math.max(8, Math.min(depth, 20));
    }

    /**
     * FEN 하나를 Stockfish UCI 프로토콜로 분석한다.
     * synchronized는 하나의 엔진 stdin/stdout에 여러 요청이 섞이는 것을 방지한다.
     */
    public synchronized Evaluation evaluate(String fen) {
        Evaluation cached = cache.get(fen);
        if (cached != null) return cached;
        ensureStarted();
        try {
            send("position fen " + fen);
            send("go depth " + depth);
            String line;
            Integer centipawns = null;
            Integer secondBestScore = null;
            String bestMove = "";
            long deadline = System.nanoTime() + Duration.ofSeconds(20).toNanos();
            while (System.nanoTime() < deadline && (line = output.readLine()) != null) {
                if (line.startsWith("info ") && line.contains(" score ")) {
                    String[] tokens = line.split("\\s+");
                    int multipv = 1;
                    Integer lineScore = null;
                    String principalMove = "";
                    for (int i = 0; i + 2 < tokens.length; i++) {
                        // MultiPV 1은 최선 후보, MultiPV 2는 두 번째 후보다.
                        if (tokens[i].equals("multipv")) multipv = Integer.parseInt(tokens[i + 1]);
                        // cp는 centipawn 단위이며 100cp는 대략 폰 하나의 가치다.
                        if (tokens[i].equals("score") && tokens[i + 1].equals("cp")) lineScore = Integer.parseInt(tokens[i + 2]);
                        if (tokens[i].equals("score") && tokens[i + 1].equals("mate")) {
                            // 메이트 점수를 일반 평가와 비교할 수 있는 큰 센티폰 값으로 정규화한다.
                            int mate = Integer.parseInt(tokens[i + 2]);
                            lineScore = mate > 0 ? 10000 - Math.min(mate, 999) : -10000 - Math.max(mate, -999);
                        }
                        // pv 다음 첫 토큰이 해당 후보의 추천 UCI 수(e2e4 등)다.
                        if (tokens[i].equals("pv")) principalMove = tokens[i + 1];
                    }
                    if (lineScore != null && multipv == 1) { centipawns = lineScore; if (!principalMove.isBlank()) bestMove = principalMove; }
                    if (lineScore != null && multipv == 2) secondBestScore = lineScore;
                }
                if (line.startsWith("bestmove")) { if (bestMove.isBlank()) bestMove = line.split("\\s+")[1]; break; }
            }
            if (centipawns == null) throw new IOException("평가값을 받지 못했습니다.");
            // 후보 간 격차가 크면 다른 수가 급격히 나쁘다는 뜻이며 유일수 판정에 사용한다.
            int candidateGap = secondBestScore == null ? 0 : Math.max(0, centipawns - secondBestScore);
            Evaluation result = new Evaluation(centipawns, bestMove, candidateGap);
            cache.put(fen, result);
            return result;
        } catch (Exception exception) {
            stop();
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "Stockfish 분석 중 오류가 발생했습니다.", exception);
        }
    }

    /** 파일 존재만 확인한다. 상태 조회만으로 엔진 프로세스를 시작하지는 않는다. */
    public boolean available() { return resolvePath() != null; }

    /** 엔진을 한 번만 시작하고 UCI 핸드셰이크 및 MultiPV 옵션을 설정한다. */
    private void ensureStarted() {
        if (process != null && process.isAlive()) return;
        Path path = resolvePath();
        if (path == null) throw new ResponseStatusException(SERVICE_UNAVAILABLE,
                "Stockfish를 찾을 수 없습니다. STOCKFISH_PATH 환경 변수에 stockfish.exe 경로를 지정하세요.");
        try {
            process = new ProcessBuilder(path.toString()).redirectErrorStream(true).start();
            input = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8));
            output = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
            send("uci"); waitFor("uciok"); send("setoption name MultiPV value 2"); send("isready"); waitFor("readyok");
        } catch (Exception exception) {
            stop();
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "Stockfish를 시작할 수 없습니다.", exception);
        }
    }

    /** 설정된 경로를 우선하고, 없으면 backend/engine/stockfish.exe를 자동 탐색한다. */
    private Path resolvePath() {
        if (!configuredPath.isBlank() && Files.isRegularFile(Path.of(configuredPath))) return Path.of(configuredPath);
        for (String candidate : new String[]{"engine/stockfish.exe", "stockfish.exe"}) {
            Path path = Path.of(candidate).toAbsolutePath(); if (Files.isRegularFile(path)) return path;
        }
        return null;
    }

    private void send(String command) throws IOException { input.write(command); input.newLine(); input.flush(); }
    private void waitFor(String expected) throws IOException {
        String line; while ((line = output.readLine()) != null) if (line.equals(expected)) return;
        throw new EOFException(expected);
    }

    /** Spring 종료 시 quit을 보내고 응답하지 않으면 강제 종료해 좀비 프로세스를 방지한다. */
    @PreDestroy public synchronized void stop() {
        if (process == null) return;
        try { if (process.isAlive()) { send("quit"); process.waitFor(1, TimeUnit.SECONDS); } } catch (Exception ignored) {}
        if (process.isAlive()) process.destroyForcibly(); process = null;
    }

    /** sideToMoveScore는 FEN에서 둘 차례인 진영 관점이며 서비스에서 백 관점으로 변환한다. */
    public record Evaluation(int sideToMoveScore, String bestMove, int candidateGap) {}
}
