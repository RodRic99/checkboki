package com.chessreview.analysis;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.assertj.core.api.Assertions.assertThat;

class AnalysisServiceTest {
    // 실제 PC의 Stockfish 설치 여부와 무관하게 테스트하도록 JUnit 임시 폴더를 사용한다.
    @TempDir Path tempDir;

    @Test void reportsConfiguredEngineAsAvailable() throws IOException {
        // available()은 엔진을 실행하지 않고 설정 경로에 파일이 있는지만 검사한다.
        Path executable = Files.createFile(tempDir.resolve("stockfish.exe"));
        var stockfish = new StockfishService(executable.toString(), 12);
        assertThat(stockfish.available()).isTrue();
    }
}
