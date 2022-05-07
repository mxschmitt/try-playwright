import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/browser';
import 'rsuite/dist/rsuite.min.css';
import App from './components/App';
import CodeContextProvider from './components/CodeContext';

if (process.env.NODE_ENV === "production" && window.location.hostname !== "localhost") {
    Sentry.init({
        dsn: "https://4140ec4f2db74957926f7df6c98ec331@sentry.io/3480803",
        environment: window.location.hostname,
    });
}

ReactDOM.createRoot(document.getElementById('app')!).render(<CodeContextProvider>
    <App />
</CodeContextProvider>);
