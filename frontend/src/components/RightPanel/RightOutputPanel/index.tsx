import React from 'react'

import ResponseFile from '../../ResponseFile'

import styles from './index.module.css'

interface RightOutputPanelProps {
    resp: SuccessExecutionResponse | null;
    error: string | null
}

const RightOutputPanel: React.FunctionComponent<RightOutputPanelProps> = ({ resp, error }) => {
    return (
        <>
            {!error && resp && <>
                {resp.output.length > 0 && <h4>Logs</h4>}
                <code className={styles.logsWrapper}>{resp.output.split("\n").map((entry, idx) => <React.Fragment key={idx}>
                    {entry}
                    <br />
                </React.Fragment>)}</code>
                {resp.files.length > 0 && <h4>Files</h4>}
                {resp.files.map((file, idx) => <ResponseFile file={file} key={idx} />)}
                <p>Duration of {resp.duration} ms with Playwright version {resp.version}.</p>
            </>}
            {error && <>
                <h4>Error</h4>
                <pre>
                    {error}
                </pre>
            </>}
        </>
    )
}

export default RightOutputPanel