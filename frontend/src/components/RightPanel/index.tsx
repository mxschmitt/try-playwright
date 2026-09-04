import { useContext } from 'react'
import { Box, Button, HStack, Panel } from 'rsuite'

import ShareButton from '../ShareButton'

import RightOutputPanel from './RightOutputPanel'
import RightExamplesPanel from './RightExamplesPanel'
import { CodeContext } from '../CodeContext'

import type { ExecutionResponse } from '../../utils'

interface RightPanelProps {
    resp: ExecutionResponse | null;
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
            flex={1}
            minh={0}
            w="100%"
            display="flex"
            direction="column"
            overflow="hidden"
            bodyProps={{ style: { flex: 1, minHeight: 0, overflow: 'auto' } }}
            header={
                <HStack justify="space-between" align="center" w="100%" spacing={10}>
                    <span>{getHeaderText(!rightPanelMode)}</span>
                    <HStack spacing={10} align="center">
                        <Button onClick={handleShowExamplesClick} data-test-id="toggel-right-panel">
                            Show {getHeaderText(rightPanelMode)}
                        </Button>
                        <ShareButton />
                    </HStack>
                </HStack>
            }
        >
            <Box py={5} data-testid='right-panel'>
                {rightPanelMode ? <RightExamplesPanel /> : <RightOutputPanel resp={resp} />}
            </Box>
        </Panel>
    )
}

export default RightPanel
