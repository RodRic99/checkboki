package com.chessreview.analysis;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.ArrayList;
import java.util.List;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class AnalysisService {
    private final StockfishService stockfish;
    private final int maxPlies;
    public AnalysisService(StockfishService stockfish, @Value("${chess-review.stockfish.max-plies:160}") int maxPlies) {
        this.stockfish = stockfish; this.maxPlies = maxPlies;
    }

    /**
     * 각 수의 전후 포지션을 평가해 실제로 둔 진영의 손실을 계산한다.
     * Stockfish 원점수는 "현재 둘 차례" 관점이므로 먼저 백 관점 점수로 통일한다.
     */
    public AnalysisDtos.Response analyze(List<AnalysisDtos.Move> moves) {
        // 비정상적으로 긴 요청이 CPU를 장시간 독점하지 못하도록 상한을 둔다.
        if (moves.size() > maxPlies) throw new ResponseStatusException(BAD_REQUEST, "한 번에 분석 가능한 최대 수순은 " + maxPlies + " 반수입니다.");
        List<AnalysisDtos.Review> reviews = new ArrayList<>();
        int mistakes = 0;
        for (AnalysisDtos.Move move : moves) {
            var before = stockfish.evaluate(move.beforeFen());
            var evaluation = stockfish.evaluate(move.fen());
            boolean whiteToMove = move.fen().contains(" w ");
            int whiteScore = whiteToMove ? evaluation.sideToMoveScore() : -evaluation.sideToMoveScore();
            boolean whiteBefore = move.beforeFen().contains(" w ");
            int beforeWhiteScore = whiteBefore ? before.sideToMoveScore() : -before.sideToMoveScore();
            // 백은 점수가 내려간 만큼, 흑은 백의 점수가 올라간 만큼 손해를 본다.
            int loss = move.color().equals("w") ? Math.max(0, beforeWhiteScore - whiteScore) : Math.max(0, whiteScore - beforeWhiteScore);
            String classification = classify(loss, before.candidateGap());
            if (loss >= 100) mistakes++;
            reviews.add(new AnalysisDtos.Review(move.ply(), whiteScore, loss, before.bestMove(), classification, comment(loss, whiteScore)));
        }
        return new AnalysisDtos.Response("Stockfish", "Stockfish 분석 완료 · " + moves.size() + "개 반수 · 실수 후보 " + mistakes + "개", reviews);
    }

    /** 현재 포지션 하나만 평가해 실시간 보드 조작에 사용할 추천 수를 반환한다. */
    public AnalysisDtos.PositionResponse analyzePosition(String fen) {
        var evaluation = stockfish.evaluate(fen);
        boolean whiteToMove = fen.contains(" w ");
        int whiteScore = whiteToMove ? evaluation.sideToMoveScore() : -evaluation.sideToMoveScore();
        return new AnalysisDtos.PositionResponse(whiteScore, evaluation.bestMove());
    }

    /**
     * 센티폰 손실로 분류하되, 손실이 거의 없고 대안과 100cp 이상 차이나면 유일수로 본다.
     * 임계값을 한곳에 모아 향후 사용자 설정으로 분리하기 쉽게 했다.
     */
    private String classify(int loss, int candidateGap) {
        if (loss >= 300) return "BLUNDER";
        if (loss >= 150) return "MISTAKE";
        if (loss >= 75) return "INACCURACY";
        if (loss <= 15 && candidateGap >= 100) return "ONLY_MOVE";
        if (loss <= 15) return "BEST";
        if (loss <= 40) return "RECOMMENDED";
        return "GOOD";
    }
    private String comment(int loss, int score) {
        String balance = score > 30 ? "백 우세" : score < -30 ? "흑 우세" : "균형";
        if (loss >= 300) return "큰 평가 손실입니다. 전술적 반격과 더 안전한 후보 수를 확인하세요. 현재 " + balance + "입니다.";
        if (loss >= 150) return "평가가 크게 내려갔습니다. Stockfish의 추천 수와 비교해 보세요. 현재 " + balance + "입니다.";
        if (loss >= 75) return "조금 부정확한 선택입니다. 현재 " + balance + "입니다.";
        return "평가를 잘 유지했습니다. 현재 " + balance + "입니다.";
    }
}
