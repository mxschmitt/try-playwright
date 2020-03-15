import React, { CSSProperties, useEffect } from 'react'
import { IconButton, Icon, Notification } from 'rsuite'
import clipboard from 'clipboard-polyfill'

interface ShareButtonProps {
    code: string;
    style: CSSProperties;
}

const ShareButton: React.FunctionComponent<ShareButtonProps> = ({ code, style }) => {
    const handleOnClick = async (): Promise<void> => {
        const resp = await fetch("/api/v1/share/create", {
            method:"POST",
            body: JSON.stringify({
                code
            }),
            headers: {
                "Content-Type": "application/json"
            }
        })
        if (!resp.ok) {
            Notification.error({
                title: "Creating of a Share link was not successfull",
            });
        }
        const body = await resp.json()
        const newURL = `${window.location.origin}${window.location.pathname}?s=${body?.key}`
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
    useEffect(() => {
        const handler = function (e: KeyboardEvent): void {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                handleOnClick()
            }
        }
        window.addEventListener("keydown", handler);
        return (): void => window.removeEventListener("keydown", handler)
    })
    return (<IconButton style={style} onClick={handleOnClick} icon={<Icon icon="share" />}>
        Share
    </IconButton>)
}

export default ShareButton
