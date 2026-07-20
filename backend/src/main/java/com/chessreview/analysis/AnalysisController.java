package com.chessreview.analysis;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/analysis")
@CrossOrigin(originPatterns = "*")
public class AnalysisController {
    private final AnalysisService service;
    private final StockfishService stockfish;
    public AnalysisController(AnalysisService service, StockfishService stockfish) { this.service = service; this.stockfish = stockfish; }
    /** 전체 수순을 동기 분석한다. 분석량 제한과 엔진 오류 처리는 서비스 계층에서 담당한다. */
    @PostMapping
    public AnalysisDtos.Response analyze(@Valid @RequestBody AnalysisDtos.Request request) {
        return service.analyze(request.moves());
    }
    /** UI가 분석 전에 Stockfish 설치 여부를 확인할 수 있는 가벼운 상태 API다. */
    @GetMapping("/engine")
    public AnalysisDtos.EngineStatus engine() {
        boolean available = stockfish.available();
        return new AnalysisDtos.EngineStatus(available, available ? "Stockfish 사용 가능" : "STOCKFISH_PATH 설정 필요");
    }
}
