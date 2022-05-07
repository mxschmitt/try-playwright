import React from 'react'
import type { ExecutionResponse } from '../../../utils';

import ResponseFile from '../../ResponseFile'

import styles from './index.module.css'

interface RightOutputPanelProps {
    resp: ExecutionResponse | null;
}

const RightOutputPanel: React.FunctionComponent<RightOutputPanelProps> = ({ resp }) => {
    return (
        <>
            {resp && <>
                {resp.error && <>
                    <h4>Error</h4>
                    <pre>
                        {resp.error}
                    </pre>
                </>}

                {resp.output && <>
                    {resp.output.length > 0 && <h4>Logs</h4>}
                    <code className={styles.logsWrapper}>
                    {resp.output.split("\n").map((entry, idx) => <React.Fragment key={idx}>
                        {entry}
                        <br />
                    </React.Fragment>)}
                    </code>
                </>}

                {resp.files && <>
                    {resp.files.length > 0 && <h4>Files</h4>}
                    {resp.files.map((file, idx) => <ResponseFile file={file} key={idx} />)}
                </>}

                {resp.success && <>
                    <p>Duration of {resp.duration} ms with Playwright version {resp.version}.</p>
                </>}
            </>}
        </>
    )
}

export default RightOutputPanel