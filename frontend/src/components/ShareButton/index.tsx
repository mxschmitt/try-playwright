import React, { useEffect, useContext } from 'react'
import { IconButton, Icon, Notification } from 'rsuite'
import * as clipboard from 'clipboard-polyfill'
import { CodeContext } from '../CodeContext'
import { Examples } from '../../constants'
import styles from './index.module.css'

const ShareButton: React.FunctionComponent = () => {
    const { code } = useContext(CodeContext)
    const handleOnClick = async (): Promise<void> => {
        let path = ""
        // if there is a example existing with the same code, then use this
        const example = Examples.find(example => example.code === code)
        if (!example) {
            const resp = await fetch("/service/control/share/create", {
                method: "POST",
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
            path = `s=${body?.key}`
        } else {
            path = `e=${example.id}`
        }

        const newURL = `${window.location.origin}${window.location.pathname}?${path}`
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
    return (<IconButton className={styles.iconButton} onClick={handleOnClick} icon={<Icon icon="share" />}>
        Share
    </IconButton>)
}

export default ShareButton
