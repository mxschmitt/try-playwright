import React from 'react'

import ResponseFile from '../../ResponseFile'

import styles from './index.module.css'

interface RightOutputPanelProps {
    resp: APIResponse | null;
}

const RightOutputPanel: React.FunctionComponent<RightOutputPanelProps> = ({ resp }) => {
    return (
        <>
            {resp && <>
                {resp.logs.length > 0 && <h4>Logs</h4>}
                <code className={styles.logsWrapper}>{resp.logs.map((entry, idx) => <React.Fragment key={idx}>
                    {entry.args.join(" ")}
                    <br />
                </React.Fragment>)}</code>
                {resp.files.length > 0 && <h4>Files</h4>}
                {resp.files.map((file, idx) => <ResponseFile file={file} key={idx} />)}
                <p>Duration of {resp.duration} ms with Playwright version {resp.version.replace(/[\^|=]/, "")}.</p>
            </>}
        </>
    )
}

export default RightOutputPanel