import React from 'react';
import ReactDOM from 'react-dom/client';
import { PopupRoot } from '@/components/popup/PopupRoot';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupRoot />
  </React.StrictMode>
);
