import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// index.html의 #root에 React 애플리케이션을 마운트하는 프런트엔드 진입점이다.
// StrictMode는 개발 중 잘못된 부수 효과와 오래된 React 사용 방식을 더 일찍 발견하게 해 준다.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
