import React from 'react'
import { Panel } from 'rsuite'


import ResponseFile from '../ResponseFile'
import ShareButton from '../ShareButton'

interface RightPanelProps {
    resp: APIResponse | null;
    code: string;
}

const RightPanel: React.FunctionComponent<RightPanelProps> = ({ resp, code }) => {

    return (
        <Panel
            bodyFill
            header={
                <>
                    Output <ShareButton code={code} style={{ float: "right" }} />
                </>
            }
        >
            {resp && <>
                {resp.logs.length > 0 && <h4>Logs</h4>}
                <code style={{ wordBreak: "break-all" }}>{resp.logs.map((entry, idx) => <React.Fragment key={idx}>
                    {entry.args.join(" ")}
                    <br />
                </React.Fragment>)}</code>
                {resp.files.length > 0 && <h4>Files</h4>}
                {resp.files.map((file, idx) => <ResponseFile file={file} key={idx} />)}
                <p>Duration of {resp.duration} ms with Playwright version {resp.version.replace(/[\^|=]/, "")}.</p>
            </>}
        </Panel>
    )
}

export default RightPanel