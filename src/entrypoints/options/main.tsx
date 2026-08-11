import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsRoot } from '@/components/settings/SettingsRoot';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsRoot />
  </React.StrictMode>
);
