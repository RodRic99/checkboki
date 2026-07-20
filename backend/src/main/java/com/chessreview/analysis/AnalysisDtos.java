package com.chessreview.analysis;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import java.util.List;

public final class AnalysisDtos {
    private AnalysisDtos() {}

    /**
     * 프런트가 전송하는 한 개의 반수(half-move).
     * beforeFen과 fen을 모두 받아 엔진 평가가 얼마나 변했는지 계산한다.
     */
    public record Move(@Positive int ply, @NotBlank String san, @NotBlank String beforeFen, @NotBlank String fen, @NotBlank String color) {}
    /** 대국 분석 요청. Bean Validation으로 빈 수순과 잘못된 필드를 컨트롤러 진입 전에 거부한다. */
    public record Request(@NotEmpty List<@Valid Move> moves) {}
    /** score는 백 관점 평가, centipawnLoss는 실제로 둔 쪽이 잃은 평가값이다. */
    public record Review(int ply, int score, int centipawnLoss, String bestMove, String classification, String comment) {}
    public record Response(String engine, String summary, List<Review> reviews) {}
    public record EngineStatus(boolean available, String message) {}
}
