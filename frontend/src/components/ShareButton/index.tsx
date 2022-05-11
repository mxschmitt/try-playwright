import { useEffect, useContext } from 'react'
import { IconButton, Notification, toaster } from 'rsuite'
import ShareIcon from '@rsuite/icons/ShareOutline';
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
                    toaster.push(
                        <Notification type="error" header="info">
                            You are rate limited, please try again in a few minutes.
                        </Notification>
                    );
                    return
                }
                toaster.push(
                    <Notification type="error" header="info">
                        Creating of a Share link was not successful
                    </Notification>
                );
                return
            }
            const body = await resp.json()
            urlParams.set("s", body?.key)
        } else {
            urlParams.set("e", example.id)
        }
        const newURL = pushNewURL(urlParams)
        navigator.clipboard.writeText(newURL)
            .then(() => {
                toaster.push(
                    <Notification type="success" header="info">
                        Successfully copied link to the clipboard
                    </Notification>
                );
            })
            .catch(() => {
                toaster.push(
                    <Notification type="error" header="info">
                        Failed to copy link to the clipboard
                    </Notification>
                );
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
    return (<IconButton className={styles.iconButton} onClick={handleOnClick} icon={<ShareIcon />}>
        Share
    </IconButton>)
}

export default ShareButton
