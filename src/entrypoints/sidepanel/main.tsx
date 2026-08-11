import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidePanelRoot } from '@/components/sidepanel/SidePanelRoot';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanelRoot />
  </React.StrictMode>
);
