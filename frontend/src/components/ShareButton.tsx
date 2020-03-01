import React, { CSSProperties } from 'react'
import { Button, Notification } from 'rsuite'

import { encodeCode } from '../utils';

interface ShareButtonProps {
    code: string
    style: CSSProperties
}

const ShareButton: React.FunctionComponent<ShareButtonProps> = ({ code, style }) => {
    const handleOnClick = () => {
        const encodedCode = encodeCode(code)
        const newURL = `${window.location.origin}${window.location.pathname}?code=${encodedCode}`
        window.history.pushState(null, "Playwright Playground", newURL)
        navigator.clipboard.writeText(newURL)
            .then(() => {
                Notification.success({
                    title: "Successfully copied link to the clipboard",
                });
            })
            .catch(() => {
                Notification.error({
                    title: "Failed to copy link to the clipboard",
                });
            })
    }
    return (<Button style={style} onClick={handleOnClick}>
        Share
    </Button>)
}

export default ShareButton