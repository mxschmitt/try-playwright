import React from 'react'
import { Dropdown } from 'rsuite'

import { Example } from '../constants'

interface ExampleWrapperProps {
    example: Example;
    index: number;
    onSelect?: () => void;
}

const ExampleWrapper: React.FunctionComponent<ExampleWrapperProps> = ({ example, index, onSelect }) => {
    return <Dropdown.Item onSelect={onSelect} title={example.description} eventKey={index}>{example.title}</Dropdown.Item>
}

export default ExampleWrapper