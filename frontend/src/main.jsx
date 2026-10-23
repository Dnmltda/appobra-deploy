import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { prepararInstalacao } from '@/lib/instalarApp.js';

prepararInstalacao();

ReactDOM.createRoot(document.getElementById('root')).render(
	<App />
);