package com.chessreview.chesscom;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PgnSanitizerTest {
    @Test
    void keepsOnlyPlayerHeadersResultAndMainLineMoves() {
        String original = """
                [Event "Live Chess"]
                [Site "Chess.com"]
                [Date "2026.07.21"]
                [White "MyId"]
                [WhiteElo "1450"]
                [Black "Opponent"]
                [BlackElo "1510"]
                [Result "1-0"]
                [ECO "C20"]

                1. e4 {[%clk 0:09:58]} e5 (1... c5) 2. Nf3 $1 Nc6 ; server note
                3. Bb5 [{핀을 유지하는 메모}] a6 1-0
                """;

        assertThat(PgnSanitizer.keepPlayersAndMoves(original)).isEqualTo("""
                [White "MyId"]
                [WhiteElo "1450"]
                [Black "Opponent"]
                [BlackElo "1510"]
                [Result "1-0"]

                1. e4 e5
                2. Nf3 Nc6
                3. Bb5 [{핀을 유지하는 메모}] a6 1-0""");
    }

    @Test
    void acceptsMoveTextWithoutHeaders() {
        assertThat(PgnSanitizer.keepPlayersAndMoves("1. d4 d5 {comment} 2. c4 1/2-1/2"))
                .isEqualTo("1. d4 d5\n2. c4 1/2-1/2");
    }
}
