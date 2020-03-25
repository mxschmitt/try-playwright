import React, { useContext } from 'react'
import { Panel, Button } from 'rsuite'

import ShareButton from '../ShareButton'

import RightOutputPanel from './RightOutputPanel'
import RightExamplesPanel from './RightExamplesPanel'
import { CodeContext } from '../CodeContext'

interface RightPanelProps {
    resp: APIResponse | null;
}

const getHeaderText = (mode: boolean): string => {
    return mode ? "Output" : "Examples"
}

const RightPanel: React.FunctionComponent<RightPanelProps> = ({ resp }) => {
    const { rightPanelMode, onChangeRightPanelMode } = useContext(CodeContext)
    const handleShowExamplesClick = (): void => onChangeRightPanelMode(!rightPanelMode)

    return (
        <Panel
            bodyFill
            header={
                <>
                    {getHeaderText(!rightPanelMode)}
                    <ShareButton  style={{ float: "right" }} />
                    <Button onClick={handleShowExamplesClick} style={{ float: "right", marginRight: 10 }} data-test-id="toggel-right-panel">Show {getHeaderText(rightPanelMode)}</Button>
                </>
            }
        >
            <div style={{ padding: 5 }}>
                {rightPanelMode ? <RightExamplesPanel /> : <RightOutputPanel resp={resp} />}
            </div>
        </Panel>
    )
}

export default RightPanel