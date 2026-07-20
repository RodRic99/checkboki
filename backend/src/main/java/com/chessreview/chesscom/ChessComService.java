package com.chessreview.chesscom;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class ChessComService {
    private static final String API_ROOT = "https://api.chess.com/pub";
    private final RestClient client;

    public ChessComService(@Value("${chess-review.chess-com.user-agent}") String userAgent) {
        this.client = RestClient.builder()
                .defaultHeader(HttpHeaders.USER_AGENT, userAgent)
                .build();
    }

    /**
     * 월별 아카이브 목록을 최신순으로 뒤집은 뒤 요청한 개월 수만 조회한다.
     * 프런트가 Chess.com 원본 형식에 의존하지 않도록 여기서 내부 DTO로 변환한다.
     */
    public ChessComDtos.GamesResponse games(String rawUsername, int months) {
        String username = validateUsername(rawUsername);
        try {
            JsonNode archiveBody = client.get()
                    .uri(API_ROOT + "/player/{username}/games/archives", username)
                    .retrieve().body(JsonNode.class);
            List<String> archives = new ArrayList<>();
            if (archiveBody != null) archiveBody.path("archives").forEach(node -> archives.add(node.asText()));
            if (archives.isEmpty()) throw new ResponseStatusException(NOT_FOUND, "공개된 대국 기록이 없습니다.");

            Collections.reverse(archives);
            List<ChessComDtos.Game> games = new ArrayList<>();
            // Chess.com이 반환한 공식 월별 archive URL만 호출한다.
            for (String archive : archives.stream().limit(months).toList()) {
                JsonNode month = client.get().uri(URI.create(archive)).retrieve().body(JsonNode.class);
                if (month != null) month.path("games").forEach(node -> games.add(toGame(node)));
            }
            // 여러 달의 결과를 합쳤으므로 최근 대국이 먼저 보이도록 다시 정렬한다.
            games.sort((a, b) -> Long.compare(b.endTime(), a.endTime()));
            return new ChessComDtos.GamesResponse(username, Math.min(months, archives.size()), games);
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(BAD_GATEWAY, "Chess.com 공개 API 조회에 실패했습니다.", exception);
        }
    }

    /** 누락 필드가 있어도 JsonNode.path().asXxx()의 기본값으로 안전하게 변환한다. */
    private ChessComDtos.Game toGame(JsonNode node) {
        String url = node.path("url").asText();
        String id = url.substring(url.lastIndexOf('/') + 1);
        return new ChessComDtos.Game(id, url, node.path("pgn").asText(), node.path("end_time").asLong(),
                node.path("time_class").asText(), node.path("time_control").asText(),
                Boolean.toString(node.path("rated").asBoolean()), player(node.path("white")), player(node.path("black")));
    }

    private ChessComDtos.Player player(JsonNode node) {
        return new ChessComDtos.Player(node.path("username").asText(), node.path("rating").asInt(), node.path("result").asText());
    }

    /** URL 경로에 들어갈 사용자명을 허용 문자와 Chess.com 길이 범위로 제한한다. */
    private String validateUsername(String username) {
        String normalized = username == null ? "" : username.trim();
        if (!normalized.matches("[A-Za-z0-9_-]{3,25}"))
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Chess.com 아이디 형식이 올바르지 않습니다.");
        return normalized;
    }
}
