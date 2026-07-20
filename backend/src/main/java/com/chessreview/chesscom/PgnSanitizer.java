package com.chessreview.chesscom;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Chess.com PGN에서 화면 표시와 복기에 필요한 정보만 남긴다.
 *
 * <p>선수 이름/레이팅과 결과는 헤더로 유지한다. 수순에서는 Chess.com이 넣는
 * 시계 주석({@code [%clk ...]}), 일반 주석, 후보 변화도, NAG({@code $1})를 제거한다.
 * 따라서 사용자는 PGN 입력창에서 실제 대국 정보와 본 수순만 보게 된다.</p>
 */
final class PgnSanitizer {
    private static final Pattern HEADER = Pattern.compile("(?m)^\\s*\\[([A-Za-z0-9_]+)\\s+\"((?:\\\\.|[^\"\\\\])*)\"\\]\\s*$");
    private static final String[] KEPT_HEADERS = {"White", "WhiteElo", "Black", "BlackElo", "Result"};

    private PgnSanitizer() {
    }

    static String keepPlayersAndMoves(String pgn) {
        if (pgn == null || pgn.isBlank()) return "";

        Map<String, String> headers = new LinkedHashMap<>();
        Matcher matcher = HEADER.matcher(pgn);
        while (matcher.find()) headers.putIfAbsent(matcher.group(1), matcher.group(2));

        // 마지막 헤더 뒤부터가 movetext다. 헤더가 없는 사용자의 PGN도 안전하게 처리한다.
        int movesStart = 0;
        matcher.reset();
        while (matcher.find()) movesStart = matcher.end();
        String moves = cleanMoveText(pgn.substring(movesStart));

        StringBuilder cleaned = new StringBuilder();
        for (String name : KEPT_HEADERS) {
            String value = headers.get(name);
            if (value != null && !value.isBlank()) {
                cleaned.append('[').append(name).append(" \"").append(value).append("\"]\n");
            }
        }
        if (!cleaned.isEmpty() && !moves.isBlank()) cleaned.append('\n');
        return cleaned.append(moves).toString().trim();
    }

    private static String cleanMoveText(String text) {
        StringBuilder result = new StringBuilder();
        int braceDepth = 0;
        int variationDepth = 0;
        boolean lineComment = false;

        for (int index = 0; index < text.length(); index++) {
            char current = text.charAt(index);
            if (lineComment) {
                if (current == '\n' || current == '\r') lineComment = false;
                else continue;
            }
            if (current == ';' && braceDepth == 0 && variationDepth == 0) {
                lineComment = true;
                continue;
            }
            if (current == '{') { braceDepth++; continue; }
            if (current == '}' && braceDepth > 0) { braceDepth--; continue; }
            if (braceDepth > 0) continue;
            if (current == '(') { variationDepth++; continue; }
            if (current == ')' && variationDepth > 0) { variationDepth--; continue; }
            if (variationDepth == 0) result.append(current);
        }

        // 먼저 불규칙한 공백을 정리한 뒤, 새 백 수의 번호 앞에서 줄을 바꾼다.
        // 따라서 한 줄에는 "1. e4 e5"처럼 백과 흑이 각각 한 수씩 표시된다.
        String compact = result.toString().replaceAll("\\$\\d+", " ").replaceAll("\\s+", " ").trim();
        return compact.replaceAll("\\s+(?=\\d+\\.(?!\\.))", "\n");
    }
}
