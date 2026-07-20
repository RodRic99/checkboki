package com.chessreview.chesscom;

import java.util.List;

public final class ChessComDtos {
    private ChessComDtos() {}

    /** Chess.com 원본 JSON 중 목록 화면과 PGN 분석에 필요한 필드만 노출한다. */
    public record Game(
            String id,
            String url,
            String pgn,
            long endTime,
            String timeClass,
            String timeControl,
            String rated,
            Player white,
            Player black
    ) {}

    public record Player(String username, int rating, String result) {}
    public record GamesResponse(String username, int archiveCount, List<Game> games) {}
}
