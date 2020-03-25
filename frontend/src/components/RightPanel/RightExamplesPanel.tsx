import React, { useState, useEffect, useContext } from 'react'
import { PanelGroup, Panel } from 'rsuite'

import { Examples } from '../../constants'
import { determineCode } from '../../utils'
import { CodeContext } from '../CodeContext'

const RightExamplesPanel: React.FunctionComponent = () => {
    const [expandedID, setExpandedId] = useState<string>(Examples[0].id)
    const { onChange } = useContext(CodeContext)
    useEffect(() => {
        determineCode((code) => {
            const example = Examples.find(example => example.code === code)
            if (example) {
                setExpandedId(example.id)
            }
        })
    }, [setExpandedId])
    const handleOnSelect = (eventKey: string): void => {
        const newURL = `${window.location.origin}${window.location.pathname}?e=${eventKey}`
        window.history.pushState(null, "Try Playwright", newURL)

        const example = Examples.find(example => example.id === eventKey)
        if (example) {
            onChange(example.code)
        }
    }
    return (
        <>
            <PanelGroup accordion bordered onSelect={handleOnSelect}>
                {Examples.map((example, idx) => <Panel key={example.id} eventKey={example.id} header={example.title} expanded={example.id === expandedID}>
                    <p>{example.description}</p>
                </Panel>
                )}
            </PanelGroup>
        </>
    )
}

export default RightExamplesPanel