import React, { CSSProperties } from 'react'
import { IconButton, Icon, Notification } from 'rsuite'
import clipboard from 'clipboard-polyfill'

import { encodeCode } from '../utils';

interface ShareButtonProps {
    code: string;
    style: CSSProperties;
}

const ShareButton: React.FunctionComponent<ShareButtonProps> = ({ code, style }) => {
    const handleOnClick = (): void => {
        const encodedCode = encodeCode(code)
        const newURL = `${window.location.origin}${window.location.pathname}?code=${encodedCode}`
        window.history.pushState(null, "Try Playwright", newURL)
        clipboard.writeText(newURL)
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
    return (<IconButton style={style} onClick={handleOnClick} icon={<Icon icon="share" />}>
        Share
    </IconButton>)
}

export default ShareButton