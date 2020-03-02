import React from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/browser';

import 'rsuite/dist/styles/rsuite-default.css'

import App from './App';

if (process.env.NODE_ENV === "production") {
    Sentry.init({
        dsn: "https://4140ec4f2db74957926f7df6c98ec331@sentry.io/3480803",
        environment: window.location.hostname,
    });
}

ReactDOM.render(<App />, document.getElementById('root'));
