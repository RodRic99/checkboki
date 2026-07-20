package com.chessreview.chesscom;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chesscom")
@CrossOrigin(originPatterns = "*")
public class ChessComController {
    private final ChessComService service;
    public ChessComController(ChessComService service) { this.service = service; }

    /**
     * 최근 N개월의 공개 대국을 조회한다. months를 1~12로 제한해
     * 실수로 외부 API를 과도하게 호출하거나 응답이 지나치게 커지는 것을 막는다.
     */
    @GetMapping("/players/{username}/games")
    public ChessComDtos.GamesResponse games(
            @PathVariable String username,
            @RequestParam(defaultValue = "3") int months) {
        return service.games(username, Math.max(1, Math.min(months, 12)));
    }
}
