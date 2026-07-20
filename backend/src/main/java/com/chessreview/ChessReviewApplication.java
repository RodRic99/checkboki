package com.chessreview;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ChessReviewApplication {
    /** Spring의 내장 웹 서버를 시작하고 @Service/@RestController 빈을 자동 등록하는 백엔드 진입점이다. */
    public static void main(String[] args) { SpringApplication.run(ChessReviewApplication.class, args); }
}
