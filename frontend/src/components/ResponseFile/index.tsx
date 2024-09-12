import React from 'react'
import type { FileWrapper } from '../../utils';

import styles from './index.module.css'

interface ResponseFileProps {
    file: FileWrapper;
}

const ResponseFile: React.FunctionComponent<ResponseFileProps> = ({ file }) => {
    const { publicURL, fileName, extension } = file
    if (extension === ".pdf") {
        return <object type="application/pdf" data={publicURL} className={styles.pdfFile} >
            {fileName}
        </object>
    }
    if (extension === ".mp4") {
        return <video autoPlay muted className={styles.video} controls loop>
            <source src={publicURL} type="video/mp4" />
        </video>
    }
    if (extension === ".webm") {
        return <video autoPlay muted className={styles.video} controls loop>
            <source src={publicURL} type="video/webm" />
        </video>
    }
    if (extension === ".zip") {
        const traceViewerURL = `https://trace.playwright.dev/?trace=${encodeURIComponent(new URL(publicURL, window.location.href).toString())}`
        return <span>
                &nbsp;-&nbsp;
                <a href={traceViewerURL} target="_blank" rel="noreferrer" className={styles.zipFile}>
                Open in Trace Viewer
            </a>
        </span>
    }
    return <img src={publicURL} alt={fileName} className={styles.image} />
}

const ResponseFileWrapper: React.FunctionComponent<ResponseFileProps> = ({ file }) => {
    return <p className={styles.responseFile} data-test-id="file">
        <span className="file-name">{file.fileName}</span>
        <ResponseFile file={file} />
    </p>
}

export default ResponseFileWrapper