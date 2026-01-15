import { useState, useEffect, useContext } from 'react'
import { PanelGroup, Panel } from 'rsuite'

import { determineCode, pushNewURL } from '../../../utils'
import { CodeContext } from '../../CodeContext'

import styles from './index.module.css'

const RightExamplesPanel: React.FunctionComponent = () => {
    const [expandedID, setExpandedId] = useState<string>()
    const { onChange, examples } = useContext(CodeContext)
    // Try to find the matching example and set it to expanded
    useEffect(() => {
        determineCode((code) => {
            const example = examples.find(example => example.code === code)
            if (example) {
                setExpandedId(example.id)
            }
        }, examples)
    }, [setExpandedId, examples])
    const handleOnSelect = (eventKey: string | number | undefined): void => {
        if (!eventKey)
            return;
        setExpandedId(eventKey as string)
        const params = new URLSearchParams(window.location.search)
        params.set("e", String(eventKey))
        params.delete("s")
        pushNewURL(params)

        const example = examples.find(example => example.id === eventKey)
        if (example) {
            onChange(example.code)
        }
    }
    return (
        <>
            <PanelGroup accordion bordered onSelect={handleOnSelect}>
                {examples?.map((example, idx) => <Panel key={example.id} eventKey={example.id} header={<>
                    <a className={styles.exampleLink} href={`/?e=${example.id}`} onClick={(e: React.MouseEvent): void => e.preventDefault()}>
                        {example.title}
                    </a>
                </>} expanded={example.id === expandedID}>
                    <p>{example.description}</p>
                </Panel>
                )}
            </PanelGroup>
        </>
    )
}

export default RightExamplesPanel