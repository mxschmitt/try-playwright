import { useEffect, useContext } from 'react'
import { IconButton, Icon, Notification } from 'rsuite'
import * as clipboard from 'clipboard-polyfill'
import { CodeContext } from '../CodeContext'
import styles from './index.module.css'
import { pushNewURL } from '../../utils'

const ShareButton: React.FunctionComponent = () => {
    const { code, codeLanguage, examples } = useContext(CodeContext)
    const handleOnClick = async (): Promise<void> => {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.delete("e")
        urlParams.delete("s")
        urlParams.set("l", codeLanguage)
        // if there is a example existing with the same code, then use this
        const example = examples.find(example => example.code === code)
        if (!example) {
            const resp = await fetch("/service/control/share/create", {
                method: "POST",
                body: code,
            })
            if (!resp.ok) {
                if (resp.status === 429) {
                    Notification.error({
                        title: "You are rate limited, please try again in a few minutes."
                    })
                    return
                }
                Notification.error({
                    title: "Creating of a Share link was not successful",
                });
                return
            }
            const body = await resp.json()
            urlParams.set("s", body?.key)
        } else {
            urlParams.set("e", example.id)
        }
        const newURL = pushNewURL(urlParams)
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
        let processingKeyboardEvent = false
        const keyupHandler = (e: KeyboardEvent) => {
             processingKeyboardEvent = false
        }
        const keydownHandler = (e: KeyboardEvent): void => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                if (!processingKeyboardEvent) {
                    handleOnClick()
                    processingKeyboardEvent = true
                }
            }
        }
        window.addEventListener("keydown", keydownHandler);
        window.addEventListener("keyup", keyupHandler);
        return (): void => {
            window.removeEventListener("keydown", keydownHandler)
            window.removeEventListener("keyup", keyupHandler)
        }
    })
    return (<IconButton className={styles.iconButton} onClick={handleOnClick} icon={<Icon icon="share" />}>
        Share
    </IconButton>)
}

export default ShareButton
